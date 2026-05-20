from __future__ import annotations

import hmac
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload
from starlette.middleware.sessions import SessionMiddleware

from app.config import Settings
from app.database import configure_database, get_db, init_db
from app.models import OperationLog, StegoFile, User
from app.security import hash_password, new_token, safe_filename, verify_password
from app.services.files import FileServiceError, ensure_data_dirs, read_upload, save_stego_file, sha256_digest
from app.services.logging import log_operation
from app.services.steganography import (
    CapacityError,
    InvalidPasswordError,
    NoHiddenDataError,
    PasswordRequiredError,
    SteganographyError,
    UnsupportedImageError,
    embed_secret_in_cover,
    extract_secret_from_image,
)

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    ensure_data_dirs(settings)
    configure_database(settings.database_url)
    init_db()

    app = FastAPI(title=settings.app_name)
    app.state.settings = settings
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.secret_key,
        same_site="lax",
        https_only=False,
        max_age=60 * 60 * 8,
    )
    app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
    register_routes(app)
    return app


def register_routes(app: FastAPI) -> None:
    @app.get("/")
    def index(request: Request, db: Session = Depends(get_db)) -> Response:
        user = get_current_user(request, db)
        if user:
            return redirect("/dashboard")
        return render(request, "landing.html", {"title": "Secure Steganography"})

    @app.get("/register")
    def register_form(request: Request, db: Session = Depends(get_db)) -> Response:
        if get_current_user(request, db):
            return redirect("/dashboard")
        return render(request, "register.html", {"title": "Register"})

    @app.post("/register")
    def register_user(
        request: Request,
        username: Annotated[str, Form()],
        email: Annotated[str, Form()],
        password: Annotated[str, Form()],
        confirm_password: Annotated[str, Form()],
        csrf_token: Annotated[str, Form()],
        db: Session = Depends(get_db),
    ) -> Response:
        verify_csrf(request, csrf_token)
        username = username.strip()
        email = email.strip().lower()
        if len(username) < 3 or len(password) < 8 or password != confirm_password:
            return render(
                request,
                "register.html",
                {"title": "Register", "error": "Use a 3+ character username, matching 8+ character passwords."},
                status_code=400,
            )
        existing = db.scalar(select(User).where((User.username == username) | (User.email == email)))
        if existing:
            return render(
                request,
                "register.html",
                {"title": "Register", "error": "Username or email is already registered."},
                status_code=400,
            )

        user = User(username=username, email=email, password_hash=hash_password(password), role="user", status="active")
        db.add(user)
        db.flush()
        log_operation(db, user_id=user.user_id, operation_type="Register", operation_status="Success", message="User registered.")
        db.commit()
        request.session["user_id"] = user.user_id
        return redirect("/dashboard")

    @app.get("/login")
    def login_form(request: Request, db: Session = Depends(get_db)) -> Response:
        if get_current_user(request, db):
            return redirect("/dashboard")
        return render(request, "login.html", {"title": "Login"})

    @app.post("/login")
    def login_user(
        request: Request,
        username: Annotated[str, Form()],
        password: Annotated[str, Form()],
        csrf_token: Annotated[str, Form()],
        db: Session = Depends(get_db),
    ) -> Response:
        verify_csrf(request, csrf_token)
        user = db.scalar(select(User).where(User.username == username.strip()))
        if not user or not verify_password(password, user.password_hash):
            log_operation(db, user_id=user.user_id if user else None, operation_type="Login", operation_status="Failed", message="Invalid credentials.")
            db.commit()
            return render(request, "login.html", {"title": "Login", "error": "Invalid username or password."}, status_code=401)
        if not user.is_active:
            log_operation(db, user_id=user.user_id, operation_type="Login", operation_status="Failed", message="Blocked or inactive account.")
            db.commit()
            return render(request, "login.html", {"title": "Login", "error": "This account is not active."}, status_code=403)

        request.session["user_id"] = user.user_id
        log_operation(db, user_id=user.user_id, operation_type="Login", operation_status="Success", message="User logged in.")
        db.commit()
        return redirect("/dashboard")

    @app.post("/logout")
    def logout(request: Request, csrf_token: Annotated[str, Form()]) -> Response:
        verify_csrf(request, csrf_token)
        request.session.clear()
        return redirect("/login")

    @app.get("/dashboard")
    def dashboard(request: Request, db: Session = Depends(get_db)) -> Response:
        user = require_user(request, db)
        files = db.scalars(
            select(StegoFile).where(StegoFile.user_id == user.user_id).order_by(StegoFile.created_at.desc())
        ).all()
        recent_logs = db.scalars(
            select(OperationLog)
            .where(OperationLog.user_id == user.user_id)
            .order_by(OperationLog.created_at.desc())
            .limit(8)
        ).all()
        return render(
            request,
            "dashboard.html",
            {"title": "Dashboard", "current_user": user, "files": files, "recent_logs": recent_logs},
        )

    @app.get("/embed")
    def embed_form(request: Request, db: Session = Depends(get_db)) -> Response:
        user = require_user(request, db)
        return render(request, "embed.html", {"title": "Embed", "current_user": user})

    @app.post("/embed")
    def embed_secret(
        request: Request,
        cover_file: Annotated[UploadFile, File()],
        secret_text: Annotated[str, Form()] = "",
        stego_password: Annotated[str, Form()] = "",
        csrf_token: Annotated[str, Form()] = "",
        secret_file: Annotated[UploadFile | None, File()] = None,
        db: Session = Depends(get_db),
    ) -> Response:
        user = require_user(request, db)
        verify_csrf(request, csrf_token)
        try:
            cover_bytes = read_upload(cover_file, request.app.state.settings.max_upload_bytes)
            payload_kind, payload_data, payload_filename, content_type = choose_payload(secret_text, secret_file, request.app.state.settings.max_upload_bytes)
            stego_bytes = embed_secret_in_cover(
                cover_bytes,
                cover_file.filename or "cover.png",
                secret_data=payload_data,
                payload_kind=payload_kind,
                payload_filename=payload_filename,
                content_type=content_type,
                password=stego_password.strip() or None,
            )
            saved_path, generated_name = save_stego_file(request.app.state.settings, stego_bytes, cover_file.filename or "cover.png")
            stego_record = StegoFile(
                user_id=user.user_id,
                cover_file_name=safe_filename(cover_file.filename, "cover"),
                stego_file_name=generated_name,
                file_type="image/png",
                file_size=len(stego_bytes),
                storage_path=str(saved_path),
                sha256=sha256_digest(stego_bytes),
                password_protected=bool(stego_password.strip()),
            )
            db.add(stego_record)
            db.flush()
            log_operation(
                db,
                user_id=user.user_id,
                stego_file_id=stego_record.stego_file_id,
                operation_type="Embed",
                operation_status="Success",
                message=f"Created stego file {generated_name}.",
            )
            db.commit()
            return redirect(f"/dashboard?created={stego_record.stego_file_id}")
        except (FileServiceError, SteganographyError) as exc:
            log_operation(db, user_id=user.user_id, operation_type="Embed", operation_status="Failed", message=str(exc))
            db.commit()
            return render(
                request,
                "embed.html",
                {"title": "Embed", "current_user": user, "error": str(exc)},
                status_code=400,
            )

    @app.get("/files/{stego_file_id}/download")
    def download_stego(stego_file_id: int, request: Request, db: Session = Depends(get_db)) -> Response:
        user = require_user(request, db)
        stego_file = db.get(StegoFile, stego_file_id)
        if not stego_file or (stego_file.user_id != user.user_id and not user.is_admin):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        path = Path(stego_file.storage_path)
        if not path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file was not found.")
        return FileResponse(path, media_type="image/png", filename=stego_file.stego_file_name)

    @app.get("/extract")
    def extract_form(request: Request, db: Session = Depends(get_db)) -> Response:
        user = require_user(request, db)
        return render(request, "extract.html", {"title": "Extract", "current_user": user})

    @app.post("/extract")
    def extract_secret(
        request: Request,
        stego_file: Annotated[UploadFile, File()],
        stego_password: Annotated[str, Form()] = "",
        csrf_token: Annotated[str, Form()] = "",
        db: Session = Depends(get_db),
    ) -> Response:
        user = require_user(request, db)
        verify_csrf(request, csrf_token)
        matched_stego_id: int | None = None
        try:
            stego_bytes = read_upload(stego_file, request.app.state.settings.max_upload_bytes)
            matched = db.scalar(select(StegoFile).where(StegoFile.sha256 == sha256_digest(stego_bytes)))
            matched_stego_id = matched.stego_file_id if matched else None
            payload = extract_secret_from_image(stego_bytes, password=stego_password.strip() or None)
            log_operation(
                db,
                user_id=user.user_id,
                stego_file_id=matched_stego_id,
                operation_type="Extract",
                operation_status="Success",
                message="Hidden payload extracted.",
            )
            db.commit()
            if payload.kind == "file":
                filename = safe_filename(payload.filename, "extracted-secret.bin")
                return StreamingResponse(
                    iter([payload.data]),
                    media_type=payload.content_type,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'},
                )
            text = payload.data.decode("utf-8", errors="replace")
            return render(
                request,
                "extract.html",
                {"title": "Extract", "current_user": user, "extracted_text": text, "success": "Hidden text extracted."},
            )
        except PasswordRequiredError as exc:
            return extraction_error(request, db, user, str(exc), matched_stego_id, "Access Denied")
        except InvalidPasswordError as exc:
            return extraction_error(request, db, user, str(exc), matched_stego_id, "Access Denied")
        except (FileServiceError, UnsupportedImageError, CapacityError, NoHiddenDataError, SteganographyError) as exc:
            return extraction_error(request, db, user, str(exc), matched_stego_id, "Failed")

    @app.get("/admin/users")
    def admin_users(request: Request, db: Session = Depends(get_db)) -> Response:
        user = require_admin(request, db)
        users = db.scalars(select(User).order_by(User.created_at.desc())).all()
        return render(request, "admin_users.html", {"title": "Users", "current_user": user, "users": users})

    @app.post("/admin/users/{user_id}/status")
    def update_user_status(
        user_id: int,
        request: Request,
        new_status: Annotated[str, Form(alias="status")],
        csrf_token: Annotated[str, Form()],
        db: Session = Depends(get_db),
    ) -> Response:
        admin = require_admin(request, db)
        verify_csrf(request, csrf_token)
        if new_status not in {"active", "blocked", "inactive"}:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST)
        target = db.get(User, user_id)
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if target.user_id == admin.user_id and new_status != "active":
            users = db.scalars(select(User).order_by(User.created_at.desc())).all()
            return render(
                request,
                "admin_users.html",
                {"title": "Users", "current_user": admin, "users": users, "error": "You cannot disable your own admin account."},
                status_code=400,
            )
        target.status = new_status
        log_operation(
            db,
            user_id=admin.user_id,
            operation_type="Admin Update",
            operation_status="Success",
            message=f"Set user {target.username} status to {new_status}.",
        )
        db.commit()
        return redirect("/admin/users")

    @app.get("/admin/logs")
    def admin_logs(request: Request, db: Session = Depends(get_db)) -> Response:
        user = require_admin(request, db)
        logs = db.scalars(
            select(OperationLog)
            .options(joinedload(OperationLog.user), joinedload(OperationLog.stego_file))
            .order_by(OperationLog.created_at.desc())
            .limit(200)
        ).all()
        return render(request, "admin_logs.html", {"title": "Logs", "current_user": user, "logs": logs})


def choose_payload(secret_text: str, secret_file: UploadFile | None, max_bytes: int) -> tuple[str, bytes, str | None, str]:
    has_text = bool(secret_text.strip())
    has_file = bool(secret_file and secret_file.filename)
    if has_text == has_file:
        raise FileServiceError("Provide either secret text or one secret file.")
    if has_text:
        return "text", secret_text.encode("utf-8"), None, "text/plain; charset=utf-8"
    assert secret_file is not None
    data = read_upload(secret_file, max_bytes)
    return "file", data, safe_filename(secret_file.filename, "secret-file"), secret_file.content_type or "application/octet-stream"


def extraction_error(
    request: Request,
    db: Session,
    user: User,
    message: str,
    stego_file_id: int | None,
    status_text: str,
) -> Response:
    log_operation(
        db,
        user_id=user.user_id,
        stego_file_id=stego_file_id,
        operation_type="Extract",
        operation_status=status_text,
        message=message,
    )
    db.commit()
    return render(
        request,
        "extract.html",
        {"title": "Extract", "current_user": user, "error": message},
        status_code=400,
    )


def get_current_user(request: Request, db: Session) -> User | None:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    user = db.get(User, user_id)
    if not user or not user.is_active:
        request.session.clear()
        return None
    return user


def require_user(request: Request, db: Session) -> User:
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_303_SEE_OTHER,
            headers={"Location": "/login"},
        )
    return user


def require_admin(request: Request, db: Session) -> User:
    user = require_user(request, db)
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return user


def get_csrf_token(request: Request) -> str:
    token = request.session.get("csrf_token")
    if not token:
        token = new_token()
        request.session["csrf_token"] = token
    return token


def verify_csrf(request: Request, submitted_token: str) -> None:
    expected = request.session.get("csrf_token")
    if not expected or not hmac.compare_digest(str(expected), str(submitted_token)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid form token.")


def render(request: Request, template_name: str, context: dict | None = None, status_code: int = 200) -> Response:
    context = dict(context or {})
    context.setdefault("csrf_token", get_csrf_token(request))
    context.setdefault("current_user", None)
    context.setdefault("request", request)
    return templates.TemplateResponse(request, template_name, context, status_code=status_code)


def redirect(url: str) -> RedirectResponse:
    return RedirectResponse(url=url, status_code=status.HTTP_303_SEE_OTHER)


app = create_app()

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import get_session_factory
from app.models import OperationLog, StegoFile, User
from tests.conftest import create_admin, csrf_token, image_bytes, login_user, register_user


def test_public_landing_page_and_authenticated_root_redirect(test_client: TestClient) -> None:
    response = test_client.get("/")
    assert response.status_code == 200
    assert "Hide confidential data" in response.text
    assert "Create Account" in response.text
    assert "data-theme-toggle" in response.text

    register_user(test_client)
    response = test_client.get("/", follow_redirects=False)
    assert response.status_code == 303
    assert response.headers["location"] == "/dashboard"


def test_register_embed_download_and_extract_text(test_client: TestClient) -> None:
    register_user(test_client)
    response = test_client.get("/embed")
    token = csrf_token(response)

    response = test_client.post(
        "/embed",
        data={"csrf_token": token, "secret_text": "classified text", "stego_password": "extract-key"},
        files={"cover_file": ("cover.png", image_bytes(), "image/png")},
        follow_redirects=False,
    )

    assert response.status_code == 303
    db = get_session_factory()()
    try:
        stego = db.scalar(select(StegoFile))
        assert stego is not None
        stego_bytes = Path(stego.storage_path).read_bytes()
    finally:
        db.close()

    download = test_client.get(f"/files/{stego.stego_file_id}/download")
    assert download.status_code == 200
    assert download.content == stego_bytes

    response = test_client.get("/extract")
    token = csrf_token(response)
    response = test_client.post(
        "/extract",
        data={"csrf_token": token, "stego_password": "extract-key"},
        files={"stego_file": ("stego.png", stego_bytes, "image/png")},
    )

    assert response.status_code == 200
    assert "classified text" in response.text


def test_wrong_extraction_password_is_logged(test_client: TestClient) -> None:
    register_user(test_client)
    token = csrf_token(test_client.get("/embed"))
    response = test_client.post(
        "/embed",
        data={"csrf_token": token, "secret_text": "private", "stego_password": "correct"},
        files={"cover_file": ("cover.png", image_bytes(), "image/png")},
        follow_redirects=False,
    )
    assert response.status_code == 303

    db = get_session_factory()()
    try:
        stego = db.scalar(select(StegoFile))
        stego_bytes = Path(stego.storage_path).read_bytes()
    finally:
        db.close()

    token = csrf_token(test_client.get("/extract"))
    response = test_client.post(
        "/extract",
        data={"csrf_token": token, "stego_password": "wrong"},
        files={"stego_file": ("stego.png", stego_bytes, "image/png")},
    )

    assert response.status_code == 400
    assert "password is incorrect" in response.text
    db = get_session_factory()()
    try:
        log = db.scalar(
            select(OperationLog)
            .where(OperationLog.operation_type == "Extract")
            .order_by(OperationLog.created_at.desc())
        )
        assert log is not None
        assert log.operation_status == "Access Denied"
    finally:
        db.close()


def test_admin_can_manage_user_access_and_view_logs(test_client: TestClient) -> None:
    register_user(test_client, username="bob")
    create_admin()

    test_client.cookies.clear()
    login_user(test_client, username="admin")
    response = test_client.get("/admin/users")
    assert response.status_code == 200
    assert "bob@example.com" in response.text

    db = get_session_factory()()
    try:
        bob = db.scalar(select(User).where(User.username == "bob"))
        assert bob is not None
        bob_id = bob.user_id
    finally:
        db.close()

    token = csrf_token(response)
    response = test_client.post(
        f"/admin/users/{bob_id}/status",
        data={"csrf_token": token, "status": "blocked"},
        follow_redirects=False,
    )
    assert response.status_code == 303

    response = test_client.get("/admin/logs")
    assert response.status_code == 200
    assert "Admin Update" in response.text

    test_client.cookies.clear()
    response = test_client.get("/login")
    token = csrf_token(response)
    response = test_client.post(
        "/login",
        data={"csrf_token": token, "username": "bob", "password": "password123"},
    )
    assert response.status_code == 403


def test_non_admin_cannot_open_admin_pages(test_client: TestClient) -> None:
    register_user(test_client)

    response = test_client.get("/admin/users")

    assert response.status_code == 403

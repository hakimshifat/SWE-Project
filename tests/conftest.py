from __future__ import annotations

import re
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import Settings
from app.database import get_session_factory
from app.main import create_app
from app.models import User
from app.security import hash_password

TOKEN_RE = re.compile(r'name="csrf_token" value="([^"]+)"')


@pytest.fixture
def test_client(tmp_path: Path) -> TestClient:
    settings = Settings(
        app_name="SIHS Test",
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        data_dir=tmp_path / "data",
        secret_key="test-secret-key",
    )
    app = create_app(settings)
    with TestClient(app) as client:
        yield client


def image_bytes(size: tuple[int, int] = (120, 120), image_format: str = "PNG") -> bytes:
    image = Image.new("RGB", size, color=(33, 108, 95))
    buffer = BytesIO()
    image.save(buffer, format=image_format)
    return buffer.getvalue()


def csrf_token(response) -> str:
    match = TOKEN_RE.search(response.text)
    assert match, response.text
    return match.group(1)


def register_user(client: TestClient, username: str = "alice", password: str = "password123") -> None:
    response = client.get("/register")
    token = csrf_token(response)
    response = client.post(
        "/register",
        data={
            "csrf_token": token,
            "username": username,
            "email": f"{username}@example.com",
            "password": password,
            "confirm_password": password,
        },
        follow_redirects=False,
    )
    assert response.status_code == 303


def create_admin(username: str = "admin", password: str = "password123") -> None:
    db = get_session_factory()()
    try:
        db.add(
            User(
                username=username,
                email=f"{username}@example.com",
                password_hash=hash_password(password),
                role="admin",
                status="active",
            )
        )
        db.commit()
    finally:
        db.close()


def login_user(client: TestClient, username: str = "alice", password: str = "password123") -> None:
    response = client.get("/login")
    token = csrf_token(response)
    response = client.post(
        "/login",
        data={"csrf_token": token, "username": username, "password": password},
        follow_redirects=False,
    )
    assert response.status_code == 303


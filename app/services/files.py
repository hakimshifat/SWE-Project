from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import Settings
from app.security import safe_filename


class FileServiceError(ValueError):
    pass


def ensure_data_dirs(settings: Settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    stego_dir(settings).mkdir(parents=True, exist_ok=True)


def stego_dir(settings: Settings) -> Path:
    return settings.data_dir / "stego"


def read_upload(upload: UploadFile, max_bytes: int) -> bytes:
    if not upload or not upload.filename:
        raise FileServiceError("No file was uploaded.")
    data = upload.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise FileServiceError("Uploaded file is too large.")
    if not data:
        raise FileServiceError("Uploaded file is empty.")
    return data


def sha256_digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_stego_file(settings: Settings, stego_bytes: bytes, cover_filename: str) -> tuple[Path, str]:
    original = safe_filename(cover_filename, "cover")
    stem = Path(original).stem or "cover"
    generated_name = f"{stem}-{uuid.uuid4().hex[:12]}.png"
    path = stego_dir(settings) / generated_name
    path.write_bytes(stego_bytes)
    return path, generated_name


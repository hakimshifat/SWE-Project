from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class Settings:
    app_name: str
    database_url: str
    data_dir: Path
    secret_key: str
    max_upload_bytes: int = 25 * 1024 * 1024

    @classmethod
    def from_env(cls) -> "Settings":
        data_dir = Path(os.getenv("SIHS_DATA_DIR", "data")).resolve()
        database_url = os.getenv("SIHS_DATABASE_URL", f"sqlite:///{data_dir / 'app.db'}")
        secret_key = os.getenv("SIHS_SECRET_KEY", "dev-session-key-change-me")
        max_upload_bytes = int(os.getenv("SIHS_MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
        return cls(
            app_name="Secure Information Hiding System",
            database_url=database_url,
            data_dir=data_dir,
            secret_key=secret_key,
            max_upload_bytes=max_upload_bytes,
        )


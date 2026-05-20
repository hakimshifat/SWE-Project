from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
from pathlib import Path

PASSWORD_ITERATIONS = 390_000
_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PASSWORD_ITERATIONS,
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = base64.urlsafe_b64decode(salt_text.encode("ascii"))
        expected = base64.urlsafe_b64decode(digest_text.encode("ascii"))
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def safe_filename(filename: str | None, default: str = "file") -> str:
    name = Path(filename or default).name.strip().replace(" ", "_")
    name = _SAFE_FILENAME_RE.sub("_", name)
    name = name.strip("._")
    return (name or default)[:120]


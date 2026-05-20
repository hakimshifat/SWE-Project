from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import select

from app.config import Settings
from app.database import configure_database, get_session_factory, init_db
from app.models import User
from app.security import hash_password
from app.services.files import ensure_data_dirs


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or update an SIHS administrator account.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", help="Admin password. If omitted, prompts securely.")
    args = parser.parse_args()

    password = args.password or getpass.getpass("Admin password: ")
    if len(password) < 8:
        print("Password must be at least 8 characters.", file=sys.stderr)
        return 2

    settings = Settings.from_env()
    ensure_data_dirs(settings)
    configure_database(settings.database_url)
    init_db()
    db = get_session_factory()()
    try:
        user = db.scalar(select(User).where(User.username == args.username))
        if user:
            user.email = args.email.lower()
            user.password_hash = hash_password(password)
            user.role = "admin"
            user.status = "active"
            action = "Updated"
        else:
            user = User(
                username=args.username,
                email=args.email.lower(),
                password_hash=hash_password(password),
                role="admin",
                status="active",
            )
            db.add(user)
            action = "Created"
        db.commit()
        print(f"{action} admin account: {args.username}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

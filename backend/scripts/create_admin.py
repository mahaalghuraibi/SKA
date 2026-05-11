"""
Create or update the platform admin user.

Usage (local / CI):
  python scripts/create_admin.py admin@example.com yourpassword

Render / env-only (uses app.core.config → SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD):
  python scripts/create_admin.py

Run from the `backend/` directory (Render rootDir should be `backend`).
"""
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import func

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.db.session import SessionLocal, init_db
from app.models.user import User
from app.services.auth_service import hash_password, normalize_email, normalize_username, verify_password


def _resolve_credentials() -> tuple[str, str]:
    if len(sys.argv) >= 3:
        return normalize_email(sys.argv[1]), str(sys.argv[2])
    email = normalize_email(settings.SEED_ADMIN_EMAIL)
    password = (settings.SEED_ADMIN_PASSWORD or "").strip()
    if not email or not password:
        print(
            "Missing credentials: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in the environment, "
            "or pass: python scripts/create_admin.py <email> <password>",
            file=sys.stderr,
        )
        return "", ""
    return email, password


def main() -> int:
    email, password = _resolve_credentials()
    if not email or not password:
        return 1

    init_db()

    db = SessionLocal()
    try:
        existing = db.query(User).filter(func.lower(User.email) == email.lower()).first()
        if existing is None:
            base = normalize_username(email.split("@")[0]) or "admin"
            username = base
            i = 2
            while db.query(User).filter(func.lower(User.username) == username.lower()).first() is not None:
                suffix = f"_{i}"
                username = f"{base[: max(1, 64 - len(suffix))]}{suffix}"
                i += 1
            db.add(
                User(
                    email=email,
                    username=username,
                    password=hash_password(password),
                    is_admin=True,
                    role="admin",
                    tenant_id=1,
                    branch_id=1,
                    branch_name="فرع تجريبي",
                )
            )
            db.commit()
            print(f"Admin created successfully: {email}")
            return 0

        changed = False
        if existing.role != "admin":
            existing.role = "admin"
            changed = True
        if not existing.is_admin:
            existing.is_admin = True
            changed = True
        if existing.tenant_id is None:
            existing.tenant_id = 1
            changed = True
        if existing.branch_id is None:
            existing.branch_id = 1
            changed = True
        if not (existing.branch_name or "").strip():
            existing.branch_name = "فرع تجريبي"
            changed = True
        if not verify_password(password, existing.password):
            existing.password = hash_password(password)
            changed = True
        if changed:
            db.add(existing)
            db.commit()
        print(f"User updated to admin successfully: {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

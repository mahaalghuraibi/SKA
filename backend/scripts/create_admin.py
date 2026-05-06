import sys
from pathlib import Path

from sqlalchemy import func

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.db.session import SessionLocal
from app.models.user import User
from app.services.auth_service import hash_password, normalize_email


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python scripts/create_admin.py admin@test.com 123456")
        return 1

    email = normalize_email(sys.argv[1])
    password = sys.argv[2]
    if not password:
        print("Password is required")
        return 1

    db = SessionLocal()
    try:
        existing = db.query(User).filter(func.lower(User.email) == email).first()
        if existing is None:
            user = User(
                email=email,
                password=hash_password(password),
                role="admin",
                tenant_id=1,
            )
            db.add(user)
            db.commit()
            print(f"Admin created successfully: {email}")
            return 0

        existing.password = hash_password(password)
        existing.role = "admin"
        if existing.tenant_id is None:
            existing.tenant_id = 1
        db.commit()
        print(f"User updated to admin successfully: {email}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

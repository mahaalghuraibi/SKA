from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.rbac import require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserRoleUpdate
from app.services.auth_service import hash_password, normalize_email, normalize_username, username_from_email

router = APIRouter(
    prefix="/users",
    tags=["users"],
    dependencies=[Depends(require_roles("admin"))],
)
AUTO_ADMIN_EMAILS = {
    normalize_email(settings.SEED_ADMIN_EMAIL),
    "xmha2000@outlook.com",
}


def _ensure_unique_username(db: Session, raw_username: str, *, fallback_email: str) -> str:
    base_raw = normalize_username(raw_username or "") or username_from_email(fallback_email)
    base = base_raw[:64] or "user"
    candidate = base
    i = 2
    while (
        db.query(User)
        .filter(func.lower(User.username) == candidate.lower())
        .first()
        is not None
    ):
        suffix = f"_{i}"
        candidate = f"{base[: max(1, 64 - len(suffix))]}{suffix}"
        i += 1
    return candidate


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return db.query(User).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def admin_create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    email = normalize_email(str(payload.email))
    existing = db.query(User).filter(func.lower(User.email) == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    wanted_username = normalize_username(payload.username)
    if not wanted_username:
        raise HTTPException(status_code=400, detail="Username is required")
    if (
        db.query(User)
        .filter(func.lower(User.username) == wanted_username)
        .first()
        is not None
    ):
        raise HTTPException(status_code=400, detail="Username already exists")
    final_username = _ensure_unique_username(db, wanted_username, fallback_email=email)

    org_name = (payload.organization_name or "").strip() or None
    branch_id = int(payload.branch_id or 1)
    branch_name = (payload.branch_name or "").strip() or "فرع تجريبي"
    supervisor_id = payload.supervisor_id
    supervisor_name = (payload.supervisor_name or "").strip() or None
    if payload.role == "staff" and supervisor_id is None:
        same_branch_supervisor = (
            db.query(User)
            .filter(
                User.tenant_id == payload.tenant_id,
                User.role == "supervisor",
                User.branch_id == branch_id,
            )
            .order_by(User.id.asc())
            .first()
        )
        if same_branch_supervisor is not None:
            supervisor_id = same_branch_supervisor.id
            supervisor_name = (
                same_branch_supervisor.full_name or same_branch_supervisor.username or same_branch_supervisor.email
            )
    user = User(
        email=email,
        username=final_username,
        password=hash_password(payload.password),
        is_admin=email in AUTO_ADMIN_EMAILS,
        role=payload.role,
        tenant_id=payload.tenant_id,
        organization_name=org_name,
        branch_id=branch_id,
        branch_name=branch_name,
        supervisor_id=supervisor_id,
        supervisor_name=supervisor_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/admin-create", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def admin_create_user_alias(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    return admin_create_user(payload, db)


@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()

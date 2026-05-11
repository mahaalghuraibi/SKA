from typing import Annotated
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.schemas.user import UserCreate, UserOut
from app.core.limiter import limiter
from app.services.auth_service import (
    create_access_token,
    hash_password,
    normalize_email,
    normalize_username,
    username_from_email,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


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


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login (OAuth2 password)",
    description=(
        "Send **application/x-www-form-urlencoded** data with fields `username` "
        "(email) and `password`. Do not send JSON."
    ),
)
@limiter.limit("25/minute")
def login(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
) -> TokenResponse:
    """OAuth2 password flow: accepts email or username."""
    if not form_data.username or not form_data.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="بيانات الدخول غير صحيحة",
        )

    raw_login = form_data.username.strip()
    login_key = normalize_email(raw_login) if "@" in raw_login else normalize_username(raw_login)
    user = (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == login_key,
                func.lower(User.username) == login_key,
            )
        )
        .first()
    )
    user_found = user is not None
    password_ok = verify_password(form_data.password, user.password) if user_found else False
    if not user_found or not password_ok:
        logger.info("login failed user_found=%s", user_found)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="بيانات الدخول غير صحيحة",
            headers={"WWW-Authenticate": "Bearer"},
        )

    logger.info("login success user_id=%s role=%s", user.id, user.role)
    token = create_access_token(subject=user.email)
    return TokenResponse(
        id=user.id,
        access_token=token,
        token_type="bearer",
        is_admin=bool(user.is_admin),
        role=user.role,
        email=user.email,
        username=user.username,
        full_name=user.full_name,
    )


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("40/hour")
def create_user(
    request: Request,
    payload: UserCreate,
    db: Session = Depends(get_db),
) -> UserOut:
    """Public registration endpoint (staff/supervisor/admin)."""

    email = normalize_email(str(payload.email))
    existing_user = (
        db.query(User).filter(func.lower(User.email) == email).first()
    )
    if existing_user:
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

    raw_name = (payload.full_name or "").strip() if payload.full_name is not None else ""
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
        is_admin=payload.role == "admin",
        role=payload.role,
        tenant_id=payload.tenant_id,
        full_name=raw_name or None,
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

import logging

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)
logger = logging.getLogger(__name__)


def _user_from_access_token(token: str, db: Session) -> User | None:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    sub = (payload.get("sub") or "").strip().lower()
    return db.query(User).filter(func.lower(User.email) == sub).first()


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token) if token else None
    user = _user_from_access_token(token, db)
    if settings.effective_dev_auth_bypass and not user:
        user = db.query(User).order_by(User.id.asc()).first()
        if user:
            logger.warning("DEV_AUTH_BYPASS active: endpoint=%s using user_id=%s", request.url.path, user.id)
    if settings.is_production:
        logger.debug(
            "auth endpoint=%s ok=%s",
            request.url.path,
            bool(user),
        )
    else:
        logger.info(
            "auth check endpoint=%s token_exists=%s user_id=%s role=%s branch=%s",
            request.url.path,
            bool(token),
            user.id if user else None,
            user.role if user else payload.get("role") if isinstance(payload, dict) else None,
            user.branch_id if user else None,
        )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if not token:
        return None
    return _user_from_access_token(token, db)

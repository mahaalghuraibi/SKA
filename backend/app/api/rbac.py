"""Role-based access control dependencies."""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.models.user import User

ROLE_ADMIN = "admin"
ROLE_SUPERVISOR = "supervisor"
ROLE_STAFF = "staff"


def any_admin_exists(db: Session) -> bool:
    return (
        db.query(User)
        .filter(User.role == ROLE_ADMIN)
        .count()
        > 0
    )


def require_roles(*allowed: str) -> Callable:
    """Require one of `allowed` roles. `admin` always passes (full access)."""

    allowed_set = frozenset(allowed)
    label = ", ".join(sorted(allowed_set))

    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == ROLE_ADMIN:
            return current_user
        if current_user.role not in allowed_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ليس لديك صلاحية للوصول لهذه الصفحة",
            )
        return current_user

    return dependency

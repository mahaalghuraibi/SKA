"""Current-user aliases under /users/me (no admin gate on the parent /users router)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.me import _apply_me_update, _change_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import MePasswordUpdate, MeUpdate, UserOut

router = APIRouter(prefix="/users", tags=["auth"])


@router.get("/me", response_model=UserOut)
def get_current_user_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserOut)
def patch_current_user_me(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    return _apply_me_update(db, current_user, payload)


@router.put("/me", response_model=UserOut)
def put_current_user_me(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    return _apply_me_update(db, current_user, payload)


@router.post("/me/save", response_model=UserOut)
def post_current_user_me_save(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    return _apply_me_update(db, current_user, payload)


@router.patch("/me/password")
def patch_current_user_me_password(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)


@router.put("/me/password")
def put_current_user_me_password(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)


@router.post("/me/password/save")
def post_current_user_me_password(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)

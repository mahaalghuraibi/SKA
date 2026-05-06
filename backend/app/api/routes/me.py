from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import MePasswordUpdate, MeUpdate, UserOut
from app.services.auth_service import hash_password, verify_password

router = APIRouter(prefix="/me", tags=["auth"])
# Alias routes for clients that expect /api/v1/profile (avoids some proxy/method quirks with /me).
profile_router = APIRouter(prefix="/profile", tags=["profile"])

# Base64 data URLs can be large; keep a sane cap for SQLite TEXT + API.
_MAX_AVATAR_CHARS = 400_000


def _apply_me_update(db: Session, current_user: User, payload: MeUpdate) -> User:
    data = payload.model_dump(exclude_unset=True)
    # Single DB column `avatar_url`; clients may send `avatar_data_url` instead.
    if "avatar_data_url" in data:
        data["avatar_url"] = data.pop("avatar_data_url")
    if "full_name" in data:
        fn = data["full_name"]
        current_user.full_name = (fn or "").strip() or None
    if "avatar_url" in data:
        raw = data["avatar_url"]
        if raw is not None:
            s = str(raw).strip()
            if len(s) > _MAX_AVATAR_CHARS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="صورة الملف الشخصي كبيرة جدًا. جرّب صورة أصغر.",
                )
            current_user.avatar_url = s if s else None
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


def _change_password(db: Session, current_user: User, payload: MePasswordUpdate) -> dict[str, bool]:
    if not verify_password(payload.current_password, current_user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمة المرور الحالية غير صحيحة.",
        )
    current_user.password = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    return {"ok": True}


@router.get("", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@profile_router.get("", response_model=UserOut)
def read_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("", response_model=UserOut)
def update_me(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    return _apply_me_update(db, current_user, payload)


@router.put("", response_model=UserOut)
def update_me_put(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """PUT alias for PATCH (some clients send PUT and would otherwise get 405)."""
    return _apply_me_update(db, current_user, payload)


@profile_router.patch("", response_model=UserOut)
def update_profile(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    return _apply_me_update(db, current_user, payload)


@profile_router.put("", response_model=UserOut)
def update_profile_put(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    return _apply_me_update(db, current_user, payload)


@router.post("/save", response_model=UserOut)
def update_me_post_save(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """POST fallback when PATCH/PUT are blocked (some proxies return 405)."""
    return _apply_me_update(db, current_user, payload)


@profile_router.post("/save", response_model=UserOut)
def update_profile_post_save(
    payload: MeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    return _apply_me_update(db, current_user, payload)


@router.patch("/password")
def change_me_password(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)


@profile_router.patch("/password")
def change_profile_password(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)


@router.put("/password")
def change_me_password_put(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)


@profile_router.put("/password")
def change_profile_password_put(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)


@router.post("/password/save")
def change_me_password_post(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)


@profile_router.post("/password/save")
def change_profile_password_post(
    payload: MePasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    return _change_password(db, current_user, payload)

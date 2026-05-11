"""Write client-sent data URLs to disk; serve stable short URLs for dish thumbnails."""

from __future__ import annotations

import base64
import io
import re
import uuid
from pathlib import Path

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

# data:image/png;base64,XXXX
_DATA_URL_RE = re.compile(r"^data:image/([\w+.-]+);base64,(.+)$", re.IGNORECASE | re.DOTALL)
# Stored public path prefix (must match dishes router + api prefix).
_FILES_PUBLIC_PREFIX = "/api/v1/dishes/files/"
_FILENAME_RE = re.compile(r"^[a-f0-9]{32}\.(png|jpg|jpeg|webp|gif)$", re.IGNORECASE)
_MAX_RAW_BYTES = 12_000_000


def dish_media_dir() -> Path:
    d = settings.DISH_MEDIA_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d


def materialize_dish_image_url(image_url: str) -> str:
    """
    If image_url is a data:image/...;base64,... URL, decode and save under DISH_MEDIA_DIR
    and return /api/v1/dishes/files/<uuid>.<ext>. Otherwise return image_url unchanged.
    """
    raw = (image_url or "").strip()
    if not raw.startswith("data:image/"):
        return raw
    m = _DATA_URL_RE.match(raw)
    if not m:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="صورة الطبق غير صالحة (توقع data:image/...;base64,...).",
        )
    mime = m.group(1).lower()
    b64 = re.sub(r"\s+", "", m.group(2))
    try:
        data = base64.b64decode(b64, validate=True)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تعذر فك ترميز صورة الطبق.",
        ) from exc
    if len(data) > _MAX_RAW_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="صورة الطبق كبيرة جدًا. جرّب صورة أصغر أو أقل دقة.",
        )
    try:
        with Image.open(io.BytesIO(data)) as im:
            im.load()
            pil_fmt = (im.format or "").upper()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ملف الصورة غير صالح أو تالف.",
        ) from exc

    if "png" in mime and pil_fmt == "PNG":
        ext = "png"
    elif "webp" in mime and pil_fmt == "WEBP":
        ext = "webp"
    elif "gif" in mime and pil_fmt == "GIF":
        ext = "gif"
    elif ("jpeg" in mime or mime == "jpg") and pil_fmt in ("JPEG", "MPO"):
        ext = "jpg"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="نوع الصورة لا يطابق المحتوى. استخدم PNG أو JPEG أو WebP أو GIF.",
        )
    fname = f"{uuid.uuid4().hex}.{ext}"
    dest = dish_media_dir() / fname
    dest.write_bytes(data)
    return f"{_FILES_PUBLIC_PREFIX}{fname}"


def try_delete_stored_dish_file(image_url: str) -> None:
    """Remove on-disk file if image_url points at our files endpoint."""
    raw = (image_url or "").strip()
    if not raw.startswith(_FILES_PUBLIC_PREFIX):
        return
    fname = raw[len(_FILES_PUBLIC_PREFIX) :]
    if not _FILENAME_RE.match(fname):
        return
    path = dish_media_dir() / fname
    if path.is_file():
        try:
            path.unlink()
        except OSError:
            pass


def safe_dish_filename(filename: str) -> bool:
    return bool(_FILENAME_RE.match((filename or "").strip()))

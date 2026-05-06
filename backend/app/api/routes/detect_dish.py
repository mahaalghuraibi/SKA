import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.rbac import require_roles
from app.db.session import get_db
from app.models.dish_record import DishRecord
from app.models.user import User
from app.schemas.dish_record import DetectDishResponse, DishSuggestionItem
from app.services.professional_dish_vision import classify_dish_image, refresh_review_metadata

router = APIRouter(tags=["dish-detection"])
logger = logging.getLogger(__name__)


def _uncertain() -> DetectDishResponse:
    unk = DishSuggestionItem(name="طبق غير محدد", confidence=0.0, reason="تعذر تحليل الصورة")
    return DetectDishResponse(
        dish_name="طبق غير محدد",
        dish_name_ar="طبق غير محدد",
        confidence=0.0,
        suggestions=[unk, unk, unk],
        labels=["طبق غير محدد", "طبق غير محدد", "طبق غير محدد"],
        detected_classes=[],
        suggestion_reason="تعذر تحليل الصورة",
        suggested_name="طبق غير محدد",
        suggested_options=["طبق غير محدد", "طبق غير محدد", "طبق غير محدد"],
        experimental=True,
        protein_type="unknown",
        visual_reason="تعذر تحليل الصورة",
        needs_review=True,
        protein_conflict=False,
        vision_model="none",
    )


def _merge_unique(items: list[str]) -> list[str]:
    out: list[str] = []
    for item in items:
        value = str(item or "").strip()
        if value and value not in out:
            out.append(value)
    return out


def _enhance_with_history(result: dict[str, object], db: Session, tenant_id: int) -> dict[str, object]:
    """
    Learn from confirmed labels in DB when the same predicted label was corrected before.
    """
    primary = str(result.get("dish_name") or "").strip()
    if not primary:
        return result

    history_rows = (
        db.query(
            DishRecord.confirmed_label,
            func.count(DishRecord.id).label("hits"),
        )
        .filter(DishRecord.tenant_id == tenant_id)
        .filter(DishRecord.confirmed_label.isnot(None))
        .filter(func.lower(DishRecord.predicted_label) == primary.lower())
        .group_by(DishRecord.confirmed_label)
        .order_by(func.count(DishRecord.id).desc())
        .limit(3)
        .all()
    )
    history_options = [str(row[0]).strip() for row in history_rows if row and row[0]]
    if not history_options:
        return result

    existing_options = [str(x) for x in (result.get("suggested_options") or []) if isinstance(x, str)]
    merged_options = _merge_unique(history_options + existing_options)
    result["suggested_options"] = merged_options[:3]
    result["suggested_name"] = merged_options[0]

    top_hits = int(history_rows[0][1] or 0) if history_rows and len(history_rows[0]) > 1 else 0
    confidence = float(result.get("confidence") or 0.0)
    if top_hits >= 3 and confidence < 0.85:
        new_primary = merged_options[0]
        result["dish_name"] = new_primary
        result["dish_name_ar"] = new_primary
        reason = str(result.get("visual_reason") or result.get("suggestion_reason") or "").strip()
        prefix = "تعلم من تصحيحات الموظفين السابقة"
        merged_reason = f"{prefix} — {reason}" if reason else prefix
        result["suggestion_reason"] = merged_reason
        result["visual_reason"] = merged_reason
        sugs = result.get("suggestions")
        if isinstance(sugs, list) and len(sugs) > 0 and isinstance(sugs[0], dict):
            sugs[0]["name"] = new_primary
            result["suggestions"] = sugs
        labels = result.get("labels")
        if isinstance(labels, list) and labels:
            labels[0] = new_primary
            result["labels"] = labels
        opts = result.get("suggested_options")
        if isinstance(opts, list) and opts:
            opts[0] = new_primary
            result["suggested_options"] = opts
    return result


@router.post(
    "/detect-dish",
    response_model=DetectDishResponse,
    dependencies=[Depends(require_roles("admin", "supervisor", "staff"))],
)
async def detect_dish(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DetectDishResponse:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="تعذر التعرف على الطبق")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="تعذر التعرف على الطبق")

    try:
        logger.warning("detect-dish called: content_type=%s image_bytes=%s", image.content_type, len(image_bytes))
        result = classify_dish_image(image_bytes=image_bytes)
        logger.warning(
            "detect-dish pipeline raw result: vision_model=%s dish=%s confidence=%s suggestions=%s",
            result.get("vision_model"),
            result.get("dish_name"),
            result.get("confidence"),
            result.get("suggestions"),
        )
        result = _enhance_with_history(result, db=db, tenant_id=current_user.tenant_id)
        result = refresh_review_metadata(result)
        logger.warning(
            "detect-dish final result: dish=%s confidence=%s needs_review=%s",
            result.get("dish_name"),
            result.get("confidence"),
            result.get("needs_review"),
        )
        return DetectDishResponse(**result)
    except Exception as exc:
        logger.error("detect-dish pipeline error: %s", exc, exc_info=True)
        return _uncertain()

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.rbac import require_roles
from app.db.session import get_db
from app.models.meal_type import MealType
from app.schemas.meal_type import MealTypeOut

router = APIRouter(
    prefix="/meal-types",
    tags=["meal-types"],
    dependencies=[Depends(require_roles("admin", "supervisor", "staff"))],
)


@router.get("", response_model=list[MealTypeOut])
def list_meal_types(db: Session = Depends(get_db)) -> list[MealType]:
    return (
        db.query(MealType)
        .filter(MealType.is_active.is_(True))
        .order_by(MealType.name_ar.asc())
        .all()
    )

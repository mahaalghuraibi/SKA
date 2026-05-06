from fastapi import APIRouter, Depends

from app.api.rbac import require_roles

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_roles("supervisor", "admin"))],
)


@router.get("/quality-summary")
def quality_summary() -> dict:
    # Placeholder summary until reporting aggregation is wired.
    return {
        "compliance_rate": None,
        "open_violations": 0,
        "alerts_count": 0,
        "is_mock": True,
    }

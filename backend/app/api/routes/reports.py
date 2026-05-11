from fastapi import APIRouter, Depends, Request

from app.api.rbac import require_roles
from app.core.limiter import limiter

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(require_roles("supervisor", "admin"))],
)


@router.get("/quality-summary")
@limiter.limit("120/minute")
def quality_summary(request: Request) -> dict:
    # Placeholder summary until reporting aggregation is wired.
    return {
        "compliance_rate": None,
        "open_violations": 0,
        "alerts_count": 0,
        "is_mock": True,
    }

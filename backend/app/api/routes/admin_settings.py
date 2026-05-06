from fastapi import APIRouter, Depends

from app.api.rbac import require_roles

router = APIRouter(
    prefix="/admin/settings",
    tags=["admin-settings"],
    dependencies=[Depends(require_roles("admin"))],
)


@router.get("")
def get_admin_settings() -> dict:
    # Placeholder until persistent settings are added.
    return {
        "project_name": "SKA Backend",
        "allow_public_register_admin": False,
        "is_mock": True,
    }

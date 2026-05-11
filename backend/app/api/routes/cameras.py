from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.rbac import require_roles
from app.db.session import get_db
from app.models.camera import Camera
from app.models.user import User
from app.schemas.camera import CameraCreate, CameraOut
from app.security.stream_url import validate_camera_stream_url

router = APIRouter(prefix="/cameras", tags=["cameras"])


@router.get(
    "",
    response_model=list[CameraOut],
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def list_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Camera]:
    return db.query(Camera).filter(Camera.tenant_id == current_user.tenant_id).all()


@router.post(
    "",
    response_model=CameraOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("admin", "supervisor"))],
)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)) -> Camera:
    data = payload.model_dump()
    data["stream_url"] = validate_camera_stream_url(data.get("stream_url"))
    camera = Camera(**data)
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera

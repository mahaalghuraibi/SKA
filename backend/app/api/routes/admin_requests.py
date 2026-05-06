import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.rbac import require_roles
from app.db.session import get_db
from app.models.admin_request import AdminRequest
from app.models.user import User
from app.schemas.admin_request import (
    AdminRequestActionResponse,
    AdminRequestCreate,
    AdminRequestOut,
    AdminRequestUpdate,
)
from app.services.auth_service import hash_password, normalize_email

router = APIRouter(prefix="/admin-requests", tags=["admin-requests"])


@router.post("", response_model=AdminRequestOut, status_code=status.HTTP_201_CREATED)
def create_admin_request(
    payload: AdminRequestCreate,
    db: Session = Depends(get_db),
) -> AdminRequest:
    req = AdminRequest(
        name=payload.name.strip(),
        email=normalize_email(str(payload.email)),
        company=payload.company.strip(),
        phone=payload.phone.strip(),
        reason=payload.reason.strip(),
        status="pending",
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get(
    "",
    response_model=list[AdminRequestOut],
    dependencies=[Depends(require_roles("admin"))],
)
def list_admin_requests(db: Session = Depends(get_db)) -> list[AdminRequest]:
    return db.query(AdminRequest).order_by(AdminRequest.created_at.desc()).all()


@router.patch(
    "/{request_id}",
    response_model=AdminRequestActionResponse,
    dependencies=[Depends(require_roles("admin"))],
)
def update_admin_request_status(
    request_id: int,
    payload: AdminRequestUpdate,
    db: Session = Depends(get_db),
) -> AdminRequestActionResponse:
    req = db.query(AdminRequest).filter(AdminRequest.id == request_id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = payload.status
    message = "تم تحديث حالة الطلب."

    if payload.status == "approved":
        email = normalize_email(req.email)
        existing = db.query(User).filter(func.lower(User.email) == email).first()
        if existing is None:
            temp_password = secrets.token_urlsafe(8)
            user = User(
                email=email,
                password=hash_password(temp_password),
                role="admin",
                tenant_id=1,
            )
            db.add(user)
            message = (
                "تمت الموافقة على الطلب وإنشاء حساب Admin جديد. "
                f"كلمة المرور المؤقتة: {temp_password}"
            )
        else:
            existing.role = "admin"
            message = "تمت الموافقة على الطلب وترقية المستخدم إلى Admin."

    db.commit()
    db.refresh(req)
    return AdminRequestActionResponse(request=req, message=message)

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.rbac import require_roles
from app.db.session import get_db
from app.models.dish_record import DishRecord
from app.models.monitoring_alert import MonitoringAlert
from app.models.user import User
from app.schemas.supervisor import SupervisorEmployeeOut, SupervisorSummaryOut

router = APIRouter(
    prefix="/supervisor",
    tags=["supervisor"],
    dependencies=[Depends(require_roles("supervisor", "admin"))],
)

_RIYADH = ZoneInfo("Asia/Riyadh")


def _riyadh_day_window_utc() -> tuple[datetime, datetime]:
    now_riyadh = datetime.now(_RIYADH)
    day_start_riyadh = now_riyadh.replace(hour=0, minute=0, second=0, microsecond=0)
    next_day_riyadh = day_start_riyadh + timedelta(days=1)
    return (
        day_start_riyadh.astimezone(timezone.utc).replace(tzinfo=None),
        next_day_riyadh.astimezone(timezone.utc).replace(tzinfo=None),
    )


def _riyadh_week_start_utc() -> datetime:
    now_riyadh = datetime.now(_RIYADH)
    day_start_riyadh = now_riyadh.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = day_start_riyadh - timedelta(days=day_start_riyadh.weekday())
    return week_start.astimezone(timezone.utc).replace(tzinfo=None)


def _pending_expr():
    return or_(
        DishRecord.needs_review.is_(True),
        DishRecord.status.in_(["needs_review", "pending_review"]),
        DishRecord.ai_confidence < 0.75,
    )


def _ensure_supervisor_branch(current_user: User) -> None:
    if current_user.role == "supervisor" and current_user.branch_id is None:
        raise HTTPException(status_code=400, detail="لم يتم تحديد الفرع لهذا الحساب")


@router.get("/summary", response_model=SupervisorSummaryOut)
def supervisor_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SupervisorSummaryOut:
    _ensure_supervisor_branch(current_user)
    tenant_id = current_user.tenant_id
    day_start_utc, next_day_utc = _riyadh_day_window_utc()
    week_start_utc = _riyadh_week_start_utc()

    staff_scope_ids: list[int] | None = None
    if current_user.role == "supervisor":
        staff_scope_ids = [
            uid
            for (uid,) in db.query(User.id)
            .filter(
                User.tenant_id == tenant_id,
                User.role == "staff",
                User.branch_id == current_user.branch_id,
            )
            .all()
        ]
    base_q = db.query(DishRecord).filter(DishRecord.tenant_id == tenant_id)
    if staff_scope_ids is not None:
        if not staff_scope_ids:
            base_q = base_q.filter(DishRecord.id == -1)
        else:
            base_q = base_q.filter(DishRecord.user_id.in_(staff_scope_ids))
    total_dishes = base_q.count()
    dishes_today = base_q.filter(DishRecord.recorded_at >= day_start_utc, DishRecord.recorded_at < next_day_utc).count()
    dishes_week = base_q.filter(DishRecord.recorded_at >= week_start_utc).count()
    pending_reviews = base_q.filter(_pending_expr()).count()
    approved_today = base_q.filter(
        DishRecord.status == "approved",
        DishRecord.reviewed_at >= day_start_utc,
        DishRecord.reviewed_at < next_day_utc,
    ).count()
    rejected_today = base_q.filter(
        DishRecord.status == "rejected",
        DishRecord.reviewed_at >= day_start_utc,
        DishRecord.reviewed_at < next_day_utc,
    ).count()
    total_quantity_q = db.query(func.coalesce(func.sum(DishRecord.quantity), 0)).filter(DishRecord.tenant_id == tenant_id)
    average_confidence_q = db.query(func.avg(DishRecord.ai_confidence)).filter(DishRecord.tenant_id == tenant_id)
    if staff_scope_ids is not None:
        if not staff_scope_ids:
            total_quantity_q = total_quantity_q.filter(DishRecord.id == -1)
            average_confidence_q = average_confidence_q.filter(DishRecord.id == -1)
        else:
            total_quantity_q = total_quantity_q.filter(DishRecord.user_id.in_(staff_scope_ids))
            average_confidence_q = average_confidence_q.filter(DishRecord.user_id.in_(staff_scope_ids))
    total_quantity = int(total_quantity_q.scalar() or 0)
    average_confidence = average_confidence_q.scalar()
    compliance_rate = 0.0
    if total_dishes > 0:
        approved_total = base_q.filter(DishRecord.status == "approved").count()
        compliance_rate = round((approved_total / total_dishes) * 100.0, 1)

    most_common_q = db.query(
        func.coalesce(func.nullif(DishRecord.confirmed_label, ""), DishRecord.predicted_label).label("dish_name"),
        func.count(DishRecord.id).label("cnt"),
    ).filter(DishRecord.tenant_id == tenant_id)
    if staff_scope_ids is not None:
        if not staff_scope_ids:
            most_common_q = most_common_q.filter(DishRecord.id == -1)
        else:
            most_common_q = most_common_q.filter(DishRecord.user_id.in_(staff_scope_ids))
    most_common_row = most_common_q.group_by("dish_name").order_by(func.count(DishRecord.id).desc()).first()
    most_common_dish = str(most_common_row[0]) if most_common_row and most_common_row[0] else None

    most_reviewed_q = db.query(
        func.coalesce(func.nullif(DishRecord.confirmed_label, ""), DishRecord.predicted_label).label("dish_name"),
        func.count(DishRecord.id).label("cnt"),
    ).filter(DishRecord.tenant_id == tenant_id)
    if staff_scope_ids is not None:
        if not staff_scope_ids:
            most_reviewed_q = most_reviewed_q.filter(DishRecord.id == -1)
        else:
            most_reviewed_q = most_reviewed_q.filter(DishRecord.user_id.in_(staff_scope_ids))
    most_reviewed_dish_row = (
        most_reviewed_q.filter(_pending_expr()).group_by("dish_name").order_by(func.count(DishRecord.id).desc()).first()
    )
    most_reviewed_dish = str(most_reviewed_dish_row[0]) if most_reviewed_dish_row and most_reviewed_dish_row[0] else None

    users_q = db.query(User).filter(User.tenant_id == tenant_id)
    if current_user.role == "supervisor":
        users_q = users_q.filter(User.role == "staff", User.branch_id == current_user.branch_id)
    users = users_q.all()
    total_employees = len(users)
    today_q = db.query(DishRecord.user_id).filter(
        DishRecord.tenant_id == tenant_id,
        DishRecord.recorded_at >= day_start_utc,
        DishRecord.recorded_at < next_day_utc,
    )
    if staff_scope_ids is not None:
        if not staff_scope_ids:
            today_q = today_q.filter(DishRecord.id == -1)
        else:
            today_q = today_q.filter(DishRecord.user_id.in_(staff_scope_ids))
    today_user_ids = {uid for (uid,) in today_q.distinct().all()}
    active_employees_today = len(today_user_ids)

    pending_by_user_q = db.query(DishRecord.user_id, func.count(DishRecord.id)).filter(DishRecord.tenant_id == tenant_id)
    if staff_scope_ids is not None:
        if not staff_scope_ids:
            pending_by_user_q = pending_by_user_q.filter(DishRecord.id == -1)
        else:
            pending_by_user_q = pending_by_user_q.filter(DishRecord.user_id.in_(staff_scope_ids))
    pending_by_user = (
        pending_by_user_q.filter(_pending_expr()).group_by(DishRecord.user_id).order_by(func.count(DishRecord.id).desc()).first()
    )
    top_employee_review_name = None
    top_employee_review_count = 0
    if pending_by_user:
        top_employee_review_count = int(pending_by_user[1] or 0)
        u = db.query(User).filter(User.id == pending_by_user[0]).first()
        if u:
            top_employee_review_name = u.full_name or u.username or u.email

    alert_q = db.query(MonitoringAlert).filter(
        MonitoringAlert.tenant_id == tenant_id,
        MonitoringAlert.status == "open",
    )
    if current_user.role == "supervisor":
        alert_q = alert_q.filter(MonitoringAlert.branch_id == current_user.branch_id)
    alerts_count = alert_q.count()
    violations_count = alerts_count

    return SupervisorSummaryOut(
        branch_id=current_user.branch_id,
        branch_name=current_user.branch_name or "فرع تجريبي",
        dishes_today=dishes_today,
        dishes_week=dishes_week,
        total_dishes=total_dishes,
        pending_reviews=pending_reviews,
        approved_today=approved_today,
        rejected_today=rejected_today,
        total_employees=total_employees,
        active_employees_today=active_employees_today,
        total_quantity=total_quantity,
        most_common_dish=most_common_dish,
        average_confidence=round(float(average_confidence) * 100, 1) if average_confidence is not None else None,
        compliance_rate=compliance_rate,
        violations_count=violations_count,
        alerts_count=alerts_count,
        dishes_count=dishes_today,
        quality_score=float(compliance_rate or 0.0),
        top_employee_review_name=top_employee_review_name,
        top_employee_review_count=top_employee_review_count,
        most_reviewed_dish=most_reviewed_dish,
    )


@router.get("/employees", response_model=list[SupervisorEmployeeOut])
def supervisor_employees(
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    active_today: bool | None = Query(default=None),
    has_pending_reviews: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SupervisorEmployeeOut]:
    _ensure_supervisor_branch(current_user)
    tenant_id = current_user.tenant_id
    day_start_utc, next_day_utc = _riyadh_day_window_utc()

    q = db.query(User).filter(User.tenant_id == tenant_id)
    if current_user.role == "supervisor":
        q = q.filter(User.role == "staff", User.branch_id == current_user.branch_id)
    if role:
        q = q.filter(User.role == role)
    if search:
        key = f"%{search.strip().lower()}%"
        q = q.filter(
            or_(
                func.lower(User.username).like(key),
                func.lower(User.email).like(key),
                func.lower(func.coalesce(User.full_name, "")).like(key),
            )
        )
    users = q.order_by(User.id.desc()).all()
    if not users:
        return []

    ids = [u.id for u in users]
    today_rows = (
        db.query(DishRecord.user_id, func.count(DishRecord.id))
        .filter(DishRecord.tenant_id == tenant_id, DishRecord.user_id.in_(ids), DishRecord.recorded_at >= day_start_utc, DishRecord.recorded_at < next_day_utc)
        .group_by(DishRecord.user_id)
        .all()
    )
    total_rows = (
        db.query(DishRecord.user_id, func.count(DishRecord.id))
        .filter(DishRecord.tenant_id == tenant_id, DishRecord.user_id.in_(ids))
        .group_by(DishRecord.user_id)
        .all()
    )
    pending_rows = (
        db.query(DishRecord.user_id, func.count(DishRecord.id))
        .filter(DishRecord.tenant_id == tenant_id, DishRecord.user_id.in_(ids))
        .filter(_pending_expr())
        .group_by(DishRecord.user_id)
        .all()
    )
    last_rows = (
        db.query(DishRecord.user_id, func.max(DishRecord.recorded_at))
        .filter(DishRecord.tenant_id == tenant_id, DishRecord.user_id.in_(ids))
        .group_by(DishRecord.user_id)
        .all()
    )
    today_map = {uid: int(cnt or 0) for uid, cnt in today_rows}
    total_map = {uid: int(cnt or 0) for uid, cnt in total_rows}
    pending_map = {uid: int(cnt or 0) for uid, cnt in pending_rows}
    last_map = {uid: dt for uid, dt in last_rows}

    out: list[SupervisorEmployeeOut] = []
    for u in users:
        dishes_today = today_map.get(u.id, 0)
        pending_reviews = pending_map.get(u.id, 0)
        status_txt = "نشط" if dishes_today > 0 else "غير نشط"
        row = SupervisorEmployeeOut(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            branch_name=u.branch_name,
            role=u.role,
            dishes_today=dishes_today,
            total_dishes=total_map.get(u.id, 0),
            pending_reviews=pending_reviews,
            last_activity=last_map.get(u.id),
            status=status_txt,
        )
        if active_today is True and dishes_today <= 0:
            continue
        if active_today is False and dishes_today > 0:
            continue
        if has_pending_reviews is True and pending_reviews <= 0:
            continue
        if has_pending_reviews is False and pending_reviews > 0:
            continue
        out.append(row)
    return out

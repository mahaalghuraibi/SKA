from datetime import datetime

from pydantic import BaseModel


class SupervisorSummaryOut(BaseModel):
    branch_id: int | None
    branch_name: str | None
    dishes_today: int
    dishes_week: int
    total_dishes: int
    pending_reviews: int
    approved_today: int
    rejected_today: int
    total_employees: int
    active_employees_today: int
    total_quantity: int
    most_common_dish: str | None
    average_confidence: float | None
    compliance_rate: float | None
    violations_count: int
    alerts_count: int
    dishes_count: int
    quality_score: float
    top_employee_review_name: str | None
    top_employee_review_count: int
    most_reviewed_dish: str | None


class SupervisorEmployeeOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str | None
    branch_name: str | None
    role: str
    dishes_today: int
    total_dishes: int
    pending_reviews: int
    last_activity: datetime | None
    status: str

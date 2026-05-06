from pydantic import BaseModel, Field


class MonitoringCheckOut(BaseModel):
    key: str
    label_ar: str
    status: str
    status_ar: str
    confidence: int = Field(ge=0, le=100)
    reason_ar: str


class MonitoringViolationOut(BaseModel):
    type: str
    label_ar: str
    confidence: int = Field(ge=0, le=100)
    reason_ar: str


class MonitoringAnalyzeResponse(BaseModel):
    status: str = "ok"
    provider: str
    camera_name: str | None = None
    location: str | None = None
    people_count: int = Field(ge=0, default=0)
    overall_confidence: int = Field(ge=0, le=100, default=0)
    needs_review: bool = False
    checks: list[MonitoringCheckOut]
    violations: list[MonitoringViolationOut]
    alerts_created: int = Field(default=0, ge=0)

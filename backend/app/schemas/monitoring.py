from typing import Any

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
    description: str = ""   # human-readable Arabic description (same as reason_ar)
    status: str = "new"     # lifecycle status: new | open | resolved
    person_index: int | None = None
    alias_of: str | None = None


class MonitoringAnalyzeResponse(BaseModel):
    ok: bool = True
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
    summary: str = ""
    frame_report: dict[str, Any] | None = None

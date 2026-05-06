from datetime import datetime

from pydantic import BaseModel, Field


class SupervisorCameraCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    location: str = Field(min_length=1, max_length=255)
    stream_url: str | None = Field(default=None, max_length=500)
    is_connected: bool = True
    ai_enabled: bool = False


class SupervisorCameraUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    location: str | None = Field(default=None, min_length=1, max_length=255)
    stream_url: str | None = Field(default=None, max_length=500)
    is_connected: bool | None = None
    ai_enabled: bool | None = None


class SupervisorCameraOut(BaseModel):
    id: int
    name: str
    location: str
    stream_url: str | None
    is_connected: bool
    ai_enabled: bool
    tenant_id: int
    last_analysis_at: datetime | None = None
    analysis_mode: str = "basic"


class SupervisorAlertOut(BaseModel):
    id: int
    type: str
    label_ar: str | None = None
    details: str
    branch: str | None = None
    location: str | None = None
    camera_id: int | None = None
    camera_name: str | None = None
    confidence: float
    created_at: datetime
    status: str
    resolved_at: datetime | None = None
    resolved_by: str | None = None

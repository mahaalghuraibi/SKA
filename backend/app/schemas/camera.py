from pydantic import BaseModel, ConfigDict, field_serializer

from app.security.stream_url import redact_stream_url_for_response


class CameraCreate(BaseModel):
    name: str
    location: str
    stream_url: str | None = None
    is_active: bool = True
    tenant_id: int


class CameraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: str
    stream_url: str | None
    is_active: bool
    tenant_id: int

    @field_serializer("stream_url")
    @classmethod
    def _redact_stream_url(cls, v: str | None) -> str | None:
        return redact_stream_url_for_response(v)

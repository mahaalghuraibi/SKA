from pydantic import BaseModel


class CameraCreate(BaseModel):
    name: str
    location: str
    stream_url: str | None = None
    is_active: bool = True
    tenant_id: int


class CameraOut(BaseModel):
    id: int
    name: str
    location: str
    stream_url: str | None
    is_active: bool
    tenant_id: int

    class Config:
        from_attributes = True

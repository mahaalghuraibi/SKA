from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


class AdminRequestCreate(BaseModel):
    name: str
    email: EmailStr
    company: str
    phone: str
    reason: str


class AdminRequestUpdate(BaseModel):
    status: Literal["approved", "rejected"]


class AdminRequestOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    company: str
    phone: str
    reason: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminRequestActionResponse(BaseModel):
    request: AdminRequestOut
    message: str

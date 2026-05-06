from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, computed_field, field_validator, model_validator


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    username: str = Field(min_length=2, max_length=64)
    password: str
    role: Literal["admin", "supervisor", "staff"] = "staff"
    tenant_id: int
    full_name: str | None = Field(default=None, max_length=255)
    organization_name: str | None = Field(default=None, max_length=255)
    branch_id: int | None = None
    branch_name: str | None = Field(default=None, max_length=255)
    supervisor_id: int | None = None
    supervisor_name: str | None = Field(default=None, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: object) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v

    @field_validator("full_name", mode="before")
    @classmethod
    def empty_full_name(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v  # type: ignore[return-value]

    @field_validator("username", mode="before")
    @classmethod
    def normalize_username(cls, v: object) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v  # type: ignore[return-value]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    is_admin: bool = False
    role: str
    tenant_id: int
    full_name: str | None = None
    avatar_url: str | None = None
    organization_name: str | None = None
    branch_id: int | None = None
    branch_name: str | None = None
    supervisor_id: int | None = None
    supervisor_name: str | None = None

    @computed_field
    @property
    def avatar_data_url(self) -> str | None:
        """Same storage as `avatar_url` (e.g. data URL or `/api/...` path); duplicated for API clients."""
        return self.avatar_url


class MeUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    full_name: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=400_000)
    avatar_data_url: str | None = Field(default=None, max_length=400_000)


class MePasswordUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=6, max_length=256)
    confirm_new_password: str = Field(min_length=6, max_length=256)

    @model_validator(mode="after")
    def passwords_match(self) -> "MePasswordUpdate":
        if self.new_password != self.confirm_new_password:
            raise ValueError("new_password and confirm_new_password must match")
        return self


class UserRoleUpdate(BaseModel):
    role: Literal["admin", "supervisor", "staff"]

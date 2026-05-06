from pydantic import BaseModel


class TokenResponse(BaseModel):
    id: int | None = None
    access_token: str
    token_type: str = "bearer"
    is_admin: bool = False
    role: str | None = None
    email: str | None = None
    username: str | None = None
    full_name: str | None = None

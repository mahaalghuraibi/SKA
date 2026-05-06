from pydantic import BaseModel


class MealTypeOut(BaseModel):
    id: int
    name_ar: str
    category: str
    aliases: str
    is_active: bool

    class Config:
        from_attributes = True

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)

    users = relationship("User", back_populates="tenant", cascade="all,delete")
    cameras = relationship("Camera", back_populates="tenant", cascade="all,delete")
    dish_records = relationship("DishRecord", back_populates="tenant", cascade="all,delete")

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="staff", nullable=False)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    organization_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    branch_id: Mapped[int | None] = mapped_column(nullable=True, index=True)
    branch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    supervisor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    supervisor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    tenant = relationship("Tenant", back_populates="users")
    supervisor = relationship("User", remote_side=[id], foreign_keys=[supervisor_id])
    dish_records = relationship(
        "DishRecord",
        back_populates="user",
        cascade="all,delete",
        foreign_keys="DishRecord.user_id",
    )

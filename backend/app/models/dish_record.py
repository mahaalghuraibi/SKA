from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DishRecord(Base):
    __tablename__ = "dish_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    predicted_label: Mapped[str] = mapped_column(String(255), nullable=False)
    confirmed_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    source_entity: Mapped[str] = mapped_column(String(100), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    needs_review: Mapped[bool] = mapped_column(default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending_review", nullable=False, index=True)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    reviewed_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejected_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    supervisor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_suggestions: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    employee_id: Mapped[int | None] = mapped_column(nullable=True, index=True)
    employee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employee_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    branch_id: Mapped[int | None] = mapped_column(nullable=True, index=True)
    branch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)

    user = relationship("User", back_populates="dish_records", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by_id])
    tenant = relationship("Tenant", back_populates="dish_records")

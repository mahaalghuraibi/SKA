from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MonitoringAlert(Base):
    __tablename__ = "monitoring_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    branch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    camera_id: Mapped[int | None] = mapped_column(ForeignKey("cameras.id"), nullable=True, index=True)
    camera_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    violation_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    label_ar: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False)
    reason_ar: Mapped[str] = mapped_column(Text, nullable=False)
    image_data_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_by_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    camera = relationship("Camera", back_populates="monitoring_alerts")

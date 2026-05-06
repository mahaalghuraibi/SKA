from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    stream_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    ai_enabled: Mapped[bool] = mapped_column(default=False, nullable=False)
    last_analysis_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    tenant = relationship("Tenant", back_populates="cameras")
    monitoring_alerts = relationship("MonitoringAlert", back_populates="camera")

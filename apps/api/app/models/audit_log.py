import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class AuditLog(IdTimestampMixin, Base):
    """Rastro de lecturas de datos personales (p. ej. el celular completo de un cliente)."""

    __tablename__ = "audit_log"
    __table_args__ = (Index("ix_audit_log_business_id_at", "business_id", "at"),)

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    action: Mapped[str] = mapped_column(String)
    entity: Mapped[str] = mapped_column(String)
    entity_id: Mapped[uuid.UUID]
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

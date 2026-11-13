import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class BarberTimeOff(IdTimestampMixin, Base):
    __tablename__ = "barber_time_off"
    __table_args__ = (CheckConstraint("ends_at > starts_at", name="ends_after_starts"),)

    barber_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("barber.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String)

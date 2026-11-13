import uuid
from datetime import time

from sqlalchemy import CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class BarberSchedule(IdTimestampMixin, Base):
    __tablename__ = "barber_schedule"
    __table_args__ = (
        CheckConstraint("weekday BETWEEN 0 AND 6", name="weekday_range"),
        CheckConstraint("end_time > start_time", name="end_after_start"),
    )

    barber_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("barber.id"))
    weekday: Mapped[int]  # 0 = lunes ... 6 = domingo
    start_time: Mapped[time]
    end_time: Mapped[time]

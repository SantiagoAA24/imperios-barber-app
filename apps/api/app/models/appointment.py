import enum
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class AppointmentStatus(enum.StrEnum):
    booked = "booked"
    attended = "attended"
    no_show = "no_show"
    cancelled = "cancelled"


class AppointmentSource(enum.StrEnum):
    online = "online"
    manual = "manual"
    walk_in = "walk_in"


_period = func.tstzrange(text("starts_at"), text("ends_at"), "[)")

# Las restricciones de exclusión viven en la migración (SQL literal); se declaran aquí para que
# el modelo documente la garantía. Alembic no compara restricciones de exclusión.
_ACTIVE = "status IN ('booked','attended')"


class Appointment(IdTimestampMixin, Base):
    __tablename__ = "appointment"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ends_after_starts"),
        CheckConstraint("price_cop >= 0", name="price_non_negative"),
        CheckConstraint("duration_min > 0", name="duration_positive"),
        ExcludeConstraint(
            ("barber_id", "="),
            (_period, "&&"),
            using="gist",
            where=text(_ACTIVE),
            name="appointment_no_barber_overlap",
        ),
        ExcludeConstraint(
            ("resource_id", "="),
            (_period, "&&"),
            using="gist",
            where=text(f"resource_id IS NOT NULL AND {_ACTIVE}"),
            name="appointment_no_resource_overlap",
        ),
        Index("ix_appointment_business_id_starts_at", "business_id", "starts_at"),
        Index("ix_appointment_barber_id_starts_at", "barber_id", "starts_at"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    barber_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("barber.id"))
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("client.id"))
    service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("service.id"))
    resource_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("resource.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status"),
        server_default=AppointmentStatus.booked.value,
    )
    source: Mapped[AppointmentSource] = mapped_column(
        Enum(AppointmentSource, name="appointment_source")
    )
    price_cop: Mapped[int]
    duration_min: Mapped[int]
    manage_token_hash: Mapped[str] = mapped_column(String, unique=True)
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

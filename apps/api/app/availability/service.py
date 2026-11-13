"""Carga de datos y llamada a ``compute_slots``. Aquí vive el I/O; el cálculo es puro."""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, select
from sqlalchemy.orm import Session

from app.availability.slots import Interval, compute_slots
from app.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    BarberSchedule,
    BarberTimeOff,
    Business,
    Service,
)

ACTIVE_STATUSES = (AppointmentStatus.booked, AppointmentStatus.attended)


@dataclass
class DayAvailability:
    """Inicios libres (UTC) por barbero candidato, más lo que hace falta para elegir entre ellos."""

    barbers: list[Barber]
    by_barber: dict[uuid.UUID, list[datetime]] = field(default_factory=dict)
    day_load: dict[uuid.UUID, int] = field(default_factory=dict)

    def slots(self) -> list[tuple[datetime, list[uuid.UUID]]]:
        """Cada hora libre con los barberos libres a esa hora (ordenados por nombre)."""
        names = {b.id: b.display_name for b in self.barbers}
        merged: dict[datetime, list[uuid.UUID]] = {}
        for barber_id, starts in self.by_barber.items():
            for s in starts:
                merged.setdefault(s, []).append(barber_id)
        return [
            (s, sorted(ids, key=lambda i: (names[i], str(i)))) for s, ids in sorted(merged.items())
        ]


def local_day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=tz)
    end = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz)
    return start.astimezone(UTC), end.astimezone(UTC)


def candidate_barbers(
    session: Session, business: Business, barber_id: uuid.UUID | None
) -> list[Barber]:
    """El barbero pedido o, sin barbero, todos los activos y visibles al agendar."""
    stmt = (
        select(Barber)
        .where(
            Barber.business_id == business.id,
            Barber.active.is_(True),
            Barber.visible_in_booking.is_(True),
        )
        .order_by(Barber.display_name, Barber.id)
    )
    if barber_id is not None:
        stmt = stmt.where(Barber.id == barber_id)
    return list(session.scalars(stmt))


def availability_for(
    session: Session,
    business: Business,
    barbers: list[Barber],
    *,
    duration_min: int,
    resource_id: uuid.UUID | None,
    day: date,
    now: datetime,
    ignore_appointment_id: uuid.UUID | None = None,
) -> DayAvailability:
    tz = ZoneInfo(business.timezone)
    day_start, day_end = local_day_bounds(day, tz)
    ids = [b.id for b in barbers]
    result = DayAvailability(barbers=barbers)
    if not ids:
        return result

    schedules: dict[uuid.UUID, list[tuple[time, time]]] = {i: [] for i in ids}
    for row in session.scalars(
        select(BarberSchedule).where(
            BarberSchedule.barber_id.in_(ids), BarberSchedule.weekday == day.weekday()
        )
    ):
        schedules[row.barber_id].append((row.start_time, row.end_time))

    time_off: dict[uuid.UUID, list[Interval]] = {i: [] for i in ids}
    for off in session.scalars(
        select(BarberTimeOff).where(
            BarberTimeOff.barber_id.in_(ids),
            BarberTimeOff.starts_at < day_end,
            BarberTimeOff.ends_at > day_start,
        )
    ):
        time_off[off.barber_id].append(Interval(off.starts_at, off.ends_at))

    # Citas activas del día de los candidatos y, si el servicio usa un recurso, de cualquiera.
    busy_filter: ColumnElement[bool] = Appointment.barber_id.in_(ids)
    if resource_id is not None:
        busy_filter = busy_filter | (Appointment.resource_id == resource_id)
    stmt = select(Appointment).where(
        Appointment.business_id == business.id,
        Appointment.status.in_(ACTIVE_STATUSES),
        Appointment.starts_at < day_end,
        Appointment.ends_at > day_start,
        busy_filter,
    )
    if ignore_appointment_id is not None:
        stmt = stmt.where(Appointment.id != ignore_appointment_id)
    own: dict[uuid.UUID, list[Interval]] = {i: [] for i in ids}
    resource_busy: list[Interval] = []
    for appt in session.scalars(stmt):
        span = Interval(appt.starts_at, appt.ends_at)
        if appt.barber_id in own:
            own[appt.barber_id].append(span)
        if resource_id is not None and appt.resource_id == resource_id:
            resource_busy.append(span)

    for barber in barbers:
        result.day_load[barber.id] = len(own[barber.id])
        result.by_barber[barber.id] = compute_slots(
            day=day,
            tz=tz,
            working=schedules[barber.id],
            blocked=[*time_off[barber.id], *own[barber.id]],
            resource_busy=resource_busy,
            duration_min=duration_min,
            slot_min=business.slot_min,
            now=now,
            min_lead_min=business.min_lead_min,
        )
    return result


def get_availability(
    session: Session,
    business: Business,
    service: Service,
    barber_id: uuid.UUID | None,
    day: date,
    *,
    now: datetime,
    ignore_appointment_id: uuid.UUID | None = None,
) -> DayAvailability:
    return availability_for(
        session,
        business,
        candidate_barbers(session, business, barber_id),
        duration_min=service.duration_min,
        resource_id=service.resource_id,
        day=day,
        now=now,
        ignore_appointment_id=ignore_appointment_id,
    )

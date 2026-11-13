"""Horario semanal y ausencias del barbero.

Cambiar el horario o crear una ausencia NO cancela citas ya reservadas: se devuelven en
``conflicts`` para que la pantalla se las muestre al barbero y él decida.
"""

import uuid
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    BarberSchedule,
    BarberTimeOff,
    Business,
    Client,
    Service,
)
from app.schemas.me import (
    ConflictOut,
    ScheduleBlock,
    ScheduleOut,
    TimeOffCreatedOut,
    TimeOffListOut,
    TimeOffOut,
)

MAX_REASON = 100
MAX_BLOCKS_PER_DAY = 4


# --- conflictos -------------------------------------------------------------------------------


def upcoming_booked(
    session: Session, business: Business, barber: Barber, now: datetime
) -> list[tuple[Appointment, Client, Service]]:
    rows = session.execute(
        select(Appointment, Client, Service)
        .join(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .where(
            Appointment.business_id == business.id,
            Appointment.barber_id == barber.id,
            Appointment.status == AppointmentStatus.booked,
            Appointment.ends_at > now,
        )
        .order_by(Appointment.starts_at, Appointment.id)
    ).all()
    return [(a, c, s) for a, c, s in rows]


def conflict_out(
    business: Business, appointment: Appointment, client: Client, service: Service
) -> ConflictOut:
    tz = ZoneInfo(business.timezone)
    return ConflictOut(
        appointment_id=appointment.id,
        starts_at=appointment.starts_at.astimezone(tz),
        ends_at=appointment.ends_at.astimezone(tz),
        client_name=client.name,
        service_name=service.name,
    )


def schedule_conflicts(
    session: Session,
    business: Business,
    barber: Barber,
    blocks: list[tuple[int, time, time]],
    now: datetime,
) -> list[ConflictOut]:
    """Citas reservadas que no caben enteras en algún tramo del horario dado."""
    tz = ZoneInfo(business.timezone)
    out: list[ConflictOut] = []
    for appointment, client, service in upcoming_booked(session, business, barber, now):
        start = appointment.starts_at.astimezone(tz)
        end = appointment.ends_at.astimezone(tz)
        fits = end.date() == start.date() and any(
            weekday == start.weekday() and seg_start <= start.time() and end.time() <= seg_end
            for weekday, seg_start, seg_end in blocks
        )
        if not fits:
            out.append(conflict_out(business, appointment, client, service))
    return out


def time_off_conflicts(
    session: Session,
    business: Business,
    barber: Barber,
    starts_at: datetime,
    ends_at: datetime,
    now: datetime,
) -> list[ConflictOut]:
    return [
        conflict_out(business, a, c, s)
        for a, c, s in upcoming_booked(session, business, barber, now)
        if a.starts_at < ends_at and starts_at < a.ends_at
    ]


# --- horario ----------------------------------------------------------------------------------


def _blocks(session: Session, barber: Barber) -> list[tuple[int, time, time]]:
    rows = session.execute(
        select(BarberSchedule.weekday, BarberSchedule.start_time, BarberSchedule.end_time)
        .where(BarberSchedule.barber_id == barber.id)
        .order_by(BarberSchedule.weekday, BarberSchedule.start_time)
    ).all()
    return [(w, s, e) for w, s, e in rows]


def _out(
    session: Session,
    business: Business,
    barber: Barber,
    blocks: list[tuple[int, time, time]],
    now: datetime,
) -> ScheduleOut:
    return ScheduleOut(
        schedule=[ScheduleBlock(weekday=w, start_time=s, end_time=e) for w, s, e in blocks],
        conflicts=schedule_conflicts(session, business, barber, blocks, now),
    )


def get_schedule(
    session: Session, business: Business, barber: Barber, now: datetime
) -> ScheduleOut:
    return _out(session, business, barber, _blocks(session, barber), now)


def _invalid(message: str, **details: object) -> ApiError:
    return ApiError(422, "invalid_schedule", message, dict(details))


def _validate(blocks: list[ScheduleBlock], slot_min: int) -> list[tuple[int, time, time]]:
    cleaned: list[tuple[int, time, time]] = []
    for b in blocks:
        if not 0 <= b.weekday <= 6:
            raise _invalid("El día de la semana no es válido.", weekday=b.weekday)
        for t in (b.start_time, b.end_time):
            minutes = t.hour * 60 + t.minute
            if t.second or t.microsecond or minutes % slot_min:
                raise _invalid(
                    f"Las horas van de {slot_min} en {slot_min} minutos (por ejemplo 9:00 o 9:30).",
                    weekday=b.weekday,
                )
        if b.end_time <= b.start_time:
            raise _invalid(
                "La hora de cierre debe ser después de la de apertura.", weekday=b.weekday
            )
        cleaned.append((b.weekday, b.start_time, b.end_time))
    cleaned.sort()
    for (w1, _s1, e1), (w2, s2, _e2) in zip(cleaned, cleaned[1:], strict=False):
        if w1 == w2 and s2 < e1:
            raise _invalid("Hay tramos que se cruzan el mismo día.", weekday=w1)
    per_day: dict[int, int] = {}
    for w, _, _ in cleaned:
        per_day[w] = per_day.get(w, 0) + 1
        if per_day[w] > MAX_BLOCKS_PER_DAY:
            raise _invalid("Un día admite hasta 4 tramos.", weekday=w)
    return cleaned


def replace_schedule(
    session: Session,
    business: Business,
    barber: Barber,
    blocks: list[ScheduleBlock],
    now: datetime,
) -> ScheduleOut:
    cleaned = _validate(blocks, business.slot_min)
    # Todo o nada: la sesión se confirma una sola vez, después de este reemplazo.
    session.execute(delete(BarberSchedule).where(BarberSchedule.barber_id == barber.id))
    session.add_all(
        BarberSchedule(barber_id=barber.id, weekday=w, start_time=s, end_time=e)
        for w, s, e in cleaned
    )
    session.flush()
    return _out(session, business, barber, cleaned, now)


# --- ausencias --------------------------------------------------------------------------------


def _time_off_out(business: Business, off: BarberTimeOff) -> TimeOffOut:
    tz = ZoneInfo(business.timezone)
    return TimeOffOut(
        id=off.id,
        starts_at=off.starts_at.astimezone(tz),
        ends_at=off.ends_at.astimezone(tz),
        reason=off.reason,
    )


def list_time_off(
    session: Session, business: Business, barber: Barber, now: datetime
) -> TimeOffListOut:
    """Ausencias en curso o futuras, la más próxima primero."""
    rows = session.scalars(
        select(BarberTimeOff)
        .where(BarberTimeOff.barber_id == barber.id, BarberTimeOff.ends_at > now)
        .order_by(BarberTimeOff.starts_at, BarberTimeOff.id)
    )
    return TimeOffListOut(items=[_time_off_out(business, off) for off in rows])


def create_time_off(
    session: Session,
    business: Business,
    barber: Barber,
    *,
    starts_at: datetime,
    ends_at: datetime,
    reason: str | None,
    now: datetime,
) -> TimeOffCreatedOut:
    reason_clean = " ".join((reason or "").split()) or None
    if reason_clean is not None and len(reason_clean) > MAX_REASON:
        raise ApiError(422, "invalid_time_off", f"El motivo admite hasta {MAX_REASON} caracteres.")
    if ends_at <= starts_at:
        raise ApiError(
            422, "invalid_time_off", "El fin de la ausencia debe ser después del inicio."
        )
    if ends_at <= now:
        raise ApiError(422, "invalid_time_off", "Esa ausencia ya pasó.")
    if ends_at - starts_at > timedelta(days=366):
        raise ApiError(422, "invalid_time_off", "Una ausencia no puede durar más de un año.")
    off = BarberTimeOff(
        barber_id=barber.id, starts_at=starts_at, ends_at=ends_at, reason=reason_clean
    )
    session.add(off)
    session.flush()
    return TimeOffCreatedOut(
        time_off=_time_off_out(business, off),
        conflicts=time_off_conflicts(session, business, barber, starts_at, ends_at, now),
    )


def delete_time_off(session: Session, barber: Barber, time_off_id: uuid.UUID) -> None:
    off = session.scalar(
        select(BarberTimeOff).where(
            BarberTimeOff.id == time_off_id, BarberTimeOff.barber_id == barber.id
        )
    )
    if off is None:
        raise ApiError(404, "time_off_not_found", "No encontramos esa ausencia.")
    session.delete(off)
    session.flush()

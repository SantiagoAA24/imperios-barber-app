"""Agenda del admin (día y semana). Crear y cambiar estado reutilizan la fase 6.

La lectura es una consulta de citas (JOIN con barbero, cliente y servicio) más una de horarios:
el número de consultas no depende de cuántas citas haya (sin N+1).
"""

import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.availability.service import local_day_bounds
from app.core.errors import ApiError
from app.models import (
    Appointment,
    AppointmentStatus,
    Barber,
    BarberSchedule,
    Business,
    Client,
    Service,
)
from app.schemas.admin import (
    AdminAgendaOut,
    AdminAppointmentCreateIn,
    AdminAppointmentOut,
    AgendaBarberOut,
    AgendaClientOut,
    AgendaServiceOut,
)
from app.services import barber_panel
from app.services.barber_panel import is_overdue, mask_phone

MAX_RANGE_DAYS = 8  # incluye el primer y el último día
DEFAULT_START = "09:00"
DEFAULT_END = "18:00"


def _out(
    business: Business,
    appointment: Appointment,
    barber: Barber,
    client: Client,
    service: Service,
    now: datetime,
) -> AdminAppointmentOut:
    tz = ZoneInfo(business.timezone)
    return AdminAppointmentOut(
        id=appointment.id,
        barber=AgendaBarberOut(id=barber.id, display_name=barber.display_name),
        # Duración y precio salen de la cita (copia hecha al reservar); el nombre, del servicio.
        service=AgendaServiceOut(
            name=service.name,
            duration_min=appointment.duration_min,
            uses_resource=appointment.resource_id is not None,
        ),
        client=AgendaClientOut(
            id=client.id, name=client.name, phone_masked=mask_phone(client.phone_e164)
        ),
        status=appointment.status,
        source=appointment.source,
        starts_at=appointment.starts_at.astimezone(tz),
        ends_at=appointment.ends_at.astimezone(tz),
        price_cop=appointment.price_cop,
        is_overdue=is_overdue(business, appointment, now),
    )


def _grid_hours(session: Session, business: Business, first: date, last: date) -> tuple[str, str]:
    weekdays = sorted(
        {(first + timedelta(days=i)).weekday() for i in range((last - first).days + 1)}
    )
    lo, hi = session.execute(
        select(func.min(BarberSchedule.start_time), func.max(BarberSchedule.end_time))
        .join(Barber, Barber.id == BarberSchedule.barber_id)
        .where(
            Barber.business_id == business.id,
            Barber.active.is_(True),
            BarberSchedule.weekday.in_(weekdays),
        )
    ).one()
    fmt = "%H:%M"
    return (
        lo.strftime(fmt) if isinstance(lo, time) else DEFAULT_START,
        hi.strftime(fmt) if isinstance(hi, time) else DEFAULT_END,
    )


def list_appointments(
    session: Session,
    business: Business,
    first: date,
    last: date,
    barber_id: uuid.UUID | None,
    include_cancelled: bool,
    now: datetime,
) -> AdminAgendaOut:
    if last < first:
        raise ApiError(422, "invalid_range", "La fecha final no puede ser anterior a la inicial.")
    if (last - first).days + 1 > MAX_RANGE_DAYS:
        raise ApiError(
            422,
            "range_too_large",
            f"El rango máximo es de {MAX_RANGE_DAYS} días.",
        )
    tz = ZoneInfo(business.timezone)
    start, _ = local_day_bounds(first, tz)
    _, end = local_day_bounds(last, tz)
    stmt = (
        select(Appointment, Barber, Client, Service)
        .join(Barber, Barber.id == Appointment.barber_id)
        .join(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .where(
            Appointment.business_id == business.id,
            Appointment.starts_at >= start,
            Appointment.starts_at < end,
        )
        .order_by(Appointment.starts_at, Barber.display_name, Appointment.id)
    )
    if barber_id is not None:
        stmt = stmt.where(Appointment.barber_id == barber_id)
    if not include_cancelled:
        stmt = stmt.where(Appointment.status != AppointmentStatus.cancelled)
    rows = session.execute(stmt).all()
    day_start, day_end = _grid_hours(session, business, first, last)
    return AdminAgendaOut(
        items=[_out(business, a, b, c, s, now) for a, b, c, s in rows],
        day_start=day_start,
        day_end=day_end,
    )


def get_one(
    session: Session, business: Business, appointment_id: uuid.UUID, now: datetime
) -> AdminAppointmentOut:
    row = session.execute(
        select(Appointment, Barber, Client, Service)
        .join(Barber, Barber.id == Appointment.barber_id)
        .join(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .where(Appointment.id == appointment_id, Appointment.business_id == business.id)
    ).first()
    if row is None:
        raise ApiError(404, "appointment_not_found", "No encontramos esta cita.")
    return _out(business, row[0], row[1], row[2], row[3], now)


def _barber(session: Session, business: Business, barber_id: uuid.UUID) -> Barber:
    barber = session.scalar(
        select(Barber).where(Barber.id == barber_id, Barber.business_id == business.id)
    )
    if barber is None:
        raise ApiError(404, "not_found", "No encontramos a ese barbero.")
    if not barber.active:
        raise ApiError(409, "barber_inactive", "Ese barbero está inactivo y no recibe citas.")
    return barber


def available_starts(
    session: Session,
    business: Business,
    barber_id: uuid.UUID,
    service_id: uuid.UUID,
    day: date,
    now: datetime,
) -> list[datetime]:
    barber = _barber(session, business, barber_id)
    return barber_panel.own_availability(session, business, barber, service_id, day, now)


def create_appointment(
    session: Session, business: Business, body: AdminAppointmentCreateIn, now: datetime
) -> AdminAppointmentOut:
    """Cita manual para el barbero indicado, con las mismas protecciones de doble reserva."""
    barber = _barber(session, business, body.barber_id)
    created = barber_panel.create_for_barber(
        session,
        business,
        barber,
        service_id=body.service_id,
        starts_at=body.starts_at,
        walk_in=False,
        source="manual",
        name=body.client.name,
        phone=body.client.phone,
        note=body.note,
        now=now,
    )
    session.commit()  # los servicios de la fase 6 no confirman: lo hace quien los llama
    return get_one(session, business, created.id, now)


def change_status(
    session: Session,
    business: Business,
    appointment_id: uuid.UUID,
    target: AppointmentStatus,
    now: datetime,
) -> AdminAppointmentOut:
    """Mismas transiciones, tolerancia y 409 que el panel del barbero (fase 6)."""
    barber = session.scalar(
        select(Barber)
        .join(Appointment, Appointment.barber_id == Barber.id)
        .where(Appointment.id == appointment_id, Appointment.business_id == business.id)
    )
    if barber is None:
        raise ApiError(404, "appointment_not_found", "No encontramos esta cita.")
    barber_panel.change_status(session, business, barber, appointment_id, target, now)
    session.commit()
    return get_one(session, business, appointment_id, now)

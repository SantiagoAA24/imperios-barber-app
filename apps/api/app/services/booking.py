"""Reglas de reserva: crear, ver, cancelar y reprogramar. La base de datos es la fuente de verdad.

La disponibilidad se calcula con ``app.availability``; aquí solo se decide qué hacer con ella y se
traduce la violación de exclusión (SQLSTATE 23P01) en un 409 con alternativas.
"""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.availability.service import (
    DayAvailability,
    availability_for,
    candidate_barbers,
    get_availability,
)
from app.core.errors import ApiError
from app.core.phone import INVALID_PHONE_MESSAGE, InvalidPhoneError, normalize_phone
from app.models import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
    Barber,
    Business,
    Client,
    Service,
)
from app.schemas.booking import (
    BarberBrief,
    BusinessBrief,
    ClientBrief,
    PublicAppointment,
    ServiceBrief,
)

MAX_DAYS_AHEAD = 60
EXCLUSION_VIOLATION = "23P01"
# Dos INSERT simultáneos contra una restricción de exclusión pueden bloquearse entre sí:
# PostgreSQL aborta a uno con 40P01 en lugar de 23P01. Es la misma carrera perdida.
DEADLOCK_DETECTED = "40P01"
LOST_RACE = {EXCLUSION_VIOLATION, DEADLOCK_DETECTED}
MAX_ALTERNATIVES = 3


# --- utilidades -------------------------------------------------------------------------------


def new_manage_token() -> str:
    return secrets.token_urlsafe(16)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _lost_race(exc: DBAPIError) -> bool:
    return getattr(exc.orig, "sqlstate", None) in LOST_RACE


def _human_minutes(minutes: int) -> str:
    if minutes % 60 == 0:
        hours = minutes // 60
        return "1 hora" if hours == 1 else f"{hours} horas"
    return f"{minutes} minutos"


def local_day(business: Business, instant: datetime) -> date:
    return instant.astimezone(ZoneInfo(business.timezone)).date()


def check_day_in_range(business: Business, day: date, now: datetime) -> None:
    today = local_day(business, now)
    if day < today or day > today + timedelta(days=MAX_DAYS_AHEAD):
        raise ApiError(
            422,
            "date_out_of_range",
            f"Elige una fecha entre hoy y los próximos {MAX_DAYS_AHEAD} días.",
        )


def _iso(business: Business, instant: datetime) -> str:
    return instant.astimezone(ZoneInfo(business.timezone)).isoformat()


# --- catálogo ---------------------------------------------------------------------------------


def load_service(session: Session, business: Business, service_id: uuid.UUID) -> Service:
    service = session.scalar(
        select(Service).where(
            Service.id == service_id,
            Service.business_id == business.id,
            Service.active.is_(True),
        )
    )
    if service is None:
        raise ApiError(404, "service_not_found", "No encontramos ese servicio.")
    return service


def _barbers_for(session: Session, business: Business, barber_id: uuid.UUID | None) -> list[Barber]:
    barbers = candidate_barbers(session, business, barber_id)
    if barber_id is not None and not barbers:
        raise ApiError(404, "barber_not_found", "No encontramos a ese barbero.")
    return barbers


# --- disponibilidad pública -------------------------------------------------------------------


def public_availability(
    session: Session,
    business: Business,
    *,
    service_id: uuid.UUID,
    barber_id: uuid.UUID | None,
    day: date,
    now: datetime,
) -> list[dict[str, object]]:
    check_day_in_range(business, day, now)
    service = load_service(session, business, service_id)
    _barbers_for(session, business, barber_id)
    avail = get_availability(session, business, service, barber_id, day, now=now)
    return [{"starts_at": _iso(business, s), "barber_ids": ids} for s, ids in avail.slots()]


def _alternatives(
    business: Business, avail: DayAvailability, target: datetime
) -> list[dict[str, object]]:
    """Hasta 3 horarios libres del mismo día, los más cercanos al pedido, en orden cronológico."""
    options = [(s, ids) for s, ids in avail.slots() if s != target]
    nearest = sorted(options, key=lambda o: (abs(o[0] - target), o[0]))[:MAX_ALTERNATIVES]
    return [
        {"starts_at": _iso(business, s), "barber_ids": [str(i) for i in ids]}
        for s, ids in sorted(nearest)
    ]


def _slot_unavailable(
    session: Session,
    business: Business,
    barbers: list[Barber],
    *,
    duration_min: int,
    resource_id: uuid.UUID | None,
    day: date,
    now: datetime,
    target: datetime,
    ignore_appointment_id: uuid.UUID | None = None,
) -> ApiError:
    # Se recalcula con lo que ya está confirmado en la base (incluida la cita que ganó la carrera).
    fresh = availability_for(
        session,
        business,
        barbers,
        duration_min=duration_min,
        resource_id=resource_id,
        day=day,
        now=now,
        ignore_appointment_id=ignore_appointment_id,
    )
    return ApiError(
        409,
        "slot_unavailable",
        "Ese horario ya no está disponible. Elige otro de los que te mostramos.",
        {"alternatives": _alternatives(business, fresh, target)},
    )


# --- crear ------------------------------------------------------------------------------------


def clean_client_input(name: str, phone: str) -> tuple[str, str]:
    name = " ".join(name.split())
    if not 2 <= len(name) <= 60:
        raise ApiError(422, "invalid_name", "Escribe tu nombre (entre 2 y 60 caracteres).")
    try:
        return name, normalize_phone(phone)
    except InvalidPhoneError:
        raise ApiError(422, "invalid_phone", INVALID_PHONE_MESSAGE) from None


def _find_or_create_client(
    session: Session, business: Business, name: str, phone: str, now: datetime
) -> Client:
    # ON CONFLICT: dos solicitudes simultáneas con el mismo celular no chocan con el índice único.
    session.execute(
        pg_insert(Client)
        .values(business_id=business.id, name=name, phone_e164=phone, consent_at=now)
        .on_conflict_do_nothing(
            index_elements=[Client.business_id, Client.phone_e164],
            index_where=text("phone_e164 IS NOT NULL"),
        )
    )
    client = session.scalars(
        select(Client).where(Client.business_id == business.id, Client.phone_e164 == phone)
    ).one()
    client.consent_at = now  # conserva el nombre existente; el UPDATE toma el bloqueo del cliente
    session.flush()
    return client


@dataclass(frozen=True)
class BookingResult:
    appointment: Appointment
    token: str
    service: Service
    barber: Barber
    client: Client


def create_appointment(
    session: Session,
    business: Business,
    *,
    service_id: uuid.UUID,
    barber_id: uuid.UUID | None,
    starts_at: datetime,
    name: str,
    phone_e164: str,
    now: datetime,
) -> BookingResult:
    starts = starts_at.astimezone(UTC)
    day = local_day(business, starts)
    check_day_in_range(business, day, now)
    service = load_service(session, business, service_id)
    barbers = _barbers_for(session, business, barber_id)

    # (a) Recalcular en el servidor y exigir que el horario esté en la lista.
    avail = availability_for(
        session,
        business,
        barbers,
        duration_min=service.duration_min,
        resource_id=service.resource_id,
        day=day,
        now=now,
    )
    free = [b for b in barbers if starts in avail.by_barber[b.id]]

    def unavailable() -> ApiError:
        return _slot_unavailable(
            session,
            business,
            barbers,
            duration_min=service.duration_min,
            resource_id=service.resource_id,
            day=day,
            now=now,
            target=starts,
        )

    if not free:
        raise unavailable()

    # (b) y (c) Cliente por celular y tope de citas activas.
    client = _find_or_create_client(session, business, name, phone_e164, now)
    active = session.scalar(
        select(func.count())
        .select_from(Appointment)
        .where(
            Appointment.business_id == business.id,
            Appointment.client_id == client.id,
            Appointment.status == AppointmentStatus.booked,
            Appointment.starts_at > now,
        )
    )
    if (active or 0) >= business.max_active_per_phone:
        raise ApiError(
            422,
            "too_many_active",
            f"Ya tienes {active} citas agendadas con este celular. "
            "Cancela una para poder agendar otra.",
        )

    # (d) Sin barbero: el que tenga menos citas ese día, luego por nombre.
    free.sort(key=lambda b: (avail.day_load[b.id], b.display_name, str(b.id)))
    token = new_manage_token()
    for barber in free:
        appointment = Appointment(
            business_id=business.id,
            barber_id=barber.id,
            client_id=client.id,
            service_id=service.id,
            resource_id=service.resource_id,
            starts_at=starts,
            ends_at=starts + timedelta(minutes=service.duration_min),
            status=AppointmentStatus.booked,
            source=AppointmentSource.online,
            price_cop=service.price_cop,
            duration_min=service.duration_min,
            manage_token_hash=hash_token(token),
        )
        # (e)/(f) El INSERT decide; si otra transacción ganó, la base lanza 23P01 y se prueba
        # el siguiente candidato. El savepoint conserva el cliente ya creado.
        try:
            with session.begin_nested():
                session.add(appointment)
                session.flush()
        except DBAPIError as exc:
            if not _lost_race(exc):
                raise
            continue
        return BookingResult(appointment, token, service, barber, client)
    raise unavailable()


# --- ver, cancelar, reprogramar ---------------------------------------------------------------


def find_by_token(
    session: Session, business: Business, token: str, *, lock: bool = False
) -> Appointment:
    stmt = select(Appointment).where(
        Appointment.business_id == business.id,
        Appointment.manage_token_hash == hash_token(token),
    )
    if lock:
        # Solo serializa cancelar/reprogramar de la MISMA cita; la doble reserva la evita la base.
        stmt = stmt.with_for_update()
    appointment = session.scalar(stmt)
    if appointment is None:
        raise ApiError(404, "appointment_not_found", "No encontramos esta cita.")
    return appointment


def _within_notice(business: Business, appointment: Appointment, now: datetime) -> bool:
    return appointment.starts_at - now >= timedelta(minutes=business.cancel_min_notice_min)


def can_change(business: Business, appointment: Appointment, now: datetime) -> bool:
    return appointment.status == AppointmentStatus.booked and _within_notice(
        business, appointment, now
    )


def present(
    session: Session, business: Business, appointment: Appointment, now: datetime
) -> PublicAppointment:
    service = session.get(Service, appointment.service_id)
    barber = session.get(Barber, appointment.barber_id)
    client = session.get(Client, appointment.client_id)
    assert service is not None and barber is not None and client is not None
    tz = ZoneInfo(business.timezone)
    allowed = can_change(business, appointment, now)
    return PublicAppointment(
        id=appointment.id,
        status=appointment.status,
        starts_at=appointment.starts_at.astimezone(tz),
        ends_at=appointment.ends_at.astimezone(tz),
        # Precio y duración salen de la cita (copiados al reservar), el nombre del servicio vivo.
        service=ServiceBrief(
            id=service.id,
            name=service.name,
            price_cop=appointment.price_cop,
            duration_min=appointment.duration_min,
        ),
        barber=BarberBrief(id=barber.id, display_name=barber.display_name),
        client=ClientBrief(first_name=client.name.split()[0] if client.name.split() else ""),
        business=BusinessBrief(name=business.name),
        can_cancel=allowed,
        can_reschedule=allowed,
    )


def _check_changeable(
    business: Business, appointment: Appointment, now: datetime, verb: str
) -> None:
    if appointment.status != AppointmentStatus.booked:
        raise ApiError(409, "appointment_not_active", "Esta cita ya no está activa.")
    if not _within_notice(business, appointment, now):
        raise ApiError(
            409,
            "too_late_to_cancel" if verb == "cancelar" else "too_late_to_reschedule",
            f"Para {verb} con menos de {_human_minutes(business.cancel_min_notice_min)} "
            "de anticipación, escríbele al local.",
        )


def cancel_appointment(
    session: Session, business: Business, token: str, now: datetime
) -> Appointment:
    appointment = find_by_token(session, business, token, lock=True)
    _check_changeable(business, appointment, now, "cancelar")
    appointment.status = AppointmentStatus.cancelled
    appointment.cancelled_at = now
    session.flush()
    return appointment


def reschedule_appointment(
    session: Session, business: Business, token: str, starts_at: datetime, now: datetime
) -> Appointment:
    appointment = find_by_token(session, business, token, lock=True)
    _check_changeable(business, appointment, now, "reprogramar")
    starts = starts_at.astimezone(UTC)
    day = local_day(business, starts)
    check_day_in_range(business, day, now)

    # Mismo barbero, misma duración y mismo recurso que se copiaron al reservar.
    barber = session.scalar(
        select(Barber).where(
            Barber.id == appointment.barber_id,
            Barber.business_id == business.id,
            Barber.active.is_(True),
        )
    )
    barbers = [barber] if barber is not None else []
    avail = availability_for(
        session,
        business,
        barbers,
        duration_min=appointment.duration_min,
        resource_id=appointment.resource_id,
        day=day,
        now=now,
        ignore_appointment_id=appointment.id,  # la propia cita no bloquea su nuevo horario
    )

    def unavailable() -> ApiError:
        return _slot_unavailable(
            session,
            business,
            barbers,
            duration_min=appointment.duration_min,
            resource_id=appointment.resource_id,
            day=day,
            now=now,
            target=starts,
            ignore_appointment_id=appointment.id,
        )

    if barber is None or starts not in avail.by_barber[barber.id]:
        raise unavailable()

    try:
        with session.begin_nested():
            appointment.starts_at = starts
            appointment.ends_at = starts + timedelta(minutes=appointment.duration_min)
            session.flush()
    except DBAPIError as exc:
        if not _lost_race(exc):
            raise
        session.expire(appointment)  # vuelve a los valores confirmados en la base
        raise unavailable() from None
    return appointment

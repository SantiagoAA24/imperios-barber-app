"""Reglas del panel del barbero: agenda del día, cambios de estado y citas manuales.

Todo se filtra por ``business_id`` y por el barbero del token: una cita de otro barbero (o de otro
negocio) responde 404, igual que una que no existe. El servidor decide ``is_overdue`` y las
transiciones; el cliente solo las muestra.
"""

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.availability.next_free import NO_FREE_TIME
from app.availability.service import (
    availability_for,
    barber_next_free,
    local_day_bounds,
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
    User,
)
from app.schemas.me import (
    AgendaOut,
    DaySummary,
    MeAppointmentOut,
    MeClientOut,
    MeServiceOut,
    PendingReviewOut,
)
from app.services.booking import (
    LOST_RACE,
    alternatives,
    check_day_in_range,
    hash_token,
    load_service,
    local_day,
    new_manage_token,
    slot_unavailable,
)

ATTEND_EARLY_MIN = 15
# «Citas por revisar»: siguen en 'booked' y terminaron hace más de 2 horas, dentro de los últimos
# 7 días. Se calcula al consultar; no hay tarea programada que las cierre.
REVIEW_AFTER = timedelta(hours=2)
REVIEW_WINDOW = timedelta(days=7)
IN_PERSON_CONSENT_NOTE = "Consentimiento recogido en persona."
MAX_NOTE = 200

# Transiciones válidas. 'no_show' -> 'attended' cubre al cliente que llegó tarde.
TRANSITIONS: dict[AppointmentStatus, set[AppointmentStatus]] = {
    AppointmentStatus.booked: {
        AppointmentStatus.attended,
        AppointmentStatus.no_show,
        AppointmentStatus.cancelled,
    },
    AppointmentStatus.no_show: {AppointmentStatus.attended},
}

STATUS_WORDS = {
    AppointmentStatus.booked: "pendiente",
    AppointmentStatus.attended: "atendida",
    AppointmentStatus.no_show: "marcada como no asistió",
    AppointmentStatus.cancelled: "cancelada",
}


def barber_for_user(session: Session, user: User) -> Barber:
    barber = session.scalar(
        select(Barber).where(
            Barber.user_id == user.id,
            Barber.business_id == user.business_id,
            Barber.active.is_(True),
        )
    )
    if barber is None:
        raise ApiError(403, "no_barber_profile", "Tu usuario no tiene un perfil de barbero activo.")
    return barber


# --- presentación -----------------------------------------------------------------------------


def mask_phone(phone_e164: str | None) -> str | None:
    """'+573001234567' -> '300 *** 4567'."""
    if not phone_e164:
        return None
    digits = phone_e164.removeprefix("+57")
    if len(digits) != 10:
        return "*** ***"
    return f"{digits[:3]} *** {digits[6:]}"


def is_overdue(business: Business, appointment: Appointment, now: datetime) -> bool:
    limit = appointment.starts_at + timedelta(minutes=business.tolerance_min)
    return appointment.status == AppointmentStatus.booked and now > limit


def present(
    business: Business,
    appointment: Appointment,
    client: Client,
    service: Service,
    now: datetime,
) -> MeAppointmentOut:
    tz = ZoneInfo(business.timezone)
    needs_contact = appointment.status in (AppointmentStatus.booked, AppointmentStatus.no_show)
    return MeAppointmentOut(
        id=appointment.id,
        status=appointment.status,
        source=appointment.source,
        starts_at=appointment.starts_at.astimezone(tz),
        ends_at=appointment.ends_at.astimezone(tz),
        # Precio y duración salen de la cita (copiados al reservar); el nombre, del servicio vivo.
        service=MeServiceOut(
            name=service.name,
            duration_min=appointment.duration_min,
            price_cop=appointment.price_cop,
            uses_resource=appointment.resource_id is not None,
        ),
        client=MeClientOut(
            id=client.id,
            name=client.name,
            phone_masked=mask_phone(client.phone_e164),
            phone_e164=client.phone_e164 if needs_contact else None,
        ),
        is_overdue=is_overdue(business, appointment, now),
        reminder_sent_at=appointment.reminder_sent_at,
    )


def _present_one(
    session: Session, business: Business, appointment: Appointment, now: datetime
) -> MeAppointmentOut:
    client = session.get(Client, appointment.client_id)
    service = session.get(Service, appointment.service_id)
    assert client is not None and service is not None
    return present(business, appointment, client, service, now)


# --- agenda del día ---------------------------------------------------------------------------


def day_agenda(
    session: Session,
    business: Business,
    barber: Barber,
    day: date,
    *,
    include_cancelled: bool,
    now: datetime,
) -> AgendaOut:
    start, end = local_day_bounds(day, ZoneInfo(business.timezone))
    stmt = (
        select(Appointment, Client, Service)
        .join(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .where(
            Appointment.business_id == business.id,
            Appointment.barber_id == barber.id,
            Appointment.starts_at >= start,
            Appointment.starts_at < end,
        )
        .order_by(Appointment.starts_at, Appointment.id)
    )
    if not include_cancelled:
        stmt = stmt.where(Appointment.status != AppointmentStatus.cancelled)
    rows = session.execute(stmt).all()

    live = [a for a, _, _ in rows if a.status != AppointmentStatus.cancelled]
    summary = DaySummary(
        total=len(live),
        attended=sum(a.status == AppointmentStatus.attended for a in live),
        pending=sum(a.status == AppointmentStatus.booked for a in live),
        no_show=sum(a.status == AppointmentStatus.no_show for a in live),
        revenue_cop=sum(a.price_cop for a in live if a.status == AppointmentStatus.attended),
    )
    return AgendaOut(
        date=day.isoformat(),
        appointments=[present(business, a, c, s, now) for a, c, s in rows],
        summary=summary,
    )


def pending_review_filters(business: Business, now: datetime) -> tuple[object, ...]:
    """Condiciones SQL de «por revisar»; las comparten el panel del barbero y el del admin."""
    return (
        Appointment.business_id == business.id,
        Appointment.status == AppointmentStatus.booked,
        Appointment.ends_at < now - REVIEW_AFTER,
        Appointment.ends_at >= now - REVIEW_WINDOW,
    )


def pending_review(
    session: Session, business: Business, barber: Barber, now: datetime
) -> PendingReviewOut:
    rows = session.execute(
        select(Appointment, Client, Service)
        .join(Client, Client.id == Appointment.client_id)
        .join(Service, Service.id == Appointment.service_id)
        .where(*pending_review_filters(business, now), Appointment.barber_id == barber.id)  # type: ignore[arg-type]
        .order_by(Appointment.starts_at, Appointment.id)
    ).all()
    items = [present(business, a, c, s, now) for a, c, s in rows]
    return PendingReviewOut(count=len(items), items=items)


# --- recordatorio por WhatsApp ----------------------------------------------------------------


def mark_reminder_sent(
    session: Session,
    business: Business,
    barber: Barber,
    appointment_id: uuid.UUID,
    now: datetime,
) -> MeAppointmentOut:
    """Guarda cuándo el barbero abrió el recordatorio. Repetirlo es seguro: deja la cita marcada
    y solo mueve la hora al último reenvío («Recordatorio enviado hace X»)."""
    appointment = session.scalar(
        select(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.business_id == business.id,
            Appointment.barber_id == barber.id,
        )
        .with_for_update()
    )
    if appointment is None:
        raise ApiError(404, "appointment_not_found", "No encontramos esta cita.")
    if appointment.status != AppointmentStatus.booked:
        raise ApiError(
            409,
            "reminder_not_applicable",
            f"Esta cita ya está {STATUS_WORDS[appointment.status]}; no lleva recordatorio.",
        )
    appointment.reminder_sent_at = now
    session.flush()
    return _present_one(session, business, appointment, now)


# --- cambiar estado ---------------------------------------------------------------------------


def change_status(
    session: Session,
    business: Business,
    barber: Barber,
    appointment_id: uuid.UUID,
    target: AppointmentStatus,
    now: datetime,
) -> MeAppointmentOut:
    appointment = session.scalar(
        select(Appointment)
        .where(
            Appointment.id == appointment_id,
            Appointment.business_id == business.id,
            Appointment.barber_id == barber.id,
        )
        .with_for_update()  # dos toques seguidos no se pisan
    )
    if appointment is None:
        raise ApiError(404, "appointment_not_found", "No encontramos esta cita.")

    current = appointment.status
    if target not in TRANSITIONS.get(current, set()):
        raise ApiError(
            409,
            "invalid_transition",
            f"Esta cita ya está {STATUS_WORDS[current]}; no se puede cambiar así.",
            {"from": current.value, "to": target.value},
        )
    if target == AppointmentStatus.no_show:
        limit = appointment.starts_at + timedelta(minutes=business.tolerance_min)
        if now <= limit:
            raise ApiError(
                409,
                "too_early_for_no_show",
                f"Todavía estás dentro de los {business.tolerance_min} minutos de espera.",
            )
    early_limit = appointment.starts_at - timedelta(minutes=ATTEND_EARLY_MIN)
    if (
        target == AppointmentStatus.attended
        and current == AppointmentStatus.booked
        and (now < early_limit)
    ):
        raise ApiError(
            409,
            "too_early_for_attended",
            f"Solo puedes marcarla como atendida desde {ATTEND_EARLY_MIN} minutos antes.",
        )

    try:
        with session.begin_nested():
            appointment.status = target
            if target == AppointmentStatus.cancelled:
                appointment.cancelled_at = (
                    now  # el hueco queda libre: la exclusión ignora esta fila
                )
            session.flush()
    except DBAPIError as exc:
        # no_show -> attended vuelve a ocupar un hueco que otra cita pudo tomar mientras tanto.
        if getattr(exc.orig, "sqlstate", None) not in LOST_RACE:
            raise
        session.expire(appointment)
        raise ApiError(
            409,
            "slot_taken",
            "Ese horario ya lo ocupó otra cita, así que no se puede marcar como atendida.",
        ) from None
    return _present_one(session, business, appointment, now)


# --- disponibilidad y turno sin cita ----------------------------------------------------------


def own_availability(
    session: Session,
    business: Business,
    barber: Barber,
    service_id: uuid.UUID,
    day: date,
    now: datetime,
) -> list[datetime]:
    """Inicios libres del propio barbero (cuadrícula de 30 min, sin margen de anticipación)."""
    check_day_in_range(business, day, now)
    service = load_service(session, business, service_id)
    avail = availability_for(
        session,
        business,
        [barber],
        duration_min=service.duration_min,
        resource_id=service.resource_id,
        day=day,
        now=now,
        min_lead_min=0,
    )
    return avail.by_barber[barber.id]


def next_free(
    session: Session, business: Business, barber: Barber, service_id: uuid.UUID, now: datetime
) -> datetime:
    service = load_service(session, business, service_id)
    start = barber_next_free(session, business, barber, service, now=now)
    if start is None:
        raise ApiError(409, "no_free_time", NO_FREE_TIME)
    return start


# --- crear ------------------------------------------------------------------------------------


def _clean_name(name: str) -> str:
    name = " ".join(name.split())
    if not 2 <= len(name) <= 60:
        raise ApiError(422, "invalid_name", "Escribe el nombre del cliente (2 a 60 caracteres).")
    return name


def _clean_phone(phone: str | None) -> str | None:
    if phone is None or not phone.strip():
        return None
    try:
        return normalize_phone(phone)
    except InvalidPhoneError:
        raise ApiError(422, "invalid_phone", INVALID_PHONE_MESSAGE) from None


def _clean_note(note: str | None) -> str | None:
    text_ = " ".join((note or "").split())
    if len(text_) > MAX_NOTE:
        raise ApiError(422, "invalid_note", f"La nota admite hasta {MAX_NOTE} caracteres.")
    return text_ or None


def _client_for_barber(
    session: Session,
    business: Business,
    name: str,
    phone: str | None,
    note: str | None,
) -> Client:
    """Cliente por celular (se reutiliza) o uno nuevo sin celular.

    El barbero recoge el consentimiento en persona: ``consent_at`` queda nulo y la nota lo deja
    escrito. A un cliente que ya existe no se le toca el nombre ni el consentimiento.
    """
    fresh_notes = f"{IN_PERSON_CONSENT_NOTE} {note}" if note else IN_PERSON_CONSENT_NOTE
    if phone is None:
        client = Client(business_id=business.id, name=name, notes=fresh_notes)
        session.add(client)
        session.flush()
        return client
    inserted = session.execute(
        pg_insert(Client)
        .values(business_id=business.id, name=name, phone_e164=phone, notes=fresh_notes)
        .on_conflict_do_nothing(
            index_elements=[Client.business_id, Client.phone_e164],
            index_where=text("phone_e164 IS NOT NULL"),
        )
        .returning(Client.id)
    ).scalar_one_or_none()
    client = session.scalars(
        select(Client).where(Client.business_id == business.id, Client.phone_e164 == phone)
    ).one()
    if inserted is None and note:
        client.notes = f"{client.notes} | {note}" if client.notes else note
        session.flush()
    return client


def create_for_barber(
    session: Session,
    business: Business,
    barber: Barber,
    *,
    service_id: uuid.UUID,
    starts_at: datetime | None,
    walk_in: bool,
    source: str | None,
    name: str,
    phone: str | None,
    note: str | None,
    now: datetime,
) -> MeAppointmentOut:
    expected = "walk_in" if walk_in else "manual"
    if source is not None and source != expected:
        raise ApiError(
            422,
            "invalid_source",
            "El origen no coincide: usa 'walk_in' solo con turno sin cita.",
        )
    if walk_in and starts_at is not None:
        raise ApiError(422, "invalid_start", "Un turno sin cita empieza ya: no envíes la hora.")
    if not walk_in and starts_at is None:
        raise ApiError(422, "invalid_start", "Elige el día y la hora de la cita.")

    clean_name = _clean_name(name)
    clean_phone = _clean_phone(phone)
    clean_note = _clean_note(note)
    service = load_service(session, business, service_id)

    if walk_in:
        starts = barber_next_free(session, business, barber, service, now=now)
        if starts is None:
            raise ApiError(409, "no_free_time", NO_FREE_TIME)
    else:
        assert starts_at is not None
        starts = starts_at.astimezone(UTC)
        day = local_day(business, starts)
        check_day_in_range(business, day, now)
        free = availability_for(
            session,
            business,
            [barber],
            duration_min=service.duration_min,
            resource_id=service.resource_id,
            day=day,
            now=now,
            min_lead_min=0,
        ).by_barber[barber.id]
        if starts not in free:
            raise slot_unavailable(
                session,
                business,
                [barber],
                duration_min=service.duration_min,
                resource_id=service.resource_id,
                day=day,
                now=now,
                target=starts,
                min_lead_min=0,
            )

    client = _client_for_barber(session, business, clean_name, clean_phone, clean_note)
    appointment = Appointment(
        business_id=business.id,
        barber_id=barber.id,
        client_id=client.id,
        service_id=service.id,
        resource_id=service.resource_id,
        starts_at=starts,
        ends_at=starts + timedelta(minutes=service.duration_min),
        status=AppointmentStatus.booked,
        source=AppointmentSource(expected),
        price_cop=service.price_cop,
        duration_min=service.duration_min,
        manage_token_hash=hash_token(new_manage_token()),  # el barbero no entrega enlace
    )
    try:
        with session.begin_nested():
            session.add(appointment)
            session.flush()
    except DBAPIError as exc:
        if getattr(exc.orig, "sqlstate", None) not in LOST_RACE:
            raise
        # Otra cita ganó el hueco (p. ej. el otro barbero con el vaporizador): se recalcula.
        raise _race_lost(session, business, barber, service, starts, walk_in, now) from None
    return _present_one(session, business, appointment, now)


def _race_lost(
    session: Session,
    business: Business,
    barber: Barber,
    service: Service,
    target: datetime,
    walk_in: bool,
    now: datetime,
) -> ApiError:
    if walk_in:
        fresh = barber_next_free(session, business, barber, service, now=now)
        tz = ZoneInfo(business.timezone)
        options = (
            [{"starts_at": fresh.astimezone(tz).isoformat(), "barber_ids": [str(barber.id)]}]
            if fresh
            else []
        )
        return ApiError(
            409,
            "slot_unavailable",
            "Ese hueco se ocupó hace un momento. Mira a qué hora puedes empezar ahora.",
            {"alternatives": options},
        )
    day = local_day(business, target)
    fresh_av = availability_for(
        session,
        business,
        [barber],
        duration_min=service.duration_min,
        resource_id=service.resource_id,
        day=day,
        now=now,
        min_lead_min=0,
    )
    return ApiError(
        409,
        "slot_unavailable",
        "Ese horario ya no está disponible. Elige otro de los que te mostramos.",
        {"alternatives": alternatives(business, fresh_av, target)},
    )

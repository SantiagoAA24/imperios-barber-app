"""Clientes del negocio (admin): lista con estadísticas, detalle con celular completo y notas.

Todo con agregaciones en SQL. El celular completo solo sale de ``client_detail`` y cada lectura
inserta una fila en ``audit_log``; en listas siempre va parcial.
"""

import base64
import json
import re
import unicodedata
import uuid
from typing import Any

from sqlalchemy import Select, func, select, tuple_
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Appointment, AppointmentStatus, AuditLog, Barber, Client, Service, User
from app.schemas.admin import (
    ClientAppointmentOut,
    ClientDetailOut,
    ClientFilter,
    ClientListItemOut,
    ClientListOut,
    ClientNotesOut,
)
from app.services.barber_panel import mask_phone

FREQUENT_MIN_ATTENDED = 5
DEFAULT_LIMIT = 20
MAX_LIMIT = 50
RECENT = 10
MAX_QUERY = 60
VIEW_PHONE = "view_client_phone"

# Sin tildes y sin mayúsculas, en SQL y en Python con las mismas letras (ñ cuenta como n).
_FROM = "áéíóúüñ"
_TO = "aeiouun"
_TABLE = str.maketrans(_FROM, _TO)
_DIGITS_ONLY = re.compile(r"^[\d\s·*+\-().]+$")


def fold(text_value: str) -> str:
    """'  José Ñandú ' -> 'jose nandu' (misma regla que ``_folded_name`` en SQL)."""
    return unicodedata.normalize("NFC", text_value.strip().lower()).translate(_TABLE)


def _folded_name() -> Any:
    return func.translate(func.lower(Client.name), _FROM, _TO)


def _stats(business_id: uuid.UUID) -> Any:
    attended = Appointment.status == AppointmentStatus.attended
    return (
        select(
            Appointment.client_id.label("client_id"),
            func.count().filter(attended).label("attended"),
            func.count().filter(Appointment.status == AppointmentStatus.no_show).label("no_show"),
            func.count().filter(Appointment.status != AppointmentStatus.cancelled).label("active"),
            func.max(Appointment.starts_at).filter(attended).label("last_visit"),
        )
        .where(Appointment.business_id == business_id)
        .group_by(Appointment.client_id)
        .subquery()
    )


def _encode(sort_key: str, client_id: uuid.UUID) -> str:
    raw = json.dumps([sort_key, str(client_id)]).encode()
    return base64.urlsafe_b64encode(raw).decode()


def _decode(cursor: str) -> tuple[str, uuid.UUID]:
    try:
        key, raw_id = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        return str(key), uuid.UUID(str(raw_id))
    except (ValueError, TypeError, json.JSONDecodeError):
        raise ApiError(422, "invalid_cursor", "El cursor de paginación no es válido.") from None


def _apply_search(stmt: Select[Any], q: str | None) -> Select[Any]:
    if q is None or not q.strip():
        return stmt
    q = q.strip()[:MAX_QUERY]
    if _DIGITS_ONLY.match(q):
        digits = re.sub(r"\D", "", q)
        # Últimos dígitos del celular (E.164): '4821' encuentra '+573004824821'.
        return stmt.where(Client.phone_e164.like(f"%{digits}"))
    needle = fold(q).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return stmt.where(_folded_name().like(f"%{needle}%", escape="\\"))


def list_clients(
    session: Session,
    business_id: uuid.UUID,
    *,
    q: str | None,
    filter_: ClientFilter,
    cursor: str | None,
    limit: int,
) -> ClientListOut:
    limit = max(1, min(limit, MAX_LIMIT))
    stats = _stats(business_id)
    attended = func.coalesce(stats.c.attended, 0)
    no_show = func.coalesce(stats.c.no_show, 0)
    sort_key = func.lower(Client.name)

    base = (
        select(Client.id)
        .outerjoin(stats, stats.c.client_id == Client.id)
        .where(Client.business_id == business_id)
    )
    base = _apply_search(base, q)
    if filter_ == "frequent":
        base = base.where(attended >= FREQUENT_MIN_ATTENDED)
    elif filter_ == "no_show":
        base = base.where(no_show >= 1)
    total = session.scalar(select(func.count()).select_from(base.subquery())) or 0

    stmt = (
        select(
            Client,
            sort_key.label("sort_key"),
            attended.label("attended"),
            no_show.label("no_show"),
            func.coalesce(stats.c.active, 0).label("active"),
            stats.c.last_visit.label("last_visit"),
        )
        .outerjoin(stats, stats.c.client_id == Client.id)
        .where(Client.business_id == business_id)
    )
    stmt = _apply_search(stmt, q)
    if filter_ == "frequent":
        stmt = stmt.where(attended >= FREQUENT_MIN_ATTENDED)
    elif filter_ == "no_show":
        stmt = stmt.where(no_show >= 1)
    if cursor:
        key, last_id = _decode(cursor)
        stmt = stmt.where(tuple_(sort_key, Client.id) > tuple_(key, last_id))
    rows = session.execute(stmt.order_by(sort_key, Client.id).limit(limit + 1)).all()

    page = rows[:limit]
    items = [
        ClientListItemOut(
            id=row.Client.id,
            name=row.Client.name,
            phone_masked=mask_phone(row.Client.phone_e164),
            appointments_count=row.active,
            last_visit_at=row.last_visit,
            attendance_rate=(
                round(row.attended / (row.attended + row.no_show), 4)
                if row.attended + row.no_show > 0
                else None
            ),
            no_show_count=row.no_show,
        )
        for row in page
    ]
    next_cursor = (
        _encode(page[-1].sort_key, page[-1].Client.id) if len(rows) > limit and page else None
    )
    return ClientListOut(items=items, next_cursor=next_cursor, total=total)


def _get(session: Session, business_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    client = session.scalar(
        select(Client).where(Client.id == client_id, Client.business_id == business_id)
    )
    if client is None:
        raise ApiError(404, "not_found", "No encontramos a ese cliente.")
    return client


def client_detail(session: Session, user: User, client_id: uuid.UUID) -> ClientDetailOut:
    client = _get(session, user.business_id, client_id)
    counts = session.execute(
        select(
            func.count().filter(Appointment.status == AppointmentStatus.attended),
            func.count().filter(Appointment.status == AppointmentStatus.no_show),
        ).where(Appointment.client_id == client.id, Appointment.business_id == user.business_id)
    ).one()
    favorite = session.scalar(
        select(Service.name)
        .join(Appointment, Appointment.service_id == Service.id)
        .where(
            Appointment.client_id == client.id,
            Appointment.business_id == user.business_id,
            Appointment.status == AppointmentStatus.attended,
        )
        .group_by(Service.id, Service.name)
        .order_by(func.count().desc(), func.max(Appointment.starts_at).desc(), Service.name)
        .limit(1)
    )
    recent = session.execute(
        select(Appointment, Service.name, Barber.display_name)
        .join(Service, Service.id == Appointment.service_id)
        .join(Barber, Barber.id == Appointment.barber_id)
        .where(Appointment.client_id == client.id, Appointment.business_id == user.business_id)
        .order_by(Appointment.starts_at.desc(), Appointment.id)
        .limit(RECENT)
    ).all()
    # La lectura del celular completo deja rastro en la misma transacción: si falla, no sale.
    session.add(
        AuditLog(
            business_id=user.business_id,
            user_id=user.id,
            action=VIEW_PHONE,
            entity="client",
            entity_id=client.id,
        )
    )
    session.commit()
    return ClientDetailOut(
        id=client.id,
        name=client.name,
        phone=client.phone_e164,
        since=client.created_at,
        visits=counts[0],
        no_show_count=counts[1],
        favorite_service=favorite,
        recent_appointments=[
            ClientAppointmentOut(
                id=a.id,
                starts_at=a.starts_at,
                status=a.status,
                service_name=service_name,
                barber_name=barber_name,
                price_cop=a.price_cop,
            )
            for a, service_name, barber_name in recent
        ],
        notes=client.notes,
    )


def update_notes(
    session: Session, business_id: uuid.UUID, client_id: uuid.UUID, notes: str | None
) -> ClientNotesOut:
    client = _get(session, business_id, client_id)
    client.notes = notes
    session.commit()
    return ClientNotesOut(id=client.id, notes=client.notes)

"""Barberos (admin): alta con clave temporal, edición y desactivación sin borrar citas."""

import secrets
import string
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import hash_password
from app.models import Barber, Business, User, UserRole
from app.schemas.admin import (
    AdminBarberOut,
    BarberConflictOut,
    BarberCreateIn,
    BarberPatchIn,
)
from app.services import auth as auth_service
from app.services import schedule

# Sin caracteres ambiguos (0/O, 1/l/I) para dictarla por teléfono o leerla en pantalla.
_ALPHABET = "".join(c for c in string.ascii_letters + string.digits if c not in "0O1lI")
TEMP_PASSWORD_LENGTH = 12


def generate_temporary_password() -> str:
    """12 caracteres aleatorios con ``secrets``; siempre trae letras y dígitos."""
    while True:
        value = "".join(secrets.choice(_ALPHABET) for _ in range(TEMP_PASSWORD_LENGTH))
        if any(c.isdigit() for c in value) and any(c.isalpha() for c in value):
            return value


def barber_out(barber: Barber, user: User) -> AdminBarberOut:
    return AdminBarberOut(
        id=barber.id,
        display_name=barber.display_name,
        email=user.email,
        visible_in_booking=barber.visible_in_booking,
        active=barber.active,
        must_change_password=user.must_change_password,
    )


def list_barbers(session: Session, business_id: uuid.UUID) -> list[AdminBarberOut]:
    rows = session.execute(
        select(Barber, User)
        .join(User, User.id == Barber.user_id)
        .where(Barber.business_id == business_id)
        .order_by(Barber.display_name, Barber.id)
    ).all()
    return [barber_out(b, u) for b, u in rows]


def _get(session: Session, business_id: uuid.UUID, barber_id: uuid.UUID) -> tuple[Barber, User]:
    row = session.execute(
        select(Barber, User)
        .join(User, User.id == Barber.user_id)
        .where(Barber.id == barber_id, Barber.business_id == business_id)
    ).first()
    if row is None:
        raise ApiError(404, "not_found", "No encontramos a ese barbero.")
    return row[0], row[1]


def create_barber(
    session: Session, business_id: uuid.UUID, data: BarberCreateIn
) -> tuple[AdminBarberOut, str]:
    taken = session.scalar(
        select(User.id).where(User.business_id == business_id, User.email == data.email)
    )
    if taken is not None:
        raise ApiError(409, "email_taken", "Ya existe una cuenta con ese correo.")
    password = generate_temporary_password()
    user = User(
        business_id=business_id,
        role=UserRole.barber,
        name=data.display_name,
        email=data.email,
        password_hash=hash_password(password),
        active=True,
        must_change_password=True,
    )
    session.add(user)
    try:
        session.flush()
        barber = Barber(
            business_id=business_id,
            user_id=user.id,
            display_name=data.display_name,
            visible_in_booking=data.visible_in_booking,
            active=True,
        )
        session.add(barber)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise ApiError(409, "email_taken", "Ya existe una cuenta con ese correo.") from None
    return barber_out(barber, user), password


def reset_password(session: Session, business_id: uuid.UUID, barber_id: uuid.UUID) -> str:
    _, user = _get(session, business_id, barber_id)
    password = generate_temporary_password()
    user.password_hash = hash_password(password)
    user.must_change_password = True
    auth_service.revoke_sessions(session, user.id, datetime.now(UTC))
    session.commit()
    return password


def update_barber(
    session: Session,
    business: Business,
    barber_id: uuid.UUID,
    data: BarberPatchIn,
    now: datetime,
) -> tuple[AdminBarberOut, list[BarberConflictOut]]:
    barber, user = _get(session, business.id, barber_id)
    changes = data.sent()
    for field, value in changes.items():
        setattr(barber, field, value)
    if "display_name" in changes:
        user.name = barber.display_name
    if "active" in changes:
        # La cuenta sigue a la ficha: un barbero inactivo no puede iniciar sesión.
        user.active = barber.active
        if not barber.active:
            auth_service.revoke_sessions(session, user.id, now)
    session.commit()
    conflicts: list[BarberConflictOut] = []
    if not barber.active:
        conflicts = [
            BarberConflictOut(**schedule.conflict_out(business, a, c, s).model_dump())
            for a, c, s in schedule.upcoming_booked(session, business, barber, now)
        ]
    return barber_out(barber, user), conflicts

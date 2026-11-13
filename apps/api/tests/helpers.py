"""Fábricas de datos para las pruebas de la API."""

import itertools
from datetime import time

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import (
    Barber,
    BarberSchedule,
    Business,
    Product,
    ProductAvailability,
    Resource,
    Service,
    User,
    UserRole,
)

PASSWORD = "clave-de-prueba-123"
_counter = itertools.count(1)
_password_hash = hash_password(PASSWORD)  # una sola vez: argon2 es lento a propósito


def make_business(session: Session, slug: str = "imperio", domain: str | None = None) -> Business:
    b = Business(name=f"Negocio {slug}", slug=slug, domain=domain)
    session.add(b)
    session.commit()
    return b


def make_user(
    session: Session,
    business: Business,
    role: UserRole = UserRole.barber,
    email: str | None = None,
    active: bool = True,
) -> User:
    n = next(_counter)
    u = User(
        business_id=business.id,
        role=role,
        name=f"Usuario {n}",
        email=email or f"u{n}@{business.slug}.test",
        password_hash=_password_hash,
        active=active,
    )
    session.add(u)
    session.commit()
    return u


def make_barber(
    session: Session,
    business: Business,
    name: str,
    visible: bool = True,
    active: bool = True,
) -> Barber:
    user = make_user(session, business, UserRole.barber)
    b = Barber(
        business_id=business.id,
        user_id=user.id,
        display_name=name,
        visible_in_booking=visible,
        active=active,
    )
    session.add(b)
    session.commit()
    return b


def make_service(
    session: Session,
    business: Business,
    name: str,
    sort: int = 0,
    active: bool = True,
    resource: Resource | None = None,
    price_cop: int = 22_000,
    duration_min: int = 30,
) -> Service:
    s = Service(
        business_id=business.id,
        name=name,
        description=f"Descripción de {name}",
        price_cop=price_cop,
        duration_min=duration_min,
        resource_id=resource.id if resource else None,
        active=active,
        sort=sort,
    )
    session.add(s)
    session.commit()
    return s


def make_resource(session: Session, business: Business, name: str = "Vaporizador") -> Resource:
    r = Resource(business_id=business.id, name=name, capacity=1)
    session.add(r)
    session.commit()
    return r


def make_product(
    session: Session,
    business: Business,
    name: str,
    sort: int = 0,
    active: bool = True,
    availability: ProductAvailability = ProductAvailability.in_stock,
) -> Product:
    p = Product(
        business_id=business.id,
        name=name,
        description=None,
        price_cop=18_000,
        availability=availability,
        image_url=None,
        active=active,
        sort=sort,
    )
    session.add(p)
    session.commit()
    return p


def make_schedule(
    session: Session,
    barber: Barber,
    weekday: int,
    blocks: list[tuple[time, time]] | None = None,
) -> None:
    for start, end in blocks or [(time(9), time(13)), (time(14), time(18))]:
        session.add(
            BarberSchedule(barber_id=barber.id, weekday=weekday, start_time=start, end_time=end)
        )
    session.commit()

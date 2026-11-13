"""Datos de ejemplo de Imperio. Idempotente: ``uv run python -m app.seed``."""

from datetime import time

from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
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

PASSWORD = "cambiar-esto"  # valor de ejemplo; cambiar fuera de desarrollo

# (nombre, precio COP, minutos, usa vaporizador)
SERVICES = [
    ("Corte básico", 22_000, 30, False),
    ("Corte + barba", 27_000, 45, False),
    ("Corte + barba + cejas", 30_000, 45, False),
    ("Corte + cejas", 25_000, 30, False),
    ("Corte + limpieza facial", 50_000, 60, True),
    ("Limpieza facial", 35_000, 30, True),
]

# [valores de ejemplo] lunes-sábado en dos tramos; domingo un tramo.
WEEKDAY_BLOCKS = [(time(9), time(13)), (time(14), time(18))]
SUNDAY_BLOCKS = [(time(10), time(14))]

# (nombre, descripción, precio COP, disponibilidad)
PRODUCTS = [
    ("Cera mate", "Fijación fuerte sin brillo.", 28_000, ProductAvailability.in_stock),
    ("Pomada base agua", "Brillo medio, se lava fácil.", 32_000, ProductAvailability.in_stock),
    ("Aceite para barba", "Suaviza e hidrata.", 35_000, ProductAvailability.in_stock),
    ("Bálsamo para barba", "Control y forma.", 30_000, ProductAvailability.out_of_stock),
    ("Shampoo para barba", "Limpieza diaria.", 24_000, ProductAvailability.in_stock),
    ("Gel fijador", "Fijación extrafuerte.", 18_000, ProductAvailability.in_stock),
    ("Polvo texturizante", "Volumen y textura.", 38_000, ProductAvailability.out_of_stock),
    ("Peine de madera", "Para barba y cabello.", 15_000, ProductAvailability.in_stock),
]


def _get_or_create_user(
    session: Session, business: Business, role: UserRole, name: str, email: str, pw_hash: str
) -> User:
    user = session.scalar(select(User).where(User.business_id == business.id, User.email == email))
    if user is None:
        user = User(
            business_id=business.id,
            role=role,
            name=name,
            email=email,
            password_hash=pw_hash,
        )
        session.add(user)
        session.flush()
    return user


def seed(session: Session) -> None:
    business = session.scalar(select(Business).where(Business.slug == "imperio"))
    if business is None:
        business = Business(name="Imperio Barber", slug="imperio", timezone="America/Bogota")
        session.add(business)
        session.flush()

    vaporizador = session.scalar(
        select(Resource).where(Resource.business_id == business.id, Resource.name == "Vaporizador")
    )
    if vaporizador is None:
        vaporizador = Resource(business_id=business.id, name="Vaporizador", capacity=1)
        session.add(vaporizador)
        session.flush()

    for sort, (name, price, minutes, uses_vaporizer) in enumerate(SERVICES):
        exists = session.scalar(
            select(Service.id).where(Service.business_id == business.id, Service.name == name)
        )
        if exists is None:
            session.add(
                Service(
                    business_id=business.id,
                    name=name,
                    price_cop=price,
                    duration_min=minutes,
                    resource_id=vaporizador.id if uses_vaporizer else None,
                    sort=sort,
                )
            )

    # Hasheo solo si hace falta: argon2 es lento a propósito.
    pw_hash: str | None = None

    def password_hash() -> str:
        nonlocal pw_hash
        if pw_hash is None:
            pw_hash = PasswordHasher().hash(PASSWORD)
        return pw_hash

    def ensure_user(role: UserRole, name: str, email: str) -> User:
        found = session.scalar(
            select(User).where(User.business_id == business.id, User.email == email)
        )
        return found or _get_or_create_user(session, business, role, name, email, password_hash())

    ensure_user(UserRole.admin, "Administrador", "admin@imperio.test")

    for n in (1, 2):
        user = ensure_user(UserRole.barber, f"Barbero {n}", f"barbero{n}@imperio.test")
        barber = session.scalar(select(Barber).where(Barber.user_id == user.id))
        if barber is None:
            barber = Barber(business_id=business.id, user_id=user.id, display_name=f"Barbero {n}")
            session.add(barber)
            session.flush()
        for weekday in range(7):
            for start, end in SUNDAY_BLOCKS if weekday == 6 else WEEKDAY_BLOCKS:
                exists = session.scalar(
                    select(BarberSchedule.id).where(
                        BarberSchedule.barber_id == barber.id,
                        BarberSchedule.weekday == weekday,
                        BarberSchedule.start_time == start,
                    )
                )
                if exists is None:
                    session.add(
                        BarberSchedule(
                            barber_id=barber.id, weekday=weekday, start_time=start, end_time=end
                        )
                    )

    for sort, (name, description, price, availability) in enumerate(PRODUCTS):
        exists = session.scalar(
            select(Product.id).where(Product.business_id == business.id, Product.name == name)
        )
        if exists is None:
            session.add(
                Product(
                    business_id=business.id,
                    name=name,
                    description=description,
                    price_cop=price,
                    availability=availability,
                    sort=sort,
                )
            )


def main() -> None:
    with SessionLocal() as session, session.begin():
        seed(session)
    print("Seed de Imperio listo.")


if __name__ == "__main__":
    main()

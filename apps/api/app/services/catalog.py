"""Catálogo público: solo registros activos del negocio, en orden ``sort``."""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Barber, Product, Service
from app.schemas.public import PublicService


def list_services(session: Session, business_id: uuid.UUID) -> list[PublicService]:
    rows = session.scalars(
        select(Service)
        .where(Service.business_id == business_id, Service.active.is_(True))
        .order_by(Service.sort, Service.name, Service.id)
    )
    return [
        PublicService(
            id=s.id,
            name=s.name,
            description=s.description,
            price_cop=s.price_cop,
            duration_min=s.duration_min,
            uses_resource=s.resource_id is not None,
        )
        for s in rows
    ]


def list_barbers(session: Session, business_id: uuid.UUID) -> Sequence[Barber]:
    # barber no tiene columna sort: orden estable por nombre.
    return session.scalars(
        select(Barber)
        .where(
            Barber.business_id == business_id,
            Barber.active.is_(True),
            Barber.visible_in_booking.is_(True),
        )
        .order_by(Barber.display_name, Barber.id)
    ).all()


def list_products(session: Session, business_id: uuid.UUID) -> Sequence[Product]:
    return session.scalars(
        select(Product)
        .where(Product.business_id == business_id, Product.active.is_(True))
        .order_by(Product.sort, Product.name, Product.id)
    ).all()

"""Productos del negocio (admin): solo catálogo, sin historial; se pueden borrar."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Product, ProductAvailability
from app.schemas.admin import ProductCreateIn, ProductPatchIn


def list_products(session: Session, business_id: uuid.UUID) -> list[Product]:
    return list(
        session.scalars(
            select(Product)
            .where(Product.business_id == business_id)
            .order_by(Product.sort, Product.name, Product.id)
        )
    )


def _get(session: Session, business_id: uuid.UUID, product_id: uuid.UUID) -> Product:
    product = session.scalar(
        select(Product).where(Product.id == product_id, Product.business_id == business_id)
    )
    if product is None:
        raise ApiError(404, "not_found", "No encontramos ese producto.")
    return product


def create_product(session: Session, business_id: uuid.UUID, data: ProductCreateIn) -> Product:
    last = session.scalar(select(func.max(Product.sort)).where(Product.business_id == business_id))
    product = Product(
        business_id=business_id,
        name=data.name,
        description=data.description,
        price_cop=data.price_cop,
        availability=ProductAvailability(data.availability),
        image_url=data.image_url,
        active=data.active,
        sort=(last + 1) if last is not None else 0,
    )
    session.add(product)
    session.commit()
    return product


def update_product(
    session: Session, business_id: uuid.UUID, product_id: uuid.UUID, data: ProductPatchIn
) -> Product:
    product = _get(session, business_id, product_id)
    for field, value in data.sent().items():
        if field == "availability":
            value = ProductAvailability(str(value))
        setattr(product, field, value)
    session.commit()
    return product


def delete_product(session: Session, business_id: uuid.UUID, product_id: uuid.UUID) -> None:
    session.delete(_get(session, business_id, product_id))
    session.commit()


def reorder_products(session: Session, business_id: uuid.UUID, ids: list[uuid.UUID]) -> None:
    products = list_products(session, business_id)
    if len(set(ids)) != len(ids) or set(ids) != {p.id for p in products}:
        raise ApiError(
            422,
            "invalid_order",
            "La lista debe traer todos los productos del negocio, una sola vez cada uno.",
        )
    position = {product_id: i for i, product_id in enumerate(ids)}
    for product in products:
        product.sort = position[product.id]
    session.commit()

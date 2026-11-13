"""Servicios del negocio (admin). Todo filtra por ``business_id``; nada con historial se borra."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models import Appointment, Resource, Service
from app.schemas.admin import ServiceCreateIn, ServicePatchIn

HAS_HISTORY_MESSAGE = (
    "Este servicio tiene citas en el historial. Desactívalo en lugar de eliminarlo."
)


def list_resources(session: Session, business_id: uuid.UUID) -> list[Resource]:
    return list(
        session.scalars(
            select(Resource).where(Resource.business_id == business_id).order_by(Resource.name)
        )
    )


def list_services(session: Session, business_id: uuid.UUID) -> list[Service]:
    return list(
        session.scalars(
            select(Service)
            .where(Service.business_id == business_id)
            .order_by(Service.sort, Service.name, Service.id)
        )
    )


def _get(session: Session, business_id: uuid.UUID, service_id: uuid.UUID) -> Service:
    service = session.scalar(
        select(Service).where(Service.id == service_id, Service.business_id == business_id)
    )
    if service is None:
        raise ApiError(404, "not_found", "No encontramos ese servicio.")
    return service


def _check_resource(session: Session, business_id: uuid.UUID, resource_id: uuid.UUID) -> None:
    found = session.scalar(
        select(Resource.id).where(Resource.id == resource_id, Resource.business_id == business_id)
    )
    if found is None:
        raise ApiError(422, "invalid_resource", "El recurso elegido no existe en este negocio.")


def create_service(session: Session, business_id: uuid.UUID, data: ServiceCreateIn) -> Service:
    if data.resource_id is not None:
        _check_resource(session, business_id, data.resource_id)
    last = session.scalar(select(func.max(Service.sort)).where(Service.business_id == business_id))
    service = Service(
        business_id=business_id,
        name=data.name,
        description=data.description,
        price_cop=data.price_cop,
        duration_min=data.duration_min,
        resource_id=data.resource_id,
        active=data.active,
        sort=(last + 1) if last is not None else 0,
    )
    session.add(service)
    session.commit()
    return service


def update_service(
    session: Session, business_id: uuid.UUID, service_id: uuid.UUID, data: ServicePatchIn
) -> Service:
    service = _get(session, business_id, service_id)
    changes = data.sent()
    resource_id = changes.get("resource_id")
    if isinstance(resource_id, uuid.UUID):
        _check_resource(session, business_id, resource_id)
    # Solo se tocan columnas del servicio: las citas existentes conservan su copia de precio y
    # duración, así que un cambio aquí afecta únicamente a las reservas futuras.
    for field, value in changes.items():
        setattr(service, field, value)
    session.commit()
    return service


def delete_service(session: Session, business_id: uuid.UUID, service_id: uuid.UUID) -> None:
    service = _get(session, business_id, service_id)
    has_history = session.scalar(
        select(Appointment.id).where(Appointment.service_id == service.id).limit(1)
    )
    if has_history is not None:
        raise ApiError(409, "has_history", HAS_HISTORY_MESSAGE)
    try:
        session.delete(service)
        session.commit()
    except IntegrityError:
        # Una cita creada justo ahora: se trata igual que un historial existente.
        session.rollback()
        raise ApiError(409, "has_history", HAS_HISTORY_MESSAGE) from None


def reorder_services(
    session: Session, business_id: uuid.UUID, ids: list[uuid.UUID]
) -> list[Service]:
    services = list_services(session, business_id)
    if len(set(ids)) != len(ids) or set(ids) != {s.id for s in services}:
        raise ApiError(
            422,
            "invalid_order",
            "La lista debe traer todos los servicios del negocio, una sola vez cada uno.",
        )
    position = {service_id: i for i, service_id in enumerate(ids)}
    for service in services:
        service.sort = position[service.id]
    session.commit()
    return sorted(services, key=lambda s: s.sort)

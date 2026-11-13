import uuid

from fastapi import APIRouter, Depends, Response

from app.core.db import DbSession
from app.core.security import AdminUser
from app.routers.booking import no_store
from app.schemas.admin import (
    AdminServiceListOut,
    AdminServiceOut,
    OrderIn,
    ResourceOut,
    ServiceCreateIn,
    ServicePatchIn,
)
from app.schemas.auth import PingOut
from app.schemas.errors import ErrorBody
from app.services import admin_services

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(no_store)],
    responses={
        401: {"model": ErrorBody},
        403: {"model": ErrorBody},
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
    },
)


@router.get("/ping", response_model=PingOut)
def ping(user: AdminUser) -> PingOut:
    """Ruta de apoyo para probar permisos; se reemplaza en fases siguientes."""
    return PingOut(status="ok", role=user.role, business_id=user.business_id)


# --- servicios --------------------------------------------------------------------------------


def _service_list(session: DbSession, user: AdminUser) -> AdminServiceListOut:
    return AdminServiceListOut(
        items=[
            AdminServiceOut.model_validate(s, from_attributes=True)
            for s in admin_services.list_services(session, user.business_id)
        ],
        resources=[
            ResourceOut(id=r.id, name=r.name)
            for r in admin_services.list_resources(session, user.business_id)
        ],
    )


@router.get("/services", response_model=AdminServiceListOut)
def list_services(user: AdminUser, session: DbSession) -> AdminServiceListOut:
    return _service_list(session, user)


@router.post("/services", response_model=AdminServiceOut, status_code=201)
def create_service(body: ServiceCreateIn, user: AdminUser, session: DbSession) -> AdminServiceOut:
    service = admin_services.create_service(session, user.business_id, body)
    return AdminServiceOut.model_validate(service, from_attributes=True)


@router.put("/services/order", response_model=AdminServiceListOut)
def reorder_services(body: OrderIn, user: AdminUser, session: DbSession) -> AdminServiceListOut:
    admin_services.reorder_services(session, user.business_id, body.ids)
    return _service_list(session, user)


@router.patch("/services/{service_id}", response_model=AdminServiceOut)
def update_service(
    service_id: uuid.UUID, body: ServicePatchIn, user: AdminUser, session: DbSession
) -> AdminServiceOut:
    service = admin_services.update_service(session, user.business_id, service_id, body)
    return AdminServiceOut.model_validate(service, from_attributes=True)


@router.delete("/services/{service_id}", status_code=204)
def delete_service(service_id: uuid.UUID, user: AdminUser, session: DbSession) -> Response:
    admin_services.delete_service(session, user.business_id, service_id)
    return Response(status_code=204)

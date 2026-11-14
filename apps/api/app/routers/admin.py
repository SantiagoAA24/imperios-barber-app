import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response

from app.core.clock import Now
from app.core.db import DbSession
from app.core.security import AdminUser
from app.core.tenant import CurrentBusiness
from app.models import AppointmentStatus
from app.routers.booking import no_store
from app.schemas.admin import (
    AdminAgendaOut,
    AdminAppointmentCreateIn,
    AdminAppointmentOut,
    AdminAppointmentPatchIn,
    AdminBarberListOut,
    AdminProductListOut,
    AdminProductOut,
    AdminServiceListOut,
    AdminServiceOut,
    BarberCreatedOut,
    BarberCreateIn,
    BarberPatchIn,
    BarberUpdatedOut,
    ClientDetailOut,
    ClientFilter,
    ClientListOut,
    ClientNotesIn,
    ClientNotesOut,
    OrderIn,
    ProductCreateIn,
    ProductPatchIn,
    ResourceOut,
    ServiceCreateIn,
    ServicePatchIn,
    TemporaryPasswordOut,
)
from app.schemas.auth import PingOut
from app.schemas.errors import ErrorBody
from app.schemas.me import OwnAvailabilityOut
from app.services import (
    admin_agenda,
    admin_barbers,
    admin_clients,
    admin_products,
    admin_services,
    booking,
)

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


# --- productos --------------------------------------------------------------------------------


def _product_list(session: DbSession, user: AdminUser) -> AdminProductListOut:
    return AdminProductListOut(
        items=[
            AdminProductOut.model_validate(p, from_attributes=True)
            for p in admin_products.list_products(session, user.business_id)
        ]
    )


@router.get("/products", response_model=AdminProductListOut)
def list_products(user: AdminUser, session: DbSession) -> AdminProductListOut:
    return _product_list(session, user)


@router.post("/products", response_model=AdminProductOut, status_code=201)
def create_product(body: ProductCreateIn, user: AdminUser, session: DbSession) -> AdminProductOut:
    product = admin_products.create_product(session, user.business_id, body)
    return AdminProductOut.model_validate(product, from_attributes=True)


@router.put("/products/order", response_model=AdminProductListOut)
def reorder_products(body: OrderIn, user: AdminUser, session: DbSession) -> AdminProductListOut:
    admin_products.reorder_products(session, user.business_id, body.ids)
    return _product_list(session, user)


@router.patch("/products/{product_id}", response_model=AdminProductOut)
def update_product(
    product_id: uuid.UUID, body: ProductPatchIn, user: AdminUser, session: DbSession
) -> AdminProductOut:
    product = admin_products.update_product(session, user.business_id, product_id, body)
    return AdminProductOut.model_validate(product, from_attributes=True)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(product_id: uuid.UUID, user: AdminUser, session: DbSession) -> Response:
    admin_products.delete_product(session, user.business_id, product_id)
    return Response(status_code=204)


# --- barberos ---------------------------------------------------------------------------------


@router.get("/barbers", response_model=AdminBarberListOut)
def list_barbers(user: AdminUser, session: DbSession) -> AdminBarberListOut:
    return AdminBarberListOut(items=admin_barbers.list_barbers(session, user.business_id))


@router.post("/barbers", response_model=BarberCreatedOut, status_code=201)
def create_barber(body: BarberCreateIn, user: AdminUser, session: DbSession) -> BarberCreatedOut:
    """Devuelve ``temporary_password`` UNA sola vez; no se guarda en claro."""
    barber, password = admin_barbers.create_barber(session, user.business_id, body)
    return BarberCreatedOut(barber=barber, temporary_password=password)


@router.patch("/barbers/{barber_id}", response_model=BarberUpdatedOut)
def update_barber(
    barber_id: uuid.UUID,
    body: BarberPatchIn,
    user: AdminUser,
    session: DbSession,
    business: CurrentBusiness,
    now: Now,
) -> BarberUpdatedOut:
    barber, conflicts = admin_barbers.update_barber(session, business, barber_id, body, now)
    return BarberUpdatedOut(barber=barber, conflicts=conflicts)


@router.post("/barbers/{barber_id}/reset-password", response_model=TemporaryPasswordOut)
def reset_barber_password(
    barber_id: uuid.UUID, user: AdminUser, session: DbSession
) -> TemporaryPasswordOut:
    password = admin_barbers.reset_password(session, user.business_id, barber_id)
    return TemporaryPasswordOut(temporary_password=password)


# --- agenda -----------------------------------------------------------------------------------


@router.get("/appointments", response_model=AdminAgendaOut)
def list_appointments(
    from_: Annotated[date, Query(alias="from")],
    to: date,
    business: CurrentBusiness,
    user: AdminUser,
    session: DbSession,
    now: Now,
    barber_id: uuid.UUID | None = None,
    include_cancelled: bool = False,
) -> AdminAgendaOut:
    """Citas de un rango de días locales (máximo 8), con el celular siempre parcial."""
    return admin_agenda.list_appointments(
        session, business, from_, to, barber_id, include_cancelled, now
    )


@router.post("/appointments", response_model=AdminAppointmentOut, status_code=201)
def create_appointment(
    body: AdminAppointmentCreateIn,
    business: CurrentBusiness,
    user: AdminUser,
    session: DbSession,
    now: Now,
) -> AdminAppointmentOut:
    return admin_agenda.create_appointment(session, business, body, now)


@router.patch("/appointments/{appointment_id}", response_model=AdminAppointmentOut)
def update_appointment(
    appointment_id: uuid.UUID,
    body: AdminAppointmentPatchIn,
    business: CurrentBusiness,
    user: AdminUser,
    session: DbSession,
    now: Now,
) -> AdminAppointmentOut:
    return admin_agenda.change_status(
        session, business, appointment_id, AppointmentStatus(body.status), now
    )


@router.get("/availability", response_model=OwnAvailabilityOut)
def availability(
    barber_id: uuid.UUID,
    service_id: uuid.UUID,
    on: Annotated[date, Query(alias="date")],
    business: CurrentBusiness,
    user: AdminUser,
    session: DbSession,
    now: Now,
) -> dict[str, object]:
    """Horarios libres de un barbero para crear una cita manual (sin margen de anticipación)."""
    starts = admin_agenda.available_starts(session, business, barber_id, service_id, on, now)
    return {
        "date": on.isoformat(),
        "slots": [{"starts_at": booking.iso_local(business, s)} for s in starts],
    }


# --- clientes ---------------------------------------------------------------------------------


@router.get("/clients", response_model=ClientListOut)
def list_clients(
    user: AdminUser,
    session: DbSession,
    q: Annotated[str | None, Query(max_length=60)] = None,
    filter: ClientFilter = "all",
    cursor: str | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ClientListOut:
    """Lista paginada por cursor. El celular va siempre parcial."""
    return admin_clients.list_clients(
        session, user.business_id, q=q, filter_=filter, cursor=cursor, limit=limit
    )


@router.get("/clients/{client_id}", response_model=ClientDetailOut)
def get_client(client_id: uuid.UUID, user: AdminUser, session: DbSession) -> ClientDetailOut:
    """Único lugar con el celular COMPLETO; cada lectura queda en ``audit_log``."""
    return admin_clients.client_detail(session, user, client_id)


@router.patch("/clients/{client_id}", response_model=ClientNotesOut)
def update_client(
    client_id: uuid.UUID, body: ClientNotesIn, user: AdminUser, session: DbSession
) -> ClientNotesOut:
    return admin_clients.update_notes(session, user.business_id, client_id, body.notes)

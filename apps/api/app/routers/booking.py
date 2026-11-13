import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.clock import Now
from app.core.db import DbSession
from app.core.errors import ApiError
from app.core.ratelimit import PUBLIC_LIMIT, limiter
from app.core.tenant import CurrentBusiness
from app.schemas.booking import (
    AvailabilityOut,
    CreateAppointmentIn,
    CreatedAppointment,
    PublicAppointment,
    RescheduleIn,
)
from app.schemas.errors import ErrorBody
from app.services import booking


def no_store(response: Response) -> None:
    # Datos de disponibilidad y de citas personales: nunca deben quedar en cachés.
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Host"


router = APIRouter(
    prefix="/public",
    tags=["reservas"],
    dependencies=[Depends(no_store)],
    responses={404: {"model": ErrorBody}, 409: {"model": ErrorBody}, 429: {"model": ErrorBody}},
)

public_limit = limiter.shared_limit(PUBLIC_LIMIT, scope="public")
CREATE_LIMIT = "10/hour"


@router.get("/availability", response_model=AvailabilityOut)
@public_limit
def availability(
    request: Request,
    business: CurrentBusiness,
    session: DbSession,
    now: Now,
    service_id: uuid.UUID,
    on: Annotated[date, Query(alias="date")],
    barber_id: uuid.UUID | None = None,
) -> dict[str, object]:
    slots = booking.public_availability(
        session, business, service_id=service_id, barber_id=barber_id, day=on, now=now
    )
    return {"date": on.isoformat(), "slots": slots}


@router.post("/appointments", response_model=CreatedAppointment, status_code=201)
@limiter.limit(CREATE_LIMIT)
def create_appointment(
    request: Request,
    body: CreateAppointmentIn,
    business: CurrentBusiness,
    session: DbSession,
    now: Now,
) -> CreatedAppointment:
    if body.website.strip():
        raise ApiError(400, "bad_request", "La solicitud no es válida.")  # honeypot, sin pistas
    if not body.consent:
        raise ApiError(
            422,
            "consent_required",
            "Necesitamos tu autorización para guardar tus datos y poder agendar tu cita.",
        )
    name, phone = booking.clean_client_input(body.client.name, body.client.phone)
    result = booking.create_appointment(
        session,
        business,
        service_id=body.service_id,
        barber_id=body.barber_id,
        starts_at=body.starts_at,
        name=name,
        phone_e164=phone,
        now=now,
    )
    session.commit()
    return CreatedAppointment(
        appointment=booking.present(session, business, result.appointment, now),
        manage_token=result.token,
        manage_path=f"/cita/{result.token}",
    )


@router.get("/appointments/{token}", response_model=PublicAppointment)
@public_limit
def get_appointment(
    request: Request, token: str, business: CurrentBusiness, session: DbSession, now: Now
) -> PublicAppointment:
    appointment = booking.find_by_token(session, business, token)
    return booking.present(session, business, appointment, now)


@router.post("/appointments/{token}/cancel", response_model=PublicAppointment)
@public_limit
def cancel_appointment(
    request: Request, token: str, business: CurrentBusiness, session: DbSession, now: Now
) -> PublicAppointment:
    appointment = booking.cancel_appointment(session, business, token, now)
    session.commit()
    return booking.present(session, business, appointment, now)


@router.post("/appointments/{token}/reschedule", response_model=PublicAppointment)
@public_limit
def reschedule_appointment(
    request: Request,
    token: str,
    body: RescheduleIn,
    business: CurrentBusiness,
    session: DbSession,
    now: Now,
) -> PublicAppointment:
    appointment = booking.reschedule_appointment(session, business, token, body.starts_at, now)
    session.commit()
    return booking.present(session, business, appointment, now)

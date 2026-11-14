"""Rutas del barbero (``/me``). Todas exigen rol barbero y se limitan al barbero del token."""

import uuid
from datetime import date
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Response

from app.core.clock import Now
from app.core.db import DbSession
from app.core.security import BarberUser
from app.core.tenant import CurrentBusiness
from app.models import AppointmentStatus, Barber
from app.routers.booking import no_store
from app.schemas.auth import PingOut
from app.schemas.errors import ErrorBody
from app.schemas.me import (
    AgendaOut,
    MeAppointmentOut,
    MeCreateAppointmentIn,
    NextFreeOut,
    OwnAvailabilityOut,
    PendingReviewOut,
    ScheduleIn,
    ScheduleOut,
    TimeOffCreatedOut,
    TimeOffIn,
    TimeOffListOut,
    UpdateStatusIn,
)
from app.services import barber_panel, booking, schedule

router = APIRouter(
    prefix="/me",
    tags=["barbero"],
    dependencies=[Depends(no_store)],
    responses={
        401: {"model": ErrorBody},
        403: {"model": ErrorBody},
        404: {"model": ErrorBody},
        409: {"model": ErrorBody},
    },
)


def current_barber(user: BarberUser, session: DbSession) -> Barber:
    """El barbero del token: nunca se acepta un ``barber_id`` enviado por el cliente."""
    return barber_panel.barber_for_user(session, user)


CurrentBarber = Annotated[Barber, Depends(current_barber)]


@router.get("/ping", response_model=PingOut)
def ping(user: BarberUser) -> PingOut:
    """Ruta de apoyo para probar permisos."""
    return PingOut(status="ok", role=user.role, business_id=user.business_id)


# --- agenda -----------------------------------------------------------------------------------


@router.get("/appointments", response_model=AgendaOut)
def list_appointments(
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
    on: Annotated[date | None, Query(alias="date")] = None,
    include_cancelled: bool = False,
) -> AgendaOut:
    day = on or booking.local_day(business, now)
    return barber_panel.day_agenda(
        session, business, barber, day, include_cancelled=include_cancelled, now=now
    )


@router.get("/appointments/pending-review", response_model=PendingReviewOut)
def pending_review(
    business: CurrentBusiness, session: DbSession, barber: CurrentBarber, now: Now
) -> PendingReviewOut:
    """Citas propias en 'booked' que terminaron hace más de 2 horas (últimos 7 días)."""
    return barber_panel.pending_review(session, business, barber, now)


@router.post("/appointments/{appointment_id}/reminder-sent", response_model=MeAppointmentOut)
def reminder_sent(
    appointment_id: uuid.UUID,
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
) -> MeAppointmentOut:
    result = barber_panel.mark_reminder_sent(session, business, barber, appointment_id, now)
    session.commit()
    return result


@router.patch("/appointments/{appointment_id}", response_model=MeAppointmentOut)
def update_appointment(
    appointment_id: uuid.UUID,
    body: UpdateStatusIn,
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
) -> MeAppointmentOut:
    result = barber_panel.change_status(
        session, business, barber, appointment_id, AppointmentStatus(body.status), now
    )
    session.commit()
    return result


@router.post("/appointments", response_model=MeAppointmentOut, status_code=201)
def create_appointment(
    body: MeCreateAppointmentIn,
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
) -> MeAppointmentOut:
    result = barber_panel.create_for_barber(
        session,
        business,
        barber,
        service_id=body.service_id,
        starts_at=body.starts_at,
        walk_in=body.walk_in,
        source=body.source,
        name=body.client.name,
        phone=body.client.phone,
        note=body.note,
        now=now,
    )
    session.commit()
    return result


@router.get("/next-free", response_model=NextFreeOut)
def next_free(
    service_id: uuid.UUID,
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
) -> NextFreeOut:
    start = barber_panel.next_free(session, business, barber, service_id, now)
    return NextFreeOut(starts_at=start.astimezone(ZoneInfo(business.timezone)))


@router.get("/availability", response_model=OwnAvailabilityOut)
def own_availability(
    service_id: uuid.UUID,
    on: Annotated[date, Query(alias="date")],
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
) -> dict[str, object]:
    """Horarios libres del propio barbero para elegir hora en una cita manual."""
    starts = barber_panel.own_availability(session, business, barber, service_id, on, now)
    return {
        "date": on.isoformat(),
        "slots": [{"starts_at": booking.iso_local(business, s)} for s in starts],
    }


# --- horario ----------------------------------------------------------------------------------


@router.get("/schedule", response_model=ScheduleOut)
def get_schedule(
    business: CurrentBusiness, session: DbSession, barber: CurrentBarber, now: Now
) -> ScheduleOut:
    return schedule.get_schedule(session, business, barber, now)


@router.put("/schedule", response_model=ScheduleOut, responses={422: {"model": ErrorBody}})
def put_schedule(
    body: ScheduleIn,
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
) -> ScheduleOut:
    result = schedule.replace_schedule(session, business, barber, body.schedule, now)
    session.commit()
    return result


# --- ausencias --------------------------------------------------------------------------------


@router.get("/time-off", response_model=TimeOffListOut)
def list_time_off(
    business: CurrentBusiness, session: DbSession, barber: CurrentBarber, now: Now
) -> TimeOffListOut:
    return schedule.list_time_off(session, business, barber, now)


@router.post(
    "/time-off",
    response_model=TimeOffCreatedOut,
    status_code=201,
    responses={422: {"model": ErrorBody}},
)
def create_time_off(
    body: TimeOffIn,
    business: CurrentBusiness,
    session: DbSession,
    barber: CurrentBarber,
    now: Now,
) -> TimeOffCreatedOut:
    result = schedule.create_time_off(
        session,
        business,
        barber,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        reason=body.reason,
        now=now,
    )
    session.commit()
    return result


@router.delete("/time-off/{time_off_id}", status_code=204)
def delete_time_off(time_off_id: uuid.UUID, session: DbSession, barber: CurrentBarber) -> Response:
    schedule.delete_time_off(session, barber, time_off_id)
    session.commit()
    return Response(status_code=204)

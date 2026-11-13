"""Esquemas de /me: agenda, citas manuales, horario y ausencias del barbero."""

import uuid
from datetime import datetime, time
from typing import Literal

from pydantic import AwareDatetime, BaseModel

from app.models import AppointmentSource, AppointmentStatus

# --- agenda -----------------------------------------------------------------------------------


class MeServiceOut(BaseModel):
    name: str
    duration_min: int
    price_cop: int
    uses_resource: bool


class MeClientOut(BaseModel):
    id: uuid.UUID
    name: str
    phone_masked: str | None
    # Solo en citas que se pueden necesitar contactar (pendientes o no asistió) y solo aquí,
    # en la agenda propia del barbero: sirve para armar el enlace de WhatsApp.
    phone_e164: str | None


class MeAppointmentOut(BaseModel):
    id: uuid.UUID
    status: AppointmentStatus
    source: AppointmentSource
    starts_at: datetime
    ends_at: datetime
    service: MeServiceOut
    client: MeClientOut
    is_overdue: bool


class DaySummary(BaseModel):
    total: int  # citas del día sin contar canceladas
    attended: int
    pending: int
    no_show: int
    revenue_cop: int  # suma de las atendidas


class AgendaOut(BaseModel):
    date: str
    appointments: list[MeAppointmentOut]
    summary: DaySummary


class UpdateStatusIn(BaseModel):
    status: Literal["attended", "no_show", "cancelled"]


# --- crear ------------------------------------------------------------------------------------


class NextFreeOut(BaseModel):
    starts_at: datetime


class OwnSlotOut(BaseModel):
    starts_at: datetime


class OwnAvailabilityOut(BaseModel):
    date: str
    slots: list[OwnSlotOut]


class WalkInClientIn(BaseModel):
    # Se validan en el servicio para devolver códigos propios (invalid_name, invalid_phone).
    name: str
    phone: str | None = None


class MeCreateAppointmentIn(BaseModel):
    service_id: uuid.UUID
    starts_at: AwareDatetime | None = None
    walk_in: bool = False
    client: WalkInClientIn
    source: Literal["manual", "walk_in"] | None = None
    note: str | None = None


# --- horario y ausencias ----------------------------------------------------------------------


class ConflictOut(BaseModel):
    """Cita reservada que quedó fuera del nuevo horario o dentro de una ausencia. No se cancela."""

    appointment_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    client_name: str
    service_name: str


class ScheduleBlock(BaseModel):
    weekday: int  # 0 = lunes ... 6 = domingo
    start_time: time
    end_time: time


class ScheduleIn(BaseModel):
    schedule: list[ScheduleBlock]


class ScheduleOut(BaseModel):
    schedule: list[ScheduleBlock]
    conflicts: list[ConflictOut]


class TimeOffIn(BaseModel):
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    reason: str | None = None


class TimeOffOut(BaseModel):
    id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None


class TimeOffListOut(BaseModel):
    items: list[TimeOffOut]


class TimeOffCreatedOut(BaseModel):
    time_off: TimeOffOut
    conflicts: list[ConflictOut]

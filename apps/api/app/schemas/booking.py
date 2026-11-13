import uuid
from datetime import datetime

from pydantic import AwareDatetime, BaseModel

from app.models import AppointmentStatus


class SlotOut(BaseModel):
    starts_at: datetime
    barber_ids: list[uuid.UUID]


class AvailabilityOut(BaseModel):
    date: str
    slots: list[SlotOut]


class ClientIn(BaseModel):
    # Sin restricciones de pydantic: nombre y celular se validan en el servicio para devolver
    # códigos propios (invalid_name, invalid_phone) con mensaje en español.
    name: str
    phone: str


class CreateAppointmentIn(BaseModel):
    service_id: uuid.UUID
    barber_id: uuid.UUID | None = None
    starts_at: AwareDatetime
    client: ClientIn
    consent: bool
    website: str = ""  # honeypot: las personas no lo ven ni lo llenan


class RescheduleIn(BaseModel):
    starts_at: AwareDatetime


class ServiceBrief(BaseModel):
    id: uuid.UUID
    name: str
    price_cop: int
    duration_min: int


class BarberBrief(BaseModel):
    id: uuid.UUID
    display_name: str


class ClientBrief(BaseModel):
    first_name: str


class BusinessBrief(BaseModel):
    name: str


class PublicAppointment(BaseModel):
    """Lo que ve quien tiene el enlace secreto. Nunca incluye el celular."""

    id: uuid.UUID
    status: AppointmentStatus
    starts_at: datetime
    ends_at: datetime
    service: ServiceBrief
    barber: BarberBrief
    client: ClientBrief
    business: BusinessBrief
    can_cancel: bool
    can_reschedule: bool


class CreatedAppointment(BaseModel):
    appointment: PublicAppointment
    manage_token: str
    manage_path: str

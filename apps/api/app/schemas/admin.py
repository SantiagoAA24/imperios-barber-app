"""Esquemas de /admin: catálogo editable (servicios y, más adelante, productos y barberos)."""

import re
import uuid
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
)

from app.models import AppointmentSource, AppointmentStatus
from app.schemas.me import WalkInClientIn

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
PriceCop = Annotated[int, Field(ge=0, le=1_000_000)]


def _blank_to_none(value: str | None) -> str | None:
    return value or None


class ResourceOut(BaseModel):
    id: uuid.UUID
    name: str


class AdminServiceOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price_cop: int
    duration_min: int
    resource_id: uuid.UUID | None
    active: bool
    sort: int


class AdminServiceListOut(BaseModel):
    items: list[AdminServiceOut]
    resources: list[ResourceOut]


class _DurationMixin(BaseModel):
    @field_validator("duration_min", check_fields=False)
    @classmethod
    def _multiple_of_five(cls, value: int | None) -> int | None:
        if value is not None and (value < 5 or value > 240 or value % 5 != 0):
            raise ValueError("duration_min debe ser múltiplo de 5 entre 5 y 240")
        return value

    @field_validator("description", check_fields=False)
    @classmethod
    def _empty_description(cls, value: str | None) -> str | None:
        return _blank_to_none(value)


class ServiceCreateIn(_DurationMixin):
    model_config = ConfigDict(extra="forbid")

    name: Name
    description: Description | None = None
    price_cop: PriceCop
    duration_min: int
    resource_id: uuid.UUID | None = None
    active: bool = True


class ServicePatchIn(_DurationMixin):
    """Solo cambian los campos enviados; ``description`` y ``resource_id`` aceptan ``null``."""

    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    description: Description | None = None
    price_cop: PriceCop | None = None
    duration_min: int | None = None
    resource_id: uuid.UUID | None = None
    active: bool | None = None

    @field_validator("name", "price_cop", "duration_min", "active")
    @classmethod
    def _not_null(cls, value: object) -> object:
        # Un campo enviado explícitamente como null no tiene sentido para estos.
        if value is None:
            raise ValueError("no puede ser null")
        return value

    def sent(self) -> dict[str, object]:
        return {k: getattr(self, k) for k in self.model_fields_set}


class OrderIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: list[uuid.UUID] = Field(min_length=1, max_length=500)


# --- productos --------------------------------------------------------------------------------

ProductAvailabilityLiteral = Literal["in_stock", "out_of_stock"]


def _https_url(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    parts = urlsplit(value)
    if len(value) > 500 or parts.scheme != "https" or not parts.hostname:
        raise ValueError("image_url debe ser https y de máximo 500 caracteres")
    return value


class AdminProductOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price_cop: int
    availability: ProductAvailabilityLiteral
    image_url: str | None
    active: bool
    sort: int


class AdminProductListOut(BaseModel):
    items: list[AdminProductOut]


class _ProductMixin(BaseModel):
    @field_validator("image_url", check_fields=False)
    @classmethod
    def _image(cls, value: str | None) -> str | None:
        return _https_url(value)

    @field_validator("description", check_fields=False)
    @classmethod
    def _empty_description(cls, value: str | None) -> str | None:
        return _blank_to_none(value)


class ProductCreateIn(_ProductMixin):
    model_config = ConfigDict(extra="forbid")

    name: Name
    description: Description | None = None
    price_cop: PriceCop
    availability: ProductAvailabilityLiteral = "in_stock"
    image_url: str | None = None
    active: bool = True


class ProductPatchIn(_ProductMixin):
    model_config = ConfigDict(extra="forbid")

    name: Name | None = None
    description: Description | None = None
    price_cop: PriceCop | None = None
    availability: ProductAvailabilityLiteral | None = None
    image_url: str | None = None
    active: bool | None = None

    @field_validator("name", "price_cop", "availability", "active")
    @classmethod
    def _not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("no puede ser null")
        return value

    def sent(self) -> dict[str, object]:
        return {k: getattr(self, k) for k in self.model_fields_set}


# --- barberos ---------------------------------------------------------------------------------

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=40)]


class AdminBarberOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str
    visible_in_booking: bool
    active: bool
    must_change_password: bool


class AdminBarberListOut(BaseModel):
    items: list[AdminBarberOut]


class BarberCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName
    email: Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254)]
    visible_in_booking: bool = True

    @field_validator("email")
    @classmethod
    def _valid_email(cls, value: str) -> str:
        if not _EMAIL.match(value):
            raise ValueError("correo no válido")
        return value


class BarberPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: DisplayName | None = None
    visible_in_booking: bool | None = None
    active: bool | None = None

    @field_validator("display_name", "visible_in_booking", "active")
    @classmethod
    def _not_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("no puede ser null")
        return value

    def sent(self) -> dict[str, object]:
        return {k: getattr(self, k) for k in self.model_fields_set}


class BarberCreatedOut(BaseModel):
    barber: AdminBarberOut
    # Se muestra una sola vez: ni se guarda en claro ni se puede volver a pedir.
    temporary_password: str


class TemporaryPasswordOut(BaseModel):
    temporary_password: str


class BarberConflictOut(BaseModel):
    appointment_id: uuid.UUID
    starts_at: datetime
    ends_at: datetime
    client_name: str
    service_name: str


class BarberUpdatedOut(BaseModel):
    barber: AdminBarberOut
    # Citas futuras en estado booked del barbero desactivado: no se cancelan.
    conflicts: list[BarberConflictOut]


# --- agenda -----------------------------------------------------------------------------------


class AgendaBarberOut(BaseModel):
    id: uuid.UUID
    display_name: str


class AgendaServiceOut(BaseModel):
    name: str
    duration_min: int
    uses_resource: bool


class AgendaClientOut(BaseModel):
    id: uuid.UUID
    name: str
    # Siempre parcial ('300 *** 4821'): el celular completo solo sale en el detalle del cliente.
    phone_masked: str | None


class AdminAppointmentOut(BaseModel):
    id: uuid.UUID
    barber: AgendaBarberOut
    service: AgendaServiceOut
    client: AgendaClientOut
    status: AppointmentStatus
    source: AppointmentSource
    starts_at: datetime
    ends_at: datetime
    price_cop: int
    is_overdue: bool


class AdminAgendaOut(BaseModel):
    items: list[AdminAppointmentOut]
    # Rejilla sugerida: inicio mínimo y cierre máximo de los horarios de los barberos activos
    # para los días pedidos ("HH:MM", hora local). Sin horarios configurados: 09:00 a 18:00.
    day_start: str
    day_end: str


class AdminAppointmentCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    barber_id: uuid.UUID
    service_id: uuid.UUID
    starts_at: AwareDatetime
    client: WalkInClientIn
    note: str | None = None


class AdminAppointmentPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["attended", "no_show", "cancelled"]

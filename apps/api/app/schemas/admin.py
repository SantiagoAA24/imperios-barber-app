"""Esquemas de /admin: catálogo editable (servicios y, más adelante, productos y barberos)."""

import uuid
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

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

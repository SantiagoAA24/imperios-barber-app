import uuid

from pydantic import BaseModel, ConfigDict

from app.models import ProductAvailability


class PublicBusiness(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str
    timezone: str
    tolerance_min: int
    slot_min: int


class PublicService(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    price_cop: int
    duration_min: int
    uses_resource: bool


class PublicBarber(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str


class PublicProduct(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    price_cop: int
    availability: ProductAvailability
    image_url: str | None

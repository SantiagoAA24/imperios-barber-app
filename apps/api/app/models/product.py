import enum
import uuid

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class ProductAvailability(enum.StrEnum):
    in_stock = "in_stock"
    out_of_stock = "out_of_stock"


class Product(IdTimestampMixin, Base):
    __tablename__ = "product"
    __table_args__ = (
        CheckConstraint("price_cop >= 0", name="price_non_negative"),
        Index("ix_product_business_id_active_sort", "business_id", "active", "sort"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String)
    price_cop: Mapped[int]
    availability: Mapped[ProductAvailability] = mapped_column(
        Enum(ProductAvailability, name="product_availability"),
        server_default=ProductAvailability.in_stock.value,
    )
    image_url: Mapped[str | None] = mapped_column(String)
    active: Mapped[bool] = mapped_column(server_default=text("true"))
    sort: Mapped[int] = mapped_column(server_default=text("0"))

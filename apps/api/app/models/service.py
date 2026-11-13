import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class Service(IdTimestampMixin, Base):
    __tablename__ = "service"
    __table_args__ = (
        CheckConstraint("price_cop >= 0", name="price_non_negative"),
        CheckConstraint("duration_min > 0 AND mod(duration_min, 5) = 0", name="duration_valid"),
        Index("ix_service_business_id_active_sort", "business_id", "active", "sort"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String)
    price_cop: Mapped[int]
    duration_min: Mapped[int]
    resource_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("resource.id"))
    active: Mapped[bool] = mapped_column(server_default=text("true"))
    sort: Mapped[int] = mapped_column(server_default=text("0"))

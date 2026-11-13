import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class Resource(IdTimestampMixin, Base):
    __tablename__ = "resource"
    __table_args__ = (CheckConstraint("capacity > 0", name="capacity_positive"),)

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String)
    capacity: Mapped[int] = mapped_column(server_default=text("1"))

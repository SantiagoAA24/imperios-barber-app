import uuid

from sqlalchemy import ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class Barber(IdTimestampMixin, Base):
    __tablename__ = "barber"

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), unique=True)
    display_name: Mapped[str] = mapped_column(String)
    visible_in_booking: Mapped[bool] = mapped_column(server_default=text("true"))
    active: Mapped[bool] = mapped_column(server_default=text("true"))

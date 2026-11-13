from sqlalchemy import CheckConstraint, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class Business(IdTimestampMixin, Base):
    __tablename__ = "business"
    __table_args__ = (
        CheckConstraint("tolerance_min >= 0", name="tolerance_min_non_negative"),
        CheckConstraint("slot_min > 0", name="slot_min_positive"),
        CheckConstraint("min_lead_min >= 0", name="min_lead_min_non_negative"),
        CheckConstraint("cancel_min_notice_min >= 0", name="cancel_min_notice_non_negative"),
        CheckConstraint("max_active_per_phone > 0", name="max_active_per_phone_positive"),
    )

    name: Mapped[str] = mapped_column(String)
    slug: Mapped[str] = mapped_column(String, unique=True)
    domain: Mapped[str | None] = mapped_column(String, unique=True)
    timezone: Mapped[str] = mapped_column(String, server_default="America/Bogota")
    tolerance_min: Mapped[int] = mapped_column(server_default=text("5"))
    slot_min: Mapped[int] = mapped_column(server_default=text("30"))
    min_lead_min: Mapped[int] = mapped_column(server_default=text("30"))
    cancel_min_notice_min: Mapped[int] = mapped_column(server_default=text("60"))
    max_active_per_phone: Mapped[int] = mapped_column(server_default=text("3"))

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class Client(IdTimestampMixin, Base):
    __tablename__ = "client"
    __table_args__ = (
        Index("ix_client_business_id_name", "business_id", "name"),
        Index(
            "uq_client_business_id_phone_e164",
            "business_id",
            "phone_e164",
            unique=True,
            postgresql_where="phone_e164 IS NOT NULL",
        ),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    name: Mapped[str] = mapped_column(String)
    phone_e164: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(String)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

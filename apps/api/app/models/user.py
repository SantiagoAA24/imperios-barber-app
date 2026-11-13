import enum
import uuid

from sqlalchemy import CheckConstraint, Enum, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdTimestampMixin


class UserRole(enum.StrEnum):
    admin = "admin"
    barber = "barber"


class User(IdTimestampMixin, Base):
    __tablename__ = "user"
    __table_args__ = (
        UniqueConstraint("business_id", "email"),
        CheckConstraint("email = lower(email)", name="email_lowercase"),
    )

    business_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("business.id"))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    name: Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)
    active: Mapped[bool] = mapped_column(server_default=text("true"))

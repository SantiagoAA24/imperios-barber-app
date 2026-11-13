import uuid

from pydantic import BaseModel, Field

from app.models import UserRole


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    role: UserRole
    must_change_password: bool = False


class ChangePasswordIn(BaseModel):
    current: str = Field(min_length=1, max_length=256)
    new: str = Field(min_length=10, max_length=256)


class PingOut(BaseModel):
    status: str
    role: UserRole
    business_id: uuid.UUID

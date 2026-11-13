"""Contraseñas (argon2), JWT de acceso (HS256), refresh opaco y dependencias de autorización."""

import hashlib
import secrets
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request
from sqlalchemy import select

from app.core.config import Settings
from app.core.db import DbSession
from app.core.errors import ApiError
from app.core.tenant import CurrentBusiness
from app.models import User, UserRole

ACCESS_COOKIE = "access_token"
REFRESH_COOKIE = "refresh_token"
ALGORITHM = "HS256"

_hasher = PasswordHasher()
_dummy_hash: str | None = None


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def burn_password_check(password: str) -> None:
    """Gasta el mismo tiempo que una verificación real (correo inexistente o usuario inactivo)."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = _hasher.hash("contraseña-de-relleno")
    verify_password(_dummy_hash, password)


# --- Access token (JWT) ---------------------------------------------------------------------


@dataclass(frozen=True)
class TokenClaims:
    user_id: uuid.UUID
    role: str
    business_id: uuid.UUID


def create_access_token(user: User, settings: Settings, now: datetime | None = None) -> str:
    issued = now or datetime.now(UTC)
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "business_id": str(user.business_id),
        "iat": issued,
        "exp": issued + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str, settings: Settings) -> TokenClaims:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[ALGORITHM],
            options={"require": ["exp", "sub", "role", "business_id"]},
        )
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "token_expired", "Tu sesión venció. Inicia sesión de nuevo.") from None
    except jwt.InvalidTokenError:
        raise _invalid_token() from None
    try:
        return TokenClaims(
            user_id=uuid.UUID(str(payload["sub"])),
            role=str(payload["role"]),
            business_id=uuid.UUID(str(payload["business_id"])),
        )
    except ValueError:
        raise _invalid_token() from None


def _invalid_token() -> ApiError:
    return ApiError(401, "invalid_token", "Tu sesión no es válida. Inicia sesión de nuevo.")


# --- Refresh token (opaco) ------------------------------------------------------------------


def new_refresh_token() -> tuple[str, str]:
    """Devuelve (valor para la cookie, sha256 para la base). Solo el hash se guarda."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# --- Dependencias ---------------------------------------------------------------------------


def get_settings_dep(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def session_user(request: Request, session: DbSession, business: CurrentBusiness) -> User:
    """Usuario del access token, aunque deba cambiar su clave (solo /auth/me y change-password).

    El ``business_id`` que manda es el del token, no el del cliente.
    """
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        raise ApiError(401, "not_authenticated", "Inicia sesión para continuar.")
    claims = decode_access_token(token, get_settings_dep(request))
    # Un token de otro negocio no vale en este sitio (ni se consulta nada de este negocio).
    if claims.business_id != business.id:
        raise _invalid_token()
    user = session.scalar(
        select(User).where(
            User.id == claims.user_id,
            User.business_id == claims.business_id,
            User.active.is_(True),
        )
    )
    if user is None:
        raise _invalid_token()
    return user


def current_user(user: Annotated[User, Depends(session_user)]) -> User:
    """Como ``session_user``, pero con clave temporal pendiente no deja usar nada más."""
    if user.must_change_password:
        raise ApiError(
            403,
            "password_change_required",
            "Debes cambiar tu clave temporal antes de continuar.",
        )
    return user


SessionUser = Annotated[User, Depends(session_user)]
CurrentUser = Annotated[User, Depends(current_user)]
SettingsDep = Annotated[Settings, Depends(get_settings_dep)]


def require_role(*roles: UserRole | str) -> Callable[[User], User]:
    """Exige alguno de los roles dados. Un admin NO hereda al barbero: hay que listarlo."""
    allowed = {UserRole(r) for r in roles}

    def dependency(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise ApiError(403, "forbidden", "No tienes permiso para hacer esto.")
        return user

    return dependency


AdminUser = Annotated[User, Depends(require_role(UserRole.admin))]
BarberUser = Annotated[User, Depends(require_role(UserRole.barber))]

"""Reglas de sesión: login, rotación del refresh con detección de reutilización, logout."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError
from app.core.security import (
    burn_password_check,
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.models import Business, RefreshToken, User


@dataclass(frozen=True)
class IssuedSession:
    user: User
    access_token: str
    refresh_token: str


def _invalid_credentials() -> ApiError:
    # Mismo código y mensaje para correo inexistente, contraseña errónea o usuario inactivo.
    return ApiError(401, "invalid_credentials", "Correo o contraseña incorrectos.")


def _invalid_refresh() -> ApiError:
    return ApiError(401, "invalid_refresh_token", "Tu sesión venció. Inicia sesión de nuevo.")


def _issue(
    session: Session, user: User, settings: Settings, family_id: uuid.UUID, now: datetime
) -> tuple[IssuedSession, RefreshToken]:
    raw, token_hash = new_refresh_token()
    row = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        family_id=family_id,
        expires_at=now + timedelta(days=settings.refresh_token_days),
    )
    session.add(row)
    session.flush()
    return IssuedSession(user, create_access_token(user, settings, now), raw), row


def login(
    session: Session, business: Business, settings: Settings, email: str, password: str
) -> IssuedSession:
    user = session.scalar(
        select(User).where(User.business_id == business.id, User.email == email.strip().lower())
    )
    if user is None or not user.active:
        burn_password_check(password)
        raise _invalid_credentials()
    if not verify_password(user.password_hash, password):
        raise _invalid_credentials()
    issued, _ = _issue(session, user, settings, uuid.uuid4(), datetime.now(UTC))
    session.commit()
    return issued


def refresh(
    session: Session, business: Business, settings: Settings, raw_token: str | None
) -> IssuedSession:
    if not raw_token:
        raise _invalid_refresh()
    now = datetime.now(UTC)
    # FOR UPDATE: dos refresh simultáneos con el mismo token se serializan.
    row = session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        .with_for_update()
    )
    if row is None:
        raise _invalid_refresh()
    if row.revoked_at is not None:
        # Reutilización de un refresh ya rotado (o cerrado): se asume robo y cae toda la familia.
        _revoke_family(session, row.family_id, now)
        session.commit()
        raise _invalid_refresh()
    user = session.scalar(
        select(User).where(
            User.id == row.user_id, User.business_id == business.id, User.active.is_(True)
        )
    )
    if user is None or row.expires_at <= now:
        raise _invalid_refresh()
    issued, new_row = _issue(session, user, settings, row.family_id, now)
    row.revoked_at = now
    row.replaced_by = new_row.id
    session.commit()
    return issued


def logout(session: Session, raw_token: str | None) -> None:
    if not raw_token:
        return
    now = datetime.now(UTC)
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(raw_token))
        .where(RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    session.commit()


def _revoke_family(session: Session, family_id: uuid.UUID, now: datetime) -> None:
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )


def change_password(
    session: Session, user: User, settings: Settings, current: str, new: str
) -> IssuedSession:
    """Cambia la clave, cierra las demás sesiones y abre una nueva."""
    if not verify_password(user.password_hash, current):
        raise ApiError(
            403, "invalid_current_password", "La clave actual no es correcta.", {"field": "current"}
        )
    if new == current:
        raise ApiError(422, "password_unchanged", "La clave nueva debe ser distinta de la actual.")
    now = datetime.now(UTC)
    user.password_hash = hash_password(new)
    user.must_change_password = False
    revoke_sessions(session, user.id, now)
    issued, _ = _issue(session, user, settings, uuid.uuid4(), now)
    session.commit()
    return issued


def revoke_sessions(session: Session, user_id: uuid.UUID, now: datetime) -> None:
    """Revoca todos los refresh tokens vigentes del usuario (no hace commit)."""
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )

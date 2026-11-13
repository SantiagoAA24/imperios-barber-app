"""Límite de peticiones (slowapi, almacenamiento en memoria del proceso)."""

from limits import parse
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.errors import RATE_LIMITED_MESSAGE, ApiError

limiter = Limiter(key_func=get_remote_address, default_limits=[], storage_uri="memory://")

LOGIN_LIMIT = "5/minute"
PUBLIC_LIMIT = "120/minute"

_login_email_item = parse(LOGIN_LIMIT)


def hit_login_email(email: str) -> None:
    """Segundo tope del login: 5 intentos por minuto por correo, sin importar la IP."""
    if not limiter.enabled:  # solo se apaga en E2E; en producción siempre está activo
        return
    if not limiter.limiter.hit(_login_email_item, "login_email", email):
        raise ApiError(429, "rate_limited", RATE_LIMITED_MESSAGE, headers={"Retry-After": "60"})

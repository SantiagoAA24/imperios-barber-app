"""Verificación de Origin en métodos que modifican datos y cabeceras de seguridad."""

from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from app.core.config import Settings
from app.core.errors import error_response

UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

Next = Callable[[Request], Awaitable[Response]]


def register_middleware(app: FastAPI, settings: Settings) -> None:
    allowed = {o.lower() for o in settings.allowed_origins_list}

    @app.middleware("http")
    async def check_origin(request: Request, call_next: Next) -> Response:
        # Un navegador siempre manda Origin en estas peticiones; sin él (curl, otros servidores)
        # no hay riesgo de CSRF, así que se deja pasar. Un Origin presente debe estar permitido.
        origin = request.headers.get("origin")
        if (
            request.method in UNSAFE_METHODS
            and origin is not None
            and origin.rstrip("/").lower() not in allowed
        ):
            return error_response(
                403, "origin_not_allowed", "No podemos procesar esta solicitud desde aquí."
            )
        return await call_next(request)

    @app.middleware("http")
    async def security_headers(request: Request, call_next: Next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response

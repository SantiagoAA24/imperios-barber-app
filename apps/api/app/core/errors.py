"""Formato de error único: ``{"code": "snake_case", "message": "...", "details": {}}``."""

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")

RATE_LIMITED_MESSAGE = "Hiciste demasiados intentos. Espera un momento e inténtalo de nuevo."

_DEFAULTS: dict[int, tuple[str, str]] = {
    400: ("bad_request", "La solicitud no es válida."),
    401: ("not_authenticated", "Inicia sesión para continuar."),
    403: ("forbidden", "No tienes permiso para hacer esto."),
    404: ("not_found", "No encontramos lo que buscas."),
    405: ("method_not_allowed", "Esta acción no está permitida aquí."),
    409: ("conflict", "Esta acción choca con el estado actual."),
    429: ("rate_limited", RATE_LIMITED_MESSAGE),
}


class ApiError(HTTPException):
    """Error de negocio con ``code`` estable (para el frontend) y mensaje en español."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message, headers=headers)
        self.code = code
        self.message = message
        self.details = details or {}


def error_response(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": message, "details": details or {}},
        headers=headers,
    )


async def _http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    headers = dict(exc.headers) if exc.headers else None
    if isinstance(exc, ApiError):
        return error_response(exc.status_code, exc.code, exc.message, exc.details, headers)
    code, message = _DEFAULTS.get(
        exc.status_code, ("http_error", "No pudimos completar la solicitud.")
    )
    return error_response(exc.status_code, code, message, headers=headers)


async def _validation_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    # Solo ubicación y tipo del error: nunca el valor recibido (podría ser una contraseña).
    fields = [{"loc": [str(p) for p in e["loc"]], "type": e["type"]} for e in exc.errors()]
    return error_response(422, "validation_error", "Revisa los datos enviados.", {"fields": fields})


async def _rate_limit_handler(request: Request, exc: Exception) -> JSONResponse:
    return error_response(429, "rate_limited", RATE_LIMITED_MESSAGE, headers={"Retry-After": "60"})


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    # El traceback queda en el log del servidor; al cliente solo le llega un mensaje genérico.
    logger.error("Error no controlado en %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(
        500, "internal_error", "Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento."
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
    app.add_exception_handler(Exception, _unhandled_handler)

"""Resolución del negocio: Host contra ``business.domain``; si no coincide, el slug por defecto."""

from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends, Request
from sqlalchemy import select

from app.core.db import DbSession
from app.core.errors import ApiError
from app.models import Business


def request_host(request: Request) -> str:
    """Host sin puerto y en minúsculas (vacío si falta o es inválido)."""
    try:
        return (urlsplit("//" + request.headers.get("host", "")).hostname or "").lower()
    except ValueError:
        return ""


def get_business(request: Request, session: DbSession) -> Business:
    business = None
    host = request_host(request)
    if host:
        business = session.scalar(select(Business).where(Business.domain == host))
    if business is None:
        slug = request.app.state.settings.default_business_slug
        business = session.scalar(select(Business).where(Business.slug == slug))
    if business is None:
        raise ApiError(404, "business_not_found", "No encontramos este negocio.")
    return business


CurrentBusiness = Annotated[Business, Depends(get_business)]

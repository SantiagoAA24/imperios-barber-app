"""Escenario de reservas: lunes 16-nov-2026, "ahora" = 8:00 am en Bogotá."""

from dataclasses import dataclass
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.core.clock import utcnow
from app.models import Barber, Business, Resource, Service
from tests.helpers import make_barber, make_business, make_resource, make_schedule, make_service

BOGOTA = ZoneInfo("America/Bogota")
DAY = "2026-11-16"  # lunes
HOST = {"Host": "imperio.test"}


def at(hhmm: str, day: str = DAY) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    y, mo, d = (int(x) for x in day.split("-"))
    return datetime(y, mo, d, h, m, tzinfo=BOGOTA)


class Clock:
    def __init__(self) -> None:
        self.now = at("08:00").astimezone(UTC)


@dataclass
class Env:
    business: Business
    ana: Barber
    beto: Barber
    vaporizer: Resource
    basico: Service  # 30 min, sin recurso
    facial_combo: Service  # 60 min, vaporizador
    facial: Service  # 30 min, vaporizador


@pytest.fixture
def clock(app: FastAPI) -> Clock:
    c = Clock()
    app.dependency_overrides[utcnow] = lambda: c.now
    return c


@pytest.fixture
def env(session: Session, clock: Clock) -> Env:
    business = make_business(session, "imperio", "imperio.test")
    ana = make_barber(session, business, "Ana")
    beto = make_barber(session, business, "Beto")
    for b in (ana, beto):
        make_schedule(session, b, 0)  # lunes 9-13 y 14-18
    vap = make_resource(session, business)
    return Env(
        business=business,
        ana=ana,
        beto=beto,
        vaporizer=vap,
        basico=make_service(session, business, "Corte básico", duration_min=30),
        facial_combo=make_service(
            session, business, "Corte + limpieza facial", resource=vap, duration_min=60
        ),
        facial=make_service(session, business, "Limpieza facial", resource=vap, duration_min=30),
    )


def client_from(app: FastAPI, ip: str) -> AsyncClient:
    """Un cliente HTTP con su propia IP (el tope de 10 reservas/hora es por IP)."""
    transport = ASGITransport(app=app, client=(ip, 50000))
    return AsyncClient(transport=transport, base_url="http://testserver")


def booking_body(
    service: Service,
    barber: Barber | None,
    hhmm: str,
    phone: str = "300 123 4567",
    name: str = "Juan Pérez",
    **extra: object,
) -> dict[str, object]:
    body: dict[str, object] = {
        "service_id": str(service.id),
        "barber_id": str(barber.id) if barber else None,
        "starts_at": at(hhmm).isoformat(),
        "client": {"name": name, "phone": phone},
        "consent": True,
        "website": "",
    }
    return {**body, **extra}

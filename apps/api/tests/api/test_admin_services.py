"""Servicios del admin: validación, aislamiento, orden, historial y copia de precio en la cita."""

import uuid

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models import Appointment, Service
from tests.api.conftest import Env, booking_body, client_from
from tests.helpers import admin_headers, make_business, make_resource, make_service

pytestmark = pytest.mark.anyio

URL = "/api/v1/admin/services"
PUBLIC = "/api/v1/public/services"
GOOD = {"name": "Corte nuevo", "price_cop": 20_000, "duration_min": 30}


@pytest.fixture
def admin(session: Session, env: Env) -> dict[str, str]:
    return admin_headers(session, env.business)


async def test_lista_trae_todos_incluidos_inactivos_y_recursos(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    make_service(session, env.business, "Oculto", sort=9, active=False)
    r = await client.get(URL, headers=admin)
    assert r.status_code == 200
    body = r.json()
    names = [s["name"] for s in body["items"]]
    assert "Oculto" in names and "Corte básico" in names
    assert [x["name"] for x in body["resources"]] == ["Vaporizador"]


async def test_crear_pone_sort_al_final_y_aparece_en_publico(
    client: AsyncClient, env: Env, admin: dict[str, str]
) -> None:
    r = await client.post(URL, json={**GOOD, "description": "  Con cariño "}, headers=admin)
    assert r.status_code == 201
    created = r.json()
    assert created["description"] == "Con cariño"
    assert created["active"] is True
    listing = (await client.get(URL, headers=admin)).json()["items"]
    assert listing[-1]["id"] == created["id"]
    public = (await client.get(PUBLIC, headers={"Host": "imperio.test"})).json()
    assert "Corte nuevo" in [s["name"] for s in public]


@pytest.mark.parametrize(
    "bad",
    [
        {"name": "A"},
        {"name": "x" * 61},
        {"description": "d" * 201},
        {"price_cop": -1},
        {"price_cop": 1_000_001},
        {"price_cop": 1.5},
        {"duration_min": 7},
        {"duration_min": 0},
        {"duration_min": 245},
        {"unknown": 1},
    ],
)
async def test_validaciones_de_creacion(
    client: AsyncClient, env: Env, admin: dict[str, str], bad: dict[str, object]
) -> None:
    r = await client.post(URL, json={**GOOD, **bad}, headers=admin)
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"


async def test_limites_validos(client: AsyncClient, env: Env, admin: dict[str, str]) -> None:
    for price, minutes in ((0, 5), (1_000_000, 240)):
        r = await client.post(
            URL, json={"name": "Límite", "price_cop": price, "duration_min": minutes}, headers=admin
        )
        assert r.status_code == 201


async def test_recurso_de_otro_negocio_se_rechaza(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    other = make_business(session, "otro", "otro.test")
    foreign = make_resource(session, other)
    r = await client.post(URL, json={**GOOD, "resource_id": str(foreign.id)}, headers=admin)
    assert r.status_code == 422 and r.json()["code"] == "invalid_resource"
    r = await client.patch(
        f"{URL}/{env.basico.id}", json={"resource_id": str(foreign.id)}, headers=admin
    )
    assert r.status_code == 422 and r.json()["code"] == "invalid_resource"


async def test_patch_parcial_y_nulos(client: AsyncClient, env: Env, admin: dict[str, str]) -> None:
    r = await client.patch(
        f"{URL}/{env.facial.id}", json={"resource_id": None, "price_cop": 40_000}, headers=admin
    )
    assert r.status_code == 200
    body = r.json()
    assert body["resource_id"] is None and body["price_cop"] == 40_000
    assert body["name"] == "Limpieza facial"  # no enviado: no cambia
    r = await client.patch(f"{URL}/{env.facial.id}", json={"name": None}, headers=admin)
    assert r.status_code == 422
    r = await client.patch(
        f"{URL}/{env.facial.id}", json={"resource_id": str(env.vaporizer.id)}, headers=admin
    )
    assert r.json()["resource_id"] == str(env.vaporizer.id)


async def test_desactivar_lo_quita_de_la_web_publica(
    client: AsyncClient, env: Env, admin: dict[str, str]
) -> None:
    r = await client.patch(f"{URL}/{env.basico.id}", json={"active": False}, headers=admin)
    assert r.status_code == 200
    public = (await client.get(PUBLIC, headers={"Host": "imperio.test"})).json()
    assert "Corte básico" not in [s["name"] for s in public]


async def test_aislamiento_entre_negocios(client: AsyncClient, session: Session, env: Env) -> None:
    other = make_business(session, "otro", "otro.test")
    foreign = make_service(session, other, "Ajeno")
    admin_b = admin_headers(session, other, host="otro.test")
    admin_a = admin_headers(session, env.business)

    # A no ve ni edita ni borra lo de B (404), y B no ve lo de A.
    a_list = (await client.get(URL, headers=admin_a)).json()["items"]
    assert str(foreign.id) not in [s["id"] for s in a_list]
    assert (
        await client.patch(f"{URL}/{foreign.id}", json={"active": False}, headers=admin_a)
    ).status_code == 404
    assert (await client.delete(f"{URL}/{foreign.id}", headers=admin_a)).status_code == 404
    b_list = (await client.get(URL, headers=admin_b)).json()["items"]
    assert [s["name"] for s in b_list] == ["Ajeno"]
    session.expire_all()
    assert session.get(Service, foreign.id) is not None


async def test_token_de_otro_negocio_no_sirve_en_este_host(
    client: AsyncClient, session: Session, env: Env
) -> None:
    other = make_business(session, "otro", "otro.test")
    admin_b = admin_headers(session, other, host="otro.test")
    r = await client.get(URL, headers={**admin_b, "Host": "imperio.test"})
    assert r.status_code == 401


async def test_orden_completo_y_validaciones(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    items = (await client.get(URL, headers=admin)).json()["items"]
    ids = [s["id"] for s in items]
    reversed_ids = list(reversed(ids))
    r = await client.put(f"{URL}/order", json={"ids": reversed_ids}, headers=admin)
    assert r.status_code == 200
    assert [s["id"] for s in r.json()["items"]] == reversed_ids
    assert [s["sort"] for s in r.json()["items"]] == list(range(len(ids)))
    # Falta uno, repetido o ajeno: 422.
    for bad in (ids[:-1], ids + [ids[0]], ids[:-1] + [str(uuid.uuid4())]):
        r = await client.put(f"{URL}/order", json={"ids": bad}, headers=admin)
        assert r.status_code == 422 and r.json()["code"] == "invalid_order"


async def test_eliminar_sin_historial(client: AsyncClient, env: Env, admin: dict[str, str]) -> None:
    r = await client.delete(f"{URL}/{env.facial.id}", headers=admin)
    assert r.status_code == 204
    ids = [s["id"] for s in (await client.get(URL, headers=admin)).json()["items"]]
    assert str(env.facial.id) not in ids


async def test_eliminar_con_historial_da_409_has_history(
    app: FastAPI, client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    async with client_from(app, "10.0.0.7") as c:
        r = await c.post(
            "/api/v1/public/appointments",
            json=booking_body(env.basico, env.ana, "10:00"),
            headers={"Host": "imperio.test"},
        )
        assert r.status_code == 201
    r = await client.delete(f"{URL}/{env.basico.id}", headers=admin)
    assert r.status_code == 409
    body = r.json()
    assert body["code"] == "has_history"
    assert (
        body["message"]
        == "Este servicio tiene citas en el historial. Desactívalo en lugar de eliminarlo."
    )
    session.expire_all()
    assert session.get(Service, env.basico.id) is not None


async def test_cambiar_precio_no_altera_cita_reservada_pero_si_la_siguiente(
    app: FastAPI, client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    host = {"Host": "imperio.test"}
    async with client_from(app, "10.0.0.8") as c:
        first = await c.post(
            "/api/v1/public/appointments",
            json=booking_body(env.basico, env.ana, "10:00", phone="300 111 0001"),
            headers=host,
        )
        assert first.status_code == 201
        r = await client.patch(
            f"{URL}/{env.basico.id}", json={"price_cop": 30_000, "duration_min": 45}, headers=admin
        )
        assert r.status_code == 200
        second = await c.post(
            "/api/v1/public/appointments",
            json=booking_body(env.basico, env.ana, "11:00", phone="300 111 0002"),
            headers=host,
        )
        assert second.status_code == 201
    session.expire_all()
    rows = {
        a.starts_at.hour: a
        for a in session.query(Appointment).filter(Appointment.service_id == env.basico.id)
    }
    assert (rows[15].price_cop, rows[15].duration_min) == (22_000, 30)  # 10:00 Bogotá = 15 UTC
    assert (rows[16].price_cop, rows[16].duration_min) == (30_000, 45)

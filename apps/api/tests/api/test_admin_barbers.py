"""Barberos del admin: alta con clave temporal, cambio obligatorio, reinicio y desactivación."""

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.models import Appointment, Barber, User
from tests.api.conftest import Env, booking_body, client_from
from tests.conftest import make_settings
from tests.helpers import admin_headers, make_business

pytestmark = pytest.mark.anyio

URL = "/api/v1/admin/barbers"
HOST = {"Host": "imperio.test"}
NEW = {"display_name": "Carlos", "email": "  Carlos@Imperio.Test "}


@pytest.fixture
def admin(session: Session, env: Env) -> dict[str, str]:
    return admin_headers(session, env.business)


async def login(client: AsyncClient, email: str, password: str) -> object:
    return await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}, headers=HOST
    )


async def create(client: AsyncClient, admin: dict[str, str]) -> dict[str, object]:
    r = await client.post(URL, json=NEW, headers=admin)
    assert r.status_code == 201, r.text
    return r.json()  # type: ignore[no-any-return]


async def test_alta_devuelve_clave_temporal_una_vez_y_no_se_guarda_en_claro(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    body = await create(client, admin)
    password = str(body["temporary_password"])
    assert len(password) == 12 and password.isalnum()
    barber = body["barber"]
    assert isinstance(barber, dict)
    assert barber["email"] == "carlos@imperio.test" and barber["must_change_password"] is True
    # La lista y cualquier otra lectura nunca la traen de vuelta.
    listing = (await client.get(URL, headers=admin)).text
    assert password not in listing and "temporary_password" not in listing
    # Ni en claro en la base: solo el hash argon2.
    session.expire_all()
    user = session.query(User).filter(User.email == "carlos@imperio.test").one()
    assert user.password_hash != password and verify_password(user.password_hash, password)
    dump = session.execute(
        text('SELECT row_to_json(u)::text FROM "user" u WHERE email = :e'),
        {"e": "carlos@imperio.test"},
    ).scalar_one()
    assert password not in dump
    assert session.query(Barber).filter(Barber.display_name == "Carlos").count() == 1


async def test_correo_repetido_y_validaciones(
    client: AsyncClient, env: Env, admin: dict[str, str]
) -> None:
    await create(client, admin)
    r = await client.post(URL, json=NEW, headers=admin)
    assert r.status_code == 409 and r.json()["code"] == "email_taken"
    for bad in ({"email": "sin-arroba"}, {"display_name": "A"}, {"extra": 1}):
        r = await client.post(URL, json={**NEW, "email": "otro@x.co", **bad}, headers=admin)
        assert r.status_code == 422


async def test_con_clave_temporal_solo_sirve_cambiar_la_clave(
    client: AsyncClient, env: Env, admin: dict[str, str]
) -> None:
    created = await create(client, admin)
    temp = str(created["temporary_password"])
    r = await login(client, "carlos@imperio.test", temp)
    assert r.status_code == 200  # type: ignore[attr-defined]
    assert r.json()["must_change_password"] is True  # type: ignore[attr-defined]
    # Cualquier otra ruta de personal: 403 password_change_required.
    for method, path in (
        ("GET", "/api/v1/me/appointments?date=2026-11-16"),
        ("GET", "/api/v1/me/schedule"),
        ("GET", "/api/v1/admin/services"),
    ):
        resp = await client.request(method, path, headers=HOST)
        assert resp.status_code == 403, path
        if path.startswith("/api/v1/me"):
            assert resp.json()["code"] == "password_change_required"
    assert (await client.get("/api/v1/auth/me", headers=HOST)).json()["must_change_password"]

    # Validaciones del cambio.
    cp = "/api/v1/auth/change-password"
    assert (
        await client.post(cp, json={"current": temp, "new": "corta"}, headers=HOST)
    ).status_code == 422
    r = await client.post(
        cp, json={"current": "incorrecta-123", "new": "una-clave-larga-1"}, headers=HOST
    )
    assert r.status_code == 403 and r.json()["code"] == "invalid_current_password"
    r = await client.post(cp, json={"current": temp, "new": temp}, headers=HOST)
    assert r.status_code == 422
    r = await client.post(cp, json={"current": temp, "new": "una-clave-larga-1"}, headers=HOST)
    assert r.status_code == 200 and r.json()["must_change_password"] is False
    # Ya puede usar su panel con la sesión nueva, y la clave vieja dejó de servir.
    assert (await client.get("/api/v1/me/schedule", headers=HOST)).status_code == 200
    assert (await login(client, "carlos@imperio.test", temp)).status_code == 401  # type: ignore[attr-defined]
    assert (await login(client, "carlos@imperio.test", "una-clave-larga-1")).status_code == 200  # type: ignore[attr-defined]


async def test_reiniciar_clave_exige_cambiarla_de_nuevo_y_cierra_sesiones(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    created = await create(client, admin)
    barber = created["barber"]
    assert isinstance(barber, dict)
    cp = "/api/v1/auth/change-password"
    await login(client, "carlos@imperio.test", str(created["temporary_password"]))
    await client.post(
        cp,
        json={"current": str(created["temporary_password"]), "new": "clave-propia-123"},
        headers=HOST,
    )
    r = await client.post(f"{URL}/{barber['id']}/reset-password", headers=admin)
    assert r.status_code == 200
    temp2 = r.json()["temporary_password"]
    assert len(temp2) == 12
    listing = (await client.get(URL, headers=admin)).json()["items"]
    assert [b for b in listing if b["email"] == "carlos@imperio.test"][0]["must_change_password"]
    assert (await login(client, "carlos@imperio.test", "clave-propia-123")).status_code == 401  # type: ignore[attr-defined]
    resp = await login(client, "carlos@imperio.test", temp2)
    assert resp.json()["must_change_password"] is True  # type: ignore[attr-defined]


async def test_desactivar_no_borra_citas_y_devuelve_conflicts(
    app: FastAPI, client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    async with client_from(app, "10.0.0.9") as c:
        r = await c.post(
            "/api/v1/public/appointments",
            json=booking_body(env.basico, env.ana, "10:00"),
            headers=HOST,
        )
        assert r.status_code == 201
    r = await client.patch(f"{URL}/{env.ana.id}", json={"active": False}, headers=admin)
    assert r.status_code == 200
    body = r.json()
    assert body["barber"]["active"] is False
    assert [c["client_name"] for c in body["conflicts"]] == ["Juan Pérez"]
    assert body["conflicts"][0]["service_name"] == "Corte básico"
    assert session.query(Appointment).filter(Appointment.barber_id == env.ana.id).count() == 1
    # Ya no aparece al agendar y su cuenta no inicia sesión.
    public = (await client.get("/api/v1/public/barbers", headers=HOST)).json()
    assert "Ana" not in [b["display_name"] for b in public]
    session.expire_all()
    user = session.get(User, env.ana.user_id)
    assert user is not None and user.active is False
    # Reactivar: sin conflictos y vuelve a estar activa.
    r = await client.patch(f"{URL}/{env.ana.id}", json={"active": True}, headers=admin)
    assert r.json()["conflicts"] == [] and r.json()["barber"]["active"] is True


async def test_patch_visible_y_nombre(client: AsyncClient, env: Env, admin: dict[str, str]) -> None:
    r = await client.patch(
        f"{URL}/{env.beto.id}",
        json={"visible_in_booking": False, "display_name": "Beto Jr"},
        headers=admin,
    )
    assert r.status_code == 200
    public = (await client.get("/api/v1/public/barbers", headers=HOST)).json()
    assert [b["display_name"] for b in public] == ["Ana"]
    assert (
        await client.patch(f"{URL}/{env.beto.id}", json={"active": None}, headers=admin)
    ).status_code == 422


async def test_aislamiento_entre_negocios(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    other = make_business(session, "otro", "otro.test")
    admin_b = admin_headers(session, other, host="otro.test")
    created = (await client.post(URL, json=NEW, headers=admin_b)).json()
    foreign_id = created["barber"]["id"]
    ids = [b["id"] for b in (await client.get(URL, headers=admin)).json()["items"]]
    assert foreign_id not in ids
    assert (
        await client.patch(f"{URL}/{foreign_id}", json={"active": False}, headers=admin)
    ).status_code == 404
    assert (
        await client.post(f"{URL}/{foreign_id}/reset-password", headers=admin)
    ).status_code == 404


async def test_token_de_usuario_con_clave_temporal_no_abre_admin(
    client: AsyncClient, session: Session, env: Env
) -> None:
    user = session.get(User, env.ana.user_id)
    assert user is not None
    user.must_change_password = True
    session.commit()
    token = create_access_token(user, make_settings())
    r = await client.get("/api/v1/me/schedule", headers={**HOST, "Cookie": f"access_token={token}"})
    assert r.status_code == 403 and r.json()["code"] == "password_change_required"

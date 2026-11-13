"""Productos del admin: validación (https), aislamiento, orden y reflejo en la web pública."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models import Product
from tests.api.conftest import Env
from tests.helpers import admin_headers, make_business, make_product

pytestmark = pytest.mark.anyio

URL = "/api/v1/admin/products"
PUBLIC = "/api/v1/public/products"
GOOD = {"name": "Cera mate", "price_cop": 18_000}
HOST = {"Host": "imperio.test"}


@pytest.fixture
def admin(session: Session, env: Env) -> dict[str, str]:
    return admin_headers(session, env.business)


async def test_crud_y_publico(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    make_product(session, env.business, "Pomada", sort=0)
    r = await client.post(
        URL, json={**GOOD, "image_url": "https://img.example.com/c.jpg"}, headers=admin
    )
    assert r.status_code == 201
    created = r.json()
    assert created["availability"] == "in_stock" and created["sort"] == 1
    r = await client.patch(
        f"{URL}/{created['id']}", json={"availability": "out_of_stock"}, headers=admin
    )
    assert r.json()["availability"] == "out_of_stock"
    public = (await client.get(PUBLIC, headers=HOST)).json()
    assert [p["name"] for p in public] == ["Pomada", "Cera mate"]
    r = await client.patch(f"{URL}/{created['id']}", json={"active": False}, headers=admin)
    assert "Cera mate" not in [p["name"] for p in (await client.get(PUBLIC, headers=HOST)).json()]
    assert (await client.delete(f"{URL}/{created['id']}", headers=admin)).status_code == 204
    names = [p["name"] for p in (await client.get(URL, headers=admin)).json()["items"]]
    assert names == ["Pomada"]


@pytest.mark.parametrize(
    "bad",
    [
        {"image_url": "http://img.example.com/a.jpg"},
        {"image_url": "javascript:alert(1)"},
        {"image_url": "https://" + "a" * 500 + ".com/x.jpg"},
        {"availability": "mucho"},
        {"price_cop": 1_000_001},
        {"name": "x"},
        {"description": "d" * 201},
    ],
)
async def test_validaciones(
    client: AsyncClient, env: Env, admin: dict[str, str], bad: dict[str, object]
) -> None:
    r = await client.post(URL, json={**GOOD, **bad}, headers=admin)
    assert r.status_code == 422


async def test_imagen_vacia_se_guarda_como_nula(
    client: AsyncClient, env: Env, admin: dict[str, str]
) -> None:
    r = await client.post(URL, json={**GOOD, "image_url": "  "}, headers=admin)
    assert r.status_code == 201 and r.json()["image_url"] is None


async def test_aislamiento_entre_negocios(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    other = make_business(session, "otro", "otro.test")
    foreign = make_product(session, other, "Ajeno")
    assert str(foreign.id) not in [
        p["id"] for p in (await client.get(URL, headers=admin)).json()["items"]
    ]
    r = await client.patch(f"{URL}/{foreign.id}", json={"active": False}, headers=admin)
    assert r.status_code == 404
    assert (await client.delete(f"{URL}/{foreign.id}", headers=admin)).status_code == 404
    session.expire_all()
    assert session.get(Product, foreign.id) is not None


async def test_orden(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    for i, n in enumerate(("A1", "B2", "C3")):
        make_product(session, env.business, n, sort=i)
    ids = [p["id"] for p in (await client.get(URL, headers=admin)).json()["items"]]
    r = await client.put(f"{URL}/order", json={"ids": ids[::-1]}, headers=admin)
    assert [p["id"] for p in r.json()["items"]] == ids[::-1]
    for bad in (ids[:-1], [*ids, str(uuid.uuid4())]):
        r = await client.put(f"{URL}/order", json={"ids": bad}, headers=admin)
        assert r.status_code == 422 and r.json()["code"] == "invalid_order"

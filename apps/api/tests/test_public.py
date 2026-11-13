import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models import ProductAvailability
from tests.helpers import (
    make_barber,
    make_business,
    make_product,
    make_resource,
    make_service,
)

pytestmark = pytest.mark.anyio

A = {"Host": "imperio.test"}
B = {"Host": "otro.test"}


async def test_business_devuelve_solo_los_campos_publicos(
    client: AsyncClient, session: Session
) -> None:
    make_business(session, "imperio", "imperio.test")
    r = await client.get("/api/v1/public/business", headers=A)
    assert r.status_code == 200
    assert r.json() == {
        "name": "Negocio imperio",
        "slug": "imperio",
        "timezone": "America/Bogota",
        "tolerance_min": 5,
        "slot_min": 30,
    }


async def test_cada_ruta_publica_devuelve_solo_datos_del_negocio_resuelto(
    client: AsyncClient, session: Session
) -> None:
    a = make_business(session, "imperio", "imperio.test")
    b = make_business(session, "otro", "otro.test")
    make_service(session, a, "Corte de A")
    make_service(session, b, "Corte de B")
    make_barber(session, a, "Barbero de A")
    make_barber(session, b, "Barbero de B")
    make_product(session, a, "Cera de A")
    make_product(session, b, "Cera de B")

    for path, key, own, other in [
        ("services", "name", "Corte de A", "Corte de B"),
        ("barbers", "display_name", "Barbero de A", "Barbero de B"),
        ("products", "name", "Cera de A", "Cera de B"),
    ]:
        in_a = [row[key] for row in (await client.get(f"/api/v1/public/{path}", headers=A)).json()]
        in_b = [row[key] for row in (await client.get(f"/api/v1/public/{path}", headers=B)).json()]
        assert in_a == [own], path
        assert in_b == [other], path

    r = await client.get("/api/v1/public/business", headers=B)
    assert r.json()["slug"] == "otro"


async def test_host_desconocido_usa_el_negocio_por_defecto(
    client: AsyncClient, session: Session
) -> None:
    make_business(session, "imperio", "imperio.test")
    b = make_business(session, "otro", "otro.test")
    make_service(session, b, "Corte de B")
    r = await client.get("/api/v1/public/business", headers={"Host": "desconocido.test"})
    assert r.json()["slug"] == "imperio"
    assert (
        await client.get("/api/v1/public/services", headers={"Host": "desconocido.test"})
    ).json() == []


async def test_host_con_puerto_y_mayusculas_resuelve_el_dominio(
    client: AsyncClient, session: Session
) -> None:
    make_business(session, "imperio")
    make_business(session, "otro", "otro.test")
    r = await client.get("/api/v1/public/business", headers={"Host": "OTRO.test:8000"})
    assert r.json()["slug"] == "otro"


async def test_sin_negocio_responde_404_con_error_estandar(client: AsyncClient) -> None:
    r = await client.get("/api/v1/public/business")
    assert r.status_code == 404
    body = r.json()
    assert body["code"] == "business_not_found"
    assert isinstance(body["message"], str)
    assert body["details"] == {}


async def test_servicio_inactivo_no_aparece_y_el_orden_respeta_sort(
    client: AsyncClient, session: Session
) -> None:
    a = make_business(session)
    vapor = make_resource(session, a)
    make_service(session, a, "Tercero", sort=30)
    make_service(session, a, "Oculto", sort=5, active=False)
    make_service(session, a, "Primero", sort=10)
    make_service(session, a, "Segundo", sort=20, resource=vapor)
    r = await client.get("/api/v1/public/services")
    rows = r.json()
    assert [s["name"] for s in rows] == ["Primero", "Segundo", "Tercero"]
    assert [s["uses_resource"] for s in rows] == [False, True, False]
    assert set(rows[0]) == {
        "id",
        "name",
        "description",
        "price_cop",
        "duration_min",
        "uses_resource",
    }
    assert rows[0]["price_cop"] == 22_000


async def test_barberos_solo_visibles_y_activos(client: AsyncClient, session: Session) -> None:
    a = make_business(session)
    make_barber(session, a, "Visible")
    make_barber(session, a, "Oculto", visible=False)
    make_barber(session, a, "Inactivo", active=False)
    rows = (await client.get("/api/v1/public/barbers")).json()
    assert [b["display_name"] for b in rows] == ["Visible"]
    assert set(rows[0]) == {"id", "display_name"}


async def test_productos_activos_ordenados_con_disponibilidad(
    client: AsyncClient, session: Session
) -> None:
    a = make_business(session)
    make_product(session, a, "B", sort=2, availability=ProductAvailability.out_of_stock)
    make_product(session, a, "A", sort=1)
    make_product(session, a, "Oculto", sort=0, active=False)
    rows = (await client.get("/api/v1/public/products")).json()
    assert [p["name"] for p in rows] == ["A", "B"]
    assert [p["availability"] for p in rows] == ["in_stock", "out_of_stock"]
    assert set(rows[0]) == {"id", "name", "description", "price_cop", "availability", "image_url"}


@pytest.mark.parametrize("path", ["business", "services", "barbers", "products"])
async def test_respuestas_publicas_son_cacheables(
    client: AsyncClient, session: Session, path: str
) -> None:
    make_business(session)
    r = await client.get(f"/api/v1/public/{path}")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=60"


async def test_rutas_publicas_limitadas_a_120_por_minuto_por_ip(
    client: AsyncClient, session: Session
) -> None:
    make_business(session)
    for _ in range(120):
        assert (await client.get("/api/v1/public/business")).status_code == 200
    r = await client.get("/api/v1/public/services")  # el tope es compartido por las rutas públicas
    assert r.status_code == 429
    assert r.json()["code"] == "rate_limited"

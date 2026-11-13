import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from tests.conftest import build_app, make_settings
from tests.helpers import PASSWORD, make_business, make_user

pytestmark = pytest.mark.anyio

LOGIN = "/api/v1/auth/login"
GOOD_ORIGIN = {"Origin": "http://localhost:5173"}


def from_ip(app: FastAPI, ip: str) -> AsyncClient:
    return AsyncClient(
        transport=ASGITransport(app=app, client=(ip, 1)), base_url="http://testserver"
    )


# --- Origin y CORS --------------------------------------------------------------------------


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
async def test_metodos_que_modifican_con_origin_no_permitido_dan_403(
    client: AsyncClient, session: Session, method: str
) -> None:
    make_business(session)
    r = await client.request(
        method,
        LOGIN,
        json={"email": "a@b.co", "password": "x"},
        headers={"Origin": "https://evil.example"},
    )
    assert r.status_code == 403
    assert r.json()["code"] == "origin_not_allowed"


async def test_origin_null_y_prefijo_parecido_tambien_se_rechazan(
    client: AsyncClient, session: Session
) -> None:
    make_business(session)
    for origin in ("null", "http://localhost:5173.evil.example", "https://localhost:5173"):
        r = await client.post(
            LOGIN, json={"email": "a@b.co", "password": "x"}, headers={"Origin": origin}
        )
        assert r.status_code == 403, origin


async def test_origin_permitido_o_ausente_pasa_y_los_get_no_se_verifican(
    client: AsyncClient, session: Session
) -> None:
    make_business(session)
    body = {"email": "a@b.co", "password": "x"}
    assert (await client.post(LOGIN, json=body, headers=GOOD_ORIGIN)).status_code == 401
    assert (await client.post(LOGIN, json=body)).status_code == 401  # curl: sin Origin
    r = await client.get("/api/v1/public/business", headers={"Origin": "https://evil.example"})
    assert r.status_code == 200


async def test_cors_con_credenciales_solo_para_los_origenes_permitidos(
    client: AsyncClient,
) -> None:
    ok = await client.options(
        LOGIN, headers={**GOOD_ORIGIN, "Access-Control-Request-Method": "POST"}
    )
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert ok.headers["access-control-allow-credentials"] == "true"
    mal = await client.options(
        LOGIN,
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in mal.headers


# --- Cabeceras de seguridad -----------------------------------------------------------------


async def test_cabeceras_de_seguridad_sin_hsts_fuera_de_produccion(
    client: AsyncClient, session: Session
) -> None:
    make_business(session)
    r = await client.get("/api/v1/public/business")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert "strict-transport-security" not in r.headers
    # También en errores generados por middleware.
    bad = await client.post(LOGIN, json={}, headers={"Origin": "https://evil.example"})
    assert bad.headers["x-content-type-options"] == "nosniff"


async def test_hsts_en_produccion(engine: Engine, session: Session) -> None:
    make_business(session)
    app = build_app(engine, make_settings(environment="production"))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as c:
        r = await c.get("/api/v1/public/business")
    assert "max-age=" in r.headers["strict-transport-security"]


# --- Límite de intentos de login ------------------------------------------------------------


async def test_el_sexto_intento_de_login_en_un_minuto_da_429(
    client: AsyncClient, session: Session
) -> None:
    make_user(session, make_business(session), email="a@imperio.test")
    for i in range(5):
        r = await client.post(LOGIN, json={"email": "a@imperio.test", "password": f"mala-{i}"})
        assert r.status_code == 401
    sexto = await client.post(LOGIN, json={"email": "a@imperio.test", "password": PASSWORD})
    assert sexto.status_code == 429
    assert sexto.json()["code"] == "rate_limited"
    assert sexto.headers["retry-after"] == "60"
    assert "set-cookie" not in sexto.headers


async def test_limite_por_ip_aunque_cambie_el_correo(client: AsyncClient, session: Session) -> None:
    make_business(session)
    for i in range(5):
        await client.post(LOGIN, json={"email": f"u{i}@imperio.test", "password": "x"})
    r = await client.post(LOGIN, json={"email": "nuevo@imperio.test", "password": "x"})
    assert r.status_code == 429


async def test_limite_por_correo_aunque_cambie_la_ip(app: FastAPI, session: Session) -> None:
    make_user(session, make_business(session), email="a@imperio.test")
    for n in range(5):
        async with from_ip(app, f"10.1.0.{n}") as c:
            r = await c.post(LOGIN, json={"email": "a@imperio.test", "password": "mala"})
            assert r.status_code == 401
    async with from_ip(app, "10.1.0.99") as c:
        r = await c.post(LOGIN, json={"email": "A@imperio.test", "password": PASSWORD})
    assert r.status_code == 429


# --- Formato de error único -----------------------------------------------------------------


async def test_ruta_inexistente_y_metodo_no_permitido_usan_el_formato_estandar(
    client: AsyncClient,
) -> None:
    r = await client.get("/api/v1/nada")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message", "details"}
    assert r.json()["code"] == "not_found"
    m = await client.post("/api/v1/public/business")
    assert m.status_code == 405
    assert m.json()["code"] == "method_not_allowed"


async def test_validacion_422_no_devuelve_los_valores_enviados(
    client: AsyncClient, session: Session
) -> None:
    make_business(session)
    r = await client.post(LOGIN, json={"email": 123, "password": "hunter2-secreta"})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "validation_error"
    assert body["details"]["fields"][0]["loc"] == ["body", "email"]
    assert "hunter2-secreta" not in r.text


async def test_error_no_controlado_da_500_sin_detalles_internos(
    app: FastAPI, session: Session
) -> None:
    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("detalle-interno-secreto")

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        r = await c.get("/boom")
    assert r.status_code == 500
    assert r.json()["code"] == "internal_error"
    assert "detalle-interno-secreto" not in r.text
    assert "Traceback" not in r.text

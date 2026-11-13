from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import create_access_token
from app.models import RefreshToken, User, UserRole
from tests.conftest import build_app, make_settings
from tests.helpers import PASSWORD, make_business, make_user

pytestmark = pytest.mark.anyio

API = "/api/v1"


async def login(
    client: AsyncClient, email: str, password: str = PASSWORD, host: str | None = None
) -> Response:
    headers = {"Host": host} if host else None
    return await client.post(
        f"{API}/auth/login", json={"email": email, "password": password}, headers=headers
    )


def put_cookie(client: AsyncClient, name: str, value: str) -> None:
    """Reemplaza la cookie (httpx la guarda bajo ``testserver.local``; evita duplicados)."""
    client.cookies.delete(name)
    client.cookies.set(name, value, domain="testserver.local", path="/api/v1")


def cookie_header(r: Response, name: str) -> str:
    return next(h for h in r.headers.get_list("set-cookie") if h.startswith(f"{name}="))


async def test_login_correcto_fija_las_dos_cookies_httponly_lax(
    client: AsyncClient, session: Session
) -> None:
    u = make_user(session, make_business(session), UserRole.admin, "ana@imperio.test")
    r = await login(client, "  ANA@imperio.test ")
    assert r.status_code == 200
    assert r.json() == {"id": str(u.id), "name": u.name, "role": "admin"}
    assert "password" not in r.text
    access, refresh = cookie_header(r, "access_token"), cookie_header(r, "refresh_token")
    for c in (access, refresh):
        assert "HttpOnly" in c
        assert "SameSite=lax" in c
        assert "Path=/api/v1" in c
    assert "Max-Age=900" in access
    assert "Max-Age=2592000" in refresh
    assert r.headers["cache-control"] == "no-store"


async def test_cookies_llevan_secure_cuando_esta_activado(engine: Engine, session: Session) -> None:
    make_user(session, make_business(session), UserRole.admin, "ana@imperio.test")
    app = build_app(engine, make_settings(cookie_secure=True))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="https://testserver") as c:
        r = await login(c, "ana@imperio.test")
    assert "Secure" in cookie_header(r, "access_token")
    assert "Secure" in cookie_header(r, "refresh_token")


async def test_login_erroneo_da_401_con_el_mismo_mensaje(
    client: AsyncClient, session: Session
) -> None:
    make_user(session, make_business(session), UserRole.admin, "ana@imperio.test")
    mala = await login(client, "ana@imperio.test", "otra-clave")
    inexistente = await login(client, "nadie@imperio.test")
    assert mala.status_code == inexistente.status_code == 401
    assert mala.json() == inexistente.json()
    assert mala.json()["code"] == "invalid_credentials"
    assert "set-cookie" not in mala.headers


async def test_login_de_usuario_inactivo_se_ve_igual_que_credenciales_malas(
    client: AsyncClient, session: Session
) -> None:
    make_user(session, make_business(session), email="off@imperio.test", active=False)
    r = await login(client, "off@imperio.test")
    assert r.status_code == 401
    assert r.json()["code"] == "invalid_credentials"


async def test_login_no_entra_con_credenciales_de_otro_negocio(
    client: AsyncClient, session: Session
) -> None:
    make_business(session, "imperio", "imperio.test")
    b = make_business(session, "otro", "otro.test")
    make_user(session, b, email="b@otro.test")
    assert (await login(client, "b@otro.test", host="imperio.test")).status_code == 401
    assert (await login(client, "b@otro.test", host="otro.test")).status_code == 200


async def test_me_devuelve_el_usuario_o_401_sin_sesion(
    client: AsyncClient, session: Session
) -> None:
    u = make_user(session, make_business(session), UserRole.barber, "bar@imperio.test")
    anon = await client.get(f"{API}/auth/me")
    assert anon.status_code == 401
    assert anon.json()["code"] == "not_authenticated"
    await login(client, "bar@imperio.test")
    r = await client.get(f"{API}/auth/me")
    assert r.json() == {"id": str(u.id), "name": u.name, "role": "barber"}


async def test_permisos_por_rol(client: AsyncClient, session: Session) -> None:
    b = make_business(session)
    make_user(session, b, UserRole.barber, "bar@imperio.test")
    make_user(session, b, UserRole.admin, "adm@imperio.test")

    sin_sesion = await client.get(f"{API}/admin/ping")
    assert sin_sesion.status_code == 401
    assert (await client.get(f"{API}/me/ping")).status_code == 401

    await login(client, "bar@imperio.test")
    assert (await client.get(f"{API}/me/ping")).status_code == 200
    r = await client.get(f"{API}/admin/ping")
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"

    await login(client, "adm@imperio.test")
    ok = await client.get(f"{API}/admin/ping")
    assert ok.status_code == 200
    assert ok.json()["business_id"] == str(b.id)
    # El admin no hereda permisos de barbero.
    assert (await client.get(f"{API}/me/ping")).status_code == 403


async def test_jwt_de_un_negocio_no_da_acceso_en_el_host_de_otro(
    client: AsyncClient, session: Session
) -> None:
    a = make_business(session, "imperio", "imperio.test")
    make_business(session, "otro", "otro.test")
    make_user(session, a, UserRole.admin, "adm@imperio.test")
    await login(client, "adm@imperio.test", host="imperio.test")

    ok = await client.get(f"{API}/admin/ping", headers={"Host": "imperio.test"})
    assert ok.status_code == 200
    for path in ("admin/ping", "auth/me"):
        r = await client.get(f"{API}/{path}", headers={"Host": "otro.test"})
        assert r.status_code == 401, path
        assert r.json()["code"] == "invalid_token"
        assert str(a.id) not in r.text


async def test_el_negocio_sale_del_token_aunque_el_usuario_cambie_de_negocio_en_la_base(
    client: AsyncClient, session: Session
) -> None:
    """Un token con business_id ajeno al del usuario (o manipulado) no autentica."""
    a = make_business(session, "imperio", "imperio.test")
    b = make_business(session, "otro", "otro.test")
    u = make_user(session, a, UserRole.admin)
    forged = jwt.encode(
        {
            "sub": str(u.id),
            "role": "admin",
            "business_id": str(b.id),
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        make_settings().jwt_secret,
        algorithm="HS256",
    )
    put_cookie(client, "access_token", forged)
    r = await client.get(f"{API}/admin/ping", headers={"Host": "otro.test"})
    assert r.status_code == 401  # el usuario no pertenece al negocio B


async def test_token_firmado_con_otro_secreto_o_sin_firma_es_invalido(
    client: AsyncClient, session: Session
) -> None:
    u = make_user(session, make_business(session), UserRole.admin)
    claims = {
        "sub": str(u.id),
        "role": "admin",
        "business_id": str(u.business_id),
        "exp": datetime.now(UTC) + timedelta(minutes=5),
    }
    for token in (
        jwt.encode(claims, "otro-secreto-" + "y" * 32, algorithm="HS256"),
        jwt.encode(claims, "", algorithm="none"),
        "basura",
    ):
        put_cookie(client, "access_token", token)
        r = await client.get(f"{API}/auth/me")
        assert r.status_code == 401
        assert r.json()["code"] == "invalid_token"


async def test_access_vencido_da_token_expired_y_refresh_lo_renueva(
    client: AsyncClient, session: Session, test_settings: Settings
) -> None:
    u = make_user(session, make_business(session), UserRole.barber, "bar@imperio.test")
    await login(client, "bar@imperio.test")
    vencido = create_access_token(u, test_settings, now=datetime.now(UTC) - timedelta(hours=1))
    put_cookie(client, "access_token", vencido)

    r = await client.get(f"{API}/auth/me")
    assert r.status_code == 401
    assert r.json()["code"] == "token_expired"

    renovado = await client.post(f"{API}/auth/refresh")
    assert renovado.status_code == 200
    assert renovado.json()["id"] == str(u.id)
    assert "access_token=" in renovado.headers["set-cookie"]
    assert (await client.get(f"{API}/auth/me")).status_code == 200


async def test_refresh_rota_el_token_y_encadena_la_familia(
    client: AsyncClient, session: Session
) -> None:
    make_user(session, make_business(session), email="bar@imperio.test")
    primero = await login(client, "bar@imperio.test")
    r1 = cookie_header(primero, "refresh_token").split(";")[0]
    segundo = await client.post(f"{API}/auth/refresh")
    r2 = cookie_header(segundo, "refresh_token").split(";")[0]
    assert r1 != r2

    session.expire_all()
    filas = session.scalars(select(RefreshToken).order_by(RefreshToken.created_at)).all()
    assert len(filas) == 2
    assert filas[0].family_id == filas[1].family_id
    assert filas[0].revoked_at is not None
    assert filas[0].replaced_by == filas[1].id
    assert filas[1].revoked_at is None
    # Solo se guarda el hash, nunca el valor de la cookie.
    assert r1.split("=", 1)[1] not in {f.token_hash for f in filas}


async def test_reutilizar_un_refresh_rotado_da_401_y_revoca_la_familia(
    client: AsyncClient, session: Session
) -> None:
    make_user(session, make_business(session), email="bar@imperio.test")
    primero = await login(client, "bar@imperio.test")
    viejo = cookie_header(primero, "refresh_token").split(";")[0].split("=", 1)[1]
    rotado = await client.post(f"{API}/auth/refresh")  # `viejo` queda inválido
    assert rotado.status_code == 200

    put_cookie(client, "refresh_token", viejo)
    r = await client.post(f"{API}/auth/refresh")
    assert r.status_code == 401
    assert r.json()["code"] == "invalid_refresh_token"
    assert any("Max-Age=0" in h for h in r.headers.get_list("set-cookie"))  # cookies borradas

    session.expire_all()
    filas = session.scalars(select(RefreshToken)).all()
    assert len(filas) == 2
    assert all(f.revoked_at is not None for f in filas)


async def test_reutilizacion_no_toca_otras_sesiones_del_mismo_usuario(
    client: AsyncClient, session: Session, app: FastAPI
) -> None:
    make_user(session, make_business(session), email="bar@imperio.test")
    primero = await login(client, "bar@imperio.test")
    viejo = cookie_header(primero, "refresh_token").split(";")[0].split("=", 1)[1]
    await client.post(f"{API}/auth/refresh")
    async with AsyncClient(
        transport=ASGITransport(app=app, client=("10.0.0.2", 1)), base_url="http://testserver"
    ) as otro:
        await login(otro, "bar@imperio.test")  # segunda sesión (otra familia)
        put_cookie(client, "refresh_token", viejo)
        await client.post(f"{API}/auth/refresh")
        assert (await otro.post(f"{API}/auth/refresh")).status_code == 200


async def test_refresh_sin_cookie_o_vencido_da_401(client: AsyncClient, session: Session) -> None:
    make_user(session, make_business(session), email="bar@imperio.test")
    sin = await client.post(f"{API}/auth/refresh")
    assert sin.status_code == 401
    assert sin.json()["code"] == "invalid_refresh_token"

    await login(client, "bar@imperio.test")
    fila = session.scalars(select(RefreshToken)).one()
    fila.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    session.commit()
    assert (await client.post(f"{API}/auth/refresh")).status_code == 401


async def test_refresh_de_usuario_desactivado_da_401(client: AsyncClient, session: Session) -> None:
    u = make_user(session, make_business(session), email="bar@imperio.test")
    await login(client, "bar@imperio.test")
    u_db = session.get(User, u.id)
    assert u_db is not None
    u_db.active = False
    session.commit()
    assert (await client.post(f"{API}/auth/refresh")).status_code == 401
    assert (await client.get(f"{API}/auth/me")).status_code == 401


async def test_logout_invalida_el_refresh_y_borra_las_cookies(
    client: AsyncClient, session: Session
) -> None:
    make_user(session, make_business(session), email="bar@imperio.test")
    primero = await login(client, "bar@imperio.test")
    refresh = cookie_header(primero, "refresh_token").split(";")[0].split("=", 1)[1]

    r = await client.post(f"{API}/auth/logout")
    assert r.status_code == 204
    borradas = r.headers.get_list("set-cookie")
    assert len(borradas) == 2 and all("Max-Age=0" in h for h in borradas)
    assert (await client.get(f"{API}/auth/me")).status_code == 401

    session.expire_all()
    assert session.scalars(select(RefreshToken)).one().revoked_at is not None
    put_cookie(client, "refresh_token", refresh)
    assert (await client.post(f"{API}/auth/refresh")).status_code == 401


async def test_logout_sin_sesion_es_idempotente(client: AsyncClient, session: Session) -> None:
    make_business(session)
    assert (await client.post(f"{API}/auth/logout")).status_code == 204


async def test_no_hay_business_cruzado_en_refresh(client: AsyncClient, session: Session) -> None:
    a = make_business(session, "imperio", "imperio.test")
    make_business(session, "otro", "otro.test")
    make_user(session, a, email="a@imperio.test")
    await login(client, "a@imperio.test", host="imperio.test")
    r = await client.post(f"{API}/auth/refresh", headers={"Host": "otro.test"})
    assert r.status_code == 401

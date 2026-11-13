"""Control de acceso de TODAS las rutas /admin: 401 sin sesión, 403 para barbero.

La lista sale de la tabla de rutas de la app: una ruta /admin nueva queda cubierta sola.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models import User
from tests.api.conftest import Env
from tests.conftest import make_settings

pytestmark = pytest.mark.anyio

ADMIN_PREFIX = "/api/v1/admin"


def admin_routes() -> list[tuple[str, str]]:
    """Todas las operaciones /admin, leídas del OpenAPI de la app (la tabla de rutas real)."""
    from app.main import create_app

    schema = create_app(make_settings()).openapi()
    http = {"get", "post", "put", "patch", "delete"}
    return sorted(
        (method.upper(), path)
        for path, ops in schema["paths"].items()
        if path.startswith(ADMIN_PREFIX)
        for method in ops
        if method in http
    )


ROUTES = admin_routes()


def concrete(path: str) -> str:
    return _fill(path)


def _fill(path: str) -> str:
    out = []
    for part in path.split("/"):
        out.append(str(uuid.uuid4()) if part.startswith("{") else part)
    return "/".join(out)


def test_la_tabla_de_rutas_admin_no_esta_vacia() -> None:
    assert len(ROUTES) >= 5


@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_sin_sesion_da_401(client: AsyncClient, env: Env, method: str, path: str) -> None:
    r = await client.request(method, concrete(path), headers={"Host": "imperio.test"}, json={})
    assert r.status_code == 401, (method, path)


@pytest.mark.parametrize(("method", "path"), ROUTES)
async def test_barbero_da_403(
    client: AsyncClient, session: Session, env: Env, method: str, path: str
) -> None:
    user = session.get(User, env.ana.user_id)
    assert user is not None
    token = create_access_token(user, make_settings())
    headers = {"Host": "imperio.test", "Cookie": f"access_token={token}"}
    r = await client.request(method, concrete(path), headers=headers, json={})
    assert r.status_code == 403, (method, path)

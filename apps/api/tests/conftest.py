import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path

# Antes de importar la app: JWT_SECRET exige 32+ caracteres y el CI no tiene .env.
os.environ["JWT_SECRET"] = "secreto-solo-para-pruebas-" + "x" * 16

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings
from app.core.db import driver_url, get_session
from app.core.ratelimit import limiter
from app.main import create_app

API_DIR = Path(__file__).resolve().parent.parent
TEST_DB = "imperio_test"
MIGRATION_DB = "imperio_test_migraciones"


def _url_for(database: str) -> str:
    return (
        make_url(driver_url(get_settings().database_url))
        .set(database=database)
        .render_as_string(hide_password=False)
    )


def _recreate_database(name: str) -> None:
    admin = create_engine(_url_for("postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
        conn.execute(text(f'CREATE DATABASE "{name}"'))
    admin.dispose()


def _drop_database(name: str) -> None:
    admin = create_engine(_url_for("postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    admin.dispose()


def alembic_config(url: str) -> Config:
    cfg = Config(str(API_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_DIR / "migrations"))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """Base de pruebas real (PostgreSQL), creada y migrada con Alembic; nunca create_all()."""
    _recreate_database(TEST_DB)
    url = _url_for(TEST_DB)
    command.upgrade(alembic_config(url), "head")
    eng = create_engine(url)
    yield eng
    eng.dispose()
    _drop_database(TEST_DB)


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    with sessionmaker(bind=engine, expire_on_commit=False)() as s:
        yield s
    # Limpieza entre pruebas: las pruebas confirman de verdad para ejercer las restricciones.
    with engine.begin() as conn:
        conn.execute(
            text(
                'TRUNCATE appointment, barber_time_off, barber_schedule, barber, "user", '
                "client, service, resource, product, refresh_token, business CASCADE"
            )
        )


@pytest.fixture
def migration_db_url() -> Iterator[str]:
    _recreate_database(MIGRATION_DB)
    yield _url_for(MIGRATION_DB)
    _drop_database(MIGRATION_DB)


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_rate_limits() -> None:
    limiter.reset()


def make_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "jwt_secret": os.environ["JWT_SECRET"],
        "environment": "test",
        "cookie_secure": False,  # los clientes de prueba hablan http
        "allowed_origins": "http://localhost:5173",
    }
    return Settings(**{**values, **overrides})  # type: ignore[arg-type]


@pytest.fixture
def test_settings() -> Settings:
    return make_settings()


def build_app(engine: Engine, settings: Settings) -> FastAPI:
    app = create_app(settings)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_session() -> Iterator[Session]:
        with factory() as s:
            yield s

    app.dependency_overrides[get_session] = override_session
    return app


@pytest.fixture
def app(engine: Engine, session: Session, test_settings: Settings) -> FastAPI:
    # Depende de ``session`` para que la limpieza de tablas corra después de cada prueba.
    return build_app(engine, test_settings)


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app, client=("10.0.0.1", 50000))
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c

import pytest
from pydantic import ValidationError

from app.core.config import load_settings

SECRET = "s" * 32


def test_settings_lee_variables_de_entorno(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://x:y@db:5432/z")
    monkeypatch.setenv("JWT_SECRET", SECRET)
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://a.test, http://b.test/")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    s = load_settings()
    assert s.database_url == "postgresql://x:y@db:5432/z"
    assert s.jwt_secret == SECRET
    assert s.allowed_origins_list == ["http://a.test", "http://b.test"]
    assert s.cookie_secure is False
    assert s.default_business_slug == "imperio"


def test_jwt_secret_corto_impide_arrancar(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("JWT_SECRET", "x" * 31)
    with pytest.raises(ValidationError):
        load_settings()


def test_jwt_secret_ausente_impide_arrancar(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.chdir("/")  # sin ../../.env ni .env cerca
    with pytest.raises(ValidationError):
        load_settings()


def test_rate_limit_activo_por_defecto_y_forzado_en_produccion(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.core.ratelimit import limiter
    from app.main import create_app

    monkeypatch.setenv("JWT_SECRET", SECRET)
    assert load_settings().rate_limit_enabled is True

    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    try:
        create_app(load_settings())
        assert limiter.enabled is False  # E2E: se puede apagar fuera de producción
        monkeypatch.setenv("ENVIRONMENT", "production")
        create_app(load_settings())
        assert limiter.enabled is True  # en producción se ignora
    finally:
        limiter.enabled = True

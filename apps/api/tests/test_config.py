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

import pytest

from app.core.config import Settings


def test_settings_lee_variables_de_entorno(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://x:y@db:5432/z")
    monkeypatch.setenv("JWT_SECRET", "secreto")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://a.test, http://b.test")
    s = Settings()
    assert s.database_url == "postgresql://x:y@db:5432/z"
    assert s.jwt_secret == "secreto"
    assert s.allowed_origins_list == ["http://a.test", "http://b.test"]

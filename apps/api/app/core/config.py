from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+psycopg://imperio:imperio@localhost:5432/imperio"
    # Sin valor por defecto a propósito: si falta o mide menos de 32 caracteres la app no arranca.
    jwt_secret: str = Field(min_length=32)
    allowed_origins: str = "http://localhost:5173"
    environment: Literal["development", "test", "production"] = "development"
    # Secure en las cookies; solo se apaga (COOKIE_SECURE=false) para desarrollo local sin HTTPS.
    cookie_secure: bool = True
    default_business_slug: str = "imperio"
    # Solo para las pruebas E2E (RATE_LIMIT_ENABLED=false): varias pruebas comparten una IP. En
    # producción se ignora y el límite siempre queda activo.
    rate_limit_enabled: bool = True
    access_token_minutes: int = Field(default=15, gt=0)
    refresh_token_days: int = Field(default=30, gt=0)

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def load_settings() -> Settings:
    """Lee el entorno. ``jwt_secret`` no se pasa como argumento: sale de JWT_SECRET."""
    return Settings()  # type: ignore[call-arg]


@lru_cache
def get_settings() -> Settings:
    return load_settings()

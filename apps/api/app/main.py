from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.middleware import register_middleware
from app.core.ratelimit import limiter
from app.routers import admin, auth, booking, me, public

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Imperio Barber API")
    app.state.settings = settings
    app.state.limiter = limiter
    register_error_handlers(app)
    register_middleware(app, settings)
    # Último en añadirse = más externo: CORS responde antes (preflight) y envuelve todo lo demás.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in (public.router, booking.router, auth.router, me.router, admin.router):
        app.include_router(router, prefix=API_PREFIX)
    return app


app = create_app()

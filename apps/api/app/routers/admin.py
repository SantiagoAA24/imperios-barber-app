from fastapi import APIRouter

from app.core.security import AdminUser
from app.schemas.auth import PingOut
from app.schemas.errors import ErrorBody

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={401: {"model": ErrorBody}, 403: {"model": ErrorBody}},
)


@router.get("/ping", response_model=PingOut)
def ping(user: AdminUser) -> PingOut:
    """Ruta de apoyo para probar permisos; se reemplaza en fases siguientes."""
    return PingOut(status="ok", role=user.role, business_id=user.business_id)

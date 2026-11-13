from collections.abc import Sequence

from fastapi import APIRouter, Depends, Request, Response

from app.core.db import DbSession
from app.core.ratelimit import PUBLIC_LIMIT, limiter
from app.core.tenant import CurrentBusiness
from app.models import Barber, Business, Product
from app.schemas.errors import ErrorBody
from app.schemas.public import PublicBarber, PublicBusiness, PublicProduct, PublicService
from app.services import catalog


def cacheable(response: Response) -> None:
    response.headers["Cache-Control"] = "public, max-age=60"
    response.headers["Vary"] = "Host"


router = APIRouter(
    prefix="/public",
    tags=["público"],
    dependencies=[Depends(cacheable)],
    responses={404: {"model": ErrorBody}, 429: {"model": ErrorBody}},
)

public_limit = limiter.shared_limit(PUBLIC_LIMIT, scope="public")


@router.get("/business", response_model=PublicBusiness)
@public_limit
def business_info(request: Request, business: CurrentBusiness) -> Business:
    return business


@router.get("/services", response_model=list[PublicService])
@public_limit
def services(
    request: Request,
    business: CurrentBusiness,
    session: DbSession,
) -> list[PublicService]:
    return catalog.list_services(session, business.id)


@router.get("/barbers", response_model=list[PublicBarber])
@public_limit
def barbers(
    request: Request,
    business: CurrentBusiness,
    session: DbSession,
) -> Sequence[Barber]:
    return catalog.list_barbers(session, business.id)


@router.get("/products", response_model=list[PublicProduct])
@public_limit
def products(
    request: Request,
    business: CurrentBusiness,
    session: DbSession,
) -> Sequence[Product]:
    return catalog.list_products(session, business.id)

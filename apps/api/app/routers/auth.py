from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse

from app.core.config import Settings
from app.core.db import DbSession
from app.core.errors import ApiError, error_response
from app.core.ratelimit import LOGIN_LIMIT, hit_login_email, limiter
from app.core.security import ACCESS_COOKIE, REFRESH_COOKIE, CurrentUser, SettingsDep
from app.core.tenant import CurrentBusiness
from app.models import User
from app.schemas.auth import LoginRequest, UserOut
from app.schemas.errors import ErrorBody
from app.services import auth as auth_service

COOKIE_PATH = "/api/v1"


def no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(
    prefix="/auth",
    tags=["sesión"],
    dependencies=[Depends(no_store)],
    responses={401: {"model": ErrorBody}, 429: {"model": ErrorBody}},
)


def _set_cookie(
    response: Response, settings: Settings, name: str, value: str, max_age: int
) -> None:
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )


def _set_session_cookies(
    response: Response, settings: Settings, issued: auth_service.IssuedSession
) -> None:
    _set_cookie(
        response, settings, ACCESS_COOKIE, issued.access_token, settings.access_token_minutes * 60
    )
    _set_cookie(
        response,
        settings,
        REFRESH_COOKIE,
        issued.refresh_token,
        settings.refresh_token_days * 86400,
    )


def _clear_session_cookies(response: Response, settings: Settings) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(
            name, path=COOKIE_PATH, httponly=True, secure=settings.cookie_secure, samesite="lax"
        )


@router.post("/login", response_model=UserOut)
@limiter.limit(LOGIN_LIMIT)
def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    business: CurrentBusiness,
    session: DbSession,
    settings: SettingsDep,
) -> User:
    hit_login_email(body.email.strip().lower())
    issued = auth_service.login(session, business, settings, body.email, body.password)
    _set_session_cookies(response, settings, issued)
    return issued.user


@router.post("/refresh", response_model=UserOut)
def refresh(
    request: Request,
    response: Response,
    business: CurrentBusiness,
    session: DbSession,
    settings: SettingsDep,
) -> User | JSONResponse:
    try:
        issued = auth_service.refresh(
            session, business, settings, request.cookies.get(REFRESH_COOKIE)
        )
    except ApiError as exc:
        # Un refresh inválido, vencido o reutilizado deja al navegador sin cookies. Las cookies
        # de ``response`` no viajan en una excepción, así que se arma la respuesta de error aquí.
        failed = error_response(exc.status_code, exc.code, exc.message, exc.details)
        _clear_session_cookies(failed, settings)
        return failed
    _set_session_cookies(response, settings, issued)
    return issued.user


@router.post("/logout", status_code=204)
def logout(
    request: Request,
    response: Response,
    session: DbSession,
    settings: SettingsDep,
) -> None:
    auth_service.logout(session, request.cookies.get(REFRESH_COOKIE))
    _clear_session_cookies(response, settings)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user

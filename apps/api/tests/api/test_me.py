"""Panel del barbero (/me): aislamiento, estados, next-free, citas manuales, horario y ausencias.

Escenario de ``conftest``: lunes 16-nov-2026, "ahora" = 8:00 am en Bogotá; Ana y Beto trabajan
9-13 y 14-18. El reloj se mueve con ``clock.now``.
"""

import asyncio
import itertools
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.models import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
    Barber,
    BarberSchedule,
    BarberTimeOff,
    Client,
    Service,
    User,
    UserRole,
)
from app.services.booking import hash_token
from tests.api.conftest import DAY, HOST, Clock, Env, at, client_from
from tests.conftest import make_settings
from tests.helpers import make_barber, make_business, make_service, make_user

pytestmark = pytest.mark.anyio

ME = "/api/v1/me"
_phones = itertools.count(3_000_000_000)


def auth(session: Session, barber: Barber) -> dict[str, str]:
    user = session.get(User, barber.user_id)
    assert user is not None
    token = create_access_token(user, make_settings())
    return {**HOST, "Cookie": f"access_token={token}"}


def add_appt(
    session: Session,
    env: Env,
    barber: Barber,
    hhmm: str,
    *,
    service: Service | None = None,
    status: AppointmentStatus = AppointmentStatus.booked,
    phone: str | None = None,
    name: str = "Cliente Uno",
    day: str = DAY,
    source: AppointmentSource = AppointmentSource.online,
) -> Appointment:
    service = service or env.basico
    client = Client(
        business_id=env.business.id,
        name=name,
        phone_e164=phone if phone is not None else f"+57{next(_phones)}",
    )
    session.add(client)
    session.flush()
    start = at(hhmm, day).astimezone(UTC)
    appt = Appointment(
        business_id=env.business.id,
        barber_id=barber.id,
        client_id=client.id,
        service_id=service.id,
        resource_id=service.resource_id,
        starts_at=start,
        ends_at=start + timedelta(minutes=service.duration_min),
        status=status,
        source=source,
        price_cop=service.price_cop,
        duration_min=service.duration_min,
        manage_token_hash=hash_token(f"t-{next(_phones)}"),
    )
    session.add(appt)
    session.commit()
    return appt


def set_now(clock: Clock, hhmm: str, seconds: int = 0, day: str = DAY) -> None:
    clock.now = at(hhmm, day).astimezone(UTC) + timedelta(seconds=seconds)


async def patch(
    client: AsyncClient, headers: dict[str, str], appt: Appointment, status: str
) -> Response:
    return await client.patch(
        f"{ME}/appointments/{appt.id}", json={"status": status}, headers=headers
    )


def error_code(r: Response) -> str:
    return str(r.json()["code"])


# --- acceso y aislamiento ---------------------------------------------------------------------


async def test_rutas_exigen_sesion_de_barbero(
    client: AsyncClient, env: Env, session: Session
) -> None:
    admin = make_user(session, env.business, UserRole.admin)
    token = create_access_token(admin, make_settings())
    routes = [
        ("get", f"/appointments?date={DAY}"),
        ("get", f"/next-free?service_id={env.basico.id}"),
        ("get", "/schedule"),
        ("get", "/time-off"),
    ]
    for method, path in routes:
        r = await getattr(client, method)(f"{ME}{path}", headers=HOST)
        assert r.status_code == 401, path
        r = await getattr(client, method)(
            f"{ME}{path}", headers={**HOST, "Cookie": f"access_token={token}"}
        )
        assert r.status_code == 403 and error_code(r) == "forbidden", path


async def test_barbero_no_ve_citas_de_otro_barbero(
    client: AsyncClient, env: Env, session: Session
) -> None:
    mia = add_appt(session, env, env.ana, "10:00", name="De Ana")
    ajena = add_appt(session, env, env.beto, "10:00", name="De Beto")
    r = await client.get(f"{ME}/appointments", params={"date": DAY}, headers=auth(session, env.ana))
    ids = [a["id"] for a in r.json()["appointments"]]
    assert ids == [str(mia.id)]
    assert str(ajena.id) not in r.text and "De Beto" not in r.text


async def test_barbero_no_modifica_citas_de_otro_barbero(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    ajena = add_appt(session, env, env.beto, "10:00")
    set_now(clock, "10:30")
    for status in ("attended", "no_show", "cancelled"):
        r = await patch(client, auth(session, env.ana), ajena, status)
        assert r.status_code == 404 and error_code(r) == "appointment_not_found"
    session.expire_all()
    assert session.get(Appointment, ajena.id).status == AppointmentStatus.booked  # type: ignore[union-attr]


async def test_aislamiento_entre_negocios(
    client: AsyncClient, env: Env, session: Session, app: FastAPI
) -> None:
    otro = make_business(session, "otro", "otro.test")
    zoe = make_barber(session, otro, "Zoe")
    servicio = make_service(session, otro, "Corte otro")
    cliente = Client(business_id=otro.id, name="Cliente Otro", phone_e164="+573009998877")
    session.add(cliente)
    session.flush()
    start = at("10:00").astimezone(UTC)
    ajena = Appointment(
        business_id=otro.id,
        barber_id=zoe.id,
        client_id=cliente.id,
        service_id=servicio.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=30),
        source=AppointmentSource.online,
        price_cop=1,
        duration_min=30,
        manage_token_hash="x",
    )
    session.add(ajena)
    session.commit()
    ana = auth(session, env.ana)
    # El token de Ana no sirve en el sitio del otro negocio.
    r = await client.get(f"{ME}/appointments", headers={**ana, "Host": "otro.test"})
    assert r.status_code == 401
    # Y su agenda en su propio sitio no incluye nada del otro negocio.
    r = await client.get(f"{ME}/appointments", params={"date": DAY}, headers=ana)
    assert r.json()["appointments"] == []
    r = await client.patch(
        f"{ME}/appointments/{ajena.id}", json={"status": "attended"}, headers=ana
    )
    assert r.status_code == 404
    # Un servicio de otro negocio tampoco se puede usar.
    r = await client.post(
        f"{ME}/appointments",
        json={"service_id": str(servicio.id), "walk_in": True, "client": {"name": "Pepe"}},
        headers=ana,
    )
    assert r.status_code == 404 and error_code(r) == "service_not_found"


# --- agenda del día ---------------------------------------------------------------------------


async def test_agenda_ordenada_con_resumen_y_sin_canceladas(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.ana, "11:00", name="Tercero", status=AppointmentStatus.attended)
    add_appt(session, env, env.ana, "09:00", name="Primero", status=AppointmentStatus.no_show)
    add_appt(session, env, env.ana, "10:00", name="Segundo")
    add_appt(session, env, env.ana, "12:00", name="Cancelado", status=AppointmentStatus.cancelled)
    add_appt(session, env, env.ana, "09:00", name="Otro día", day="2026-11-17")
    set_now(clock, "09:30")
    h = auth(session, env.ana)
    r = await client.get(f"{ME}/appointments", params={"date": DAY}, headers=h)
    body = r.json()
    assert [a["client"]["name"] for a in body["appointments"]] == ["Primero", "Segundo", "Tercero"]
    assert body["summary"] == {
        "total": 3,
        "attended": 1,
        "pending": 1,
        "no_show": 1,
        "revenue_cop": 22_000,
    }
    r = await client.get(
        f"{ME}/appointments", params={"date": DAY, "include_cancelled": "true"}, headers=h
    )
    names = [a["client"]["name"] for a in r.json()["appointments"]]
    assert names == ["Primero", "Segundo", "Tercero", "Cancelado"]
    assert r.json()["summary"]["total"] == 3  # las canceladas no cuentan en el resumen


async def test_agenda_formato_de_la_cita(client: AsyncClient, env: Env, session: Session) -> None:
    add_appt(session, env, env.ana, "10:00", service=env.facial_combo, phone="+573001234567")
    r = await client.get(f"{ME}/appointments", params={"date": DAY}, headers=auth(session, env.ana))
    a = r.json()["appointments"][0]
    assert a["starts_at"] == "2026-11-16T10:00:00-05:00"
    assert a["ends_at"] == "2026-11-16T11:00:00-05:00"
    assert a["source"] == "online" and a["status"] == "booked" and a["is_overdue"] is False
    assert a["service"] == {
        "name": "Corte + limpieza facial",
        "duration_min": 60,
        "price_cop": 22_000,
        "uses_resource": True,
    }
    assert a["client"]["phone_masked"] == "300 *** 4567"
    assert a["client"]["phone_e164"] == "+573001234567"
    assert r.headers["cache-control"] == "no-store"


async def test_celular_completo_solo_cuando_hace_falta_para_whatsapp(
    client: AsyncClient, env: Env, session: Session
) -> None:
    add_appt(
        session, env, env.ana, "09:00", status=AppointmentStatus.attended, phone="+573001112233"
    )
    add_appt(
        session, env, env.ana, "10:00", status=AppointmentStatus.no_show, phone="+573004445566"
    )
    add_appt(session, env, env.ana, "11:00", phone="+573007778899")
    r = await client.get(f"{ME}/appointments", params={"date": DAY}, headers=auth(session, env.ana))
    attended, no_show, booked = r.json()["appointments"]
    assert attended["client"]["phone_e164"] is None
    assert attended["client"]["phone_masked"] == "300 *** 2233"
    assert no_show["client"]["phone_e164"] == "+573004445566"
    assert booked["client"]["phone_e164"] == "+573007778899"
    assert "3001112233" not in str(attended)


async def test_cliente_sin_celular_no_tiene_telefono(
    client: AsyncClient, env: Env, session: Session
) -> None:
    appt = add_appt(session, env, env.ana, "10:00")
    session.get(Client, appt.client_id).phone_e164 = None  # type: ignore[union-attr]
    session.commit()
    r = await client.get(f"{ME}/appointments", params={"date": DAY}, headers=auth(session, env.ana))
    assert r.json()["appointments"][0]["client"]["phone_masked"] is None
    assert r.json()["appointments"][0]["client"]["phone_e164"] is None


async def test_is_overdue_lo_decide_el_servidor_con_el_reloj(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.ana, "10:00")
    add_appt(session, env, env.ana, "11:00", status=AppointmentStatus.attended)
    h = auth(session, env.ana)

    async def overdue() -> list[bool]:
        r = await client.get(f"{ME}/appointments", params={"date": DAY}, headers=h)
        return [a["is_overdue"] for a in r.json()["appointments"]]

    set_now(clock, "10:05")  # exactamente la tolerancia: todavía no
    assert await overdue() == [False, False]
    set_now(clock, "10:05", seconds=1)
    assert await overdue() == [True, False]  # atendida nunca está vencida
    set_now(clock, "12:00")
    assert await overdue() == [True, False]


async def test_agenda_sin_fecha_usa_hoy_en_bogota(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.ana, "10:00")
    clock.now = at("21:30").astimezone(UTC)  # 02:30 UTC del día siguiente: sigue siendo el 16
    r = await client.get(f"{ME}/appointments", headers=auth(session, env.ana))
    assert r.json()["date"] == DAY and len(r.json()["appointments"]) == 1


# --- transiciones de estado -------------------------------------------------------------------

B, A, N, C = (
    AppointmentStatus.booked,
    AppointmentStatus.attended,
    AppointmentStatus.no_show,
    AppointmentStatus.cancelled,
)


@pytest.mark.parametrize(
    ("start", "target", "ok"),
    [
        (B, "attended", True),
        (B, "no_show", True),
        (B, "cancelled", True),
        (N, "attended", True),  # el cliente llegó tarde
        (N, "no_show", False),
        (N, "cancelled", False),
        (A, "attended", False),
        (A, "no_show", False),
        (A, "cancelled", False),
        (C, "attended", False),
        (C, "no_show", False),
        (C, "cancelled", False),
        (B, "booked", False),
    ],
)
async def test_transiciones(
    client: AsyncClient,
    env: Env,
    session: Session,
    clock: Clock,
    start: AppointmentStatus,
    target: str,
    ok: bool,
) -> None:
    appt = add_appt(session, env, env.ana, "10:00", status=start)
    set_now(clock, "10:30")  # ya pasó la tolerancia
    r = await patch(client, auth(session, env.ana), appt, target)
    if target == "booked":
        assert r.status_code == 422
        return
    if ok:
        assert r.status_code == 200, r.text
        assert r.json()["status"] == target
        session.expire_all()
        assert session.get(Appointment, appt.id).status.value == target  # type: ignore[union-attr]
    else:
        assert r.status_code == 409 and error_code(r) == "invalid_transition", r.text
        session.expire_all()
        assert session.get(Appointment, appt.id).status == start  # type: ignore[union-attr]


async def test_no_show_antes_y_despues_de_la_tolerancia(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    appt = add_appt(session, env, env.ana, "10:00")
    h = auth(session, env.ana)
    for hhmm, sec in [("09:00", 0), ("10:00", 0), ("10:05", 0)]:
        set_now(clock, hhmm, sec)
        r = await patch(client, h, appt, "no_show")
        assert r.status_code == 409, (hhmm, sec)
        assert error_code(r) == "too_early_for_no_show"
        assert r.json()["message"] == "Todavía estás dentro de los 5 minutos de espera."
    set_now(clock, "10:05", 1)
    r = await patch(client, h, appt, "no_show")
    assert r.status_code == 200 and r.json()["status"] == "no_show"


async def test_tolerancia_usa_el_valor_del_negocio(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    env.business.tolerance_min = 10
    session.commit()
    appt = add_appt(session, env, env.ana, "10:00")
    set_now(clock, "10:08")
    r = await patch(client, auth(session, env.ana), appt, "no_show")
    assert r.status_code == 409
    assert r.json()["message"] == "Todavía estás dentro de los 10 minutos de espera."
    set_now(clock, "10:10", 1)
    assert (await patch(client, auth(session, env.ana), appt, "no_show")).status_code == 200


async def test_attended_solo_desde_15_minutos_antes(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    appt = add_appt(session, env, env.ana, "10:00")
    h = auth(session, env.ana)
    set_now(clock, "09:44", 59)
    r = await patch(client, h, appt, "attended")
    assert r.status_code == 409 and error_code(r) == "too_early_for_attended"
    set_now(clock, "09:45")
    r = await patch(client, h, appt, "attended")
    assert r.status_code == 200 and r.json()["status"] == "attended"


async def test_cancelar_antes_de_tiempo_es_posible_y_libera_el_hueco(
    client: AsyncClient, env: Env, session: Session
) -> None:
    appt = add_appt(session, env, env.ana, "10:00")
    params = {"service_id": str(env.basico.id), "date": DAY, "barber_id": str(env.ana.id)}
    before = (await client.get("/api/v1/public/availability", params=params, headers=HOST)).json()
    assert "2026-11-16T10:00:00-05:00" not in [s["starts_at"] for s in before["slots"]]

    r = await patch(client, auth(session, env.ana), appt, "cancelled")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    session.expire_all()
    assert session.get(Appointment, appt.id).cancelled_at is not None  # type: ignore[union-attr]

    after = (await client.get("/api/v1/public/availability", params=params, headers=HOST)).json()
    assert "2026-11-16T10:00:00-05:00" in [s["starts_at"] for s in after["slots"]]
    # La web pública ya puede reservar ese hueco.
    r = await client.post(
        "/api/v1/public/appointments",
        json={
            "service_id": str(env.basico.id),
            "barber_id": str(env.ana.id),
            "starts_at": at("10:00").isoformat(),
            "client": {"name": "Juan Pérez", "phone": "3001234567"},
            "consent": True,
            "website": "",
        },
        headers=HOST,
    )
    assert r.status_code == 201


async def test_no_show_a_attended_falla_si_otra_cita_ocupo_el_hueco(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    appt = add_appt(session, env, env.ana, "10:00", status=AppointmentStatus.no_show)
    add_appt(session, env, env.ana, "10:00", name="Nuevo")  # el hueco liberado se vendió
    set_now(clock, "10:30")
    r = await patch(client, auth(session, env.ana), appt, "attended")
    assert r.status_code == 409 and error_code(r) == "slot_taken"
    session.expire_all()
    assert session.get(Appointment, appt.id).status == AppointmentStatus.no_show  # type: ignore[union-attr]


async def test_estado_invalido_es_422(client: AsyncClient, env: Env, session: Session) -> None:
    appt = add_appt(session, env, env.ana, "10:00")
    r = await patch(client, auth(session, env.ana), appt, "borrada")
    assert r.status_code == 422


# --- next-free --------------------------------------------------------------------------------


async def next_free(client: AsyncClient, h: dict[str, str], service: Service) -> Response:
    return await client.get(f"{ME}/next-free", params={"service_id": str(service.id)}, headers=h)


async def test_next_free_sin_citas_es_ahora_redondeado_a_5(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "10:12", 20)
    r = await next_free(client, auth(session, env.ana), env.basico)
    assert r.status_code == 200
    assert r.json()["starts_at"] == "2026-11-16T10:15:00-05:00"


async def test_next_free_con_cita_en_curso_empieza_al_terminar(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.ana, "10:00", service=env.facial_combo)  # 10:00-11:00
    set_now(clock, "10:20")
    r = await next_free(client, auth(session, env.ana), env.basico)
    assert r.json()["starts_at"] == "2026-11-16T11:00:00-05:00"
    # Beto, sin citas, empieza ya.
    r = await next_free(client, auth(session, env.beto), env.basico)
    assert r.json()["starts_at"] == "2026-11-16T10:20:00-05:00"


async def test_next_free_en_el_almuerzo_y_fuera_de_horario(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    h = auth(session, env.ana)
    set_now(clock, "13:10")
    assert (
        (await next_free(client, h, env.basico))
        .json()["starts_at"]
        .startswith("2026-11-16T14:00:00")
    )
    set_now(clock, "12:40")
    r = await next_free(client, h, env.facial_combo)  # 60 min no caben antes de la 1:00 pm
    assert r.json()["starts_at"].startswith("2026-11-16T14:00:00")
    set_now(clock, "07:30")
    assert (
        (await next_free(client, h, env.basico))
        .json()["starts_at"]
        .startswith("2026-11-16T09:00:00")
    )
    set_now(clock, "17:45")
    r = await next_free(client, h, env.basico)
    assert r.status_code == 409 and error_code(r) == "no_free_time"
    assert r.json()["message"] == "Hoy ya no tienes tiempo libre para este servicio."


async def test_next_free_respeta_ausencias(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    session.add(
        BarberTimeOff(
            barber_id=env.ana.id,
            starts_at=at("10:00").astimezone(UTC),
            ends_at=at("11:30").astimezone(UTC),
        )
    )
    session.commit()
    set_now(clock, "10:10")
    r = await next_free(client, auth(session, env.ana), env.basico)
    assert r.json()["starts_at"] == "2026-11-16T11:30:00-05:00"


async def test_next_free_respeta_el_vaporizador_de_otro_barbero(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.beto, "10:00", service=env.facial)  # vaporizador 10:00-10:30
    set_now(clock, "10:10")
    r = await next_free(client, auth(session, env.ana), env.facial)
    assert r.json()["starts_at"] == "2026-11-16T10:30:00-05:00"
    # Un servicio sin vaporizador no se ve afectado.
    r = await next_free(client, auth(session, env.ana), env.basico)
    assert r.json()["starts_at"] == "2026-11-16T10:10:00-05:00"


# --- crear cita -------------------------------------------------------------------------------


def create_body(service: Service, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "service_id": str(service.id),
        "client": {"name": "Carlos Gómez", "phone": "300 555 1212"},
    }
    return {**body, **overrides}


async def test_walk_in_usa_next_free_y_guarda_origen(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.ana, "10:00")  # en curso hasta 10:30
    set_now(clock, "10:12")
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, walk_in=True, source="walk_in"),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["starts_at"] == "2026-11-16T10:30:00-05:00"
    assert body["source"] == "walk_in" and body["status"] == "booked"
    row = session.get(Appointment, body["id"])
    assert row is not None and row.barber_id == env.ana.id and row.business_id == env.business.id
    assert row.price_cop == 22_000 and row.duration_min == 30


async def test_walk_in_desaparece_de_la_disponibilidad_publica(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "10:02")
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, walk_in=True),
        headers=auth(session, env.ana),
    )
    assert r.json()["starts_at"] == "2026-11-16T10:05:00-05:00"
    params = {"service_id": str(env.basico.id), "date": DAY, "barber_id": str(env.ana.id)}
    slots = (await client.get("/api/v1/public/availability", params=params, headers=HOST)).json()
    starts = [s["starts_at"][11:16] for s in slots["slots"]]
    assert "10:00" not in starts and "10:30" not in starts  # el turno 10:05-10:35 cruza ambos


async def test_cita_manual_con_celular_reutiliza_cliente_sin_tocar_consentimiento(
    client: AsyncClient, env: Env, session: Session
) -> None:
    existing = Client(
        business_id=env.business.id,
        name="Nombre Original",
        phone_e164="+573005551212",
        consent_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    session.add(existing)
    session.commit()
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(
            env.basico, starts_at=at("11:00").isoformat(), note="Prefiere barba corta"
        ),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 201, r.text
    assert r.json()["source"] == "manual"
    session.expire_all()
    clients = session.scalars(select(Client)).all()
    assert len(clients) == 1
    assert clients[0].name == "Nombre Original"
    assert clients[0].consent_at == datetime(2026, 1, 1, tzinfo=UTC)
    assert clients[0].notes == "Prefiere barba corta"


async def test_cliente_nuevo_queda_sin_consentimiento_digital_y_con_nota(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, starts_at=at("11:00").isoformat(), note="Viene con su hijo"),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 201
    c = session.scalars(select(Client)).one()
    assert c.phone_e164 == "+573005551212" and c.consent_at is None
    assert c.notes == "Consentimiento recogido en persona. Viene con su hijo"


async def test_cliente_sin_celular_se_crea_sin_telefono_y_no_se_fusiona(
    client: AsyncClient, env: Env, session: Session
) -> None:
    h = auth(session, env.ana)
    for hhmm in ("11:00", "11:30"):
        r = await client.post(
            f"{ME}/appointments",
            json=create_body(
                env.basico, starts_at=at(hhmm).isoformat(), client={"name": "Pedro Sin Cel"}
            ),
            headers=h,
        )
        assert r.status_code == 201, r.text
        assert r.json()["client"]["phone_masked"] is None
    clients = session.scalars(select(Client)).all()
    assert len(clients) == 2 and all(c.phone_e164 is None and c.consent_at is None for c in clients)


async def test_cita_manual_doble_reserva_da_409_con_alternativas(
    client: AsyncClient, env: Env, session: Session
) -> None:
    add_appt(session, env, env.ana, "11:00")
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, starts_at=at("11:00").isoformat()),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 409 and error_code(r) == "slot_unavailable"
    alts = r.json()["details"]["alternatives"]
    assert 1 <= len(alts) <= 3
    assert "2026-11-16T11:00:00-05:00" not in [a["starts_at"] for a in alts]
    assert session.scalars(select(Appointment)).all().__len__() == 1


async def test_cita_manual_fuera_de_horario_o_de_otro_dia_pasado(
    client: AsyncClient, env: Env, session: Session
) -> None:
    h = auth(session, env.ana)
    for iso, code in [
        (at("20:00").isoformat(), "slot_unavailable"),  # fuera de horario
        (at("13:00").isoformat(), "slot_unavailable"),  # almuerzo
        (at("10:00", "2026-11-15").isoformat(), "date_out_of_range"),  # día pasado
    ]:
        r = await client.post(
            f"{ME}/appointments", json=create_body(env.basico, starts_at=iso), headers=h
        )
        assert r.status_code in (409, 422) and error_code(r) == code, r.text


async def test_cita_manual_sin_margen_de_anticipacion(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "10:00")  # el margen público (30 min) no aplica al barbero
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, starts_at=at("10:30").isoformat()),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 201


@pytest.mark.parametrize(
    ("overrides", "code"),
    [
        ({"walk_in": True, "client": {"name": "A"}}, "invalid_name"),
        ({"walk_in": True, "client": {"name": ""}}, "invalid_name"),
        ({"walk_in": True, "client": {"name": "Pedro", "phone": "12345"}}, "invalid_phone"),
        ({"walk_in": True, "starts_at": "2026-11-16T11:00:00-05:00"}, "invalid_start"),
        ({"walk_in": False}, "invalid_start"),
        ({"walk_in": True, "source": "manual"}, "invalid_source"),
        ({"starts_at": "2026-11-16T11:00:00-05:00", "source": "walk_in"}, "invalid_source"),
        (
            {"starts_at": "2026-11-16T11:00:00-05:00", "note": "x" * 201},
            "invalid_note",
        ),
    ],
)
async def test_validaciones_al_crear(
    client: AsyncClient, env: Env, session: Session, overrides: dict[str, Any], code: str
) -> None:
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, **overrides),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 422 and error_code(r) == code, r.text
    assert session.scalars(select(Appointment)).all() == []
    assert session.scalars(select(Client)).all() == []  # nada queda a medias


async def test_celular_vacio_cuenta_como_sin_celular(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, walk_in=True, client={"name": "Pedro", "phone": "  "}),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 201 and r.json()["client"]["phone_masked"] is None


async def test_walk_in_sin_tiempo_libre_es_409(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "18:10")
    r = await client.post(
        f"{ME}/appointments",
        json=create_body(env.basico, walk_in=True),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 409 and error_code(r) == "no_free_time"


async def test_walk_in_simultaneo_de_dos_barberos_con_el_vaporizador(
    app: FastAPI, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "10:00")
    ha, hb = auth(session, env.ana), auth(session, env.beto)
    body = create_body(env.facial, walk_in=True)

    async def one(ip: str, headers: dict[str, str]) -> Response:
        async with client_from(app, ip) as c:
            return await c.post(f"{ME}/appointments", json=body, headers=headers)

    responses = await asyncio.gather(one("10.0.0.1", ha), one("10.0.0.2", hb))
    created = [r for r in responses if r.status_code == 201]
    lost = [r for r in responses if r.status_code == 409]
    assert len(created) + len(lost) == 2 and len(created) >= 1, [r.text for r in responses]
    for r in lost:
        assert error_code(r) == "slot_unavailable"
        assert r.json()["details"]["alternatives"][0]["starts_at"].startswith("2026-11-16T10:30:00")

    # Pase lo que pase, el vaporizador nunca atiende a dos a la vez.
    rows = session.scalars(select(Appointment).order_by(Appointment.starts_at)).all()
    assert len(rows) == len(created)
    for first, second in itertools.pairwise(rows):
        assert first.ends_at <= second.starts_at
    # Quien perdió la carrera puede reintentar y empieza cuando se libera el vaporizador.
    if lost:
        loser_headers = hb if responses[0].status_code == 201 else ha
        async with client_from(app, "10.0.0.3") as c:
            retry = await c.post(f"{ME}/appointments", json=body, headers=loser_headers)
        assert retry.status_code == 201
        assert retry.json()["starts_at"] == "2026-11-16T10:30:00-05:00"


async def test_dos_barberos_sin_recurso_no_se_estorban(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "10:00")
    for barber in (env.ana, env.beto):
        r = await client.post(
            f"{ME}/appointments",
            json=create_body(
                env.basico, walk_in=True, client={"name": "Cliente " + barber.display_name}
            ),
            headers=auth(session, barber),
        )
        assert r.status_code == 201 and r.json()["starts_at"] == "2026-11-16T10:00:00-05:00"


async def test_disponibilidad_propia_para_cita_manual(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.ana, "09:00")
    add_appt(session, env, env.beto, "09:30")
    set_now(clock, "09:10")
    r = await client.get(
        f"{ME}/availability",
        params={"service_id": str(env.basico.id), "date": DAY},
        headers=auth(session, env.ana),
    )
    starts = [s["starts_at"][11:16] for s in r.json()["slots"]]
    assert starts[0] == "09:30"  # sin margen de 30 min; la de las 9:00 ya está ocupada y pasó
    assert "09:00" not in starts and len(starts) == 15


# --- horario ----------------------------------------------------------------------------------


def blocks(*items: tuple[int, str, str]) -> dict[str, Any]:
    return {"schedule": [{"weekday": w, "start_time": s, "end_time": e} for w, s, e in items]}


async def test_get_schedule_devuelve_solo_el_propio(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await client.get(f"{ME}/schedule", headers=auth(session, env.ana))
    assert r.status_code == 200
    assert r.json()["schedule"] == [
        {"weekday": 0, "start_time": "09:00:00", "end_time": "13:00:00"},
        {"weekday": 0, "start_time": "14:00:00", "end_time": "18:00:00"},
    ]
    assert r.json()["conflicts"] == []


async def test_put_schedule_reemplaza_todo_y_se_refleja_en_la_web_publica(
    client: AsyncClient, env: Env, session: Session
) -> None:
    h = auth(session, env.ana)
    r = await client.put(
        f"{ME}/schedule", json=blocks((0, "10:00", "12:00"), (2, "09:00", "13:00")), headers=h
    )
    assert r.status_code == 200, r.text
    assert [(b["weekday"], b["start_time"]) for b in r.json()["schedule"]] == [
        (0, "10:00:00"),
        (2, "09:00:00"),
    ]
    session.expire_all()
    mine = session.scalars(select(BarberSchedule).where(BarberSchedule.barber_id == env.ana.id))
    assert len(mine.all()) == 2
    # Beto no se enteró.
    beto = session.scalars(select(BarberSchedule).where(BarberSchedule.barber_id == env.beto.id))
    assert len(beto.all()) == 2
    params = {"service_id": str(env.basico.id), "date": DAY, "barber_id": str(env.ana.id)}
    slots = (await client.get("/api/v1/public/availability", params=params, headers=HOST)).json()
    assert [s["starts_at"][11:16] for s in slots["slots"]] == ["10:00", "10:30", "11:00", "11:30"]


async def test_put_schedule_vacio_borra_el_horario(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await client.put(f"{ME}/schedule", json={"schedule": []}, headers=auth(session, env.ana))
    assert r.status_code == 200 and r.json()["schedule"] == []


@pytest.mark.parametrize(
    "items",
    [
        [(0, "12:00", "10:00")],  # fin antes del inicio
        [(0, "10:00", "10:00")],  # tramo vacío
        [(0, "09:10", "12:00")],  # no es múltiplo de 30
        [(0, "09:00", "12:15")],
        [(0, "09:00", "12:00"), (0, "11:30", "14:00")],  # tramos cruzados
        [(0, "09:00", "13:00"), (0, "10:00", "11:00")],  # uno dentro del otro
        [(7, "09:00", "12:00")],  # día inválido
        [(-1, "09:00", "12:00")],
    ],
)
async def test_put_schedule_validaciones(
    client: AsyncClient, env: Env, session: Session, items: list[tuple[int, str, str]]
) -> None:
    r = await client.put(f"{ME}/schedule", json=blocks(*items), headers=auth(session, env.ana))
    assert r.status_code == 422 and error_code(r) == "invalid_schedule", r.text
    # Falla todo o nada: el horario anterior queda intacto.
    session.expire_all()
    kept = session.scalars(select(BarberSchedule).where(BarberSchedule.barber_id == env.ana.id))
    assert len(kept.all()) == 2


async def test_put_schedule_tramos_pegados_son_validos(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await client.put(
        f"{ME}/schedule",
        json=blocks((1, "09:00", "13:00"), (1, "13:00", "17:30")),
        headers=auth(session, env.ana),
    )
    assert r.status_code == 200


async def test_put_schedule_hora_mal_escrita_es_422(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await client.put(
        f"{ME}/schedule", json=blocks((0, "nueve", "12:00")), headers=auth(session, env.ana)
    )
    assert r.status_code == 422 and error_code(r) == "validation_error"


async def test_cambiar_horario_no_cancela_y_devuelve_conflictos(
    client: AsyncClient, env: Env, session: Session
) -> None:
    afuera = add_appt(session, env, env.ana, "16:00", name="Cita Afectada")
    dentro = add_appt(session, env, env.ana, "10:00", name="Cita Segura")
    otra_ana_dia = add_appt(session, env, env.ana, "10:00", name="Martes", day="2026-11-17")
    de_beto = add_appt(session, env, env.beto, "16:00", name="De Beto")
    r = await client.put(
        f"{ME}/schedule", json=blocks((0, "09:00", "15:00")), headers=auth(session, env.ana)
    )
    assert r.status_code == 200
    conflicts = r.json()["conflicts"]
    assert [(c["appointment_id"], c["client_name"]) for c in conflicts] == [
        (str(afuera.id), "Cita Afectada"),
        (str(otra_ana_dia.id), "Martes"),  # martes ya no tiene horario
    ]
    assert conflicts[0]["service_name"] == "Corte básico"
    assert conflicts[0]["starts_at"] == "2026-11-16T16:00:00-05:00"
    assert str(dentro.id) not in r.text and str(de_beto.id) not in r.text
    session.expire_all()
    for appt in (afuera, dentro, otra_ana_dia, de_beto):
        assert session.get(Appointment, appt.id).status == AppointmentStatus.booked  # type: ignore[union-attr]
    # El GET también las muestra.
    again = await client.get(f"{ME}/schedule", headers=auth(session, env.ana))
    assert len(again.json()["conflicts"]) == 2


async def test_cita_que_cruza_el_cierre_es_conflicto(
    client: AsyncClient, env: Env, session: Session
) -> None:
    add_appt(session, env, env.ana, "12:30", service=env.facial_combo)  # 12:30-13:30
    r = await client.put(
        f"{ME}/schedule", json=blocks((0, "09:00", "13:00")), headers=auth(session, env.ana)
    )
    assert len(r.json()["conflicts"]) == 1


async def test_citas_pasadas_o_no_pendientes_no_son_conflicto(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    add_appt(session, env, env.ana, "09:00", status=AppointmentStatus.attended)
    add_appt(session, env, env.ana, "17:00", status=AppointmentStatus.cancelled)
    add_appt(session, env, env.ana, "09:30")  # ya pasó
    set_now(clock, "12:00")
    r = await client.put(f"{ME}/schedule", json={"schedule": []}, headers=auth(session, env.ana))
    assert r.json()["conflicts"] == []


# --- ausencias --------------------------------------------------------------------------------


def off_body(start: str, end: str, reason: str | None = "Trámite") -> dict[str, Any]:
    return {"starts_at": at(start).isoformat(), "ends_at": at(end).isoformat(), "reason": reason}


async def test_ausencia_crear_listar_y_borrar(
    client: AsyncClient, env: Env, session: Session
) -> None:
    h = auth(session, env.ana)
    r = await client.post(f"{ME}/time-off", json=off_body("10:00", "12:00"), headers=h)
    assert r.status_code == 201, r.text
    created = r.json()["time_off"]
    assert created["reason"] == "Trámite" and created["starts_at"] == "2026-11-16T10:00:00-05:00"
    assert r.json()["conflicts"] == []

    listed = (await client.get(f"{ME}/time-off", headers=h)).json()["items"]
    assert [i["id"] for i in listed] == [created["id"]]

    # Bloquea la disponibilidad pública.
    params = {"service_id": str(env.basico.id), "date": DAY, "barber_id": str(env.ana.id)}
    slots = (await client.get("/api/v1/public/availability", params=params, headers=HOST)).json()
    assert not {"10:00", "10:30", "11:00", "11:30"} & {
        s["starts_at"][11:16] for s in slots["slots"]
    }

    r = await client.delete(f"{ME}/time-off/{created['id']}", headers=h)
    assert r.status_code == 204
    assert (await client.get(f"{ME}/time-off", headers=h)).json()["items"] == []
    slots = (await client.get("/api/v1/public/availability", params=params, headers=HOST)).json()
    assert "10:00" in [s["starts_at"][11:16] for s in slots["slots"]]


async def test_ausencia_devuelve_citas_en_conflicto_sin_cancelarlas(
    client: AsyncClient, env: Env, session: Session
) -> None:
    dentro = add_appt(session, env, env.ana, "10:30", name="Dentro")
    borde = add_appt(session, env, env.ana, "12:00", name="Justo despues")
    parcial = add_appt(session, env, env.ana, "09:30", service=env.facial_combo, name="Parcial")
    r = await client.post(
        f"{ME}/time-off", json=off_body("10:00", "12:00"), headers=auth(session, env.ana)
    )
    names = [c["client_name"] for c in r.json()["conflicts"]]
    assert names == ["Parcial", "Dentro"]  # 9:30-10:30 solapa; la de las 12:00 no
    session.expire_all()
    for appt in (dentro, borde, parcial):
        assert session.get(Appointment, appt.id).status == AppointmentStatus.booked  # type: ignore[union-attr]


@pytest.mark.parametrize(
    "body",
    [
        {"starts_at": "2026-11-16T12:00:00-05:00", "ends_at": "2026-11-16T10:00:00-05:00"},
        {"starts_at": "2026-11-16T12:00:00-05:00", "ends_at": "2026-11-16T12:00:00-05:00"},
        {"starts_at": "2026-11-15T10:00:00-05:00", "ends_at": "2026-11-15T12:00:00-05:00"},  # pasó
        {"starts_at": "2026-11-16T10:00:00-05:00", "ends_at": "2028-01-01T00:00:00-05:00"},
        {
            "starts_at": "2026-11-16T10:00:00-05:00",
            "ends_at": "2026-11-16T12:00:00-05:00",
            "reason": "x" * 101,
        },
    ],
)
async def test_ausencia_validaciones(
    client: AsyncClient, env: Env, session: Session, body: dict[str, str]
) -> None:
    r = await client.post(f"{ME}/time-off", json=body, headers=auth(session, env.ana))
    assert r.status_code == 422 and error_code(r) == "invalid_time_off", r.text
    assert session.scalars(select(BarberTimeOff)).all() == []


async def test_ausencia_sin_zona_horaria_es_422(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await client.post(
        f"{ME}/time-off",
        json={"starts_at": "2026-11-16T10:00:00", "ends_at": "2026-11-16T12:00:00"},
        headers=auth(session, env.ana),
    )
    assert r.status_code == 422


async def test_ausencias_aisladas_entre_barberos(
    client: AsyncClient, env: Env, session: Session
) -> None:
    created = await client.post(
        f"{ME}/time-off", json=off_body("10:00", "12:00"), headers=auth(session, env.ana)
    )
    off_id = created.json()["time_off"]["id"]
    hb = auth(session, env.beto)
    assert (await client.get(f"{ME}/time-off", headers=hb)).json()["items"] == []
    r = await client.delete(f"{ME}/time-off/{off_id}", headers=hb)
    assert r.status_code == 404 and error_code(r) == "time_off_not_found"
    assert session.get(BarberTimeOff, off_id) is not None


async def test_lista_de_ausencias_omite_las_terminadas(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    h = auth(session, env.ana)
    await client.post(f"{ME}/time-off", json=off_body("10:00", "12:00"), headers=h)
    await client.post(f"{ME}/time-off", json=off_body("14:00", "15:00", None), headers=h)
    set_now(clock, "12:30")
    items = (await client.get(f"{ME}/time-off", headers=h)).json()["items"]
    assert [i["starts_at"][11:16] for i in items] == ["14:00"]
    assert items[0]["reason"] is None


# --- varios ----------------------------------------------------------------------------------


async def test_usuario_barbero_sin_perfil_activo_es_403(
    client: AsyncClient, env: Env, session: Session
) -> None:
    huerfano = make_user(session, env.business, UserRole.barber)
    token = create_access_token(huerfano, make_settings())
    r = await client.get(f"{ME}/schedule", headers={**HOST, "Cookie": f"access_token={token}"})
    assert r.status_code == 403 and error_code(r) == "no_barber_profile"


async def test_barbero_inactivo_pierde_acceso(
    client: AsyncClient, env: Env, session: Session
) -> None:
    h = auth(session, env.ana)
    env.ana.active = False
    session.commit()
    r = await client.get(f"{ME}/schedule", headers=h)
    assert r.status_code == 403

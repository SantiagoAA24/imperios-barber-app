import asyncio
import hashlib
from datetime import UTC
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import AsyncClient, Response
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentStatus, BarberTimeOff, Base, Client
from tests.api.conftest import DAY, HOST, Clock, Env, at, booking_body, client_from
from tests.helpers import make_business, make_service

pytestmark = pytest.mark.anyio

URL = "/api/v1/public/appointments"
AVAIL = "/api/v1/public/availability"


async def book(
    client: AsyncClient,
    env: Env,
    service_attr: str,
    barber: str | None,
    hhmm: str,
    phone: str = "300 123 4567",
    **extra: Any,
) -> Response:
    barber_obj = {"ana": env.ana, "beto": env.beto, None: None}[barber]
    return await client.post(
        URL,
        json=booking_body(getattr(env, service_attr), barber_obj, hhmm, phone, **extra),
        headers=HOST,
    )


async def free_slots(
    client: AsyncClient, env: Env, service_attr: str, barber: str | None = None, day: str = DAY
) -> dict[str, list[str]]:
    params = {"service_id": str(getattr(env, service_attr).id), "date": day}
    if barber:
        params["barber_id"] = str(getattr(env, barber).id)
    r = await client.get(AVAIL, params=params, headers=HOST)
    assert r.status_code == 200, r.text
    return {s["starts_at"][11:16]: s["barber_ids"] for s in r.json()["slots"]}


# --- disponibilidad ---------------------------------------------------------------------------


async def test_availability_formato_y_cache(client: AsyncClient, env: Env) -> None:
    r = await client.get(
        AVAIL, params={"service_id": str(env.basico.id), "date": DAY}, headers=HOST
    )
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert body["date"] == DAY
    first = body["slots"][0]
    assert first["starts_at"] == "2026-11-16T09:00:00-05:00"
    assert sorted(first["barber_ids"]) == sorted([str(env.ana.id), str(env.beto.id)])
    assert len(body["slots"]) == 16  # 9-13 y 14-18 cada 30 min


async def test_availability_con_barbero_devuelve_solo_ese_barbero(
    client: AsyncClient, env: Env
) -> None:
    slots = await free_slots(client, env, "basico", "ana")
    assert all(ids == [str(env.ana.id)] for ids in slots.values())


async def test_availability_respeta_margen_y_ausencias(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    clock.now = at("10:10").astimezone(UTC)
    session.add(
        BarberTimeOff(
            barber_id=env.ana.id,
            starts_at=at("11:00").astimezone(UTC),
            ends_at=at("12:00").astimezone(UTC),
        )
    )
    session.commit()
    slots = await free_slots(client, env, "basico", "ana")
    assert "10:30" not in slots  # antes de ahora + 30 min (10:40)
    assert "11:00" not in slots and "11:30" not in slots  # ausencia
    assert "10:40" not in slots and "12:00" in slots
    assert next(iter(slots)) == "12:00"


@pytest.mark.parametrize(
    ("day", "ok"),
    [("2026-11-15", False), ("2026-11-16", True), ("2027-01-15", True), ("2027-01-16", False)],
)
async def test_availability_rango_de_fechas(
    client: AsyncClient, env: Env, day: str, ok: bool
) -> None:
    r = await client.get(
        AVAIL, params={"service_id": str(env.basico.id), "date": day}, headers=HOST
    )
    if ok:
        assert r.status_code == 200
    else:
        assert r.status_code == 422
        assert r.json()["code"] == "date_out_of_range"


async def test_availability_servicio_o_barbero_ajeno_es_404(
    client: AsyncClient, env: Env, session: Session
) -> None:
    otro = make_business(session, "otro", "otro.test")
    ajeno = make_service(session, otro, "Corte ajeno")
    r = await client.get(AVAIL, params={"service_id": str(ajeno.id), "date": DAY}, headers=HOST)
    assert r.status_code == 404 and r.json()["code"] == "service_not_found"
    r = await client.get(
        AVAIL,
        params={"service_id": str(env.basico.id), "date": DAY, "barber_id": str(ajeno.id)},
        headers=HOST,
    )
    assert r.status_code == 404 and r.json()["code"] == "barber_not_found"


# --- crear ------------------------------------------------------------------------------------


async def test_crear_cita_201_y_token_solo_como_hash(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await book(client, env, "basico", "ana", "11:00", phone="+57 300 123 4567")
    assert r.status_code == 201, r.text
    body = r.json()
    token = body["manage_token"]
    assert body["manage_path"] == f"/cita/{token}"
    assert len(token) >= 21
    appt = body["appointment"]
    assert appt["status"] == "booked"
    assert appt["starts_at"] == "2026-11-16T11:00:00-05:00"
    assert appt["ends_at"] == "2026-11-16T11:30:00-05:00"
    assert appt["service"] == {
        "id": str(env.basico.id),
        "name": "Corte básico",
        "price_cop": 22_000,
        "duration_min": 30,
    }
    assert appt["client"] == {"first_name": "Juan"}
    assert appt["can_cancel"] is True and appt["can_reschedule"] is True
    assert "phone" not in r.text and "3001234567" not in r.text

    row = session.scalars(select(Appointment)).one()
    assert row.manage_token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert row.source.value == "online"
    assert row.price_cop == 22_000 and row.duration_min == 30 and row.resource_id is None
    # El token en claro no existe en ninguna columna de ninguna tabla.
    for table in Base.metadata.tables.values():
        for col in table.columns:
            hits = session.scalar(
                text(f'SELECT count(*) FROM "{table.name}" WHERE "{col.name}"::text LIKE :t'),
                {"t": f"%{token}%"},
            )
            assert hits == 0, f"{table.name}.{col.name} contiene el token"


async def test_ver_cita_por_token_no_expone_el_celular(client: AsyncClient, env: Env) -> None:
    created = (await book(client, env, "basico", "ana", "11:00", phone="3001234567")).json()
    r = await client.get(f"{URL}/{created['manage_token']}", headers=HOST)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert set(body) == {
        "id", "status", "starts_at", "ends_at", "service", "barber", "client", "business",
        "can_cancel", "can_reschedule",
    }  # fmt: skip
    assert body["barber"]["display_name"] == "Ana"
    assert body["business"] == {"name": "Negocio imperio"}
    assert "3001234567" not in r.text and "+57" not in r.text


async def test_token_desconocido_es_404(client: AsyncClient, env: Env) -> None:
    for method, suffix in [("get", ""), ("post", "/cancel")]:
        r = await getattr(client, method)(f"{URL}/no-existe{suffix}", headers=HOST)
        assert r.status_code == 404 and r.json()["code"] == "appointment_not_found"
    r = await client.post(
        f"{URL}/no-existe/reschedule", json={"starts_at": at("12:00").isoformat()}, headers=HOST
    )
    assert r.status_code == 404


async def test_mismo_celular_reutiliza_cliente_y_conserva_el_nombre(
    client: AsyncClient, env: Env, session: Session
) -> None:
    assert (await book(client, env, "basico", "ana", "10:00", name="Juan Pérez")).status_code == 201
    r = await book(client, env, "basico", "ana", "10:30", phone="573001234567", name="Otro Nombre")
    assert r.status_code == 201
    clients = session.scalars(select(Client)).all()
    assert len(clients) == 1
    assert clients[0].name == "Juan Pérez" and clients[0].phone_e164 == "+573001234567"
    assert clients[0].consent_at is not None


async def test_validaciones_del_cuerpo(client: AsyncClient, env: Env, session: Session) -> None:
    r = await book(client, env, "basico", "ana", "11:00", website="http://spam.example")
    assert r.status_code == 400 and r.json()["code"] == "bad_request"

    body = booking_body(env.basico, env.ana, "11:00")
    r = await client.post(URL, json={**body, "consent": False}, headers=HOST)
    assert r.status_code == 422 and r.json()["code"] == "consent_required"

    for bad in ["601 234 5678", "300 123 456", "300 123 45ab"]:
        r = await book(client, env, "basico", "ana", "11:00", phone=bad)
        assert r.status_code == 422
        assert r.json()["code"] == "invalid_phone"
        assert r.json()["message"] == "Escribe un celular colombiano de 10 dígitos"

    for bad_name in ["J", " " * 5, "x" * 61]:
        body = booking_body(env.basico, env.ana, "11:00", name=bad_name)
        r = await client.post(URL, json=body, headers=HOST)
        assert r.status_code == 422 and r.json()["code"] == "invalid_name"

    naive = {**booking_body(env.basico, env.ana, "11:00"), "starts_at": "2026-11-16T11:00:00"}
    assert (await client.post(URL, json=naive, headers=HOST)).status_code == 422
    assert session.scalar(select(func.count()).select_from(Appointment)) == 0


async def test_nombre_se_recorta(client: AsyncClient, env: Env, session: Session) -> None:
    r = await book(client, env, "basico", "ana", "11:00", name="  María   José  ")
    assert r.status_code == 201
    assert r.json()["appointment"]["client"]["first_name"] == "María"
    assert session.scalars(select(Client)).one().name == "María José"


async def test_fuera_de_horario_o_pasado_es_409_y_fuera_de_rango_422(
    client: AsyncClient, env: Env
) -> None:
    for hhmm in ["07:00", "08:15", "13:00", "17:45"]:  # antes, margen, almuerzo, cruza el cierre
        r = await book(client, env, "basico", "ana", hhmm)
        assert r.status_code == 409 and r.json()["code"] == "slot_unavailable", hhmm
    body = booking_body(env.basico, env.ana, "11:00")
    body["starts_at"] = at("11:00", "2027-02-01").isoformat()
    r = await client.post(URL, json=body, headers=HOST)
    assert r.status_code == 422 and r.json()["code"] == "date_out_of_range"


async def test_too_many_active_la_cuarta_cita(client: AsyncClient, env: Env) -> None:
    for hhmm in ["09:00", "09:30", "10:00"]:
        assert (await book(client, env, "basico", "ana", hhmm)).status_code == 201
    r = await book(client, env, "basico", "ana", "10:30")
    assert r.status_code == 422 and r.json()["code"] == "too_many_active"
    # Otro celular sí puede.
    assert (
        await book(client, env, "basico", "ana", "10:30", phone="3109998888")
    ).status_code == 201


async def test_limite_de_10_solicitudes_por_hora_por_ip(client: AsyncClient, env: Env) -> None:
    codes = [
        (await book(client, env, "basico", "ana", "07:00")).status_code  # 409, pero cuenta
        for _ in range(11)
    ]
    assert codes[:10] == [409] * 10 and codes[10] == 429


# --- concurrencia -----------------------------------------------------------------------------


async def test_concurrency_20_reservas_al_mismo_hueco(
    app: FastAPI, env: Env, session: Session
) -> None:
    async def one(i: int) -> int:
        async with client_from(app, f"10.1.0.{i}") as c:
            r = await c.post(
                URL,
                json=booking_body(env.basico, env.ana, "11:00", phone=f"3001000{i:03d}"),
                headers=HOST,
            )
            return r.status_code

    codes = await asyncio.gather(*(one(i) for i in range(20)))
    assert sorted(codes) == [201] + [409] * 19
    assert session.scalar(select(func.count()).select_from(Appointment)) == 1


async def test_concurrency_cualquiera_asigna_barberos_distintos_y_la_tercera_es_409(
    app: FastAPI, env: Env, session: Session
) -> None:
    async def one(i: int) -> tuple[int, dict[str, object]]:
        async with client_from(app, f"10.2.0.{i}") as c:
            r = await c.post(
                URL,
                json=booking_body(env.basico, None, "11:00", phone=f"3002000{i:03d}"),
                headers=HOST,
            )
            return r.status_code, r.json()

    first = await asyncio.gather(one(1), one(2))
    assert [s for s, _ in first] == [201, 201]
    barbers = {b["appointment"]["barber"]["id"] for _, b in first}  # type: ignore[index]
    assert barbers == {str(env.ana.id), str(env.beto.id)}
    third, _ = await one(3)
    assert third == 409
    assert session.scalar(select(func.count()).select_from(Appointment)) == 2


async def test_cualquiera_prefiere_al_barbero_con_menos_citas_ese_dia(
    client: AsyncClient, env: Env
) -> None:
    assert (
        await book(client, env, "basico", "ana", "09:00", phone="3001110001")
    ).status_code == 201
    r = await book(client, env, "basico", None, "15:00", phone="3001110002")
    assert r.json()["appointment"]["barber"]["display_name"] == "Beto"  # Ana ya tiene una
    r = await book(client, env, "basico", None, "16:00", phone="3001110003")
    assert r.json()["appointment"]["barber"]["display_name"] == "Ana"  # empate: por nombre


# --- vaporizador ------------------------------------------------------------------------------


async def test_vaporizador_es_un_recurso_compartido(
    client: AsyncClient, env: Env, session: Session
) -> None:
    r = await book(client, env, "facial_combo", "ana", "11:00", phone="3001230001")
    assert r.status_code == 201
    assert session.scalars(select(Appointment)).one().resource_id == env.vaporizer.id

    # Beto está libre, pero el vaporizador no.
    r = await book(client, env, "facial", "beto", "11:00", phone="3001230002")
    assert r.status_code == 409 and r.json()["code"] == "slot_unavailable"
    r = await book(client, env, "facial", "beto", "11:30", phone="3001230002")
    assert r.status_code == 409
    # Un servicio sin vaporizador sí se permite.
    r = await book(client, env, "basico", "beto", "11:00", phone="3001230003")
    assert r.status_code == 201

    facial = await free_slots(client, env, "facial")
    assert "11:00" not in facial and "11:30" not in facial
    assert "10:30" in facial and "12:00" in facial
    basico = await free_slots(client, env, "basico")
    assert "11:00" not in basico  # Ana y Beto ya están ocupados a las 11:00
    assert basico["11:30"] == [str(env.beto.id)]  # Ana sigue con el facial hasta las 12:00


async def test_vaporizador_se_ofrece_a_los_demas_servicios_con_barbero_libre(
    client: AsyncClient, env: Env
) -> None:
    assert (await book(client, env, "facial_combo", "ana", "11:00")).status_code == 201
    basico = await free_slots(client, env, "basico")
    assert basico["11:00"] == [str(env.beto.id)]  # solo Beto: Ana está ocupada, no el vaporizador


# --- alternativas -----------------------------------------------------------------------------


async def test_409_trae_hasta_3_alternativas_del_mismo_dia(client: AsyncClient, env: Env) -> None:
    assert (
        await book(client, env, "basico", "ana", "10:00", phone="3001000001")
    ).status_code == 201
    r = await book(client, env, "basico", "ana", "10:00", phone="3001000002")
    assert r.status_code == 409
    err = r.json()
    assert err["code"] == "slot_unavailable"
    alts = err["details"]["alternatives"]
    assert [a["starts_at"][11:16] for a in alts] == ["09:00", "09:30", "10:30"]
    assert all(a["starts_at"].startswith(DAY) for a in alts)
    assert all(a["barber_ids"] == [str(env.ana.id)] for a in alts)


async def test_409_sin_alternativas_cuando_el_dia_esta_lleno(
    client: AsyncClient, env: Env, clock: Clock
) -> None:
    clock.now = at("17:00").astimezone(UTC)
    r = await book(client, env, "basico", "ana", "09:00")
    assert r.status_code == 409
    assert len(r.json()["details"]["alternatives"]) <= 3


# --- cancelar ---------------------------------------------------------------------------------


async def test_cancelar_con_30_min_es_409_y_con_3_horas_libera_el_hueco(
    client: AsyncClient, env: Env, clock: Clock, session: Session
) -> None:
    created = (await book(client, env, "basico", "ana", "11:00")).json()
    token = created["manage_token"]
    assert "11:00" not in await free_slots(client, env, "basico", "ana")

    clock.now = at("10:30").astimezone(UTC)
    r = await client.post(f"{URL}/{token}/cancel", headers=HOST)
    assert r.status_code == 409 and r.json()["code"] == "too_late_to_cancel"
    assert r.json()["message"] == (
        "Para cancelar con menos de 1 hora de anticipación, escríbele al local."
    )
    got = (await client.get(f"{URL}/{token}", headers=HOST)).json()
    assert got["status"] == "booked" and got["can_cancel"] is False

    clock.now = at("08:00").astimezone(UTC)
    r = await client.post(f"{URL}/{token}/cancel", headers=HOST)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert r.json()["can_cancel"] is False
    assert "11:00" in await free_slots(client, env, "basico", "ana")
    row = session.scalars(select(Appointment)).one()
    assert row.status == AppointmentStatus.cancelled and row.cancelled_at is not None

    again = await client.post(f"{URL}/{token}/cancel", headers=HOST)
    assert again.status_code == 409 and again.json()["code"] == "appointment_not_active"


async def test_cancelar_justo_a_los_60_minutos_se_permite(
    client: AsyncClient, env: Env, clock: Clock
) -> None:
    token = (await book(client, env, "basico", "ana", "11:00")).json()["manage_token"]
    clock.now = at("10:00").astimezone(UTC)
    r = await client.post(f"{URL}/{token}/cancel", headers=HOST)
    assert r.status_code == 200


# --- reprogramar ------------------------------------------------------------------------------


async def test_reprogramar_a_hueco_ocupado_deja_la_cita_intacta(
    client: AsyncClient, env: Env, session: Session
) -> None:
    await book(client, env, "basico", "ana", "11:00", phone="3001000001")
    mine = (await book(client, env, "basico", "ana", "14:00", phone="3001000002")).json()
    r = await client.post(
        f"{URL}/{mine['manage_token']}/reschedule",
        json={"starts_at": at("11:00").isoformat()},
        headers=HOST,
    )
    assert r.status_code == 409 and r.json()["code"] == "slot_unavailable"
    assert len(r.json()["details"]["alternatives"]) <= 3
    row = session.scalars(
        select(Appointment).where(Appointment.id == mine["appointment"]["id"])
    ).one()
    assert row.starts_at == at("14:00") and row.ends_at == at("14:30")
    assert row.status == AppointmentStatus.booked


async def test_reprogramar_a_hueco_libre_mueve_y_libera_el_anterior(
    client: AsyncClient, env: Env
) -> None:
    mine = (await book(client, env, "basico", "ana", "14:00")).json()
    assert "14:00" not in await free_slots(client, env, "basico", "ana")
    r = await client.post(
        f"{URL}/{mine['manage_token']}/reschedule",
        json={"starts_at": at("15:00").isoformat()},
        headers=HOST,
    )
    assert r.status_code == 200, r.text
    assert r.json()["starts_at"] == "2026-11-16T15:00:00-05:00"
    assert r.json()["ends_at"] == "2026-11-16T15:30:00-05:00"
    slots = await free_slots(client, env, "basico", "ana")
    assert "14:00" in slots and "15:00" not in slots


async def test_reprogramar_ignora_la_propia_cita(client: AsyncClient, env: Env) -> None:
    mine = (await book(client, env, "facial_combo", "ana", "11:00")).json()  # 11:00-12:00
    r = await client.post(
        f"{URL}/{mine['manage_token']}/reschedule",
        json={"starts_at": at("11:30").isoformat()},  # se solapa con su propio horario actual
        headers=HOST,
    )
    assert r.status_code == 200
    assert r.json()["ends_at"] == "2026-11-16T12:30:00-05:00"


async def test_reprogramar_respeta_el_vaporizador_ajeno(client: AsyncClient, env: Env) -> None:
    await book(client, env, "facial_combo", "ana", "11:00", phone="3001000001")
    mine = (await book(client, env, "facial", "beto", "15:00", phone="3001000002")).json()
    r = await client.post(
        f"{URL}/{mine['manage_token']}/reschedule",
        json={"starts_at": at("11:30").isoformat()},
        headers=HOST,
    )
    assert r.status_code == 409


async def test_reprogramar_tarde_o_cancelada_es_409(
    client: AsyncClient, env: Env, clock: Clock
) -> None:
    mine = (await book(client, env, "basico", "ana", "11:00")).json()
    token = mine["manage_token"]
    clock.now = at("10:30").astimezone(UTC)
    r = await client.post(
        f"{URL}/{token}/reschedule", json={"starts_at": at("15:00").isoformat()}, headers=HOST
    )
    assert r.status_code == 409 and r.json()["code"] == "too_late_to_reschedule"
    assert "reprogramar" in r.json()["message"]

    clock.now = at("08:00").astimezone(UTC)
    await client.post(f"{URL}/{token}/cancel", headers=HOST)
    r = await client.post(
        f"{URL}/{token}/reschedule", json={"starts_at": at("15:00").isoformat()}, headers=HOST
    )
    assert r.status_code == 409 and r.json()["code"] == "appointment_not_active"


async def test_un_token_de_otro_negocio_no_funciona(
    client: AsyncClient, env: Env, session: Session
) -> None:
    token = (await book(client, env, "basico", "ana", "11:00")).json()["manage_token"]
    make_business(session, "otro", "otro.test")
    r = await client.get(f"{URL}/{token}", headers={"Host": "otro.test"})
    assert r.status_code == 404

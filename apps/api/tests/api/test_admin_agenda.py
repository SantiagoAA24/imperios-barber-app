"""Agenda del admin: rango, celular parcial, aislamiento, creación, estados y conteo de consultas.

Escenario de ``conftest``: lunes 16-nov-2026, "ahora" = 8:00 am en Bogotá; Ana y Beto trabajan
9-13 y 14-18 los lunes.
"""

from datetime import timedelta

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import Engine, event
from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentStatus
from tests.api.conftest import DAY, HOST, Clock, Env, at, booking_body, client_from
from tests.api.test_me import add_appt, set_now
from tests.helpers import admin_headers, make_barber, make_business, make_service

pytestmark = pytest.mark.anyio

URL = "/api/v1/admin/appointments"
Q = {"from": DAY, "to": DAY}


@pytest.fixture
def admin(session: Session, env: Env) -> dict[str, str]:
    return admin_headers(session, env.business)


async def test_lista_con_todas_las_columnas_y_celular_parcial(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    add_appt(session, env, env.ana, "10:00", phone="+573004824821", name="Mateo G.")
    add_appt(session, env, env.beto, "11:00", service=env.facial_combo, phone="+573115550000")
    r = await client.get(URL, params=Q, headers=admin)
    assert r.status_code == 200
    body = r.json()
    first, second = body["items"]
    assert first["barber"]["display_name"] == "Ana" and first["client"]["name"] == "Mateo G."
    assert first["client"]["phone_masked"] == "300 *** 4821"
    assert first["service"] == {"name": "Corte básico", "duration_min": 30, "uses_resource": False}
    assert first["status"] == "booked" and first["source"] == "online"
    assert first["starts_at"].startswith(f"{DAY}T10:00:00-05:00")
    assert first["ends_at"].startswith(f"{DAY}T10:30:00-05:00")
    assert second["service"]["uses_resource"] is True and second["service"]["duration_min"] == 60
    # Ningún celular completo en ninguna parte de la respuesta.
    assert "4824821" not in r.text and "+57" not in r.text and "5550000" not in r.text
    # Rejilla: inicio mínimo y cierre máximo de los horarios.
    assert (body["day_start"], body["day_end"]) == ("09:00", "18:00")


async def test_rango_maximo_filtro_por_barbero_y_canceladas(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    add_appt(session, env, env.ana, "10:00")
    add_appt(session, env, env.beto, "10:00")
    add_appt(session, env, env.ana, "11:00", status=AppointmentStatus.cancelled)
    ok = await client.get(URL, params={"from": DAY, "to": "2026-11-23"}, headers=admin)  # 8 días
    assert ok.status_code == 200 and len(ok.json()["items"]) == 2
    too_big = await client.get(URL, params={"from": DAY, "to": "2026-11-24"}, headers=admin)  # 9
    assert too_big.status_code == 422 and too_big.json()["code"] == "range_too_large"
    backwards = await client.get(URL, params={"from": "2026-11-17", "to": DAY}, headers=admin)
    assert backwards.status_code == 422
    only_ana = await client.get(URL, params={**Q, "barber_id": str(env.ana.id)}, headers=admin)
    assert [i["barber"]["display_name"] for i in only_ana.json()["items"]] == ["Ana"]
    with_cancelled = await client.get(URL, params={**Q, "include_cancelled": True}, headers=admin)
    assert len(with_cancelled.json()["items"]) == 3
    assert (await client.get(URL, params={"from": DAY}, headers=admin)).status_code == 422


async def test_el_dia_es_el_dia_local_de_bogota(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    # 11:30 pm Bogotá del lunes = 04:30 UTC del martes: sigue siendo lunes para el negocio.
    add_appt(session, env, env.ana, "23:30")
    add_appt(session, env, env.ana, "00:00", day="2026-11-17")
    monday = (await client.get(URL, params=Q, headers=admin)).json()["items"]
    assert len(monday) == 1 and monday[0]["starts_at"].startswith(f"{DAY}T23:30")


async def test_aislamiento_entre_negocios(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    add_appt(session, env, env.ana, "10:00")
    other = make_business(session, "otro", "otro.test")
    foreign_barber = make_barber(session, other, "Ajeno")
    foreign_service = make_service(session, other, "Ajeno")
    admin_b = admin_headers(session, other, host="otro.test")
    assert (await client.get(URL, params=Q, headers=admin_b)).json()["items"] == []
    appt = session.query(Appointment).first()
    assert appt is not None
    r = await client.patch(f"{URL}/{appt.id}", json={"status": "cancelled"}, headers=admin_b)
    assert r.status_code == 404
    # A tampoco puede crear con un barbero o un servicio del negocio B.
    for body in (
        {"barber_id": str(foreign_barber.id), "service_id": str(env.basico.id)},
        {"barber_id": str(env.ana.id), "service_id": str(foreign_service.id)},
    ):
        r = await client.post(
            URL,
            json={**body, "starts_at": at("10:30").isoformat(), "client": {"name": "Pedro Ruiz"}},
            headers=admin,
        )
        assert r.status_code in (404, 409, 422), r.text
    session.expire_all()
    assert session.query(Appointment).count() == 1


async def test_crear_cita_para_un_barbero_y_proteccion_de_doble_reserva(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    body = {
        "barber_id": str(env.ana.id),
        "service_id": str(env.basico.id),
        "starts_at": at("10:00").isoformat(),
        "client": {"name": "Pedro Ruiz", "phone": "300 123 4567"},
    }
    r = await client.post(URL, json=body, headers=admin)
    assert r.status_code == 201, r.text
    created = r.json()
    assert created["source"] == "manual" and created["barber"]["display_name"] == "Ana"
    assert created["client"]["phone_masked"] == "300 *** 4567"
    # El mismo hueco: 409 con alternativas, igual que el panel del barbero.
    again = await client.post(URL, json={**body, "client": {"name": "Otro Cliente"}}, headers=admin)
    assert again.status_code == 409 and again.json()["code"] == "slot_unavailable"
    assert again.json()["details"]["alternatives"]
    # Y el vaporizador: Beto con el mismo servicio de vaporizador a la misma hora choca.
    vap = {**body, "service_id": str(env.facial.id), "barber_id": str(env.beto.id)}
    vap_other = {**body, "service_id": str(env.facial.id), "starts_at": at("11:00").isoformat()}
    assert (await client.post(URL, json=vap_other, headers=admin)).status_code == 201
    clash = await client.post(
        URL, json={**vap, "starts_at": at("11:00").isoformat()}, headers=admin
    )
    assert clash.status_code == 409


async def test_crear_con_barbero_inactivo_o_hora_fuera_de_horario(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    base = {
        "service_id": str(env.basico.id),
        "client": {"name": "Pedro Ruiz"},
    }
    off_hours = await client.post(
        URL,
        json={**base, "barber_id": str(env.ana.id), "starts_at": at("20:00").isoformat()},
        headers=admin,
    )
    assert off_hours.status_code == 409
    env.beto.active = False
    session.commit()
    r = await client.post(
        URL,
        json={**base, "barber_id": str(env.beto.id), "starts_at": at("10:00").isoformat()},
        headers=admin,
    )
    assert r.status_code == 409 and r.json()["code"] == "barber_inactive"


async def test_estados_reutilizan_las_reglas_de_la_fase_6(
    client: AsyncClient, session: Session, env: Env, clock: Clock, admin: dict[str, str]
) -> None:
    appt = add_appt(session, env, env.ana, "10:00")
    # Antes de tiempo: 409 igual que para el barbero.
    r = await client.patch(f"{URL}/{appt.id}", json={"status": "attended"}, headers=admin)
    assert r.status_code == 409 and r.json()["code"] == "too_early_for_attended"
    r = await client.patch(f"{URL}/{appt.id}", json={"status": "no_show"}, headers=admin)
    assert r.json()["code"] == "too_early_for_no_show"
    set_now(clock, "10:00")
    r = await client.patch(f"{URL}/{appt.id}", json={"status": "attended"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "attended"
    r = await client.patch(f"{URL}/{appt.id}", json={"status": "cancelled"}, headers=admin)
    assert r.status_code == 409 and r.json()["code"] == "invalid_transition"
    other = add_appt(session, env, env.beto, "10:00")
    r = await client.patch(f"{URL}/{other.id}", json={"status": "cancelled"}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert (
        await client.patch(f"{URL}/{other.id}", json={"status": "bogus"}, headers=admin)
    ).status_code == 422
    # Cancelada: el hueco queda libre para una cita nueva.
    again = await client.post(
        URL,
        json={
            "barber_id": str(env.beto.id),
            "service_id": str(env.basico.id),
            "starts_at": at("10:00").isoformat(),
            "client": {"name": "Pedro Ruiz"},
        },
        headers=admin,
    )
    assert again.status_code == 201


async def test_cita_de_la_web_publica_aparece_en_la_columna_del_barbero(
    app: FastAPI, client: AsyncClient, env: Env, admin: dict[str, str]
) -> None:
    async with client_from(app, "10.0.0.5") as c:
        r = await c.post(
            "/api/v1/public/appointments",
            json=booking_body(env.facial_combo, env.beto, "10:00"),
            headers=HOST,
        )
        assert r.status_code == 201
    (item,) = (await client.get(URL, params=Q, headers=admin)).json()["items"]
    assert item["barber"]["display_name"] == "Beto" and item["source"] == "online"
    assert item["service"]["uses_resource"] is True


async def test_disponibilidad_del_admin(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    add_appt(session, env, env.ana, "09:00")
    r = await client.get(
        "/api/v1/admin/availability",
        params={"barber_id": str(env.ana.id), "service_id": str(env.basico.id), "date": DAY},
        headers=admin,
    )
    assert r.status_code == 200
    starts = [s["starts_at"][11:16] for s in r.json()["slots"]]
    assert "09:00" not in starts and "09:30" in starts


async def test_consultas_sql_de_la_agenda_no_dependen_del_numero_de_citas(
    engine: Engine, client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    """Máximo 5 consultas con 2 citas y con 60 citas (sin N+1)."""
    statements: list[str] = []

    def count(conn: object, cursor: object, statement: str, *args: object) -> None:
        statements.append(statement)

    async def measure() -> int:
        statements.clear()
        event.listen(engine, "before_cursor_execute", count)
        try:
            r = await client.get(URL, params={"from": DAY, "to": "2026-11-23"}, headers=admin)
        finally:
            event.remove(engine, "before_cursor_execute", count)
        assert r.status_code == 200
        return len(statements)

    add_appt(session, env, env.ana, "10:00")
    add_appt(session, env, env.beto, "10:00")
    few = await measure()
    # 60 citas más: 4 por día x 2 barberos x 8 días, cada una con su cliente.
    for offset in range(8):
        day = (at("00:00") + timedelta(days=offset)).strftime("%Y-%m-%d")
        for barber in (env.ana, env.beto):
            for hhmm in ("11:00", "11:30", "12:00", "14:00"):
                add_appt(session, env, barber, hhmm, day=day)
    many = await measure()
    n = len(
        (await client.get(URL, params={"from": DAY, "to": "2026-11-23"}, headers=admin)).json()[
            "items"
        ]
    )
    assert n >= 60
    assert few <= 5 and many <= 5, (few, many)
    assert many == few

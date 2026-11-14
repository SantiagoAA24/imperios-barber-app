"""Fase 8: recordatorio por WhatsApp (reminder-sent) y «citas por revisar» (pending-review).

Escenario de ``conftest``: lunes 16-nov-2026, "ahora" = 8:00 am en Bogotá.
"""

from datetime import UTC, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.models import Appointment, AppointmentStatus
from tests.api.conftest import DAY, HOST, Clock, Env, at
from tests.api.test_me import ME, add_appt, auth, set_now
from tests.helpers import admin_headers, make_barber, make_business, make_service

pytestmark = pytest.mark.anyio

ADMIN = "/api/v1/admin"


def day_before(days: int) -> str:
    d = at("08:00").date() - timedelta(days=days)
    return d.isoformat()


# --- reminder-sent ----------------------------------------------------------------------------


async def test_reminder_sent_marca_la_hora_y_es_idempotente(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    appt = add_appt(session, env, env.ana, "10:00")
    headers = auth(session, env.ana)
    assert (await client.get(f"{ME}/appointments", params={"date": DAY}, headers=headers)).json()[
        "appointments"
    ][0]["reminder_sent_at"] is None

    first = await client.post(f"{ME}/appointments/{appt.id}/reminder-sent", headers=headers)
    assert first.status_code == 200
    assert first.json()["reminder_sent_at"] == clock.now.isoformat().replace("+00:00", "Z")

    # Repetir no falla ni cambia nada más; al reenviar solo se mueve la hora.
    clock.now += timedelta(minutes=5)
    again = await client.post(f"{ME}/appointments/{appt.id}/reminder-sent", headers=headers)
    assert again.status_code == 200
    assert again.json()["id"] == first.json()["id"] and again.json()["status"] == "booked"
    session.expire_all()
    stored = session.get(Appointment, appt.id)
    assert stored is not None and stored.reminder_sent_at == clock.now.astimezone(UTC)


async def test_reminder_sent_solo_el_barbero_dueno(
    client: AsyncClient, env: Env, session: Session
) -> None:
    ajena = add_appt(session, env, env.beto, "10:00")
    r = await client.post(
        f"{ME}/appointments/{ajena.id}/reminder-sent", headers=auth(session, env.ana)
    )
    assert r.status_code == 404 and r.json()["code"] == "appointment_not_found"
    # Sin sesión y con sesión de admin (no es barbero): tampoco.
    assert (
        await client.post(f"{ME}/appointments/{ajena.id}/reminder-sent", headers=HOST)
    ).status_code == 401
    r = await client.post(
        f"{ME}/appointments/{ajena.id}/reminder-sent", headers=admin_headers(session, env.business)
    )
    assert r.status_code == 403
    session.expire_all()
    stored = session.get(Appointment, ajena.id)
    assert stored is not None and stored.reminder_sent_at is None


async def test_reminder_sent_otro_negocio_responde_404(
    client: AsyncClient, env: Env, session: Session
) -> None:
    otro = make_business(session, "otro", "otro.test")
    zoe = make_barber(session, otro, "Zoe")
    servicio = make_service(session, otro, "Corte otro")
    ajena = add_appt_in(session, otro, zoe, servicio)
    r = await client.post(
        f"{ME}/appointments/{ajena.id}/reminder-sent", headers=auth(session, env.ana)
    )
    assert r.status_code == 404


def add_appt_in(session: Session, business, barber, service) -> Appointment:  # type: ignore[no-untyped-def]
    from app.models import AppointmentSource, Client
    from app.services.booking import hash_token

    c = Client(business_id=business.id, name="Otro", phone_e164="+573009998877")
    session.add(c)
    session.flush()
    start = at("10:00").astimezone(UTC)
    a = Appointment(
        business_id=business.id,
        barber_id=barber.id,
        client_id=c.id,
        service_id=service.id,
        starts_at=start,
        ends_at=start + timedelta(minutes=30),
        source=AppointmentSource.online,
        price_cop=1,
        duration_min=30,
        manage_token_hash=hash_token("otro-token"),
    )
    session.add(a)
    session.commit()
    return a


@pytest.mark.parametrize("status", [AppointmentStatus.attended, AppointmentStatus.cancelled])
async def test_reminder_sent_rechaza_citas_que_no_estan_pendientes(
    client: AsyncClient, env: Env, session: Session, status: AppointmentStatus
) -> None:
    appt = add_appt(session, env, env.ana, "10:00", status=status)
    r = await client.post(
        f"{ME}/appointments/{appt.id}/reminder-sent", headers=auth(session, env.ana)
    )
    assert r.status_code == 409 and r.json()["code"] == "reminder_not_applicable"


# --- pending-review ---------------------------------------------------------------------------


async def test_pending_review_del_barbero_aplica_ventana_y_estado(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "14:00")
    # Termina 11:30 am: hace 2 h 30 min -> por revisar.
    vencida = add_appt(session, env, env.ana, "11:00", name="Vencida")
    # Termina 12:00 m: hace exactamente 2 h -> todavía no (más de 2 horas).
    borde = add_appt(session, env, env.ana, "11:30", name="Borde")
    # Atendida y cancelada no cuentan.
    add_appt(session, env, env.ana, "09:00", status=AppointmentStatus.attended, name="Atendida")
    add_appt(session, env, env.ana, "10:00", status=AppointmentStatus.cancelled, name="Cancelada")
    # Hace 6 días (dentro) y hace 8 días (fuera de la ventana de 7).
    seis = add_appt(session, env, env.ana, "10:00", day=day_before(6), name="Seis días")
    add_appt(session, env, env.ana, "10:00", day=day_before(8), name="Ocho días")
    # De otro barbero.
    add_appt(session, env, env.beto, "10:00", name="De Beto")

    r = await client.get(f"{ME}/appointments/pending-review", headers=auth(session, env.ana))
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    assert [a["id"] for a in body["items"]] == [
        str(seis.id),
        str(vencida.id),
    ]  # más antigua primero
    assert str(borde.id) not in r.text and "De Beto" not in r.text

    # Un minuto después el borde ya cumple las 2 horas.
    set_now(clock, "14:01")
    again = await client.get(f"{ME}/appointments/pending-review", headers=auth(session, env.ana))
    assert again.json()["count"] == 3


async def test_pending_review_exige_barbero_y_marcar_la_saca_de_la_lista(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    assert (await client.get(f"{ME}/appointments/pending-review", headers=HOST)).status_code == 401
    r = await client.get(
        f"{ME}/appointments/pending-review", headers=admin_headers(session, env.business)
    )
    assert r.status_code == 403
    set_now(clock, "14:00")
    appt = add_appt(session, env, env.ana, "11:00")
    headers = auth(session, env.ana)
    patched = await client.patch(
        f"{ME}/appointments/{appt.id}", json={"status": "no_show"}, headers=headers
    )
    assert patched.status_code == 200
    r = await client.get(f"{ME}/appointments/pending-review", headers=headers)
    assert r.json() == {"count": 0, "items": []}


async def test_pending_review_del_admin_ve_todo_el_negocio_y_nada_de_otro(
    client: AsyncClient, env: Env, session: Session, clock: Clock
) -> None:
    set_now(clock, "14:00")
    a = add_appt(session, env, env.ana, "11:00", phone="+573004824821")
    b = add_appt(session, env, env.beto, "10:00")
    otro = make_business(session, "otro", "otro.test")
    zoe = make_barber(session, otro, "Zoe")
    add_appt_in(session, otro, zoe, make_service(session, otro, "Corte otro"))

    admin = admin_headers(session, env.business)
    r = await client.get(f"{ADMIN}/appointments/pending-review", headers=admin)
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 2
    assert [i["id"] for i in body["items"]] == [str(b.id), str(a.id)]
    assert body["items"][0]["barber"]["display_name"] == "Beto"
    assert "4824821" not in r.text and "+57" not in r.text  # celular siempre parcial
    assert (
        await client.get(f"{ADMIN}/appointments/pending-review", headers=HOST)
    ).status_code == 401
    # Un barbero no entra a la ruta del admin.
    r = await client.get(f"{ADMIN}/appointments/pending-review", headers=auth(session, env.ana))
    assert r.status_code == 403


async def test_pending_review_admin_usa_consultas_constantes(
    client: AsyncClient, env: Env, session: Session, clock: Clock, engine: Engine
) -> None:
    set_now(clock, "14:00")
    admin = admin_headers(session, env.business)

    async def count_queries() -> int:
        n = 0

        def hook(*_: object) -> None:
            nonlocal n
            n += 1

        event.listen(engine, "before_cursor_execute", hook)
        try:
            r = await client.get(f"{ADMIN}/appointments/pending-review", headers=admin)
            assert r.status_code == 200
        finally:
            event.remove(engine, "before_cursor_execute", hook)
        return n

    add_appt(session, env, env.ana, "09:00")
    few = await count_queries()
    for hhmm in ("10:00", "10:30", "11:00"):
        add_appt(session, env, env.ana, hhmm)
        add_appt(session, env, env.beto, hhmm)
    assert await count_queries() == few

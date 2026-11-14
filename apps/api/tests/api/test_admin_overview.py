"""Resumen del admin contra un conjunto de datos determinista.

Escenario: lunes 16-nov-2026, "ahora" = 8:00 am Bogotá. La semana por defecto es lunes 16 a
domingo 22. Cada cifra esperada se calcula a mano en el comentario del conjunto de datos.
"""

import itertools
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
    Barber,
    Client,
    Service,
)
from app.services.booking import hash_token
from tests.api.conftest import Clock, Env, at
from tests.helpers import admin_headers, make_barber, make_business, make_service

pytestmark = pytest.mark.anyio

URL = "/api/v1/admin/overview"
BOGOTA = ZoneInfo("America/Bogota")
A, N, C, B = (
    AppointmentStatus.attended,
    AppointmentStatus.no_show,
    AppointmentStatus.cancelled,
    AppointmentStatus.booked,
)
_tokens = itertools.count(1)
_phones = itertools.count(3_100_000_000)


@pytest.fixture
def admin(session: Session, env: Env) -> dict[str, str]:
    return admin_headers(session, env.business)


def client_created(session: Session, env: Env, name: str, created: datetime) -> Client:
    row = Client(
        business_id=env.business.id,
        name=name,
        phone_e164=f"+57{next(_phones)}",
        created_at=created.astimezone(UTC),
    )
    session.add(row)
    session.flush()
    return row


def appt(
    session: Session,
    env: Env,
    client: Client,
    barber: Barber,
    service: Service,
    day: str,
    hhmm: str,
    status: AppointmentStatus,
) -> None:
    start = at(hhmm, day).astimezone(UTC)
    session.add(
        Appointment(
            business_id=env.business.id,
            barber_id=barber.id,
            client_id=client.id,
            service_id=service.id,
            resource_id=service.resource_id,
            starts_at=start,
            ends_at=start + timedelta(minutes=service.duration_min),
            status=status,
            source=AppointmentSource.online,
            price_cop=service.price_cop,
            duration_min=service.duration_min,
            manage_token_hash=hash_token(f"ov-{next(_tokens)}"),
        )
    )
    session.flush()


@pytest.fixture
def data(session: Session, env: Env) -> dict[str, Service]:
    """
    Servicios: Corte básico $22.000 (env.basico), Corte + barba $27.000, Cejas $10.000.
    Barberos: Ana (env.ana) y Beto (env.beto).

    Citas de la semana 16-22 nov (marcadas con su número):
      Lun 16: 1 Ana 9:00 básico  atendida | 2 Ana 9:30 barba atendida
              3 Beto 9:00 básico no asistió | 4 Beto 10:00 básico cancelada
      Mar 17: 5 Ana 10:00 barba atendida | 6 Beto 11:00 básico pendiente (futuro)
      Mié 18: nada
      Jue 19: 7 Ana 15:00 barba pendiente | 8 Beto 15:00 cejas pendiente
      Dom 22: 9 Ana 23:30 básico pendiente (23:30 locales = lunes 23 04:30 UTC)
    Fuera del rango (no cuentan): dom 15 23:30 atendida (lunes 16 04:30 UTC),
      lun 23 0:00 pendiente (límite exclusivo), lun 23 10:00 atendida.
    """
    barba = make_service(session, env.business, "Corte + barba", price_cop=27_000)
    cejas = make_service(session, env.business, "Cejas", price_cop=10_000)
    basico = env.basico
    assert basico.price_cop == 22_000

    old = datetime(2026, 11, 10, 12, 0, tzinfo=BOGOTA)
    c1 = client_created(session, env, "Cliente Uno", old)  # antes del rango
    c2 = client_created(session, env, "Cliente Dos", old)  # antes del rango
    c3 = client_created(session, env, "Cliente Tres", datetime(2026, 11, 16, 12, 0, tzinfo=BOGOTA))
    c4 = client_created(
        session, env, "Cliente Cuatro", datetime(2026, 11, 16, 12, 5, tzinfo=BOGOTA)
    )
    # Domingo 22 a las 23:50 locales (= lunes 23 04:50 UTC): sigue dentro del rango.
    c5 = client_created(
        session, env, "Cliente Cinco", datetime(2026, 11, 22, 23, 50, tzinfo=BOGOTA)
    )
    # Lunes 23 a las 0:00 locales: fuera del rango.
    c6 = client_created(session, env, "Cliente Seis", datetime(2026, 11, 23, 0, 0, tzinfo=BOGOTA))

    ana, beto = env.ana, env.beto
    appt(session, env, c1, ana, basico, "2026-11-16", "09:00", A)  # 1
    appt(session, env, c2, ana, barba, "2026-11-16", "09:30", A)  # 2
    appt(session, env, c3, beto, basico, "2026-11-16", "09:00", N)  # 3
    appt(session, env, c4, beto, basico, "2026-11-16", "10:00", C)  # 4
    appt(session, env, c1, ana, barba, "2026-11-17", "10:00", A)  # 5
    appt(session, env, c5, beto, basico, "2026-11-17", "11:00", B)  # 6
    appt(session, env, c2, ana, barba, "2026-11-19", "15:00", B)  # 7
    appt(session, env, c3, beto, cejas, "2026-11-19", "15:00", B)  # 8
    appt(session, env, c4, ana, basico, "2026-11-22", "23:30", B)  # 9
    # Fuera del rango.
    appt(session, env, c1, ana, basico, "2026-11-15", "23:30", A)
    appt(session, env, c6, beto, basico, "2026-11-23", "00:00", B)
    appt(session, env, c6, ana, basico, "2026-11-23", "10:00", A)
    session.commit()
    return {"basico": basico, "barba": barba, "cejas": cejas}


async def test_resumen_de_la_semana_actual_por_defecto(
    client: AsyncClient, env: Env, clock: Clock, admin: dict[str, str], data: dict[str, Service]
) -> None:
    r = await client.get(URL, headers=admin)
    assert r.status_code == 200, r.text
    body = r.json()
    # Sin parámetros: lunes 16 a domingo 22 (semana de "ahora").
    assert (body["date_from"], body["date_to"]) == ("2026-11-16", "2026-11-22")

    # Ingresos: solo atendidas del rango: citas 1 (22.000) + 2 (27.000) + 5 (27.000) = 76.000.
    assert body["revenue_cop"] == 76_000
    # Proyectado: pendientes futuras: 6 (22.000) + 7 (27.000) + 8 (10.000) + 9 (22.000) = 81.000.
    assert body["projected_cop"] == 81_000
    # Citas sin contar canceladas: 1,2,3,5,6,7,8,9 = 8; atendidas 1,2,5 = 3; no asistió 3 = 1;
    # canceladas 4 = 1; pendientes 6,7,8,9 = 4.
    assert body["appointments"] == {
        "total": 8,
        "attended": 3,
        "no_show": 1,
        "cancelled": 1,
        "booked": 4,
    }
    # Asistencia: 3 / (3 + 1) = 0,75 (las pendientes y canceladas no cuentan).
    assert body["attendance_rate"] == 0.75
    # Clientes nuevos creados en el rango: Tres, Cuatro y Cinco (22 a las 23:50 locales) = 3;
    # Uno y Dos son anteriores y Seis es del 23.
    assert body["new_clients"] == 3

    # Ingresos por día: los siete días, también los de cero. Cuenta = citas no canceladas.
    #   16: ingresos 22.000+27.000 = 49.000, citas 1,2,3 = 3   | 17: 27.000, citas 5,6 = 2
    #   18: 0, 0   | 19: 0 ingresos, citas 7,8 = 2   | 20: 0, 0   | 21: 0, 0
    #   22: 0 ingresos, cita 9 = 1 (cae el domingo local aunque en UTC sea lunes)
    assert body["revenue_by_day"] == [
        {"date": "2026-11-16", "revenue_cop": 49_000, "count": 3},
        {"date": "2026-11-17", "revenue_cop": 27_000, "count": 2},
        {"date": "2026-11-18", "revenue_cop": 0, "count": 0},
        {"date": "2026-11-19", "revenue_cop": 0, "count": 2},
        {"date": "2026-11-20", "revenue_cop": 0, "count": 0},
        {"date": "2026-11-21", "revenue_cop": 0, "count": 0},
        {"date": "2026-11-22", "revenue_cop": 0, "count": 1},
    ]
    assert sum(d["revenue_cop"] for d in body["revenue_by_day"]) == body["revenue_cop"]
    assert sum(d["count"] for d in body["revenue_by_day"]) == body["appointments"]["total"]

    # Servicios por cantidad (no canceladas): básico 1,3,6,9 = 4 (ingresos: solo la 1 = 22.000);
    # barba 2,5,7 = 3 (ingresos 2 y 5 = 54.000); cejas 8 = 1 (ingresos 0).
    names = [(s["name"], s["count"], s["revenue_cop"]) for s in body["top_services"]]
    assert names == [
        ("Corte básico", 4, 22_000),
        ("Corte + barba", 3, 54_000),
        ("Cejas", 1, 0),
    ]
    # Por barbero: Ana 1,2,5,7,9 = 5 citas, ingresos 76.000, 0 faltas;
    # Beto 3,6,8 = 3 citas (la 4 está cancelada), ingresos 0, 1 falta (la 3).
    assert [
        (b["display_name"], b["count"], b["revenue_cop"], b["no_show"]) for b in body["by_barber"]
    ] == [("Ana", 5, 76_000, 0), ("Beto", 3, 0, 1)]


async def test_rango_pedido_mes_completo_y_otro_rango(
    client: AsyncClient, env: Env, clock: Clock, admin: dict[str, str], data: dict[str, Service]
) -> None:
    # Solo el lunes 16: atendidas 1 y 2 = 49.000; sin pendientes futuras... la 6 es del martes.
    r = await client.get(URL, params={"from": "2026-11-16", "to": "2026-11-16"}, headers=admin)
    body = r.json()
    assert body["revenue_cop"] == 49_000 and body["projected_cop"] == 0
    assert body["appointments"] == {
        "total": 3,
        "attended": 2,
        "no_show": 1,
        "cancelled": 1,
        "booked": 0,
    }
    assert body["attendance_rate"] == round(2 / 3, 4)
    assert len(body["revenue_by_day"]) == 1
    # Un rango que incluye la semana anterior y la siguiente: suma las tres semanas.
    r = await client.get(URL, params={"from": "2026-11-15", "to": "2026-11-23"}, headers=admin)
    body = r.json()
    # + atendida del dom 15 (22.000) + atendida del lun 23 10:00 (22.000) = 76.000 + 44.000.
    assert body["revenue_cop"] == 120_000
    assert len(body["revenue_by_day"]) == 9
    # El 23 a las 0:00 (pendiente) entra y el 22 a las 23:30 no se repite en el 23.
    assert body["appointments"]["booked"] == 5 and body["appointments"]["attended"] == 5


async def test_dias_sin_citas_y_rango_vacio(
    client: AsyncClient, env: Env, clock: Clock, admin: dict[str, str]
) -> None:
    r = await client.get(URL, params={"from": "2026-12-01", "to": "2026-12-03"}, headers=admin)
    body = r.json()
    assert body["revenue_cop"] == 0 and body["projected_cop"] == 0
    assert body["attendance_rate"] is None  # 0 atendidas + 0 inasistencias: sin denominador
    assert body["appointments"] == {
        "total": 0,
        "attended": 0,
        "no_show": 0,
        "cancelled": 0,
        "booked": 0,
    }
    assert body["revenue_by_day"] == [
        {"date": d, "revenue_cop": 0, "count": 0}
        for d in ("2026-12-01", "2026-12-02", "2026-12-03")
    ]
    assert body["top_services"] == [] and body["by_barber"] == [] and body["new_clients"] == 0


async def test_limites_del_rango(
    client: AsyncClient, env: Env, clock: Clock, admin: dict[str, str]
) -> None:
    ok = await client.get(URL, params={"from": "2026-01-01", "to": "2026-12-31"}, headers=admin)
    assert ok.status_code == 200 and len(ok.json()["revenue_by_day"]) == 365
    leap = await client.get(URL, params={"from": "2028-01-01", "to": "2028-12-31"}, headers=admin)
    assert leap.status_code == 200 and len(leap.json()["revenue_by_day"]) == 366  # bisiesto
    big = await client.get(URL, params={"from": "2026-01-01", "to": "2027-01-02"}, headers=admin)
    assert big.status_code == 422 and big.json()["code"] == "range_too_large"
    back = await client.get(URL, params={"from": "2026-11-20", "to": "2026-11-19"}, headers=admin)
    assert back.status_code == 422 and back.json()["code"] == "invalid_range"
    half = await client.get(URL, params={"from": "2026-11-20"}, headers=admin)
    assert half.status_code == 422
    assert (
        await client.get(URL, params={"from": "no", "to": "2026-11-19"}, headers=admin)
    ).status_code == 422


async def test_la_semana_por_defecto_sigue_la_hora_de_bogota(
    client: AsyncClient, env: Env, clock: Clock, admin: dict[str, str]
) -> None:
    # Domingo 22 a las 11:30 pm en Bogotá = lunes 23 04:30 UTC: la semana sigue siendo 16-22.
    clock.now = at("23:30", "2026-11-22").astimezone(UTC)
    body = (await client.get(URL, headers=admin)).json()
    assert (body["date_from"], body["date_to"]) == ("2026-11-16", "2026-11-22")
    clock.now = at("00:00", "2026-11-23").astimezone(UTC)
    body = (await client.get(URL, headers=admin)).json()
    assert (body["date_from"], body["date_to"]) == ("2026-11-23", "2026-11-29")


async def test_aislamiento_entre_negocios(
    client: AsyncClient,
    session: Session,
    env: Env,
    clock: Clock,
    admin: dict[str, str],
    data: dict[str, Service],
) -> None:
    other = make_business(session, "otro", "otro.test")
    foreign_barber = make_barber(session, other, "Ajena")
    foreign_service = make_service(session, other, "Ajeno", price_cop=99_000)
    foreign_client = Client(business_id=other.id, name="Ajeno", phone_e164="+573009998877")
    session.add(foreign_client)
    session.flush()
    start = at("10:00", "2026-11-17").astimezone(UTC)
    session.add(
        Appointment(
            business_id=other.id,
            barber_id=foreign_barber.id,
            client_id=foreign_client.id,
            service_id=foreign_service.id,
            starts_at=start,
            ends_at=start + timedelta(minutes=30),
            status=A,
            source=AppointmentSource.online,
            price_cop=99_000,
            duration_min=30,
            manage_token_hash=hash_token("otro-negocio"),
        )
    )
    session.commit()
    mine = (await client.get(URL, headers=admin)).json()
    assert mine["revenue_cop"] == 76_000  # sin los 99.000 del otro negocio
    assert "Ajeno" not in [s["name"] for s in mine["top_services"]]
    assert "Ajena" not in [b["display_name"] for b in mine["by_barber"]]
    admin_b = admin_headers(session, other, host="otro.test")
    theirs = (await client.get(URL, headers=admin_b)).json()
    assert theirs["revenue_cop"] == 99_000 and theirs["appointments"]["total"] == 1
    assert theirs["new_clients"] == 0  # su cliente se creó "ahora", no en esa semana


async def test_el_cambio_de_precio_no_altera_lo_ya_atendido(
    client: AsyncClient,
    session: Session,
    env: Env,
    clock: Clock,
    admin: dict[str, str],
    data: dict[str, Service],
) -> None:
    """Los ingresos usan el precio copiado en la cita, no el actual del servicio."""
    barba = session.get(Service, data["barba"].id)
    assert barba is not None
    barba.price_cop = 40_000
    session.commit()
    assert (await client.get(URL, headers=admin)).json()["revenue_cop"] == 76_000


async def test_con_50000_citas_semana_y_mes_usan_el_indice_y_el_ano_responde_rapido(
    session: Session, env: Env
) -> None:
    """EXPLAIN con 50.000 citas repartidas en dos años: una semana y un mes no barren la tabla."""
    from app.models import Business
    from app.services import admin_overview

    client_row = Client(business_id=env.business.id, name="Masivo", phone_e164="+573000000001")
    session.add(client_row)
    session.commit()
    session.execute(
        text(
            """
            INSERT INTO appointment (business_id, barber_id, client_id, service_id, starts_at,
                                     ends_at, status, source, price_cop, duration_min,
                                     manage_token_hash)
            SELECT :biz, :barber, :client, :svc,
                   TIMESTAMPTZ '2025-01-01 13:00+00' + g * interval '21 minutes',
                   TIMESTAMPTZ '2025-01-01 13:00+00' + g * interval '21 minutes'
                       + interval '10 minutes',
                   (ARRAY['attended','attended','attended','no_show','booked','cancelled'])
                       [1 + g % 6]::appointment_status,
                   'online', 20000 + (g % 8) * 1000, 30, md5(g::text)
            FROM generate_series(1, 50000) g
            """
        ),
        {
            "biz": env.business.id,
            "barber": env.ana.id,
            "client": client_row.id,
            "svc": env.basico.id,
        },
    )
    session.commit()
    session.execute(text("ANALYZE appointment"))
    session.commit()

    business = session.get(Business, env.business.id)
    assert business is not None
    now = datetime(2026, 3, 1, tzinfo=UTC)
    bind = session.get_bind()
    captured: list[tuple[str, object]] = []

    def capture(conn: object, cur: object, stmt: str, params: object, *a: object) -> None:
        captured.append((stmt, params))

    for first, last in (("2025-06-02", "2025-06-08"), ("2025-06-01", "2025-06-30")):
        captured.clear()
        event.listen(bind, "before_cursor_execute", capture)
        try:
            result = admin_overview.overview(
                session,
                business,
                datetime.fromisoformat(first).date(),
                datetime.fromisoformat(last).date(),
                now,
            )
        finally:
            event.remove(bind, "before_cursor_execute", capture)
        assert result.appointments.total > 0
        heavy = [(s, p) for s, p in captured if "FROM appointment" in s or "JOIN appointment" in s]
        assert len(heavy) == 4  # totales, por día, servicios, barberos
        for stmt, params in heavy:
            plan = "\n".join(
                row[0]
                for row in session.connection().exec_driver_sql("EXPLAIN " + stmt, params)  # type: ignore[arg-type]
            )
            assert "ix_appointment_business_id_starts_at" in plan, plan
            assert "Seq Scan on appointment" not in plan, plan

    # Un año entero lee la mitad de la tabla: aquí el barrido es la decisión correcta del
    # planificador (un índice «cubriente» se probó y no lo cambia). Solo se exige que responda.
    import time

    t0 = time.perf_counter()
    year = admin_overview.overview(
        session, business, datetime(2025, 1, 1).date(), datetime(2025, 12, 31).date(), now
    )
    assert time.perf_counter() - t0 < 2.0
    assert len(year.revenue_by_day) == 365

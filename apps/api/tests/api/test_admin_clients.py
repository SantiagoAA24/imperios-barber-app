"""Clientes del admin: búsqueda sin tildes, filtros, cursor, celular completo solo en el detalle.

Datos deterministas (cada cifra se verifica a mano en el comentario de la prueba).
"""

import itertools
from datetime import UTC, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
    AuditLog,
    Client,
    Service,
)
from app.services.booking import hash_token
from tests.api.conftest import DAY, Env, at
from tests.helpers import admin_headers, make_business, make_service

pytestmark = pytest.mark.anyio

URL = "/api/v1/admin/clients"


@pytest.fixture
def admin(session: Session, env: Env) -> dict[str, str]:
    return admin_headers(session, env.business)


_tokens = itertools.count(1)
_hours = itertools.count(0)


def appt_for(
    session: Session,
    env: Env,
    client: Client,
    day: str,
    status: AppointmentStatus,
    service: Service | None = None,
    hhmm: str = "10:00",
) -> Appointment:
    service = service or env.basico
    start = at(hhmm, day).astimezone(UTC)
    appointment = Appointment(
        business_id=env.business.id,
        barber_id=env.ana.id,
        client_id=client.id,
        service_id=service.id,
        resource_id=service.resource_id,
        starts_at=start,
        ends_at=start + timedelta(minutes=service.duration_min),
        status=status,
        source=AppointmentSource.online,
        price_cop=service.price_cop,
        duration_min=service.duration_min,
        manage_token_hash=hash_token(f"cli-{next(_tokens)}"),
    )
    session.add(appointment)
    session.flush()
    return appointment


def make_client(session: Session, env: Env, name: str, phone: str | None) -> Client:
    client = Client(business_id=env.business.id, name=name, phone_e164=phone)
    session.add(client)
    session.flush()
    return client


def history(
    session: Session,
    env: Env,
    name: str,
    phone: str,
    statuses: list[AppointmentStatus],
) -> Client:
    """Un cliente con una cita por estado, en días distintos (una por día desde el 2026-10-01)."""
    client = make_client(session, env, name, phone)
    # Una hora distinta por cliente: todos comparten barbero y las restricciones lo exigen.
    hhmm = f"{6 + next(_hours):02d}:00"
    for i, st in enumerate(statuses, start=1):
        appt_for(session, env, client, f"2026-10-{i:02d}", st, hhmm=hhmm)
    session.commit()
    return client


def seed_clients(session: Session, env: Env) -> dict[str, Client]:
    global _hours
    _hours = itertools.count(0)  # cada prueba empieza en las 6:00
    A, N, C, B = (
        AppointmentStatus.attended,
        AppointmentStatus.no_show,
        AppointmentStatus.cancelled,
        AppointmentStatus.booked,
    )
    out = {
        # 6 atendidas: frecuente, sin inasistencias -> 100 %.
        "carlos": history(session, env, "Carlos Martínez", "+573004824821", [A] * 6),
        # 3 atendidas + 1 inasistencia + 1 cancelada: 3/4 = 0,75; 4 citas no canceladas.
        "andres": history(session, env, "Andrés Rojas", "+573152092094", [A, A, A, N, C]),
        # 5 atendidas + 2 inasistencias: frecuente y con faltas; 5/7.
        "jose": history(session, env, "José Peña", "+573205555518", [A] * 5 + [N, N]),
        # Solo una pendiente: sin tasa todavía.
        "nuevo": history(session, env, "Nuevo Cliente", "+573019999087", [B]),
        # Sin citas.
        "ninia": make_client(session, env, "Niña Muñoz", "+573123333365"),
    }
    session.commit()
    return out


async def test_lista_con_estadisticas_y_celular_parcial(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    c = seed_clients(session, env)
    r = await client.get(URL, headers=admin)
    assert r.status_code == 200
    body = r.json()
    by_name = {i["name"]: i for i in body["items"]}
    assert body["total"] == 5 and body["next_cursor"] is None
    carlos = by_name["Carlos Martínez"]
    assert carlos["appointments_count"] == 6 and carlos["attendance_rate"] == 1.0
    assert carlos["no_show_count"] == 0 and carlos["phone_masked"] == "300 *** 4821"
    assert carlos["last_visit_at"].startswith("2026-10-06")  # la 6.ª atendida
    andres = by_name["Andrés Rojas"]
    # 4 no canceladas, 3/(3+1) = 0,75, una inasistencia.
    assert (andres["appointments_count"], andres["attendance_rate"], andres["no_show_count"]) == (
        4,
        0.75,
        1,
    )
    jose = by_name["José Peña"]
    assert (jose["appointments_count"], jose["no_show_count"]) == (7, 2)
    assert jose["attendance_rate"] == round(5 / 7, 4)
    nuevo = by_name["Nuevo Cliente"]
    assert nuevo["attendance_rate"] is None and nuevo["last_visit_at"] is None
    assert nuevo["appointments_count"] == 1
    nina = by_name["Niña Muñoz"]
    assert nina["appointments_count"] == 0 and nina["attendance_rate"] is None
    # Ningún celular completo en toda la respuesta.
    for full in ("4824821", "+57", "2092094", "5555518"):
        assert full not in r.text
    assert c["carlos"].id is not None
    # Orden alfabético estable.
    assert [i["name"] for i in body["items"]] == sorted(
        (i["name"] for i in body["items"]), key=str.lower
    )


async def test_filtros_frecuentes_e_inasistencias(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    seed_clients(session, env)
    frequent = (await client.get(URL, params={"filter": "frequent"}, headers=admin)).json()
    # 5 o más atendidas: Carlos (6) y José (5); Andrés tiene 3.
    assert sorted(i["name"] for i in frequent["items"]) == ["Carlos Martínez", "José Peña"]
    assert frequent["total"] == 2
    no_show = (await client.get(URL, params={"filter": "no_show"}, headers=admin)).json()
    assert sorted(i["name"] for i in no_show["items"]) == ["Andrés Rojas", "José Peña"]
    both = await client.get(URL, params={"filter": "no_show", "q": "jose"}, headers=admin)
    assert [i["name"] for i in both.json()["items"]] == ["José Peña"]
    assert (await client.get(URL, params={"filter": "otro"}, headers=admin)).status_code == 422


async def test_busqueda_sin_tildes_ni_mayusculas_y_por_ultimos_digitos(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    seed_clients(session, env)

    async def names(q: str) -> list[str]:
        r = await client.get(URL, params={"q": q}, headers=admin)
        assert r.status_code == 200
        return [i["name"] for i in r.json()["items"]]

    assert await names("jose") == ["José Peña"]
    assert await names("JOSÉ") == ["José Peña"]
    assert await names("andres") == ["Andrés Rojas"]
    assert await names("martinez") == ["Carlos Martínez"]
    assert await names("peña") == ["José Peña"]
    assert await names("pena") == ["José Peña"]
    assert await names("nina") == ["Niña Muñoz"]  # ñ cuenta como n
    assert await names("muñoz") == ["Niña Muñoz"]
    # Últimos dígitos del celular; también con espacios o puntos de separación.
    assert await names("4821") == ["Carlos Martínez"]
    assert await names("300 482 1") == []  # no son los últimos dígitos
    assert await names("482 1") == ["Carlos Martínez"]
    assert await names("+573004824821") == ["Carlos Martínez"]
    assert await names("0000") == []
    # Caracteres de LIKE se tratan como texto.
    assert await names("%") == []
    assert await names("_") == []
    assert await names("zzz") == []


async def test_paginacion_por_cursor_sin_repetir_ni_saltar(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    for i in range(7):
        session.add(
            Client(
                business_id=env.business.id,
                name=f"Cliente {i:02d}",
                phone_e164=f"+57300000{i:04d}",
            )
        )
    # Dos con el mismo nombre: el desempate es el id.
    for _ in range(2):
        session.add(Client(business_id=env.business.id, name="Repetido", phone_e164=None))
    session.commit()
    seen: list[str] = []
    cursor: str | None = None
    pages = 0
    while True:
        params: dict[str, str | int] = {"limit": 4}
        if cursor:
            params["cursor"] = cursor
        r = await client.get(URL, params=params, headers=admin)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 9
        seen += [i["id"] for i in body["items"]]
        pages += 1
        cursor = body["next_cursor"]
        if cursor is None:
            break
    assert pages == 3 and len(seen) == 9 and len(set(seen)) == 9
    assert (await client.get(URL, params={"cursor": "basura"}, headers=admin)).status_code == 422
    assert (await client.get(URL, params={"limit": 0}, headers=admin)).status_code == 422
    assert (await client.get(URL, params={"limit": 51}, headers=admin)).status_code == 422


async def test_detalle_trae_celular_completo_y_deja_rastro_en_audit_log(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    c = seed_clients(session, env)
    # Lista: nada en audit_log.
    await client.get(URL, headers=admin)
    assert session.query(AuditLog).count() == 0

    r = await client.get(f"{URL}/{c['carlos'].id}", headers=admin)
    assert r.status_code == 200
    d = r.json()
    assert d["phone"] == "+573004824821"
    assert d["visits"] == 6 and d["no_show_count"] == 0
    assert d["favorite_service"] == "Corte básico"
    assert len(d["recent_appointments"]) == 6
    assert d["recent_appointments"][0]["starts_at"] > d["recent_appointments"][-1]["starts_at"]
    assert d["recent_appointments"][0]["barber_name"] == "Ana"
    # Una fila de auditoría por cada lectura.
    session.expire_all()
    rows = session.query(AuditLog).all()
    assert len(rows) == 1
    row = rows[0]
    assert (row.action, row.entity, row.entity_id) == (
        "view_client_phone",
        "client",
        c["carlos"].id,
    )
    assert row.business_id == env.business.id and row.at is not None
    await client.get(f"{URL}/{c['carlos'].id}", headers=admin)
    session.expire_all()
    assert session.query(AuditLog).count() == 2
    # Y el detalle recorta a las últimas 10 citas.
    jose = (await client.get(f"{URL}/{c['jose'].id}", headers=admin)).json()
    assert (
        jose["visits"] == 5 and jose["no_show_count"] == 2 and len(jose["recent_appointments"]) == 7
    )


async def test_detalle_limita_a_diez_citas_y_elige_el_servicio_favorito(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    row = make_client(session, env, "Favorito Uno", "+573007770000")
    for i in range(1, 14):
        service = env.facial if i % 3 == 0 else env.basico
        appt_for(session, env, row, f"2026-10-{i:02d}", AppointmentStatus.attended, service)
    session.commit()
    d = (await client.get(f"{URL}/{row.id}", headers=admin)).json()
    assert len(d["recent_appointments"]) == 10
    # 13 atendidas: los días 3, 6, 9 y 12 son de facial (4); las otras 9, de corte básico.
    assert d["favorite_service"] == "Corte básico" and d["visits"] == 13


async def test_notas_maximo_500_y_se_guardan(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    c = seed_clients(session, env)
    r = await client.patch(
        f"{URL}/{c['carlos'].id}", json={"notes": "  Prefiere degradado bajo. "}, headers=admin
    )
    assert r.status_code == 200 and r.json()["notes"] == "Prefiere degradado bajo."
    assert "phone" not in r.json()  # guardar notas no expone el celular
    detail = (await client.get(f"{URL}/{c['carlos'].id}", headers=admin)).json()
    assert detail["notes"] == "Prefiere degradado bajo."
    assert (
        await client.patch(f"{URL}/{c['carlos'].id}", json={"notes": "x" * 500}, headers=admin)
    ).status_code == 200
    assert (
        await client.patch(f"{URL}/{c['carlos'].id}", json={"notes": "x" * 501}, headers=admin)
    ).status_code == 422
    cleared = await client.patch(f"{URL}/{c['carlos'].id}", json={"notes": "  "}, headers=admin)
    assert cleared.json()["notes"] is None
    assert (
        await client.patch(f"{URL}/{c['carlos'].id}", json={"phone": "1"}, headers=admin)
    ).status_code == 422


async def test_aislamiento_entre_negocios(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    seed_clients(session, env)
    other = make_business(session, "otro", "otro.test")
    foreign = Client(business_id=other.id, name="Ajeno Secreto", phone_e164="+573009998877")
    session.add(foreign)
    session.commit()
    make_service(session, other, "Ajeno")
    admin_b = admin_headers(session, other, host="otro.test")

    names_a = [i["name"] for i in (await client.get(URL, headers=admin)).json()["items"]]
    assert "Ajeno Secreto" not in names_a
    assert (await client.get(URL, params={"q": "9998877"}, headers=admin)).json()["items"] == []
    assert (await client.get(URL, params={"q": "secreto"}, headers=admin)).json()["total"] == 0
    names_b = [i["name"] for i in (await client.get(URL, headers=admin_b)).json()["items"]]
    assert names_b == ["Ajeno Secreto"]
    # A no puede leer ni editar el cliente de B (404) y no queda rastro de auditoría.
    assert (await client.get(f"{URL}/{foreign.id}", headers=admin)).status_code == 404
    assert (
        await client.patch(f"{URL}/{foreign.id}", json={"notes": "x"}, headers=admin)
    ).status_code == 404
    session.expire_all()
    assert session.query(AuditLog).count() == 0
    assert session.get(Client, foreign.id).notes is None  # type: ignore[union-attr]


async def test_una_cita_cancelada_no_cuenta(
    client: AsyncClient, session: Session, env: Env, admin: dict[str, str]
) -> None:
    row = make_client(session, env, "Solo Cancelada", "+573001112233")
    appt_for(session, env, row, DAY, AppointmentStatus.cancelled)
    session.commit()
    (item,) = (await client.get(URL, headers=admin)).json()["items"]
    assert item["appointments_count"] == 0 and item["attendance_rate"] is None

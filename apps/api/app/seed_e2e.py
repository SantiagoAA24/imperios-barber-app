"""Historial determinista SOLO para las pruebas E2E del resumen: ``python -m app.seed_e2e``.

Se ejecuta después de ``app.seed`` (``scripts/e2e-setup.sh``). Crea citas pasadas fijas en la
semana del lunes 5 al domingo 11 de enero de 2026 (hora de Bogotá), con cifras conocidas:

    Lun 5: B1 10:00 básico $22.000 atendida | B1 10:30 barba $27.000 atendida
           B2 10:00 básico no asistió
    Mar 6: B2 11:00 básico atendida | B1 11:00 básico cancelada
    Jue 8: B1 15:00 barba atendida
    Sáb 10: B2 9:00 básico atendida | B2 9:30 limpieza facial $35.000 atendida

    Citas sin contar canceladas 7; atendidas 6; no asistió 1; canceladas 1; pendientes 0.
    Ingresos 155.000 (49.000 + 22.000 + 0 + 27.000 + 0 + 57.000 + 0); asistencia 6/7 = 86 %.
    Clientes nuevos 3 (el cuarto cliente es de diciembre).
"""

import hashlib
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
    Barber,
    Business,
    Client,
    Service,
)

BOGOTA = ZoneInfo("America/Bogota")
A, N, C = AppointmentStatus.attended, AppointmentStatus.no_show, AppointmentStatus.cancelled

CLIENTS = [
    # (nombre, celular, creado)
    ("Historial Antiguo", "+573000000101", datetime(2025, 12, 20, 12, 0, tzinfo=BOGOTA)),
    ("Historial Dos", "+573000000102", datetime(2026, 1, 5, 12, 0, tzinfo=BOGOTA)),
    ("Historial Tres", "+573000000103", datetime(2026, 1, 6, 12, 0, tzinfo=BOGOTA)),
    ("Historial Cuatro", "+573000000104", datetime(2026, 1, 10, 8, 0, tzinfo=BOGOTA)),
]
# (cliente, barbero, servicio, día, hora, estado)
APPOINTMENTS = [
    (0, "Barbero 1", "Corte básico", (2026, 1, 5), (10, 0), A),
    (1, "Barbero 1", "Corte + barba", (2026, 1, 5), (10, 30), A),
    (2, "Barbero 2", "Corte básico", (2026, 1, 5), (10, 0), N),
    (1, "Barbero 2", "Corte básico", (2026, 1, 6), (11, 0), A),
    (3, "Barbero 1", "Corte básico", (2026, 1, 6), (11, 0), C),
    (0, "Barbero 1", "Corte + barba", (2026, 1, 8), (15, 0), A),
    (2, "Barbero 2", "Corte básico", (2026, 1, 10), (9, 0), A),
    (3, "Barbero 2", "Limpieza facial", (2026, 1, 10), (9, 30), A),
]


def seed_history(session: Session) -> None:
    business = session.scalar(select(Business).where(Business.slug == "imperio"))
    assert business is not None, "Ejecuta primero app.seed"
    if session.scalar(select(Client.id).where(Client.phone_e164 == CLIENTS[0][1])):
        return  # idempotente
    barbers = {
        b.display_name: b
        for b in session.scalars(select(Barber).where(Barber.business_id == business.id))
    }
    services = {
        s.name: s
        for s in session.scalars(select(Service).where(Service.business_id == business.id))
    }
    clients = []
    for name, phone, created in CLIENTS:
        row = Client(
            business_id=business.id, name=name, phone_e164=phone, created_at=created.astimezone(UTC)
        )
        session.add(row)
        clients.append(row)
    session.flush()
    for i, (who, barber, service, (y, m, d), (hh, mm), status) in enumerate(APPOINTMENTS):
        svc = services[service]
        start = datetime(y, m, d, hh, mm, tzinfo=BOGOTA).astimezone(UTC)
        session.add(
            Appointment(
                business_id=business.id,
                barber_id=barbers[barber].id,
                client_id=clients[who].id,
                service_id=svc.id,
                resource_id=svc.resource_id,
                starts_at=start,
                ends_at=start + timedelta(minutes=svc.duration_min),
                status=status,
                source=AppointmentSource.manual,
                price_cop=svc.price_cop,
                duration_min=svc.duration_min,
                manage_token_hash=hashlib.sha256(f"e2e-historial-{i}".encode()).hexdigest(),
            )
        )


def main() -> None:
    with SessionLocal() as session, session.begin():
        seed_history(session)
    print("Historial E2E listo.")


if __name__ == "__main__":
    main()

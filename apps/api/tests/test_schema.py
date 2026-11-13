"""Pruebas del esquema contra PostgreSQL real (restricciones de exclusión, CHECK, únicos)."""

import itertools
import uuid
from datetime import UTC, datetime, time

import psycopg.errors
import pytest
from alembic import command
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    AppointmentSource,
    AppointmentStatus,
    Barber,
    Business,
    Client,
    Resource,
    Service,
    User,
    UserRole,
)
from tests.conftest import alembic_config

_tokens = itertools.count()


def at(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, 16, hour, minute, tzinfo=UTC)


def make_business(session: Session, slug: str = "imperio") -> Business:
    b = Business(name=slug, slug=slug)
    session.add(b)
    session.flush()
    return b


def make_barber(session: Session, business: Business, n: int = 1) -> Barber:
    u = User(
        business_id=business.id,
        role=UserRole.barber,
        name=f"Barbero {n}",
        email=f"b{n}-{uuid.uuid4().hex[:6]}@imperio.test",
        password_hash="x",
    )
    session.add(u)
    session.flush()
    b = Barber(business_id=business.id, user_id=u.id, display_name=f"Barbero {n}")
    session.add(b)
    session.flush()
    return b


def make_client(session: Session, business: Business, phone: str | None = None) -> Client:
    c = Client(business_id=business.id, name="Cliente", phone_e164=phone)
    session.add(c)
    session.flush()
    return c


def make_service(
    session: Session, business: Business, resource: Resource | None = None, **kw: int
) -> Service:
    s = Service(
        business_id=business.id,
        name=f"Servicio {next(_tokens)}",
        price_cop=kw.get("price_cop", 22_000),
        duration_min=kw.get("duration_min", 30),
        resource_id=resource.id if resource else None,
    )
    session.add(s)
    session.flush()
    return s


class World:
    """Negocio con dos barberos, un cliente, un vaporizador y servicios con y sin recurso."""

    def __init__(self, session: Session) -> None:
        self.session = session
        self.business = make_business(session)
        self.barber1 = make_barber(session, self.business, 1)
        self.barber2 = make_barber(session, self.business, 2)
        self.client = make_client(session, self.business)
        self.vaporizer = Resource(business_id=self.business.id, name="Vaporizador")
        session.add(self.vaporizer)
        session.flush()
        self.plain = make_service(session, self.business)
        self.steam = make_service(session, self.business, self.vaporizer)

    def appointment(
        self,
        barber: Barber,
        start: datetime,
        end: datetime,
        *,
        service: Service | None = None,
        status: AppointmentStatus = AppointmentStatus.booked,
        **overrides: object,
    ) -> Appointment:
        service = service or self.plain
        values: dict[str, object] = {
            "business_id": self.business.id,
            "barber_id": barber.id,
            "client_id": self.client.id,
            "service_id": service.id,
            "resource_id": service.resource_id,
            "starts_at": start,
            "ends_at": end,
            "status": status,
            "source": AppointmentSource.online,
            "price_cop": service.price_cop,
            "duration_min": service.duration_min,
            "manage_token_hash": uuid.uuid4().hex,
        }
        values.update(overrides)
        appt = Appointment(**values)
        self.session.add(appt)
        self.session.flush()
        return appt


@pytest.fixture
def world(session: Session) -> World:
    return World(session)


def sqlstate(exc: IntegrityError) -> str | None:
    orig = exc.orig
    return orig.sqlstate if isinstance(orig, psycopg.Error) else None


# --- Solapes de barbero ---------------------------------------------------------------


def test_citas_solapadas_del_mismo_barbero_fallan(world: World) -> None:
    world.appointment(world.barber1, at(10), at(10, 45))
    with pytest.raises(IntegrityError) as exc:
        world.appointment(world.barber1, at(10, 30), at(11))
    assert sqlstate(exc.value) == "23P01"
    assert isinstance(exc.value.orig, psycopg.errors.ExclusionViolation)


def test_citas_contiguas_del_mismo_barbero_se_guardan(world: World) -> None:
    world.appointment(world.barber1, at(10), at(10, 45))
    world.appointment(world.barber1, at(10, 45), at(11, 15))  # rango [): no se solapan
    world.session.commit()


def test_barberos_distintos_misma_hora_sin_recurso_se_guardan(world: World) -> None:
    world.appointment(world.barber1, at(10), at(10, 30))
    world.appointment(world.barber2, at(10), at(10, 30))
    world.session.commit()


# --- Solapes de recurso -----------------------------------------------------------------


def test_barberos_distintos_misma_hora_con_vaporizador_fallan(world: World) -> None:
    world.appointment(world.barber1, at(10), at(11), service=world.steam)
    with pytest.raises(IntegrityError) as exc:
        world.appointment(world.barber2, at(10), at(11), service=world.steam)
    assert sqlstate(exc.value) == "23P01"
    assert "appointment_no_resource_overlap" in str(exc.value.orig)


def test_vaporizador_contiguo_se_guarda(world: World) -> None:
    world.appointment(world.barber1, at(10), at(11), service=world.steam)
    world.appointment(world.barber2, at(11), at(11, 30), service=world.steam)
    world.session.commit()


# --- Estados --------------------------------------------------------------------------


def test_cita_cancelada_no_bloquea_el_hueco(world: World) -> None:
    world.appointment(world.barber1, at(10), at(10, 45), status=AppointmentStatus.cancelled)
    world.appointment(world.barber1, at(10), at(10, 45))
    world.session.commit()


def test_cita_no_show_no_bloquea_el_hueco(world: World) -> None:
    world.appointment(world.barber1, at(10), at(10, 45), status=AppointmentStatus.no_show)
    world.appointment(world.barber1, at(10, 15), at(11))
    world.session.commit()


def test_cita_attended_si_bloquea(world: World) -> None:
    world.appointment(world.barber1, at(10), at(10, 45), status=AppointmentStatus.attended)
    with pytest.raises(IntegrityError) as exc:
        world.appointment(world.barber1, at(10, 15), at(11))
    assert sqlstate(exc.value) == "23P01"


# --- Clientes -------------------------------------------------------------------------


def test_mismo_telefono_en_el_mismo_negocio_falla(world: World) -> None:
    make_client(world.session, world.business, "+573001112233")
    with pytest.raises(IntegrityError) as exc:
        make_client(world.session, world.business, "+573001112233")
    assert sqlstate(exc.value) == "23505"


def test_mismo_telefono_en_negocios_distintos_se_permite(world: World) -> None:
    other = make_business(world.session, "otro")
    make_client(world.session, world.business, "+573001112233")
    make_client(world.session, other, "+573001112233")
    world.session.commit()


def test_varios_clientes_sin_telefono_se_permiten(world: World) -> None:
    for _ in range(3):
        make_client(world.session, world.business, None)
    world.session.commit()


# --- CHECK ----------------------------------------------------------------------------


def test_servicio_rechaza_precio_negativo(world: World) -> None:
    with pytest.raises(IntegrityError) as exc:
        make_service(world.session, world.business, price_cop=-1)
    assert sqlstate(exc.value) == "23514"


@pytest.mark.parametrize("duration", [0, -5, 7])
def test_servicio_rechaza_duracion_invalida(world: World, duration: int) -> None:
    with pytest.raises(IntegrityError) as exc:
        make_service(world.session, world.business, duration_min=duration)
    assert sqlstate(exc.value) == "23514"


def test_cita_rechaza_fin_anterior_al_inicio(world: World) -> None:
    with pytest.raises(IntegrityError) as exc:
        world.appointment(world.barber1, at(11), at(10))
    assert sqlstate(exc.value) == "23514"


def test_cita_rechaza_precio_negativo_y_duracion_cero(world: World) -> None:
    with pytest.raises(IntegrityError) as exc:
        world.appointment(world.barber1, at(10), at(11), price_cop=-1)
    assert sqlstate(exc.value) == "23514"
    world.session.rollback()
    with pytest.raises(IntegrityError) as exc2:
        world.appointment(world.barber1, at(10), at(11), duration_min=0)
    assert sqlstate(exc2.value) == "23514"


def test_horario_rechaza_dia_fuera_de_rango_y_fin_anterior(world: World) -> None:
    from app.models import BarberSchedule

    world.session.add(
        BarberSchedule(barber_id=world.barber1.id, weekday=7, start_time=time(9), end_time=time(13))
    )
    with pytest.raises(IntegrityError):
        world.session.flush()
    world.session.rollback()
    world.session.add(
        BarberSchedule(barber_id=world.barber1.id, weekday=0, start_time=time(13), end_time=time(9))
    )
    with pytest.raises(IntegrityError):
        world.session.flush()


def test_email_de_usuario_debe_estar_en_minusculas_y_ser_unico_por_negocio(world: World) -> None:
    world.session.add(
        User(
            business_id=world.business.id,
            role=UserRole.admin,
            name="A",
            email="Admin@Imperio.test",
            password_hash="x",
        )
    )
    with pytest.raises(IntegrityError) as exc:
        world.session.flush()
    assert sqlstate(exc.value) == "23514"


# --- Migraciones ----------------------------------------------------------------------


def test_upgrade_downgrade_upgrade(migration_db_url: str) -> None:
    cfg = alembic_config(migration_db_url)
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    engine = create_engine(migration_db_url)
    try:
        assert inspect(engine).get_table_names() == ["alembic_version"]
        with engine.connect() as conn:
            leftovers = conn.execute(
                text(
                    "SELECT typname FROM pg_type WHERE typname IN "
                    "('user_role','appointment_status','appointment_source','product_availability')"
                )
            ).all()
        assert leftovers == []  # los tipos enum también se eliminan
    finally:
        engine.dispose()
    command.upgrade(cfg, "head")
    engine = create_engine(migration_db_url)
    try:
        assert "appointment" in inspect(engine).get_table_names()
    finally:
        engine.dispose()

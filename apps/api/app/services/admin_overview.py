"""Resumen del negocio (admin): todo con agregaciones SQL, sin cargar citas a Python.

Un día es el día LOCAL de Bogotá (``starts_at AT TIME ZONE 'America/Bogota'``). El rango se filtra
con límites UTC calculados del día local para poder usar el índice ``(business_id, starts_at)``.
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import bindparam, func, select, text
from sqlalchemy.orm import Session

from app.availability.service import local_day_bounds
from app.core.errors import ApiError
from app.models import Appointment, AppointmentStatus, Barber, Business, Client, Service
from app.schemas.admin import (
    BarberStatsOut,
    OverviewAppointmentsOut,
    OverviewOut,
    RevenueDayOut,
    TopServiceOut,
)

MAX_RANGE_DAYS = 366
TOP_SERVICES = 6


def current_week(business: Business, now: datetime) -> tuple[date, date]:
    """Lunes a domingo de la semana que contiene ``now`` en hora del negocio."""
    today = now.astimezone(ZoneInfo(business.timezone)).date()
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


def overview(
    session: Session,
    business: Business,
    first: date | None,
    last: date | None,
    now: datetime,
) -> OverviewOut:
    if first is None and last is None:
        first, last = current_week(business, now)
    elif first is None or last is None:
        raise ApiError(422, "invalid_range", "Envía las dos fechas (from y to) o ninguna.")
    if last < first:
        raise ApiError(422, "invalid_range", "La fecha final no puede ser anterior a la inicial.")
    if (last - first).days + 1 > MAX_RANGE_DAYS:
        raise ApiError(422, "range_too_large", f"El rango máximo es de {MAX_RANGE_DAYS} días.")

    tz = ZoneInfo(business.timezone)
    start, _ = local_day_bounds(first, tz)
    _, end = local_day_bounds(last, tz)
    in_range = (
        Appointment.business_id == business.id,
        Appointment.starts_at >= start,
        Appointment.starts_at < end,
    )
    status = Appointment.status
    attended = status == AppointmentStatus.attended
    live = status != AppointmentStatus.cancelled

    # 1. Totales por estado, ingresos e ingresos proyectados.
    totals = session.execute(
        select(
            func.count().filter(live).label("total"),
            func.count().filter(attended).label("attended"),
            func.count().filter(status == AppointmentStatus.no_show).label("no_show"),
            func.count().filter(status == AppointmentStatus.cancelled).label("cancelled"),
            func.count().filter(status == AppointmentStatus.booked).label("booked"),
            func.coalesce(func.sum(Appointment.price_cop).filter(attended), 0).label("revenue"),
            func.coalesce(
                func.sum(Appointment.price_cop).filter(
                    (status == AppointmentStatus.booked) & (Appointment.starts_at > now)
                ),
                0,
            ).label("projected"),
        ).where(*in_range)
    ).one()

    # 2. Ingresos por día local: generate_series asegura TODOS los días, también los de cero.
    daily = session.execute(
        text(
            """
            SELECT d.day::date AS day,
                   COALESCE(SUM(a.price_cop) FILTER (WHERE a.status = 'attended'), 0) AS revenue,
                   COUNT(a.id) FILTER (WHERE a.status <> 'cancelled') AS n
            FROM generate_series(
                CAST(:first AS date), CAST(:last AS date), interval '1 day'
            ) AS d(day)
            LEFT JOIN appointment a
              ON a.business_id = :business_id
             AND a.starts_at >= :start AND a.starts_at < :end
             AND CAST(a.starts_at AT TIME ZONE :tz AS date) = d.day::date
            GROUP BY d.day
            ORDER BY d.day
            """
        ).bindparams(
            bindparam("first", first),
            bindparam("last", last),
            bindparam("business_id", business.id),
            bindparam("start", start),
            bindparam("end", end),
            bindparam("tz", business.timezone),
        )
    ).all()

    # 3. Servicios más pedidos (por cantidad de citas no canceladas).
    top = session.execute(
        select(
            Service.id,
            Service.name,
            func.count().label("n"),
            func.coalesce(func.sum(Appointment.price_cop).filter(attended), 0).label("revenue"),
        )
        .join(Service, Service.id == Appointment.service_id)
        .where(*in_range, live)
        .group_by(Service.id, Service.name)
        .order_by(func.count().desc(), func.sum(Appointment.price_cop).desc(), Service.name)
        .limit(TOP_SERVICES)
    ).all()

    # 4. Por barbero.
    by_barber = session.execute(
        select(
            Barber.id,
            Barber.display_name,
            func.count().filter(live).label("n"),
            func.coalesce(func.sum(Appointment.price_cop).filter(attended), 0).label("revenue"),
            func.count().filter(status == AppointmentStatus.no_show).label("no_show"),
        )
        .join(Barber, Barber.id == Appointment.barber_id)
        .where(*in_range)
        .group_by(Barber.id, Barber.display_name)
        .having(func.count().filter(live) > 0)
        .order_by(func.count().filter(live).desc(), Barber.display_name)
    ).all()

    # 5. Clientes nuevos: creados dentro del rango (día local).
    new_clients = session.scalar(
        select(func.count())
        .select_from(Client)
        .where(
            Client.business_id == business.id,
            Client.created_at >= start,
            Client.created_at < end,
        )
    )

    decided = totals.attended + totals.no_show
    return OverviewOut(
        date_from=first,
        date_to=last,
        revenue_cop=totals.revenue,
        projected_cop=totals.projected,
        appointments=OverviewAppointmentsOut(
            total=totals.total,
            attended=totals.attended,
            no_show=totals.no_show,
            cancelled=totals.cancelled,
            booked=totals.booked,
        ),
        attendance_rate=round(totals.attended / decided, 4) if decided else None,
        revenue_by_day=[RevenueDayOut(date=r.day, revenue_cop=r.revenue, count=r.n) for r in daily],
        top_services=[
            TopServiceOut(service_id=r[0], name=r[1], count=r.n, revenue_cop=r.revenue) for r in top
        ],
        by_barber=[
            BarberStatsOut(
                barber_id=r[0],
                display_name=r[1],
                count=r.n,
                revenue_cop=r.revenue,
                no_show=r.no_show,
            )
            for r in by_barber
        ],
        new_clients=new_clients or 0,
    )

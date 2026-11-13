"""Cálculo puro de horarios libres.

Sin base de datos, sin reloj propio y sin I/O: todo llega por parámetro, así que se prueba con
tablas de casos. Los intervalos son semiabiertos ``[inicio, fin)``: terminar a las 10:45 y empezar
a las 10:45 no es solapamiento.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class Interval:
    """Intervalo semiabierto con zona horaria (en UTC por convención)."""

    start: datetime
    end: datetime


def _overlaps(start: datetime, end: datetime, other: Interval) -> bool:
    return start < other.end and other.start < end


def compute_slots(
    *,
    day: date,
    tz: ZoneInfo,
    working: Sequence[tuple[time, time]],
    blocked: Sequence[Interval],
    resource_busy: Sequence[Interval],
    duration_min: int,
    slot_min: int,
    now: datetime,
    min_lead_min: int,
) -> list[datetime]:
    """Inicios válidos del ``day`` (en UTC, ordenados y sin duplicados).

    ``working`` son los tramos locales del día. Un inicio vale si el servicio cabe entero en un
    tramo, no solapa con ``blocked`` ni ``resource_busy`` y ``inicio >= now + min_lead_min``.
    """
    if now.tzinfo is None:
        raise ValueError("now debe tener zona horaria")
    if duration_min <= 0 or slot_min <= 0:
        raise ValueError("duration_min y slot_min deben ser positivos")

    duration = timedelta(minutes=duration_min)
    step = timedelta(minutes=slot_min)
    earliest = now + timedelta(minutes=min_lead_min)
    obstacles = [*blocked, *resource_busy]

    found: set[datetime] = set()
    for seg_start, seg_end in working:
        window_start = datetime.combine(day, seg_start, tzinfo=tz).astimezone(UTC)
        window_end = datetime.combine(day, seg_end, tzinfo=tz).astimezone(UTC)
        start = window_start
        while start + duration <= window_end:
            end = start + duration
            if start >= earliest and not any(_overlaps(start, end, o) for o in obstacles):
                found.add(start)
            start += step
    return sorted(found)

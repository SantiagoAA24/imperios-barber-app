"""Primer instante en que un barbero puede EMPEZAR un servicio ya (turnos sin cita).

Puro, como ``compute_slots``: sin base de datos ni reloj propio. A diferencia de los horarios
públicos no está atado a la cuadrícula de 30 min ni al margen de anticipación: parte de ``now``
redondeado hacia arriba a 5 minutos y avanza hasta que el servicio cabe en un tramo laboral sin
chocar con citas, ausencias ni el recurso compartido. Solo mira el día local de ``now``.
"""

from collections.abc import Sequence
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.availability.slots import Interval

STEP_MIN = 5
NO_FREE_TIME = "Hoy ya no tienes tiempo libre para este servicio."


def ceil_to_step(instant: datetime, step_min: int = STEP_MIN) -> datetime:
    """Redondea hacia arriba a un múltiplo de ``step_min`` minutos (nunca hacia el pasado)."""
    step = step_min * 60
    seconds = int(instant.timestamp())
    has_fraction = instant.microsecond > 0
    rounded = -(-(seconds + (1 if has_fraction else 0)) // step) * step
    return datetime.fromtimestamp(rounded, tz=UTC)


def next_free_start(
    *,
    now: datetime,
    tz: ZoneInfo,
    working: Sequence[tuple[time, time]],
    blocked: Sequence[Interval],
    resource_busy: Sequence[Interval],
    duration_min: int,
    step_min: int = STEP_MIN,
) -> datetime | None:
    """Inicio (UTC) más temprano de hoy, o ``None`` si hoy ya no cabe el servicio."""
    if now.tzinfo is None:
        raise ValueError("now debe tener zona horaria")
    if duration_min <= 0 or step_min <= 0:
        raise ValueError("duration_min y step_min deben ser positivos")

    duration = timedelta(minutes=duration_min)
    day = now.astimezone(tz).date()
    earliest = ceil_to_step(now, step_min)
    obstacles = sorted([*blocked, *resource_busy], key=lambda o: o.start)

    windows = sorted(
        (
            datetime.combine(day, start, tzinfo=tz).astimezone(UTC),
            datetime.combine(day, end, tzinfo=tz).astimezone(UTC),
        )
        for start, end in working
    )
    for window_start, window_end in windows:
        start = max(earliest, window_start)
        while start + duration <= window_end:
            end = start + duration
            clash = [o for o in obstacles if start < o.end and o.start < end]
            if not clash:
                return start
            # Salta al fin del último obstáculo que estorba, siempre a un múltiplo de 5 min.
            start = ceil_to_step(max(o.end for o in clash), step_min)
    return None

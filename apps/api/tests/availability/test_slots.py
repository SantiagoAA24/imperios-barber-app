"""Pruebas de compute_slots: función pura, sin base de datos ni reloj."""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.availability.slots import Interval, compute_slots

BOGOTA = ZoneInfo("America/Bogota")
DAY = date(2026, 11, 16)  # lunes
LONG_AGO = datetime(2026, 1, 1, tzinfo=UTC)
FULL_DAY = [(time(9), time(18))]
MORNING_AFTERNOON = [(time(9), time(13)), (time(14), time(18))]


def local(h: int, m: int = 0) -> datetime:
    return datetime.combine(DAY, time(h, m), tzinfo=BOGOTA)


def iv(h1: int, m1: int, h2: int, m2: int) -> Interval:
    """Intervalo local del día, guardado en UTC como lo entrega la base."""
    return Interval(local(h1, m1).astimezone(UTC), local(h2, m2).astimezone(UTC))


def run(
    *,
    working: list[tuple[time, time]] | None = None,
    blocked: list[Interval] | None = None,
    resource_busy: list[Interval] | None = None,
    duration_min: int = 30,
    slot_min: int = 30,
    now: datetime = LONG_AGO,
    min_lead_min: int = 30,
) -> list[datetime]:
    return compute_slots(
        day=DAY,
        tz=BOGOTA,
        working=FULL_DAY if working is None else working,
        blocked=blocked or [],
        resource_busy=resource_busy or [],
        duration_min=duration_min,
        slot_min=slot_min,
        now=now,
        min_lead_min=min_lead_min,
    )


def hhmm(slots: list[datetime]) -> list[str]:
    return [s.astimezone(BOGOTA).strftime("%H:%M") for s in slots]


# (id, kwargs, cuántos inicios | None, deben aparecer, no deben aparecer, primero, último)
CASES = [
    ("A1-30min", dict(duration_min=30), 18, ["09:00", "17:30"], [], "09:00", "17:30"),
    ("A2-45min", dict(duration_min=45), 17, ["17:00"], ["17:30"], "09:00", "17:00"),
    ("A3-60min", dict(duration_min=60), 17, ["17:00"], ["17:30"], "09:00", "17:00"),
    (
        "B-almuerzo",
        dict(working=MORNING_AFTERNOON, duration_min=60),
        14,
        ["12:00", "14:00"],
        ["12:30", "13:00", "13:30"],
        "09:00",
        "17:00",
    ),
    (
        "C-bloqueo-1000-1045",
        dict(blocked=[iv(10, 0, 10, 45)], duration_min=30),
        None,
        ["09:30", "11:00"],
        ["10:00", "10:30"],
        None,
        None,
    ),
    (
        "D-bloqueo-1100-1130",
        dict(blocked=[iv(11, 0, 11, 30)], duration_min=45),
        None,
        ["10:00", "11:30"],
        ["10:30", "11:00"],
        None,
        None,
    ),
    (
        "E-recurso-1200-1300",
        dict(resource_busy=[iv(12, 0, 13, 0)], duration_min=60),
        None,
        ["11:00", "13:00"],
        ["11:30", "12:00", "12:30"],
        None,
        None,
    ),
    (
        "F-ahora-1010",
        dict(now=local(10, 10), min_lead_min=30),
        None,
        ["11:00"],
        ["09:00", "10:00", "10:30"],
        "11:00",
        None,
    ),
    (
        "G-ahora-0930-inclusivo",
        dict(now=local(9, 30), min_lead_min=30),
        None,
        ["10:00"],
        ["09:30"],
        "10:00",
        None,
    ),
    (
        "H-ausencia-0900-1200",
        dict(blocked=[iv(9, 0, 12, 0)]),
        None,
        ["12:00"],
        ["09:00", "11:30"],
        "12:00",
        None,
    ),
    ("I-sin-horario", dict(working=[]), 0, [], [], None, None),
]


@pytest.mark.parametrize(
    ("kwargs", "total", "present", "absent", "first", "last"),
    [c[1:] for c in CASES],
    ids=[c[0] for c in CASES],
)
def test_compute_slots_tabla(
    kwargs: dict[str, object],
    total: int | None,
    present: list[str],
    absent: list[str],
    first: str | None,
    last: str | None,
) -> None:
    got = hhmm(run(**kwargs))  # type: ignore[arg-type]
    if total is not None:
        assert len(got) == total
    for h in present:
        assert h in got, f"{h} debía aparecer: {got}"
    for h in absent:
        assert h not in got, f"{h} no debía aparecer: {got}"
    if first is not None:
        assert got[0] == first
    if last is not None:
        assert got[-1] == last


def test_resultado_en_utc_sin_duplicados_y_ascendente() -> None:
    # Tramos que se solapan generan el mismo inicio dos veces (11:00 y 11:30).
    slots = run(working=[(time(9), time(12)), (time(11), time(14))])
    assert slots[0] == datetime(2026, 11, 16, 14, 0, tzinfo=UTC)  # 09:00 Bogotá = 14:00Z
    assert all(s.utcoffset() == timedelta(0) for s in slots)
    assert slots == sorted(set(slots))
    assert len(slots) == 10  # 09:00 ... 13:30


def test_los_inicios_se_cuentan_desde_el_inicio_de_cada_tramo() -> None:
    got = hhmm(run(working=[(time(9, 15), time(11, 0))]))
    assert got == ["09:15", "09:45", "10:15"]  # 10:45 + 30 min cruzaría las 11:00


def test_intervalo_que_toca_el_borde_no_solapa() -> None:
    # Termina a las 10:45 y el servicio de 45 min empieza a las 10:45 (bloqueo hasta 10:45).
    got = hhmm(run(blocked=[iv(10, 0, 10, 45)], duration_min=45, slot_min=15))
    assert "10:45" in got
    assert "10:30" not in got


def test_ahora_naive_se_rechaza() -> None:
    with pytest.raises(ValueError):
        run(now=datetime(2026, 1, 1))


# K. Propiedad: ningún inicio devuelto choca con bloqueos ni se sale de un tramo.
_minute = st.integers(min_value=0, max_value=24 * 60 - 1)


@st.composite
def _intervals(draw: st.DrawFn) -> list[Interval]:
    out = []
    for _ in range(draw(st.integers(0, 6))):
        a = draw(_minute)
        length = draw(st.integers(1, 240))
        start = datetime.combine(DAY, time(0), tzinfo=BOGOTA) + timedelta(minutes=a)
        out.append(
            Interval(start.astimezone(UTC), (start + timedelta(minutes=length)).astimezone(UTC))
        )
    return out


@st.composite
def _working(draw: st.DrawFn) -> list[tuple[time, time]]:
    out = []
    for _ in range(draw(st.integers(0, 3))):
        a = draw(st.integers(0, 22 * 60))
        b = draw(st.integers(a + 5, min(a + 600, 24 * 60 - 1)))
        out.append((time(a // 60, a % 60), time(b // 60, b % 60)))
    return out


@settings(max_examples=300, deadline=None)
@given(
    working=_working(),
    blocked=_intervals(),
    busy=_intervals(),
    duration=st.sampled_from([15, 30, 45, 60, 90]),
    slot=st.sampled_from([15, 30]),
    lead=st.integers(0, 120),
)
def test_propiedad_ningun_inicio_viola_las_reglas(
    working: list[tuple[time, time]],
    blocked: list[Interval],
    busy: list[Interval],
    duration: int,
    slot: int,
    lead: int,
) -> None:
    now = local(8, 0)
    slots = run(
        working=working,
        blocked=blocked,
        resource_busy=busy,
        duration_min=duration,
        slot_min=slot,
        now=now,
        min_lead_min=lead,
    )
    assert slots == sorted(set(slots))
    spans = [
        (datetime.combine(DAY, a, tzinfo=BOGOTA), datetime.combine(DAY, b, tzinfo=BOGOTA))
        for a, b in working
    ]
    for s in slots:
        end = s + timedelta(minutes=duration)
        assert s >= now + timedelta(minutes=lead)
        assert any(a <= s and end <= b for a, b in spans), "se sale de un tramo"
        for block in [*blocked, *busy]:
            assert not (s < block.end and block.start < end), "solapa con un bloqueo"


@pytest.mark.parametrize(("duration", "slot"), [(0, 30), (30, 0), (-5, 30)])
def test_duracion_y_paso_deben_ser_positivos(duration: int, slot: int) -> None:
    with pytest.raises(ValueError):
        run(duration_min=duration, slot_min=slot)

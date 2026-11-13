"""``next_free_start``: primer instante en que se puede EMPEZAR ya, sin cuadrícula de 30 min."""

from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.availability.next_free import NO_FREE_TIME, next_free_start
from app.availability.slots import Interval

BOGOTA = ZoneInfo("America/Bogota")
WORKDAY = [(time(9), time(13)), (time(14), time(18))]


def at(hhmm: str, seconds: int = 0) -> datetime:
    h, m = (int(x) for x in hhmm.split(":"))
    return datetime(2026, 11, 16, h, m, seconds, tzinfo=BOGOTA).astimezone(UTC)


def span(start: str, end: str) -> Interval:
    return Interval(at(start), at(end))


def run(
    now: datetime,
    *,
    duration: int = 30,
    working: list[tuple[time, time]] | None = None,
    blocked: list[Interval] | None = None,
    resource_busy: list[Interval] | None = None,
) -> datetime | None:
    return next_free_start(
        now=now,
        tz=BOGOTA,
        working=WORKDAY if working is None else working,
        blocked=blocked or [],
        resource_busy=resource_busy or [],
        duration_min=duration,
    )


@pytest.mark.parametrize(
    ("now", "expected"),
    [
        (at("10:00"), at("10:00")),  # ya está en múltiplo de 5
        (at("10:00", 1), at("10:05")),  # un segundo después sube al siguiente múltiplo
        (at("10:02"), at("10:05")),
        (at("10:07", 30), at("10:10")),
        (at("12:21"), at("12:25")),
    ],
)
def test_redondea_hacia_arriba_a_5_minutos(now: datetime, expected: datetime) -> None:
    assert run(now) == expected


def test_no_depende_de_la_cuadricula_de_30_minutos() -> None:
    assert run(at("10:12")) == at("10:15")


def test_con_cita_en_curso_empieza_al_terminar() -> None:
    # Cita 10:00-10:45 en curso; ahora 10:20 -> libre a las 10:45.
    assert run(at("10:20"), blocked=[span("10:00", "10:45")]) == at("10:45")


def test_con_citas_pegadas_salta_todas() -> None:
    blocked = [span("10:00", "10:30"), span("10:30", "11:15")]
    assert run(at("10:10"), blocked=blocked) == at("11:15")


def test_un_hueco_demasiado_corto_se_salta() -> None:
    # Hueco 10:30-10:45 (15 min) no cabe un servicio de 30: sigue hasta después de la 2.ª cita.
    blocked = [span("10:00", "10:30"), span("10:45", "11:30")]
    assert run(at("10:10"), blocked=blocked) == at("11:30")


def test_un_hueco_justo_si_cabe() -> None:
    blocked = [span("10:00", "10:30"), span("11:00", "11:30")]
    assert run(at("10:10"), blocked=blocked) == at("10:30")


def test_antes_de_abrir_empieza_a_la_hora_de_apertura() -> None:
    assert run(at("07:40")) == at("09:00")


def test_durante_el_almuerzo_empieza_al_volver() -> None:
    assert run(at("13:10")) == at("14:00")


def test_servicio_que_no_cabe_antes_del_almuerzo_pasa_a_la_tarde() -> None:
    # 12:40 + 45 min cruzaría la 1:00 pm.
    assert run(at("12:40"), duration=45) == at("14:00")


def test_servicio_que_si_cabe_justo_antes_del_almuerzo() -> None:
    assert run(at("12:30"), duration=30) == at("12:30")


def test_despues_del_cierre_no_hay_hueco_hoy() -> None:
    assert run(at("17:40")) is None
    assert run(at("19:00")) is None


def test_dia_sin_horario_no_hay_hueco() -> None:
    assert run(at("10:00"), working=[]) is None


def test_ausencia_en_curso_se_respeta() -> None:
    # Permiso 10:00-12:00 (llega como bloqueo igual que una cita).
    assert run(at("10:30"), blocked=[span("10:00", "12:00")]) == at("12:00")


def test_ausencia_que_cubre_el_resto_del_dia() -> None:
    assert run(at("10:30"), blocked=[Interval(at("10:00"), at("23:59"))]) is None


def test_recurso_ocupado_por_otro_barbero_retrasa_el_inicio() -> None:
    # El vaporizador lo usa otro barbero hasta las 11:20.
    assert run(at("11:00"), resource_busy=[span("10:50", "11:20")]) == at("11:20")


def test_barbero_y_recurso_ocupados_en_tramos_distintos() -> None:
    blocked = [span("11:00", "11:30")]
    resource = [span("11:30", "12:00")]
    assert run(at("11:05"), blocked=blocked, resource_busy=resource) == at("12:00")


def test_la_duracion_se_valida() -> None:
    with pytest.raises(ValueError):
        run(at("10:00"), duration=0)


def test_now_exige_zona_horaria() -> None:
    with pytest.raises(ValueError):
        run(datetime(2026, 11, 16, 10, 0))


def test_cita_pasada_no_estorba() -> None:
    assert run(at("11:00"), blocked=[span("09:00", "09:30")]) == at("11:00")


def test_constante_de_mensaje() -> None:
    assert "tiempo libre" in NO_FREE_TIME


def test_resultado_siempre_es_multiplo_de_5_minutos() -> None:
    for minute in range(0, 120, 7):
        got = run(at("09:00") + timedelta(minutes=minute), blocked=[span("10:03", "10:47")])
        assert got is not None
        assert got.astimezone(BOGOTA).minute % 5 == 0

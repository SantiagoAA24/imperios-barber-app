import type { ScheduleBlock } from '../../lib/api/types'
import { formatTime } from '../../lib/format'

export const WEEKDAYS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const

/** Tramo de un día con horas "HH:MM" de 30 en 30 minutos. */
export type Tramo = { start: string; end: string }
/** Borrador del horario: un arreglo de tramos por cada día (0 = lunes). */
export type Draft = Tramo[][]

export const MAX_TRAMOS = 2
const DEFAULT_TRAMO: Tramo = { start: '09:00', end: '18:00' }

/** Horas del selector: 00:00, 00:30 … 23:30. */
export const TIME_OPTIONS: string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  return `${h}:${i % 2 ? '30' : '00'}`
})

/** "09:30" -> "9:30 am" */
export function timeLabel(hhmm: string): string {
  return formatTime(`2026-01-05T${hhmm}:00-05:00`)
}

export function toDraft(schedule: ScheduleBlock[]): Draft {
  const draft: Draft = Array.from({ length: 7 }, () => [])
  for (const block of schedule) {
    draft[block.weekday]?.push({
      start: block.start_time.slice(0, 5),
      end: block.end_time.slice(0, 5),
    })
  }
  draft.forEach((day) => day.sort((a, b) => a.start.localeCompare(b.start)))
  return draft
}

export function toBlocks(draft: Draft): ScheduleBlock[] {
  return draft.flatMap((tramos, weekday) =>
    tramos.map((t) => ({ weekday, start_time: t.start, end_time: t.end })),
  )
}

export function setWorking(draft: Draft, weekday: number, on: boolean): Draft {
  return draft.map((tramos, i) =>
    i !== weekday ? tramos : on ? (tramos.length > 0 ? tramos : [{ ...DEFAULT_TRAMO }]) : [],
  )
}

export function setTramo(
  draft: Draft,
  weekday: number,
  index: number,
  field: keyof Tramo,
  value: string,
): Draft {
  return draft.map((tramos, i) =>
    i !== weekday ? tramos : tramos.map((t, j) => (j === index ? { ...t, [field]: value } : t)),
  )
}

/** Parte la jornada en dos tramos (mañana y tarde) para dejar el almuerzo libre. */
export function addTramo(draft: Draft, weekday: number): Draft {
  return draft.map((tramos, i) => {
    if (i !== weekday || tramos.length === 0 || tramos.length >= MAX_TRAMOS) return tramos
    const first = tramos[0]!
    const morningEnd = first.end > '13:00' && first.start < '13:00' ? '13:00' : first.end
    const afternoonStart = morningEnd < '14:00' ? '14:00' : morningEnd
    const afternoonEnd = first.end > afternoonStart ? first.end : '18:00'
    return [
      { ...first, end: morningEnd },
      { start: afternoonStart, end: afternoonEnd },
    ]
  })
}

export function removeTramo(draft: Draft, weekday: number, index: number): Draft {
  return draft.map((tramos, i) => (i !== weekday ? tramos : tramos.filter((_, j) => j !== index)))
}

/** Copia los tramos de un día a otros días. */
export function copyDay(draft: Draft, from: number, to: number[]): Draft {
  const source = draft[from] ?? []
  return draft.map((tramos, i) => (to.includes(i) ? source.map((t) => ({ ...t })) : tramos))
}

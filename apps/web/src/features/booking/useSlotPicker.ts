import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useWeekAvailability } from '../../lib/api/hooks'
import { queryKeys } from '../../lib/api/queryClient'
import type { Slot } from '../../lib/api/types'
import { addDays, bogotaDay, dayOfMonth, formatWeekdayShort } from '../../lib/format'

export const DAYS_AHEAD = 7

/** `idle`: sin servicio elegido · `loading` · `open`: hay horarios · `full`: sin cupo · `error`. */
export type DayStatus = 'idle' | 'loading' | 'open' | 'full' | 'error'

export type PickerDay = { date: string; weekday: string; day: number; status: DayStatus }

type Pick = { day: string | null; slot: { scope: string; value: string } | null }

/**
 * Disponibilidad de los próximos 7 días para un servicio y un barbero, más el día y la hora
 * elegidos. Solo muestra lo que devuelve la API: no calcula horarios ni plazos.
 * Con `own` usa la disponibilidad del propio barbero (panel del barbero).
 * La hora elegida pertenece al par servicio+barbero: si cambia cualquiera de los dos, se limpia.
 */
export function useSlotPicker(serviceId: string | null, barberId: string | null, own = false) {
  const client = useQueryClient()
  const [today] = useState(() => bogotaDay(new Date()))
  const dates = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)),
    [today],
  )
  const queries = useWeekAvailability(serviceId, barberId, dates, own)
  const [pick, setPick] = useState<Pick>({ day: null, slot: null })
  const scope = `${serviceId}|${barberId}`

  const days: PickerDay[] = dates.map((date, i) => {
    const query = queries[i]
    let status: DayStatus = 'loading'
    if (serviceId === null) status = 'idle'
    else if (query?.data) status = query.data.slots.length > 0 ? 'open' : 'full'
    else if (query?.isError) status = 'error'
    return { date, weekday: formatWeekdayShort(date), day: dayOfMonth(date), status }
  })

  const firstOpen = days.find((d) => d.status === 'open')?.date ?? null
  const chosen = pick.day ? days.find((d) => d.date === pick.day) : undefined
  // Un día elegido que se quedó sin cupo (o que aún no se conoce) no deja la pantalla vacía:
  // se pasa al primer día con horarios.
  const day = chosen && chosen.status !== 'full' ? chosen.date : (firstOpen ?? chosen?.date ?? null)
  const dayIndex = day ? dates.indexOf(day) : -1
  const slots: Slot[] = queries[dayIndex]?.data?.slots ?? []
  const dayStatus: DayStatus = days[dayIndex]?.status ?? (serviceId === null ? 'idle' : 'loading')

  const chosenSlot = pick.slot?.scope === scope ? pick.slot.value : null
  const selectedSlot =
    chosenSlot && slots.some((s) => s.starts_at === chosenSlot) ? chosenSlot : null

  const allLoading = serviceId !== null && days.every((d) => d.status === 'loading')
  const allFull = serviceId !== null && days.every((d) => d.status === 'full')
  const hasError = days.some((d) => d.status === 'error')
  const failedQuery = queries.find((q) => q.error)

  return {
    days,
    day,
    slots,
    dayStatus,
    allLoading,
    allFull,
    hasError,
    error: failedQuery?.error ?? null,
    chosenSlot,
    selectedSlot,
    chooseDay: (date: string) => setPick((p) => ({ ...p, day: date, slot: null })),
    chooseSlot: (startsAt: string) =>
      setPick({ day: bogotaDay(startsAt), slot: { scope, value: startsAt } }),
    retry: () => {
      queries.forEach((q) => {
        if (q.isError) void q.refetch()
      })
    },
    /** Vuelve a pedir la disponibilidad de todos los días (p. ej. tras un 409). */
    refresh: () => client.invalidateQueries({ queryKey: queryKeys.availability }),
    isRetrying: queries.some((q) => q.isError && q.isFetching),
  }
}

export type SlotPickerState = ReturnType<typeof useSlotPicker>

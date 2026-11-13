import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, toApiError } from './client'
import { queryKeys } from './queryClient'
import type { CreateAppointmentBody, PublicAppointment } from './types'

type Result<T> = { data?: T; error?: unknown; response: Response }

/** Caída de red o 5xx: tiene sentido ofrecer "Reintentar". Un 4xx del API es una respuesta final. */
export function isTransientError(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500
}

export async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await request
  if (data === undefined) throw toApiError(response.status, error)
  return data
}

export function useBusiness() {
  return useQuery({
    queryKey: queryKeys.business,
    queryFn: () => unwrap(api.GET('/api/v1/public/business')),
  })
}

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => unwrap(api.GET('/api/v1/public/services')),
  })
}

export function useBarbers() {
  return useQuery({
    queryKey: queryKeys.barbers,
    queryFn: () => unwrap(api.GET('/api/v1/public/barbers')),
  })
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => unwrap(api.GET('/api/v1/public/products')),
  })
}

export type AvailabilityParams = {
  serviceId: string
  /** `null` = cualquiera. */
  barberId: string | null
  /** Día de calendario en Bogotá, AAAA-MM-DD. */
  date: string
  /** `true`: la disponibilidad del propio barbero (`/me/availability`, sin margen de anticipación). */
  own?: boolean
}

function availabilityOptions({ serviceId, barberId, date, own = false }: AvailabilityParams) {
  return {
    queryKey: [
      ...queryKeys.availability,
      own ? 'me' : 'public',
      serviceId,
      barberId ?? 'any',
      date,
    ] as const,
    queryFn: async () => {
      if (own) {
        const mine = await unwrap(
          api.GET('/api/v1/me/availability', {
            params: { query: { service_id: serviceId, date } },
          }),
        )
        // Misma forma que la pública para reutilizar el selector de horarios.
        return { date: mine.date, slots: mine.slots.map((s) => ({ ...s, barber_ids: [] })) }
      }
      return unwrap(
        api.GET('/api/v1/public/availability', {
          params: {
            query: { service_id: serviceId, date, ...(barberId ? { barber_id: barberId } : {}) },
          },
        }),
      )
    },
  }
}

/** Disponibilidad de varios días en paralelo (una consulta por día); sin servicio no consulta. */
export function useWeekAvailability(
  serviceId: string | null,
  barberId: string | null,
  dates: string[],
  own = false,
) {
  return useQueries({
    queries: dates.map((date) => ({
      ...availabilityOptions({ serviceId: serviceId ?? '', barberId, date, own }),
      enabled: serviceId !== null,
    })),
  })
}

export function useAppointment(token: string) {
  return useQuery({
    queryKey: [...queryKeys.appointment, token],
    queryFn: () =>
      unwrap(api.GET('/api/v1/public/appointments/{token}', { params: { path: { token } } })),
  })
}

export function useCreateAppointment() {
  return useMutation({
    mutationFn: (body: CreateAppointmentBody) =>
      unwrap(api.POST('/api/v1/public/appointments', { body })),
  })
}

/** Tras cancelar o reprogramar, la cita nueva reemplaza a la del caché sin otra petición. */
function useAppointmentChange(token: string) {
  const client = useQueryClient()
  return (appointment: PublicAppointment) => {
    client.setQueryData([...queryKeys.appointment, token], appointment)
    // El horario liberado u ocupado cambia la disponibilidad de todos los días.
    void client.invalidateQueries({ queryKey: queryKeys.availability })
  }
}

export function useCancelAppointment(token: string) {
  const apply = useAppointmentChange(token)
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/api/v1/public/appointments/{token}/cancel', { params: { path: { token } } }),
      ),
    onSuccess: apply,
  })
}

export function useRescheduleAppointment(token: string) {
  const apply = useAppointmentChange(token)
  return useMutation({
    mutationFn: (startsAt: string) =>
      unwrap(
        api.POST('/api/v1/public/appointments/{token}/reschedule', {
          params: { path: { token } },
          body: { starts_at: startsAt },
        }),
      ),
    onSuccess: apply,
  })
}

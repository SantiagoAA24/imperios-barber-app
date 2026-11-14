// Hooks del panel del barbero (/api/v1/me). El estado del servidor vive en TanStack Query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api, ApiError } from './client'
import { unwrap } from './hooks'
import { queryKeys } from './queryClient'
import type {
  Agenda,
  MeAppointment,
  MeCreateAppointmentBody,
  PendingReview,
  ScheduleBlock,
  ScheduleResult,
  TimeOffCreated,
} from './types'

/** Sondeo de la agenda: el servidor decide qué está vencido, el cliente solo vuelve a preguntar. */
export const AGENDA_REFRESH_MS = 30_000

export type NewStatus = 'attended' | 'no_show' | 'cancelled'

export function useAgenda(date: string) {
  return useQuery({
    queryKey: [...queryKeys.agenda, date],
    queryFn: () => unwrap(api.GET('/api/v1/me/appointments', { params: { query: { date } } })),
    staleTime: 0,
    refetchInterval: AGENDA_REFRESH_MS,
    // En pausa con la pestaña oculta; al volver, refetchOnWindowFocus actualiza al instante.
    refetchIntervalInBackground: false,
  })
}

/** Pinta el cambio de estado en la agenda en caché antes de que responda el API. */
export function applyOptimistic(agenda: Agenda, id: string, status: NewStatus): Agenda {
  const target = agenda.appointments.find((a) => a.id === id)
  if (!target) return agenda
  const was = target.status
  const summary = { ...agenda.summary }
  if (was === 'booked') summary.pending -= 1
  if (was === 'no_show') summary.no_show -= 1
  if (status === 'attended') {
    summary.attended += 1
    summary.revenue_cop += target.service.price_cop
  } else if (status === 'no_show') {
    summary.no_show += 1
  }
  if (status === 'cancelled') summary.total -= 1
  const appointments =
    status === 'cancelled'
      ? agenda.appointments.filter((a) => a.id !== id)
      : agenda.appointments.map((a) => (a.id === id ? { ...a, status, is_overdue: false } : a))
  return { ...agenda, appointments, summary }
}

type StatusVars = { id: string; status: NewStatus }
type StatusContext = { previous: Agenda | undefined }

/** Marca atendida / no asistió / cancelada con actualización optimista y reversión si falla. */
export function useChangeStatus(date: string) {
  const client = useQueryClient()
  const key = [...queryKeys.agenda, date]
  return useMutation<MeAppointment, ApiError, StatusVars, StatusContext>({
    mutationFn: ({ id, status }) =>
      unwrap(
        api.PATCH('/api/v1/me/appointments/{appointment_id}', {
          params: { path: { appointment_id: id } },
          body: { status },
        }),
      ),
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: queryKeys.agenda })
      const previous = client.getQueryData<Agenda>(key)
      if (previous) client.setQueryData<Agenda>(key, applyOptimistic(previous, id, status))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(key, context.previous)
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.agenda })
      // Cancelar o reactivar cambia los huecos que ve la web pública.
      void client.invalidateQueries({ queryKey: queryKeys.availability })
    },
  })
}

/** Sondeo de «citas por revisar»: cambian despacio (una cita cruza las 2 horas una vez). */
export const PENDING_REVIEW_REFRESH_MS = 60_000

/** Citas propias aún «pendientes» que terminaron hace más de 2 horas (últimos 7 días). */
export function usePendingReview() {
  return useQuery<PendingReview, ApiError>({
    queryKey: queryKeys.pendingReview,
    queryFn: () => unwrap(api.GET('/api/v1/me/appointments/pending-review')),
    staleTime: 0,
    refetchInterval: PENDING_REVIEW_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}

/** Marca una cita por revisar como atendida o no asistió; la saca de la lista al instante. */
export function useResolvePending() {
  const client = useQueryClient()
  return useMutation<
    MeAppointment,
    ApiError,
    { id: string; status: 'attended' | 'no_show' },
    { previous: PendingReview | undefined }
  >({
    mutationFn: ({ id, status }) =>
      unwrap(
        api.PATCH('/api/v1/me/appointments/{appointment_id}', {
          params: { path: { appointment_id: id } },
          body: { status },
        }),
      ),
    onMutate: async ({ id }) => {
      await client.cancelQueries({ queryKey: queryKeys.pendingReview })
      const previous = client.getQueryData<PendingReview>(queryKeys.pendingReview)
      if (previous) {
        const items = previous.items.filter((a) => a.id !== id)
        client.setQueryData<PendingReview>(queryKeys.pendingReview, {
          count: items.length,
          items,
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(queryKeys.pendingReview, context.previous)
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: queryKeys.agenda })
    },
  })
}

/**
 * Registra que el barbero abrió el recordatorio de WhatsApp. Actualiza la fila en caché con la
 * respuesta para que el botón cambie a «Recordatorio enviado hace X» sin esperar al sondeo.
 */
export function useReminderSent(date: string) {
  const client = useQueryClient()
  return useMutation<MeAppointment, ApiError, string>({
    mutationFn: (id) =>
      unwrap(
        api.POST('/api/v1/me/appointments/{appointment_id}/reminder-sent', {
          params: { path: { appointment_id: id } },
        }),
      ),
    onSuccess: (updated) => {
      client.setQueryData<Agenda>([...queryKeys.agenda, date], (agenda) =>
        agenda
          ? {
              ...agenda,
              appointments: agenda.appointments.map((a) => (a.id === updated.id ? updated : a)),
            }
          : agenda,
      )
    },
  })
}

/** Primer instante en que puede empezar el servicio ya. Se renueva cada 30 s mientras se ve. */
export function useNextFree(serviceId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.nextFree, serviceId],
    enabled: enabled && serviceId !== null,
    retry: false,
    staleTime: 0,
    refetchInterval: AGENDA_REFRESH_MS,
    refetchIntervalInBackground: false,
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/me/next-free', { params: { query: { service_id: serviceId ?? '' } } }),
      ),
  })
}

function invalidateAfterWrite(client: QueryClient) {
  void client.invalidateQueries({ queryKey: queryKeys.agenda })
  void client.invalidateQueries({ queryKey: queryKeys.availability })
  void client.invalidateQueries({ queryKey: queryKeys.nextFree })
}

export function useCreateBarberAppointment() {
  const client = useQueryClient()
  return useMutation<MeAppointment, ApiError, MeCreateAppointmentBody>({
    mutationFn: (body) => unwrap(api.POST('/api/v1/me/appointments', { body })),
    onSuccess: () => invalidateAfterWrite(client),
  })
}

export function useSchedule() {
  return useQuery({
    queryKey: queryKeys.schedule,
    queryFn: () => unwrap(api.GET('/api/v1/me/schedule')),
  })
}

export function useReplaceSchedule() {
  const client = useQueryClient()
  return useMutation<ScheduleResult, ApiError, ScheduleBlock[]>({
    mutationFn: (schedule) => unwrap(api.PUT('/api/v1/me/schedule', { body: { schedule } })),
    onSuccess: (result) => {
      client.setQueryData(queryKeys.schedule, result)
      invalidateAfterWrite(client)
    },
  })
}

export function useTimeOff() {
  return useQuery({
    queryKey: queryKeys.timeOff,
    queryFn: () => unwrap(api.GET('/api/v1/me/time-off')),
  })
}

export function useCreateTimeOff() {
  const client = useQueryClient()
  return useMutation<
    TimeOffCreated,
    ApiError,
    { starts_at: string; ends_at: string; reason: string | null }
  >({
    mutationFn: (body) => unwrap(api.POST('/api/v1/me/time-off', { body })),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.timeOff })
      invalidateAfterWrite(client)
    },
  })
}

export function useDeleteTimeOff() {
  const client = useQueryClient()
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      const { error, response } = await api.DELETE('/api/v1/me/time-off/{time_off_id}', {
        params: { path: { time_off_id: id } },
      })
      if (!response.ok) throw new ApiError(response.status, error as never)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.timeOff })
      invalidateAfterWrite(client)
    },
  })
}

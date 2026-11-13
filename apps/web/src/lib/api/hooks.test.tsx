import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appointment, apiError, json, stubApi } from '../../test/api'
import { ApiError } from './client'
import {
  isTransientError,
  useAppointment,
  useCancelAppointment,
  useCreateAppointment,
  useRescheduleAppointment,
  useWeekAvailability,
} from './hooks'
import { createQueryClient, queryKeys } from './queryClient'

const SERVICE = '11111111-0000-4000-8000-000000000001'
const BARBER = '22222222-0000-4000-8000-000000000001'
const AVAILABILITY = 'GET /api/v1/public/availability'

function wrapper() {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, Wrapper }
}

afterEach(() => vi.unstubAllGlobals())

describe('isTransientError', () => {
  it('red caída y 5xx sí; 4xx del API no', () => {
    expect(isTransientError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isTransientError(new ApiError(503, undefined))).toBe(true)
    expect(isTransientError(new ApiError(409, { code: 'slot_unavailable' }))).toBe(false)
    expect(isTransientError(new ApiError(422, undefined))).toBe(false)
  })
})

describe('useWeekAvailability', () => {
  const dates = ['2026-11-13', '2026-11-14', '2026-11-15']

  it('consulta cada día en paralelo con servicio, barbero y fecha', async () => {
    const calls = stubApi({
      [AVAILABILITY]: ({ query }) =>
        json(200, {
          date: query.get('date'),
          slots: [{ starts_at: `${query.get('date')}T10:00:00-05:00`, barber_ids: [] }],
        }),
    })
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useWeekAvailability(SERVICE, BARBER, dates), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.every((q) => q.isSuccess)).toBe(true))
    expect(calls).toHaveLength(3)
    expect(calls.map((c) => c.query.get('date')).sort()).toEqual(dates)
    for (const call of calls) {
      expect(call.query.get('service_id')).toBe(SERVICE)
      expect(call.query.get('barber_id')).toBe(BARBER)
    }
  })

  it('con "cualquiera" no envía barber_id', async () => {
    const calls = stubApi({ [AVAILABILITY]: () => json(200, { date: dates[0], slots: [] }) })
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useWeekAvailability(SERVICE, null, dates.slice(0, 1)), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current[0]?.isSuccess).toBe(true))
    expect(calls[0]?.query.has('barber_id')).toBe(false)
  })

  it('sin servicio no consulta nada', async () => {
    const calls = stubApi({})
    const { Wrapper } = wrapper()
    renderHook(() => useWeekAvailability(null, null, dates), { wrapper: Wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(calls).toHaveLength(0)
  })
})

describe('useAppointment', () => {
  it('trae la cita por su token', async () => {
    stubApi({ 'GET /api/v1/public/appointments/tok': () => json(200, appointment()) })
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useAppointment('tok'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.service.name).toBe('Corte + barba')
  })

  it('un 404 llega como ApiError con su código', async () => {
    stubApi({
      'GET /api/v1/public/appointments/malo': () =>
        apiError(404, 'appointment_not_found', 'No encontramos esta cita.'),
    })
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useAppointment('malo'), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect((result.current.error as ApiError).status).toBe(404)
    expect((result.current.error as ApiError).code).toBe('appointment_not_found')
  })
})

describe('useCreateAppointment', () => {
  const body = {
    service_id: SERVICE,
    barber_id: null,
    starts_at: '2026-11-13T11:00:00-05:00',
    client: { name: 'Juan', phone: '3001234567' },
    consent: true,
    website: '',
  }

  it('envía el cuerpo y devuelve el token', async () => {
    const calls = stubApi({
      'POST /api/v1/public/appointments': () =>
        json(201, {
          appointment: appointment(),
          manage_token: 'tok123',
          manage_path: '/cita/tok123',
        }),
    })
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useCreateAppointment(), { wrapper: Wrapper })
    const created = await act(() => result.current.mutateAsync(body))
    expect(calls[0]?.body).toEqual(body)
    expect(created.manage_token).toBe('tok123')
  })

  it('un 409 slot_unavailable conserva details.alternatives', async () => {
    stubApi({
      'POST /api/v1/public/appointments': () =>
        apiError(409, 'slot_unavailable', 'Ese horario ya no está disponible.', {
          alternatives: [{ starts_at: '2026-11-13T11:30:00-05:00', barber_ids: [] }],
        }),
    })
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useCreateAppointment(), { wrapper: Wrapper })
    await expect(act(() => result.current.mutateAsync(body))).rejects.toMatchObject({
      status: 409,
      code: 'slot_unavailable',
    })
  })
})

describe('cancelar y reprogramar', () => {
  it('cancelar actualiza la cita en caché e invalida la disponibilidad', async () => {
    stubApi({
      'POST /api/v1/public/appointments/tok/cancel': () =>
        json(200, appointment({ status: 'cancelled' })),
    })
    const { client, Wrapper } = wrapper()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCancelAppointment('tok'), { wrapper: Wrapper })
    await act(() => result.current.mutateAsync())
    expect(client.getQueryData<{ status: string }>([...queryKeys.appointment, 'tok'])?.status).toBe(
      'cancelled',
    )
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.availability })
  })

  it('too_late_to_cancel llega con el mensaje del API', async () => {
    stubApi({
      'POST /api/v1/public/appointments/tok/cancel': () =>
        apiError(
          409,
          'too_late_to_cancel',
          'Para cancelar con menos de 1 hora de anticipación, escríbele al local.',
        ),
    })
    const { Wrapper } = wrapper()
    const { result } = renderHook(() => useCancelAppointment('tok'), { wrapper: Wrapper })
    await expect(act(() => result.current.mutateAsync())).rejects.toMatchObject({
      code: 'too_late_to_cancel',
      message: 'Para cancelar con menos de 1 hora de anticipación, escríbele al local.',
    })
  })

  it('reprogramar envía starts_at y deja la cita nueva en caché', async () => {
    const calls = stubApi({
      'POST /api/v1/public/appointments/tok/reschedule': () =>
        json(
          200,
          appointment({
            starts_at: '2026-11-14T10:00:00-05:00',
            ends_at: '2026-11-14T10:45:00-05:00',
          }),
        ),
    })
    const { client, Wrapper } = wrapper()
    const { result } = renderHook(() => useRescheduleAppointment('tok'), { wrapper: Wrapper })
    await act(() => result.current.mutateAsync('2026-11-14T10:00:00-05:00'))
    expect(calls[0]?.body).toEqual({ starts_at: '2026-11-14T10:00:00-05:00' })
    expect(
      client.getQueryData<{ starts_at: string }>([...queryKeys.appointment, 'tok'])?.starts_at,
    ).toBe('2026-11-14T10:00:00-05:00')
  })
})

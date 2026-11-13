import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { createQueryClient } from '../lib/api/queryClient'
import type { Agenda, MeAppointment } from '../lib/api/types'
import { bogotaDay } from '../lib/format'
import { json } from './api'
import type { Handler } from './api'

export const TODAY = bogotaDay(new Date())

export const ME = { id: '44444444-0000-4000-8000-000000000001', name: 'Barbero 1', role: 'barber' }
export const meHandler: Record<string, Handler> = { 'GET /api/v1/auth/me': () => json(200, ME) }

export function meAppt(overrides: Partial<MeAppointment> & { time?: string } = {}): MeAppointment {
  const { time = '10:00', ...rest } = overrides
  return {
    id: '55555555-0000-4000-8000-000000000001',
    status: 'booked',
    source: 'online',
    starts_at: `${TODAY}T${time}:00-05:00`,
    ends_at: `${TODAY}T${time}:00-05:00`,
    service: { name: 'Corte básico', duration_min: 30, price_cop: 22000, uses_resource: false },
    client: {
      id: '66666666-0000-4000-8000-000000000001',
      name: 'Carlos Gómez',
      phone_masked: '300 *** 4567',
      phone_e164: '+573001234567',
    },
    is_overdue: false,
    ...rest,
  }
}

export function agendaOf(appointments: MeAppointment[], date = TODAY): Agenda {
  const live = appointments.filter((a) => a.status !== 'cancelled')
  return {
    date,
    appointments,
    summary: {
      total: live.length,
      attended: live.filter((a) => a.status === 'attended').length,
      pending: live.filter((a) => a.status === 'booked').length,
      no_show: live.filter((a) => a.status === 'no_show').length,
      revenue_cop: live
        .filter((a) => a.status === 'attended')
        .reduce((sum, a) => sum + a.service.price_cop, 0),
    },
  }
}

export function renderWithApp(ui: ReactNode, route = '/') {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}

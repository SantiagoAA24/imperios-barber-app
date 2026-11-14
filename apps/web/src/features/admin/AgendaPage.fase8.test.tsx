import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminLayout } from '../../app/layouts/AdminLayout'
import { json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp, TODAY } from '../../test/barber'
import AgendaPage from './AgendaPage'

function review(id: string, barber: string, client: string, time: string) {
  return {
    id,
    barber: { id: `b-${barber}`, display_name: barber },
    service: { name: 'Corte básico', duration_min: 30, uses_resource: false },
    client: { id: `c-${id}`, name: client, phone_masked: '300 *** 4821' },
    status: 'booked',
    source: 'online',
    starts_at: `${TODAY}T${time}:00-05:00`,
    ends_at: `${TODAY}T${time}:30-05:00`,
    price_cop: 22_000,
    is_overdue: true,
  }
}

const ITEMS = [review('r1', 'Ana', 'Mateo G.', '09:00'), review('r2', 'Beto', 'Juan P.', '09:30')]
const EMPTY_AGENDA = { items: [], day_start: '09:00', day_end: '18:00' }

function routes(extra: Record<string, Handler> = {}): Record<string, Handler> {
  return {
    'GET /api/v1/admin/appointments': () => json(200, EMPTY_AGENDA),
    'GET /api/v1/admin/barbers': () => json(200, { items: [] }),
    'GET /api/v1/admin/services': () => json(200, { items: [], resources: [] }),
    ...extra,
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('Citas por revisar (admin)', () => {
  it('lista las de todos los barberos y marca «Atendida» / «No asistió»', async () => {
    let items = [...ITEMS]
    const calls = stubApi(
      routes({
        'GET /api/v1/admin/appointments/pending-review': () =>
          json(200, { count: items.length, items }),
        'PATCH /api/v1/admin/appointments/r1': () => {
          items = items.filter((i) => i.id !== 'r1')
          return json(200, { ...ITEMS[0], status: 'attended' })
        },
        'PATCH /api/v1/admin/appointments/r2': () => {
          items = items.filter((i) => i.id !== 'r2')
          return json(200, { ...ITEMS[1], status: 'no_show' })
        },
      }),
    )
    renderWithApp(<AgendaPage />, '/admin/agenda')
    const section = await screen.findByRole('region', { name: 'Citas por revisar' })
    expect(within(section).getAllByRole('listitem')).toHaveLength(2)
    expect(within(section).getByText(/Corte básico · Ana/)).toBeTruthy()

    fireEvent.click(within(section).getByRole('button', { name: /^Atendida: Mateo G\./ }))
    await waitFor(() => expect(within(section).getAllByRole('listitem')).toHaveLength(1))
    fireEvent.click(within(section).getByRole('button', { name: /^No asistió: Juan P\./ }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Citas por revisar' })).toBeNull(),
    )
    expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([
      { status: 'attended' },
      { status: 'no_show' },
    ])
  })

  it('sin pendientes no aparece la sección', async () => {
    stubApi(
      routes({
        'GET /api/v1/admin/appointments/pending-review': () => json(200, { count: 0, items: [] }),
      }),
    )
    renderWithApp(<AgendaPage />, '/admin/agenda')
    await screen.findByText(/No hay citas para este día/)
    expect(screen.queryByRole('heading', { name: 'Citas por revisar' })).toBeNull()
  })
})

describe('Insignia de la barra lateral del admin', () => {
  it('«Agenda» lleva el número con texto accesible «N citas por revisar»', async () => {
    stubApi({
      'GET /api/v1/admin/appointments/pending-review': () => json(200, { count: 2, items: ITEMS }),
    })
    renderWithApp(
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>Resumen</p>} />
        </Route>
      </Routes>,
      '/admin',
    )
    expect(await screen.findByRole('link', { name: 'Agenda 2 citas por revisar' })).toBeTruthy()
    // Las demás entradas no llevan insignia.
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeTruthy()
  })
})

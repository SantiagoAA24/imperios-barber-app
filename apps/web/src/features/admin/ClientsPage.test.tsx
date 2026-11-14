import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { renderWithApp } from '../../test/barber'
import ClientsPage from './ClientsPage'

const item = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  phone_masked: '300 *** 4821',
  appointments_count: 14,
  last_visit_at: '2026-11-13T10:00:00-05:00',
  attendance_rate: 1,
  no_show_count: 0,
  ...extra,
})

const PAGE1 = {
  items: [
    item('c1', 'Carlos Martínez'),
    item('c2', 'Andrés Rojas', { attendance_rate: 0.83, no_show_count: 1 }),
  ],
  next_cursor: 'cursor-2',
  total: 3,
}
const PAGE2 = { items: [item('c3', 'Pedro Álvarez')], next_cursor: null, total: 3 }

const DETAIL = {
  id: 'c1',
  name: 'Carlos Martínez',
  phone: '+573004824821',
  since: '2026-03-12T15:00:00Z',
  visits: 14,
  no_show_count: 0,
  favorite_service: 'Corte + barba',
  recent_appointments: [
    {
      id: 'a1',
      starts_at: '2026-11-13T10:00:00-05:00',
      status: 'attended',
      service_name: 'Corte + barba',
      barber_name: 'Barbero 1',
      price_cop: 27_000,
    },
  ],
  notes: 'Prefiere degradado bajo.',
}

function renderPage(extra: Record<string, Handler> = {}) {
  const calls = stubApi({
    'GET /api/v1/admin/clients': ({ query }) => json(200, query.get('cursor') ? PAGE2 : PAGE1),
    ...extra,
  })
  const view = renderWithApp(<ClientsPage />)
  return { calls, ...view }
}

const listCalls = (calls: { path: string; query: URLSearchParams }[]) =>
  calls.filter((c) => c.path === '/api/v1/admin/clients')

afterEach(() => vi.unstubAllGlobals())

describe('Clientes (admin)', () => {
  it('tabla con encabezados reales, celular parcial y asistencia con faltas', async () => {
    const { container } = renderPage()
    await screen.findByRole('button', { name: /Carlos Martínez/ })
    for (const h of ['Cliente', 'Celular', 'Citas', 'Última visita', 'Asistencia']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeTruthy()
    }
    expect(screen.getAllByText('300 *** 4821')).toHaveLength(2)
    expect(screen.getByText('83% · 1 falta')).toBeTruthy()
    expect(screen.getByText(/parcial por privacidad/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('4824821')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('la búsqueda espera 300 ms y manda q al servidor', async () => {
    const { calls } = renderPage()
    await screen.findByRole('button', { name: /Carlos Martínez/ })
    expect(listCalls(calls)).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'jos' } })
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'josé' } })
    await new Promise((r) => setTimeout(r, 120))
    expect(listCalls(calls)).toHaveLength(1) // todavía no
    await waitFor(
      () => expect(listCalls(calls).some((c) => c.query.get('q') === 'josé')).toBe(true),
      {
        timeout: 1500,
      },
    )
    // Una sola petición con el texto final: la intermedia 'jos' nunca salió.
    expect(listCalls(calls).some((c) => c.query.get('q') === 'jos')).toBe(false)
  })

  it('los chips usan aria-pressed y cambian el filtro del servidor', async () => {
    const { calls } = renderPage()
    await screen.findByRole('button', { name: /Carlos Martínez/ })
    const group = screen.getByRole('group', { name: 'Filtro' })
    expect(within(group).getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(within(group).getByRole('button', { name: 'Con inasistencias' }))
    await waitFor(() =>
      expect(listCalls(calls).some((c) => c.query.get('filter') === 'no_show')).toBe(true),
    )
    expect(
      within(group).getByRole('button', { name: 'Con inasistencias' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(within(group).getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('Cargar más pide la página siguiente con el cursor', async () => {
    const { calls } = renderPage()
    await screen.findByRole('button', { name: /Carlos Martínez/ })
    expect(screen.getByText(/Mostrando 2 de 3/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(await screen.findByRole('button', { name: /Pedro Álvarez/ })).toBeTruthy()
    expect(listCalls(calls)[1]?.query.get('cursor')).toBe('cursor-2')
    expect(screen.getByText(/Mostrando 3 de 3/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull()
  })

  it('el detalle muestra el celular completo, WhatsApp, estadísticas, historial y guarda notas', async () => {
    const { calls } = renderPage({
      'GET /api/v1/admin/clients/c1': () => json(200, DETAIL),
      'PATCH /api/v1/admin/clients/c1': () =>
        json(200, { id: 'c1', notes: 'Sin cejas con navaja.' }),
    })
    await screen.findByRole('button', { name: /Carlos Martínez/ })
    expect(calls.some((c) => c.path.startsWith('/api/v1/admin/clients/'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Carlos Martínez/ }))
    const panel = await screen.findByRole('complementary', { name: 'Detalle del cliente' })
    await within(panel).findByText('300 482 4821')
    expect(within(panel).getByText('Cliente desde marzo de 2026')).toBeTruthy()
    const wa = within(panel).getByRole('link', { name: /WhatsApp a Carlos Martínez/ })
    expect(wa.getAttribute('href')).toContain('https://wa.me/573004824821')
    expect(wa.getAttribute('target')).toBe('_blank')
    expect(within(panel).getByText('Corte + barba', { selector: 'dd' })).toBeTruthy()
    expect(within(panel).getByRole('region', { name: 'Últimas visitas' })).toBeTruthy()
    const notes = within(panel).getByLabelText('Notas del barbero') as HTMLTextAreaElement
    expect(notes.value).toBe('Prefiere degradado bajo.')
    expect(notes.maxLength).toBe(500)
    const saveButton = within(panel).getByRole('button', {
      name: 'Guardar notas',
    }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
    fireEvent.change(notes, { target: { value: 'Sin cejas con navaja.' } })
    fireEvent.click(saveButton)
    expect(await within(panel).findByText('Notas guardadas.')).toBeTruthy()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      notes: 'Sin cejas con navaja.',
    })
    // Guardar notas no vuelve a leer el detalle (cada lectura del celular queda auditada).
    expect(
      calls.filter((c) => c.path === '/api/v1/admin/clients/c1' && c.method === 'GET'),
    ).toHaveLength(1)
  })

  it('sin resultados explica por qué', async () => {
    renderPage({
      'GET /api/v1/admin/clients': () => json(200, { items: [], next_cursor: null, total: 0 }),
    })
    expect(
      await screen.findByText('Aún no tienes clientes. Aparecen cuando agendan su primera cita.'),
    ).toBeTruthy()
  })
})

import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BarberLayout } from '../../app/layouts/BarberLayout'
import { json, stubApi } from '../../test/api'
import type { Handler } from '../../test/api'
import { agendaOf, meAppt, meHandler, renderWithApp } from '../../test/barber'
import { AgendaPage } from './AgendaPage'

const A = '55555555-0000-4000-8000-00000000000a'
const B = '55555555-0000-4000-8000-00000000000b'
const HOUR = 3_600_000

/** Cita que empieza dentro de `hours` horas (relativa al reloj real, así que no caduca). */
function inHours(hours: number, overrides: Parameters<typeof meAppt>[0] = {}) {
  const start = new Date(Date.now() + hours * HOUR)
  return meAppt({
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    ...overrides,
  })
}

function renderAgenda(
  appointments: ReturnType<typeof meAppt>[],
  extra: Record<string, Handler> = {},
) {
  const calls = stubApi({
    ...meHandler,
    'GET /api/v1/me/appointments': () => json(200, agendaOf(appointments)),
    ...extra,
  })
  const view = renderWithApp(
    <Routes>
      <Route path="/barbero" element={<AgendaPage />} />
    </Routes>,
    '/barbero',
  )
  return { calls, ...view }
}

afterEach(() => vi.unstubAllGlobals())

describe('Recordar por WhatsApp', () => {
  it('se ofrece solo si está pendiente, tiene celular y empieza en las próximas 24 horas', async () => {
    const phone = '+573001234567'
    renderAgenda([
      inHours(3, { id: A, client: { ...meAppt().client, name: 'Juan P.', phone_e164: phone } }),
      inHours(30, { id: B, client: { ...meAppt().client, name: 'Lejano', phone_e164: phone } }),
      inHours(4, {
        id: 'c',
        client: { ...meAppt().client, name: 'Sin celular', phone_e164: null, phone_masked: null },
      }),
      inHours(5, {
        id: 'd',
        status: 'attended',
        client: { ...meAppt().client, name: 'Ya atendido', phone_e164: null },
      }),
    ])
    await screen.findAllByRole('article')
    const link = await screen.findAllByRole('link', { name: /^Recordar por WhatsApp/ })
    expect(link).toHaveLength(1)
    expect(link[0]!.getAttribute('aria-label')).toBe(
      'Recordar por WhatsApp a Juan P. (se abre en otra pestaña)',
    )
    const url = new URL(link[0]!.getAttribute('href') ?? '')
    expect(url.origin + url.pathname).toBe('https://wa.me/573001234567')
    const text = url.searchParams.get('text') ?? ''
    expect(text).toMatch(/^Hola Juan, te recordamos tu cita en Imperio Barber: Corte básico, /)
    expect(text).toContain('tenemos 5 minutos de tolerancia')
    expect(text).not.toMatch(/https?:/)
    expect(link[0]!.getAttribute('target')).toBe('_blank')
    expect(link[0]!.getAttribute('rel')).toContain('noopener')
  })

  it('al abrirlo registra el envío y pasa a «Recordatorio enviado hace X» (se puede reenviar)', async () => {
    const sentAt = new Date().toISOString()
    const base = inHours(3, { id: A })
    const { calls } = renderAgenda([base], {
      [`POST /api/v1/me/appointments/${A}/reminder-sent`]: () =>
        json(200, { ...base, reminder_sent_at: sentAt }),
    })
    const link = await screen.findByRole('link', { name: /^Recordar por WhatsApp/ })
    // jsdom no navega: se cancela el comportamiento por defecto del enlace.
    link.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(link)

    const sent = await screen.findByRole('link', { name: /^Recordatorio enviado hace un momento/ })
    expect(sent.textContent).toBe('Recordatorio enviado hace un momento')
    expect(sent.getAttribute('aria-label')).toContain('Reenviar por WhatsApp a Carlos Gómez')
    expect(sent.getAttribute('href')).toContain('https://wa.me/573001234567')
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([
      `/api/v1/me/appointments/${A}/reminder-sent`,
    ])
  })

  it('una cita con recordatorio previo ya llega como «enviado»', async () => {
    renderAgenda([
      inHours(3, { id: A, reminder_sent_at: new Date(Date.now() - 12 * 60_000).toISOString() }),
    ])
    expect(
      await screen.findByRole('link', { name: /^Recordatorio enviado hace 12 min/ }),
    ).toBeTruthy()
  })
})

const REVIEW = [
  meAppt({ id: A, time: '09:00', client: { ...meAppt().client, name: 'Mateo G.' } }),
  meAppt({ id: B, time: '09:30', client: { ...meAppt().client, name: 'Juan P.' } }),
]

describe('Citas por revisar (barbero)', () => {
  it('no muestra nada cuando no hay pendientes', async () => {
    renderAgenda([])
    await screen.findByText('No tienes citas para este día.')
    expect(screen.queryByRole('heading', { name: 'Citas por revisar' })).toBeNull()
  })

  it('lista las citas y marca «Atendida» / «No asistió», sacándolas de la lista', async () => {
    let items = [...REVIEW]
    const { calls } = renderAgenda([], {
      'GET /api/v1/me/appointments/pending-review': () => json(200, { count: items.length, items }),
      [`PATCH /api/v1/me/appointments/${A}`]: () => {
        items = items.filter((i) => i.id !== A)
        return json(200, { ...REVIEW[0], status: 'attended' })
      },
      [`PATCH /api/v1/me/appointments/${B}`]: () => {
        items = items.filter((i) => i.id !== B)
        return json(200, { ...REVIEW[1], status: 'no_show' })
      },
    })
    const section = await screen.findByRole('region', { name: 'Citas por revisar' })
    expect(within(section).getAllByRole('listitem')).toHaveLength(2)

    fireEvent.click(within(section).getByRole('button', { name: /^Atendida: Mateo G\./ }))
    await waitFor(() => expect(within(section).getAllByRole('listitem')).toHaveLength(1))
    expect(await screen.findByRole('status', { name: '' })).toBeTruthy()
    expect(document.body.textContent).toContain('Cita de Mateo G. marcada como atendida.')

    fireEvent.click(within(section).getByRole('button', { name: /^No asistió: Juan P\./ }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Citas por revisar' })).toBeNull(),
    )
    // Al marcar la última, la sección desaparece pero el anuncio para lectores de pantalla sigue
    // en el documento (si la región se desmontara con ella, nadie oiría la confirmación).
    expect(screen.getByRole('status', { name: '' }).textContent).toBe(
      'Cita de Juan P. marcada como no asistió.',
    )

    expect(
      calls.filter((c) => c.method === 'PATCH').map((c) => [c.path.split('/').pop(), c.body]),
    ).toEqual([
      [A, { status: 'attended' }],
      [B, { status: 'no_show' }],
    ])
  })

  it('si el servidor rechaza el cambio, avisa y deja la cita en la lista', async () => {
    renderAgenda([], {
      'GET /api/v1/me/appointments/pending-review': () =>
        json(200, { count: 1, items: [REVIEW[0]] }),
      [`PATCH /api/v1/me/appointments/${A}`]: () =>
        json(409, {
          code: 'invalid_transition',
          message: 'Esta cita ya está atendida.',
          details: {},
        }),
    })
    const section = await screen.findByRole('region', { name: 'Citas por revisar' })
    fireEvent.click(within(section).getByRole('button', { name: /^Atendida: Mateo G\./ }))
    expect(await within(section).findByRole('alert')).toBeTruthy()
    expect(within(section).getByText('Esta cita ya está atendida.')).toBeTruthy()
    expect(within(section).getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('Insignia de la barra del barbero', () => {
  function renderLayout(count: number) {
    stubApi({
      ...meHandler,
      'GET /api/v1/me/appointments/pending-review': () =>
        json(200, { count, items: Array.from({ length: count }, () => REVIEW[0]) }),
    })
    return renderWithApp(
      <Routes>
        <Route path="/barbero" element={<BarberLayout />}>
          <Route index element={<p>Contenido</p>} />
        </Route>
      </Routes>,
      '/barbero',
    )
  }

  it('lleva el número con texto accesible «N citas por revisar»', async () => {
    renderLayout(3)
    expect(await screen.findByRole('link', { name: 'Agenda 3 citas por revisar' })).toBeTruthy()
  })

  it('en singular y sin insignia con cero', async () => {
    const { unmount } = renderLayout(1)
    expect(await screen.findByRole('link', { name: 'Agenda 1 cita por revisar' })).toBeTruthy()
    unmount()
    vi.unstubAllGlobals()
    renderLayout(0)
    expect(await screen.findByRole('link', { name: 'Agenda' })).toBeTruthy()
  })
})

import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../../lib/api/queryClient'
import { addDays, bogotaDay } from '../../lib/format'
import { apiError, appointment, BARBERS, json, SERVICES, stubApi } from '../../test/api'
import type { Call, Handler } from '../../test/api'
import { BookingPage } from './BookingPage'

const TOMORROW = addDays(bogotaDay(new Date()), 1)
const slotAt = (time: string, date = TOMORROW) => ({
  starts_at: `${date}T${time}-05:00`,
  barber_ids: [BARBERS[0]!.id],
})

/** Mañana tiene dos horarios; los demás días no tienen cupo. */
const availability: Handler = ({ query }) =>
  json(200, {
    date: query.get('date'),
    slots:
      query.get('date') === TOMORROW
        ? [slotAt('10:00:00'), slotAt('10:30:00'), slotAt('11:00:00')]
        : [],
  })

const created = () =>
  json(201, { appointment: appointment(), manage_token: 'tok123', manage_path: '/cita/tok123' })

function CitaStub() {
  return <p>Pantalla de la cita {useLocation().pathname}</p>
}

function renderPage(routes: Record<string, Handler>) {
  const calls = stubApi({
    'GET /api/v1/public/services': () => json(200, SERVICES),
    'GET /api/v1/public/barbers': () => json(200, BARBERS),
    'GET /api/v1/public/availability': availability,
    ...routes,
  })
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<BookingPage />} />
          <Route path="/cita/:token" element={<CitaStub />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return calls
}

// jsdom concatena los textos del botón sin espacios ("Corte básico30 min$22.000"), el navegador sí.
const SERVICE_BASIC = /^Corte básico\s*\d/
const confirmButton = () => screen.getByRole('button', { name: /Confirmar cita|Confirmando/ })
const serviceButton = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^${name.replace('+', '\\+')}\\s*\\d`) })

async function chooseServiceAndSlot(time = '10:00 am') {
  fireEvent.click(await screen.findByRole('button', { name: SERVICE_BASIC }))
  fireEvent.click(await screen.findByRole('button', { name: time }))
}

function fillForm({ name = 'Juan Pérez', phone = '300 123 4567' } = {}) {
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('Celular (WhatsApp)'), { target: { value: phone } })
  fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el tratamiento/ }))
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('pantalla de agendar', () => {
  it('muestra cabecera, servicios con duración y precio, y "Cualquiera" seleccionado', async () => {
    renderPage({})
    expect(screen.getByRole('link', { name: 'Productos' }).getAttribute('href')).toBe('/productos')
    expect(screen.getByText('Imperio Barber')).toBeTruthy()
    expect(await screen.findByRole('button', { name: /^Corte \+ barba\s*45 min/ })).toBeTruthy()
    expect(screen.getByText('$27.000')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Limpieza facial.*Incluye vaporizador/ }),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cualquiera' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByRole('button', { name: 'Barbero 1' })).toBeTruthy()
  })

  it('con servicio elegido consulta los 7 días en paralelo y marca "sin cupo" los vacíos', async () => {
    const calls = renderPage({})
    fireEvent.click(await screen.findByRole('button', { name: SERVICE_BASIC }))
    await waitFor(() => expect(screen.getAllByText('sin cupo')).toHaveLength(6))
    const dates = calls
      .filter((c) => c.path.endsWith('/availability'))
      .map((c) => c.query.get('date'))
    expect(new Set(dates).size).toBe(7)
    const days = within(screen.getByRole('group', { name: 'Días disponibles' })).getAllByRole(
      'button',
    )
    expect(days.filter((d) => (d as HTMLButtonElement).disabled)).toHaveLength(6)
    // El primer día con cupo se selecciona solo y sus horarios aparecen.
    expect(await screen.findByRole('button', { name: '10:00 am' })).toBeTruthy()
  })

  it('no consulta disponibilidad hasta que hay servicio', async () => {
    const calls = renderPage({})
    await screen.findByRole('button', { name: SERVICE_BASIC })
    expect(calls.some((c) => c.path.endsWith('/availability'))).toBe(false)
    expect(screen.getByText('Elige un servicio para ver los horarios disponibles.')).toBeTruthy()
  })

  it('al cambiar de servicio se limpia la hora elegida', async () => {
    renderPage({})
    await chooseServiceAndSlot()
    expect(screen.getByRole('button', { name: '10:00 am' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    fireEvent.click(serviceButton('Corte + barba'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '10:00 am' }).getAttribute('aria-pressed')).toBe(
        'false',
      ),
    )
    expect(screen.getByText('Corte + barba · Elige una hora')).toBeTruthy()
  })

  it('el resumen usa los datos reales y el botón se habilita solo con todo válido', async () => {
    renderPage({})
    expect(confirmButton().hasAttribute('disabled')).toBe(true)
    await chooseServiceAndSlot()
    expect(screen.getByText(/^Corte básico · .* · 10:00 am$/)).toBeTruthy()
    expect(screen.getAllByText('$22.000').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Juan Pérez' } })
    fireEvent.change(screen.getByLabelText('Celular (WhatsApp)'), {
      target: { value: '3001234567' },
    })
    expect(confirmButton().hasAttribute('disabled')).toBe(true) // falta el consentimiento
    fireEvent.click(screen.getByRole('checkbox', { name: /Acepto el tratamiento/ }))
    expect(confirmButton().hasAttribute('disabled')).toBe(false)
  })

  it('anuncia el resumen en una región aria-live polite', async () => {
    renderPage({})
    await chooseServiceAndSlot()
    const live = document.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toMatch(
      /Corte básico, Cualquiera, .* a las 10:00 am\. Total \$22\.000\./,
    )
  })

  it('valida al salir del campo: nombre y celular', () => {
    renderPage({})
    const phone = screen.getByLabelText('Celular (WhatsApp)')
    fireEvent.change(phone, { target: { value: '1234' } })
    expect(screen.queryByText('Escribe un celular colombiano de 10 dígitos.')).toBeNull()
    fireEvent.blur(phone)
    expect(screen.getByText('Escribe un celular colombiano de 10 dígitos.')).toBeTruthy()
    const name = screen.getByLabelText('Nombre')
    fireEvent.change(name, { target: { value: 'A' } })
    fireEvent.blur(name)
    expect(screen.getByText('Escribe tu nombre (entre 2 y 60 caracteres).')).toBeTruthy()
  })

  it('el celular lleva prefijo +57, inputMode tel y autocompletar tel-national', () => {
    renderPage({})
    const phone = screen.getByLabelText('Celular (WhatsApp)')
    expect(phone.getAttribute('inputmode')).toBe('tel')
    expect(phone.getAttribute('autocomplete')).toBe('tel-national')
    expect(screen.getByText('+57')).toBeTruthy()
  })

  it('campo trampa: fuera de pantalla con CSS, aria-hidden, tabIndex -1 y autocomplete off', () => {
    renderPage({})
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement
    expect(trap.tabIndex).toBe(-1)
    expect(trap.getAttribute('autocomplete')).toBe('off')
    const box = trap.closest('[aria-hidden="true"]') as HTMLElement
    expect(box).toBeTruthy()
    expect(box.className).toContain('left-[-9999px]')
    // display:none lo detectan los bots; overflow-hidden sí está permitido.
    expect(box.className.split(' ')).not.toContain('hidden')
  })

  it('el consentimiento enlaza a /privacidad', () => {
    renderPage({})
    expect(screen.getByRole('link', { name: /Leer la política/ }).getAttribute('href')).toBe(
      '/privacidad',
    )
  })
})

describe('enviar', () => {
  it('201: envía el cuerpo correcto, guarda el token y navega con replace a /cita/<token>', async () => {
    const calls = renderPage({ 'POST /api/v1/public/appointments': created })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())
    expect(await screen.findByText('Pantalla de la cita /cita/tok123')).toBeTruthy()
    expect(localStorage.getItem('imperio:ultima-cita')).toBe('tok123')
    const post = calls.find((c) => c.method === 'POST') as Call
    expect(post.body).toEqual({
      service_id: SERVICES[0]!.id,
      barber_id: null,
      starts_at: `${TOMORROW}T10:00:00-05:00`,
      client: { name: 'Juan Pérez', phone: '3001234567' },
      consent: true,
      website: '',
    })
  })

  it('bloquea el doble clic: una sola petición mientras envía', async () => {
    let release: (r: Response) => void = () => {}
    const calls = renderPage({
      'POST /api/v1/public/appointments': () =>
        new Promise<Response>((resolve) => (release = resolve)),
    })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())
    await waitFor(() => expect(confirmButton().hasAttribute('disabled')).toBe(true))
    expect(confirmButton().getAttribute('aria-busy')).toBe('true')
    fireEvent.click(confirmButton())
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)
    release(created())
    await screen.findByText(/Pantalla de la cita/)
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('409: avisa, conserva lo escrito y ofrece hasta 3 alternativas que se eligen con un toque', async () => {
    let attempt = 0
    const calls = renderPage({
      'POST /api/v1/public/appointments': () => {
        attempt += 1
        if (attempt > 1) return created()
        return apiError(409, 'slot_unavailable', 'Ese horario ya no está disponible.', {
          alternatives: [
            slotAt('10:30:00'),
            slotAt('11:00:00'),
            slotAt('11:30:00'),
            slotAt('12:00:00'),
          ],
        })
      },
    })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())

    expect(
      (await screen.findByText('Ese horario se acaba de ocupar. Elige otro.')).closest(
        '[role="alert"]',
      ),
    ).toBeTruthy()
    const group = screen.getByRole('group', { name: 'Horarios cercanos disponibles' })
    expect(within(group).getAllByRole('button')).toHaveLength(3)
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Juan Pérez')
    expect((screen.getByLabelText('Celular (WhatsApp)') as HTMLInputElement).value).toBe(
      '300 123 4567',
    )
    expect(
      (screen.getByRole('checkbox', { name: /Acepto el tratamiento/ }) as HTMLInputElement).checked,
    ).toBe(true)
    // Refresca la disponibilidad tras el conflicto.
    await waitFor(() =>
      expect(calls.filter((c) => c.path.endsWith('/availability')).length).toBeGreaterThan(7),
    )

    fireEvent.click(within(group).getByRole('button', { name: '10:30 am' }))
    expect(
      within(group).getByRole('button', { name: '10:30 am' }).getAttribute('aria-pressed'),
    ).toBe('true')
    fireEvent.click(confirmButton())
    await screen.findByText(/Pantalla de la cita/)
    const posts = calls.filter((c) => c.method === 'POST')
    expect((posts[1]?.body as { starts_at: string }).starts_at).toBe(`${TOMORROW}T10:30:00-05:00`)
  })

  it('5xx: Notice con "Reintentar" que vuelve a enviar', async () => {
    let attempt = 0
    const calls = renderPage({
      'POST /api/v1/public/appointments': () => {
        attempt += 1
        return attempt === 1 ? apiError(503, 'unavailable', 'Servicio no disponible') : created()
      },
    })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(
      'No pudimos agendar tu cita. Revisa tu conexión e inténtalo de nuevo.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText(/Pantalla de la cita/)
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2)
  })

  it('error de red: también ofrece "Reintentar" y no pierde los datos', async () => {
    renderPage({
      'POST /api/v1/public/appointments': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())
    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Juan Pérez')
  })

  it('invalid_phone se muestra bajo el campo con el mensaje de la API', async () => {
    renderPage({
      'POST /api/v1/public/appointments': () =>
        apiError(422, 'invalid_phone', 'Escribe un celular colombiano de 10 dígitos'),
    })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())
    const field = screen.getByLabelText('Celular (WhatsApp)')
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(screen.getByText('Escribe un celular colombiano de 10 dígitos')).toBeTruthy()
  })

  it('too_many_active se muestra en un Notice danger con el mensaje de la API', async () => {
    renderPage({
      'POST /api/v1/public/appointments': () =>
        apiError(
          422,
          'too_many_active',
          'Ya tienes 3 citas agendadas con este celular. Cancela una para poder agendar otra.',
        ),
    })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Ya tienes 3 citas agendadas con este celular.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('consent_required se muestra bajo la casilla', async () => {
    renderPage({
      'POST /api/v1/public/appointments': () =>
        apiError(422, 'consent_required', 'Necesitamos tu autorización para guardar tus datos.'),
    })
    await chooseServiceAndSlot()
    fillForm()
    fireEvent.click(confirmButton())
    const box = screen.getByRole('checkbox', { name: /Acepto el tratamiento/ })
    await waitFor(() => expect(box.getAttribute('aria-invalid')).toBe('true'))
    expect(screen.getByText('Necesitamos tu autorización para guardar tus datos.')).toBeTruthy()
  })
})

describe('errores de carga', () => {
  it('si fallan los servicios, avisa y ofrece reintentar', async () => {
    let attempt = 0
    renderPage({
      'GET /api/v1/public/services': () => {
        attempt += 1
        if (attempt === 1) throw new TypeError('Failed to fetch')
        return json(200, SERVICES)
      },
    })
    expect((await screen.findByRole('alert')).textContent).toContain(
      'No pudimos cargar los servicios.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: SERVICE_BASIC })).toBeTruthy()
  })

  it('si falla la disponibilidad, avisa con "Reintentar" y el botón sigue deshabilitado', async () => {
    renderPage({
      'GET /api/v1/public/availability': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    fireEvent.click(await screen.findByRole('button', { name: SERVICE_BASIC }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('No pudimos cargar los horarios.')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(confirmButton().hasAttribute('disabled')).toBe(true)
  })

  it('muestra esqueletos mientras llegan los servicios', () => {
    renderPage({ 'GET /api/v1/public/services': () => new Promise<Response>(() => {}) })
    expect(screen.getByText('Cargando servicios…')).toBeTruthy()
    expect(document.querySelectorAll('[data-skeleton]').length).toBeGreaterThan(0)
  })
})

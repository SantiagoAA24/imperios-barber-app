import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../lib/api/queryClient'
import { AppRoutes } from './App'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const admin = { id: '3f2b8a52-0000-4000-8000-000000000001', name: 'Administrador', role: 'admin' }
const barber = { id: '3f2b8a52-0000-4000-8000-000000000002', name: 'Carlos', role: 'barber' }
const noSession = () =>
  json(401, { code: 'not_authenticated', message: 'Inicia sesión.', details: {} })

type Handlers = Record<string, () => Response>

function stubApi(handlers: Handlers) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const key = `${request.method} ${new URL(request.url).pathname}`
      calls.push(key)
      const handler = handlers[key]
      if (!handler) throw new Error(`Sin respuesta simulada para ${key}`)
      return handler()
    }),
  )
  return calls
}

function renderAt(path: string) {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('rutas públicas', () => {
  it('"/" muestra Próximamente con el nombre de la pantalla', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Próximamente' })).toBeTruthy()
    expect(screen.getByText('Agendar')).toBeTruthy()
  })

  it.each([
    ['/cita/abc123', 'Tu cita'],
    ['/productos', 'Productos'],
  ])('%s muestra su pantalla', (path, name) => {
    renderAt(path)
    expect(screen.getByText(name)).toBeTruthy()
  })

  it('/privacidad muestra el texto provisional', () => {
    renderAt('/privacidad')
    expect(screen.getByRole('heading', { name: 'Privacidad', level: 1 })).toBeTruthy()
  })

  it('/offline muestra la página sin conexión', () => {
    renderAt('/offline')
    expect(screen.getByRole('heading', { name: 'Sin conexión' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
  })

  it('una ruta desconocida muestra "No encontramos esa página"', () => {
    renderAt('/no-existe')
    expect(screen.getByRole('heading', { name: 'No encontramos esa página' })).toBeTruthy()
  })
})

describe('rutas protegidas', () => {
  it('sin sesión, /admin lleva a /ingresar', async () => {
    stubApi({ 'GET /api/v1/auth/me': noSession })
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeTruthy()
  })

  it('el administrador entra a /admin y ve el menú lateral', async () => {
    stubApi({ 'GET /api/v1/auth/me': () => json(200, admin) })
    renderAt('/admin/clientes')
    expect(await screen.findByRole('navigation', { name: 'Administración' })).toBeTruthy()
    for (const label of ['Resumen', 'Agenda', 'Servicios y productos', 'Barberos', 'Clientes']) {
      expect(screen.getByRole('link', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: 'Clientes' }).getAttribute('aria-current')).toBe('page')
  })

  it('un barbero que abre /admin vuelve a /barbero', async () => {
    stubApi({ 'GET /api/v1/auth/me': () => json(200, barber) })
    renderAt('/admin')
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeTruthy()
    for (const label of ['Agenda', 'Nueva cita', 'Mi horario']) {
      expect(screen.getByRole('link', { name: label })).toBeTruthy()
    }
  })

  it('un administrador que abre /barbero vuelve a /admin', async () => {
    stubApi({ 'GET /api/v1/auth/me': () => json(200, admin) })
    renderAt('/barbero/horario')
    expect(await screen.findByRole('navigation', { name: 'Administración' })).toBeTruthy()
  })
})

describe('/ingresar', () => {
  it('pide correo y contraseña antes de enviar', async () => {
    const calls = stubApi({ 'GET /api/v1/auth/me': noSession })
    renderAt('/ingresar')
    fireEvent.click(await screen.findByRole('button', { name: 'Ingresar' }))
    expect(screen.getByText('Escribe tu correo.')).toBeTruthy()
    expect(screen.getByText('Escribe tu contraseña.')).toBeTruthy()
    expect(calls).not.toContain('POST /api/v1/auth/login')
  })

  it('muestra el error del API en un aviso de peligro', async () => {
    stubApi({
      'GET /api/v1/auth/me': noSession,
      'POST /api/v1/auth/login': () =>
        json(401, {
          code: 'invalid_credentials',
          message: 'Correo o contraseña incorrectos.',
          details: {},
        }),
    })
    renderAt('/ingresar')
    fireEvent.change(await screen.findByLabelText('Correo'), {
      target: { value: 'admin@imperio.test' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'mala' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Correo o contraseña incorrectos.')
  })

  it('avisa si no hay conexión', async () => {
    stubApi({
      'GET /api/v1/auth/me': noSession,
      'POST /api/v1/auth/login': () => {
        throw new TypeError('Failed to fetch')
      },
    })
    renderAt('/ingresar')
    fireEvent.change(await screen.findByLabelText('Correo'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos conectarnos')
  })

  it.each([
    ['administrador', admin, 'Administración'],
    ['barbero', barber, 'Principal'],
  ])('el %s entra y llega a su área', async (_rol, user, nav) => {
    let loggedIn = false
    const calls = stubApi({
      'GET /api/v1/auth/me': () => (loggedIn ? json(200, user) : noSession()),
      'POST /api/v1/auth/login': () => {
        loggedIn = true
        return json(200, user)
      },
    })
    renderAt('/ingresar')
    fireEvent.change(await screen.findByLabelText('Correo'), {
      target: { value: 'admin@imperio.test' },
    })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    expect(await screen.findByRole('navigation', { name: nav })).toBeTruthy()
    await waitFor(() => expect(calls).toContain('POST /api/v1/auth/login'))
  })
})

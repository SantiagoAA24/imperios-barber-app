import { vi } from 'vitest'

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export const apiError = (status: number, code: string, message: string, details = {}) =>
  json(status, { code, message, details })

export type Call = { method: string; path: string; query: URLSearchParams; body: unknown }
export type Handler = (call: Call) => Response | Promise<Response>

/**
 * fetch falso por ruta ("GET /api/v1/public/services"). Cada llamada queda en `calls`.
 * Una ruta sin manejador falla la prueba: así se ven las peticiones que nadie esperaba.
 */
export function stubApi(routes: Record<string, Handler>) {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const url = new URL(request.url)
      const text = request.method === 'GET' ? '' : await request.text()
      const call: Call = {
        method: request.method,
        path: url.pathname,
        query: url.searchParams,
        body: text ? JSON.parse(text) : undefined,
      }
      calls.push(call)
      const handler = routes[`${call.method} ${call.path}`]
      if (!handler) throw new Error(`Sin respuesta simulada para ${call.method} ${call.path}`)
      return handler(call)
    }),
  )
  return calls
}

export const SERVICES = [
  {
    id: '11111111-0000-4000-8000-000000000001',
    name: 'Corte básico',
    description: null,
    price_cop: 22000,
    duration_min: 30,
    uses_resource: false,
  },
  {
    id: '11111111-0000-4000-8000-000000000002',
    name: 'Corte + barba',
    description: null,
    price_cop: 27000,
    duration_min: 45,
    uses_resource: false,
  },
  {
    id: '11111111-0000-4000-8000-000000000003',
    name: 'Limpieza facial',
    description: null,
    price_cop: 35000,
    duration_min: 30,
    uses_resource: true,
  },
]

export const BARBERS = [
  { id: '22222222-0000-4000-8000-000000000001', display_name: 'Barbero 1' },
  { id: '22222222-0000-4000-8000-000000000002', display_name: 'Barbero 2' },
]

export const BUSINESS = {
  name: 'Imperio Barber',
  slug: 'imperio',
  timezone: 'America/Bogota',
  tolerance_min: 5,
  slot_min: 30,
}

export function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: '33333333-0000-4000-8000-000000000001',
    status: 'booked',
    starts_at: '2026-11-13T11:00:00-05:00',
    ends_at: '2026-11-13T11:45:00-05:00',
    service: { id: SERVICES[1]!.id, name: 'Corte + barba', price_cop: 27000, duration_min: 45 },
    barber: BARBERS[0],
    client: { first_name: 'Juan' },
    business: { name: 'Imperio Barber' },
    can_cancel: true,
    can_reschedule: true,
    ...overrides,
  }
}

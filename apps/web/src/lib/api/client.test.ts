import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const expired = () =>
  json(401, { code: 'token_expired', message: 'Tu sesión venció.', details: {} })
const user = { id: '3f2b8a52-0000-4000-8000-000000000001', name: 'Admin', role: 'admin' }

/** fetch falso: `me` responde según la cola; /auth/refresh según `refresh`. */
function fakeFetch(meResponses: Array<() => Response>, refresh: () => Response) {
  const calls: string[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const path = new URL(request.url).pathname
    calls.push(`${request.method} ${path}`)
    if (path === '/api/v1/auth/refresh') return refresh()
    const next = meResponses.shift()
    if (!next) throw new Error(`Petición inesperada: ${path}`)
    return next()
  })
  return { fn, calls }
}

const base = 'http://localhost'

describe('cliente de API', () => {
  it('ante 401 token_expired refresca una vez y reintenta', async () => {
    const { fn, calls } = fakeFetch([expired, () => json(200, user)], () => json(200, user))
    const api = createApiClient({ baseUrl: base, fetch: fn as unknown as typeof fetch })
    const { data, response } = await api.GET('/api/v1/auth/me')
    expect(response.status).toBe(200)
    expect(data?.name).toBe('Admin')
    expect(calls).toEqual([
      'GET /api/v1/auth/me',
      'POST /api/v1/auth/refresh',
      'GET /api/v1/auth/me',
    ])
  })

  it('envía las cookies (credentials: include)', async () => {
    let credentials = ''
    const fn = vi.fn(async (input: RequestInfo | URL) => {
      credentials = (input as Request).credentials
      return json(200, user)
    })
    await createApiClient({ baseUrl: base, fetch: fn as unknown as typeof fetch }).GET(
      '/api/v1/auth/me',
    )
    expect(credentials).toBe('include')
  })

  it('con varias peticiones vencidas a la vez refresca una sola vez', async () => {
    const { fn, calls } = fakeFetch(
      [expired, expired, () => json(200, user), () => json(200, user)],
      () => json(200, user),
    )
    const api = createApiClient({ baseUrl: base, fetch: fn as unknown as typeof fetch })
    const [a, b] = await Promise.all([api.GET('/api/v1/auth/me'), api.GET('/api/v1/auth/me')])
    expect(a.response.status).toBe(200)
    expect(b.response.status).toBe(200)
    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('no reintenta más de una vez si el segundo intento también vence', async () => {
    const { fn, calls } = fakeFetch([expired, expired], () => json(200, user))
    const api = createApiClient({ baseUrl: base, fetch: fn as unknown as typeof fetch })
    const { response } = await api.GET('/api/v1/auth/me')
    expect(response.status).toBe(401)
    expect(calls.filter((c) => c.endsWith('/auth/refresh'))).toHaveLength(1)
  })

  it('si el refresh falla devuelve el 401 original', async () => {
    const { fn } = fakeFetch([expired], () =>
      json(401, { code: 'invalid_token', message: 'x', details: {} }),
    )
    const api = createApiClient({ baseUrl: base, fetch: fn as unknown as typeof fetch })
    const { response, error } = await api.GET('/api/v1/auth/me')
    expect(response.status).toBe(401)
    expect(error?.code).toBe('token_expired')
  })

  it('un 401 distinto (credenciales inválidas) no dispara refresh', async () => {
    const { fn, calls } = fakeFetch(
      [
        () =>
          json(401, {
            code: 'invalid_credentials',
            message: 'Correo o contraseña incorrectos.',
            details: {},
          }),
      ],
      () => json(200, user),
    )
    const api = createApiClient({ baseUrl: base, fetch: fn as unknown as typeof fetch })
    const { error } = await api.POST('/api/v1/auth/login', {
      body: { email: 'a@b.co', password: 'x' },
    })
    expect(error).toMatchObject({ code: 'invalid_credentials' })
    expect(calls).toEqual(['POST /api/v1/auth/login'])
  })

  it('reintenta conservando el cuerpo de la petición', async () => {
    const bodies: string[] = []
    let first = true
    const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      if (new URL(request.url).pathname.endsWith('/refresh')) return json(200, user)
      bodies.push(await request.text())
      if (first) {
        first = false
        return expired()
      }
      return json(200, user)
    })
    const api = createApiClient({ baseUrl: base, fetch: fn as unknown as typeof fetch })
    const body = { client_name: 'Ana', note: 'ñ' } as never
    const { response } = await api.POST('/api/v1/public/appointments', { body })
    expect(response.status).toBe(200)
    expect(bodies).toHaveLength(2)
    expect(bodies[1]).toBe(bodies[0])
    expect(bodies[0]).toContain('Ana')
  })
})

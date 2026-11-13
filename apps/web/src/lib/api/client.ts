import createClient, { type Middleware } from 'openapi-fetch'
import type { components, paths } from './schema'

export type ErrorBody = components['schemas']['ErrorBody']

/** Error del API con el cuerpo `{code, message, details}` de arquitectura.md §6. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>

  constructor(status: number, body: Partial<ErrorBody> | undefined) {
    super(body?.message ?? 'No pudimos completar la solicitud. Inténtalo de nuevo.')
    this.name = 'ApiError'
    this.status = status
    this.code = body?.code ?? 'unknown_error'
    this.details = body?.details ?? {}
  }
}

const REFRESH_PATH = '/api/v1/auth/refresh'
// Estas rutas nunca se reintentan: un 401 allí es una respuesta final (credenciales, sesión cerrada).
const NO_RETRY = [REFRESH_PATH, '/api/v1/auth/login', '/api/v1/auth/logout']

export type ApiClientOptions = {
  baseUrl?: string
  fetch?: typeof fetch
}

/**
 * Cliente tipado con cookies httpOnly. Ante 401 `token_expired` llama a /auth/refresh una sola vez
 * (una sola petición en vuelo, porque reusar un refresh ya rotado revoca la sesión) y reintenta.
 */
export function createApiClient({ baseUrl = '', fetch: fetchImpl }: ApiClientOptions = {}) {
  // Se resuelve al llamar, no al crear: así respeta un `fetch` sustituido después (pruebas).
  const doFetch: typeof fetch = (input, init) => (fetchImpl ?? globalThis.fetch)(input, init)
  const originals = new WeakMap<Request, Request>()
  let refreshing: Promise<boolean> | null = null

  function refreshSession(): Promise<boolean> {
    refreshing ??= doFetch(`${baseUrl}${REFRESH_PATH}`, { method: 'POST', credentials: 'include' })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  const refreshOnExpiry: Middleware = {
    onRequest({ request }) {
      // El cuerpo de una Request se consume al enviarla: se guarda una copia para el reintento.
      originals.set(request, request.clone())
      return request
    },
    async onResponse({ request, response }) {
      if (response.status !== 401) return undefined
      const path = new URL(request.url, 'http://localhost').pathname
      if (NO_RETRY.includes(path)) return undefined
      const body = (await response
        .clone()
        .json()
        .catch(() => undefined)) as Partial<ErrorBody> | undefined
      if (body?.code !== 'token_expired') return undefined
      const original = originals.get(request)
      if (!original || !(await refreshSession())) return undefined
      return doFetch(original)
    },
  }

  const client = createClient<paths>({
    baseUrl,
    credentials: 'include',
    fetch: (request) => doFetch(request),
  })
  client.use(refreshOnExpiry)
  return client
}

export const api = createApiClient({ baseUrl: import.meta.env.VITE_API_URL ?? '' })

/** Convierte el `error` de openapi-fetch (o una caída de red) en un ApiError. */
export function toApiError(status: number, error: unknown): ApiError {
  const body = error && typeof error === 'object' ? (error as Partial<ErrorBody>) : undefined
  return new ApiError(status, body && 'code' in body ? body : undefined)
}

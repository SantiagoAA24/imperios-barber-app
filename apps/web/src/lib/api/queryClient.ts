import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

/** El catálogo cambia poco: 60 s. La disponibilidad no se reutiliza: 0. */
export const CATALOG_STALE_MS = 60_000
export const AVAILABILITY_STALE_MS = 0

export const queryKeys = {
  business: ['business'] as const,
  services: ['services'] as const,
  barbers: ['barbers'] as const,
  products: ['products'] as const,
  availability: ['availability'] as const,
  appointment: ['appointment'] as const,
  me: ['me'] as const,
  agenda: ['barber', 'agenda'] as const,
  schedule: ['barber', 'schedule'] as const,
  timeOff: ['barber', 'time-off'] as const,
  nextFree: ['barber', 'next-free'] as const,
  adminServices: ['admin', 'services'] as const,
  adminProducts: ['admin', 'products'] as const,
  adminBarbers: ['admin', 'barbers'] as const,
  adminAgenda: ['admin', 'agenda'] as const,
  adminAvailability: ['admin', 'availability'] as const,
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CATALOG_STALE_MS,
        // Un 4xx no mejora al repetirlo; una caída de red o un 5xx sí merecen un reintento.
        retry: (failures, error) =>
          failures < 2 && !(error instanceof ApiError && error.status < 500),
      },
    },
  })
  client.setQueryDefaults(queryKeys.availability, { staleTime: AVAILABILITY_STALE_MS })
  client.setQueryDefaults(queryKeys.appointment, { staleTime: AVAILABILITY_STALE_MS })
  return client
}

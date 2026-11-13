import { useQuery } from '@tanstack/react-query'
import { api, toApiError } from './client'
import { queryKeys } from './queryClient'

type Result<T> = { data?: T; error?: unknown; response: Response }

async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await request
  if (data === undefined) throw toApiError(response.status, error)
  return data
}

export function useBusiness() {
  return useQuery({
    queryKey: queryKeys.business,
    queryFn: () => unwrap(api.GET('/api/v1/public/business')),
  })
}

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => unwrap(api.GET('/api/v1/public/services')),
  })
}

export function useBarbers() {
  return useQuery({
    queryKey: queryKeys.barbers,
    queryFn: () => unwrap(api.GET('/api/v1/public/barbers')),
  })
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: () => unwrap(api.GET('/api/v1/public/products')),
  })
}

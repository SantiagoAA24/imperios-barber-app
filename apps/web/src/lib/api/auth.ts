import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, toApiError } from './client'
import { queryKeys } from './queryClient'
import type { SessionUser, UserRole } from './types'

/** Pantalla de inicio de cada rol. */
export function homeForRole(role: UserRole): string {
  return role === 'admin' ? '/admin' : '/barbero'
}

/** Usuario de la sesión, o `null` si no hay sesión (401). Otros errores sí se lanzan. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<SessionUser | null> => {
      const { data, error, response } = await api.GET('/api/v1/auth/me')
      if (data) return data
      if (response.status === 401) return null
      throw toApiError(response.status, error)
    },
  })
}

export type LoginInput = { email: string; password: string }

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation<SessionUser, ApiError, LoginInput>({
    mutationFn: async (input) => {
      const { data, error, response } = await api.POST('/api/v1/auth/login', { body: input })
      if (!data) throw toApiError(response.status, error)
      return data
    },
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.POST('/api/v1/auth/logout'),
    onSettled: () => queryClient.setQueryData(queryKeys.me, null),
  })
}

export type ChangePasswordInput = { current: string; new: string }

export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation<SessionUser, ApiError, ChangePasswordInput>({
    mutationFn: async (body) => {
      const { data, error, response } = await api.POST('/api/v1/auth/change-password', { body })
      if (!data) throw toApiError(response.status, error)
      return data
    },
    onSuccess: (user) => queryClient.setQueryData(queryKeys.me, user),
  })
}

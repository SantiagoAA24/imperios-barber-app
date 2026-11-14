// Hooks de administración (/api/v1/admin). El estado del servidor vive en TanStack Query.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, toApiError } from './client'
import { unwrap } from './hooks'
import { queryKeys } from './queryClient'
import type {
  AdminAgenda,
  AdminOverview,
  AdminClientDetail,
  AdminClientList,
  ClientFilter,
  AdminAppointment,
  AdminAppointmentCreateBody,
  AdminProduct,
  BarberCreateBody,
  BarberCreated,
  BarberPatchBody,
  BarberUpdated,
  AdminProductList,
  AdminService,
  AdminServiceList,
  ProductCreateBody,
  ProductPatchBody,
  ServiceCreateBody,
  ServicePatchBody,
} from './types'

export function useAdminServices() {
  return useQuery({
    queryKey: queryKeys.adminServices,
    queryFn: () => unwrap(api.GET('/api/v1/admin/services')),
    staleTime: 0,
  })
}

/** Un cambio de catálogo también cambia lo que ve la web pública. */
function useAfterServiceChange() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.adminServices })
    void client.invalidateQueries({ queryKey: queryKeys.services })
    void client.invalidateQueries({ queryKey: queryKeys.availability })
  }
}

export function useCreateService() {
  const after = useAfterServiceChange()
  return useMutation<AdminService, ApiError, ServiceCreateBody>({
    mutationFn: (body) => unwrap(api.POST('/api/v1/admin/services', { body })),
    onSuccess: after,
  })
}

export function useUpdateService() {
  const after = useAfterServiceChange()
  return useMutation<AdminService, ApiError, { id: string; body: ServicePatchBody }>({
    mutationFn: ({ id, body }) =>
      unwrap(
        api.PATCH('/api/v1/admin/services/{service_id}', {
          params: { path: { service_id: id } },
          body,
        }),
      ),
    onSuccess: after,
  })
}

export function useDeleteService() {
  const after = useAfterServiceChange()
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      const { error, response } = await api.DELETE('/api/v1/admin/services/{service_id}', {
        params: { path: { service_id: id } },
      })
      if (!response.ok) {
        throw toApiError(response.status, error)
      }
    },
    onSuccess: after,
  })
}

/** Guarda el orden completo (ids de todos los servicios) y deja la lista nueva en caché. */
export function useReorderServices() {
  const client = useQueryClient()
  const after = useAfterServiceChange()
  return useMutation<AdminServiceList, ApiError, string[]>({
    mutationFn: (ids) => unwrap(api.PUT('/api/v1/admin/services/order', { body: { ids } })),
    onSuccess: (list) => {
      client.setQueryData(queryKeys.adminServices, list)
      after()
    },
  })
}

// --- productos --------------------------------------------------------------------------------

export function useAdminProducts() {
  return useQuery({
    queryKey: queryKeys.adminProducts,
    queryFn: () => unwrap(api.GET('/api/v1/admin/products')),
    staleTime: 0,
  })
}

function useAfterProductChange() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.adminProducts })
    void client.invalidateQueries({ queryKey: queryKeys.products })
  }
}

export function useCreateProduct() {
  const after = useAfterProductChange()
  return useMutation<AdminProduct, ApiError, ProductCreateBody>({
    mutationFn: (body) => unwrap(api.POST('/api/v1/admin/products', { body })),
    onSuccess: after,
  })
}

export function useUpdateProduct() {
  const after = useAfterProductChange()
  return useMutation<AdminProduct, ApiError, { id: string; body: ProductPatchBody }>({
    mutationFn: ({ id, body }) =>
      unwrap(
        api.PATCH('/api/v1/admin/products/{product_id}', {
          params: { path: { product_id: id } },
          body,
        }),
      ),
    onSuccess: after,
  })
}

export function useDeleteProduct() {
  const after = useAfterProductChange()
  return useMutation<void, ApiError, string>({
    mutationFn: async (id) => {
      const { error, response } = await api.DELETE('/api/v1/admin/products/{product_id}', {
        params: { path: { product_id: id } },
      })
      if (!response.ok) throw toApiError(response.status, error)
    },
    onSuccess: after,
  })
}

export function useReorderProducts() {
  const client = useQueryClient()
  const after = useAfterProductChange()
  return useMutation<AdminProductList, ApiError, string[]>({
    mutationFn: (ids) => unwrap(api.PUT('/api/v1/admin/products/order', { body: { ids } })),
    onSuccess: (list) => {
      client.setQueryData(queryKeys.adminProducts, list)
      after()
    },
  })
}

// --- barberos ---------------------------------------------------------------------------------

export function useAdminBarbers() {
  return useQuery({
    queryKey: queryKeys.adminBarbers,
    queryFn: () => unwrap(api.GET('/api/v1/admin/barbers')),
    staleTime: 0,
  })
}

function useAfterBarberChange() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.adminBarbers })
    // Quién aparece al agendar y con quién hay horarios cambia en la web pública.
    void client.invalidateQueries({ queryKey: queryKeys.barbers })
    void client.invalidateQueries({ queryKey: queryKeys.availability })
  }
}

export function useCreateBarber() {
  const after = useAfterBarberChange()
  return useMutation<BarberCreated, ApiError, BarberCreateBody>({
    mutationFn: (body) => unwrap(api.POST('/api/v1/admin/barbers', { body })),
    onSuccess: after,
  })
}

export function useUpdateBarber() {
  const after = useAfterBarberChange()
  return useMutation<BarberUpdated, ApiError, { id: string; body: BarberPatchBody }>({
    mutationFn: ({ id, body }) =>
      unwrap(
        api.PATCH('/api/v1/admin/barbers/{barber_id}', {
          params: { path: { barber_id: id } },
          body,
        }),
      ),
    onSuccess: after,
  })
}

export function useResetBarberPassword() {
  const after = useAfterBarberChange()
  return useMutation<{ temporary_password: string }, ApiError, string>({
    mutationFn: (id) =>
      unwrap(
        api.POST('/api/v1/admin/barbers/{barber_id}/reset-password', {
          params: { path: { barber_id: id } },
        }),
      ),
    onSuccess: after,
  })
}

// --- agenda -----------------------------------------------------------------------------------

/** Sondeo de la agenda: el servidor decide qué está vencido, el cliente solo vuelve a preguntar. */
export const ADMIN_AGENDA_REFRESH_MS = 30_000

export function useAdminAgenda(from: string, to: string) {
  return useQuery<AdminAgenda, ApiError>({
    queryKey: [...queryKeys.adminAgenda, from, to],
    queryFn: () =>
      unwrap(api.GET('/api/v1/admin/appointments', { params: { query: { from, to } } })),
    staleTime: 0,
    refetchInterval: ADMIN_AGENDA_REFRESH_MS,
    refetchIntervalInBackground: false,
  })
}

function useAfterAppointmentChange() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.adminAgenda })
    // Cancelar o crear cambia los huecos libres de la web pública y del formulario.
    void client.invalidateQueries({ queryKey: queryKeys.availability })
    void client.invalidateQueries({ queryKey: queryKeys.adminAvailability })
  }
}

export type AdminNewStatus = 'attended' | 'no_show' | 'cancelled'

export function useAdminChangeStatus() {
  const after = useAfterAppointmentChange()
  return useMutation<AdminAppointment, ApiError, { id: string; status: AdminNewStatus }>({
    mutationFn: ({ id, status }) =>
      unwrap(
        api.PATCH('/api/v1/admin/appointments/{appointment_id}', {
          params: { path: { appointment_id: id } },
          body: { status },
        }),
      ),
    onSettled: after,
  })
}

export function useAdminCreateAppointment() {
  const after = useAfterAppointmentChange()
  return useMutation<AdminAppointment, ApiError, AdminAppointmentCreateBody>({
    mutationFn: (body) => unwrap(api.POST('/api/v1/admin/appointments', { body })),
    onSettled: after,
  })
}

export function useAdminAvailability(params: {
  barberId: string
  serviceId: string
  date: string
}) {
  const ready = Boolean(params.barberId && params.serviceId && params.date)
  return useQuery({
    queryKey: [...queryKeys.adminAvailability, params.barberId, params.serviceId, params.date],
    enabled: ready,
    staleTime: 0,
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/admin/availability', {
          params: {
            query: { barber_id: params.barberId, service_id: params.serviceId, date: params.date },
          },
        }),
      ),
  })
}

// --- clientes ---------------------------------------------------------------------------------

export const CLIENTS_PAGE_SIZE = 20

/** Lista paginada por cursor; el filtrado y la búsqueda los hace el servidor. */
export function useAdminClients(params: { q: string; filter: ClientFilter }) {
  return useInfiniteQuery<
    AdminClientList,
    ApiError,
    { pages: AdminClientList[] },
    unknown[],
    string | null
  >({
    queryKey: [...queryKeys.adminClients, params.q, params.filter],
    initialPageParam: null,
    staleTime: 0,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/api/v1/admin/clients', {
          params: {
            query: {
              q: params.q || undefined,
              filter: params.filter,
              limit: CLIENTS_PAGE_SIZE,
              cursor: pageParam ?? undefined,
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_cursor,
  })
}

/**
 * Detalle con el celular COMPLETO. Cada lectura queda en audit_log en el servidor, así que no se
 * vuelve a pedir al enfocar la ventana ni se guarda en caché al cerrar el panel.
 */
export function useAdminClient(id: string | null) {
  return useQuery<AdminClientDetail, ApiError>({
    queryKey: [...queryKeys.adminClient, id],
    enabled: id !== null,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/admin/clients/{client_id}', {
          params: { path: { client_id: id ?? '' } },
        }),
      ),
  })
}

export function useSaveClientNotes() {
  const client = useQueryClient()
  return useMutation<{ id: string; notes: string | null }, ApiError, { id: string; notes: string }>(
    {
      mutationFn: ({ id, notes }) =>
        unwrap(
          api.PATCH('/api/v1/admin/clients/{client_id}', {
            params: { path: { client_id: id } },
            body: { notes: notes.trim() || null },
          }),
        ),
      onSuccess: (saved) => {
        // Se actualizan las notas en el detalle abierto sin volver a pedirlo (otra lectura auditada).
        client.setQueryData<AdminClientDetail>([...queryKeys.adminClient, saved.id], (old) =>
          old ? { ...old, notes: saved.notes } : old,
        )
      },
    },
  )
}

// --- resumen ----------------------------------------------------------------------------------

/** Sin fechas el servidor devuelve la semana actual (lunes a domingo, hora de Bogotá). */
export function useAdminOverview(range: { from: string; to: string } | null) {
  return useQuery<AdminOverview, ApiError>({
    queryKey: [...queryKeys.adminOverview, range?.from ?? 'week', range?.to ?? 'week'],
    staleTime: 0,
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/admin/overview', {
          params: { query: range ? { from: range.from, to: range.to } : {} },
        }),
      ),
  })
}

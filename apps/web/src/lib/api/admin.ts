// Hooks de administración (/api/v1/admin). El estado del servidor vive en TanStack Query.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, toApiError } from './client'
import { unwrap } from './hooks'
import { queryKeys } from './queryClient'
import type {
  AdminProduct,
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

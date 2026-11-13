import type { AdminService, ServiceCreateBody } from '../../lib/api/types'
import { formatCOP } from '../../lib/format'

/** Estado del formulario: todo como texto, igual que lo escribe la persona. */
export type ServiceDraft = {
  name: string
  description: string
  price: string
  duration: string
  usesResource: boolean
  active: boolean
}

export type ServiceErrors = Partial<Record<'name' | 'description' | 'price' | 'duration', string>>

export const EMPTY_DRAFT: ServiceDraft = {
  name: '',
  description: '',
  price: '',
  duration: '30',
  usesResource: false,
  active: true,
}

export function draftFromService(service: AdminService): ServiceDraft {
  return {
    name: service.name,
    description: service.description ?? '',
    price: formatCOP(service.price_cop),
    duration: String(service.duration_min),
    usesResource: service.resource_id !== null,
    active: service.active,
  }
}

/** '$22.000' -> 22000; vacío o sin dígitos -> null. */
export function parsePesos(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  return digits === '' ? null : Number(digits)
}

export function validateDraft(draft: ServiceDraft): ServiceErrors {
  const errors: ServiceErrors = {}
  const name = draft.name.trim()
  if (name.length < 2 || name.length > 60) errors.name = 'El nombre debe tener entre 2 y 60 letras.'
  if (draft.description.trim().length > 200) {
    errors.description = 'La descripción puede tener máximo 200 caracteres.'
  }
  const price = parsePesos(draft.price)
  if (price === null || price > 1_000_000) {
    errors.price = 'Escribe un precio entre $0 y $1.000.000.'
  }
  const minutes = Number(draft.duration)
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240 || minutes % 5 !== 0) {
    errors.duration = 'La duración debe ser múltiplo de 5, entre 5 y 240 minutos.'
  }
  return errors
}

/** Cuerpo para la API; `resourceId` es el recurso del negocio que se asigna si usa vaporizador. */
export function toBody(draft: ServiceDraft, resourceId: string | null): ServiceCreateBody {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    price_cop: parsePesos(draft.price) ?? 0,
    duration_min: Number(draft.duration),
    resource_id: draft.usesResource ? resourceId : null,
    active: draft.active,
  }
}

export function isDirty(a: ServiceDraft, b: ServiceDraft): boolean {
  return (
    a.name !== b.name ||
    a.description !== b.description ||
    parsePesos(a.price) !== parsePesos(b.price) ||
    a.duration !== b.duration ||
    a.usesResource !== b.usesResource ||
    a.active !== b.active
  )
}

/** Mueve un id una posición; devuelve la misma lista si ya está en el borde. */
export function moveId(ids: string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= ids.length) return ids
  const next = [...ids]
  ;[next[from], next[to]] = [next[to]!, next[from]!]
  return next
}

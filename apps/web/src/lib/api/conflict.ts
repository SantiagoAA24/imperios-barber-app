import { ApiError } from './client'

export type Alternative = { starts_at: string }

/** Máximo de horarios alternativos que se ofrecen tras un 409. */
export const MAX_ALTERNATIVES = 3

export function isSlotConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409 && error.code === 'slot_unavailable'
}

/** `details.alternatives` del 409 slot_unavailable: hasta 3 horarios, ya validados. */
export function slotAlternatives(error: ApiError): Alternative[] {
  const raw = error.details.alternatives
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (item): item is Alternative =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Alternative).starts_at === 'string',
    )
    .slice(0, MAX_ALTERNATIVES)
    .map((item) => ({ starts_at: item.starts_at }))
}

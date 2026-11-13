import type { AdminProduct, ProductCreateBody } from '../../lib/api/types'
import { formatCOP } from '../../lib/format'
import { parsePesos } from './serviceForm'

export type ProductDraft = {
  name: string
  description: string
  price: string
  availability: 'in_stock' | 'out_of_stock'
  imageUrl: string
  active: boolean
}

export type ProductErrors = Partial<Record<'name' | 'description' | 'price' | 'imageUrl', string>>

export const EMPTY_PRODUCT: ProductDraft = {
  name: '',
  description: '',
  price: '',
  availability: 'in_stock',
  imageUrl: '',
  active: true,
}

export function draftFromProduct(product: AdminProduct): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? '',
    price: formatCOP(product.price_cop),
    availability: product.availability,
    imageUrl: product.image_url ?? '',
    active: product.active,
  }
}

export function validateProduct(draft: ProductDraft): ProductErrors {
  const errors: ProductErrors = {}
  const name = draft.name.trim()
  if (name.length < 2 || name.length > 60) errors.name = 'El nombre debe tener entre 2 y 60 letras.'
  if (draft.description.trim().length > 200) {
    errors.description = 'La descripción puede tener máximo 200 caracteres.'
  }
  const price = parsePesos(draft.price)
  if (price === null || price > 1_000_000) errors.price = 'Escribe un precio entre $0 y $1.000.000.'
  const url = draft.imageUrl.trim()
  if (url !== '') {
    let ok = url.length <= 500
    try {
      ok = ok && new URL(url).protocol === 'https:'
    } catch {
      ok = false
    }
    if (!ok) errors.imageUrl = 'Usa un enlace que empiece por https:// (máximo 500 caracteres).'
  }
  return errors
}

export function productBody(draft: ProductDraft): ProductCreateBody {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    price_cop: parsePesos(draft.price) ?? 0,
    availability: draft.availability,
    image_url: draft.imageUrl.trim() || null,
    active: draft.active,
  }
}

export function isProductDirty(a: ProductDraft, b: ProductDraft): boolean {
  return (
    a.name !== b.name ||
    a.description !== b.description ||
    parsePesos(a.price) !== parsePesos(b.price) ||
    a.availability !== b.availability ||
    a.imageUrl !== b.imageUrl ||
    a.active !== b.active
  )
}

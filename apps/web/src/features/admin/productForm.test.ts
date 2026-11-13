import { describe, expect, it } from 'vitest'
import { EMPTY_PRODUCT, isProductDirty, productBody, validateProduct } from './productForm'

const ok = { ...EMPTY_PRODUCT, name: 'Cera', price: '$18.000' }

describe('productForm', () => {
  it('valida nombre, precio e imagen https', () => {
    expect(validateProduct(ok)).toEqual({})
    expect(validateProduct({ ...ok, name: 'C' }).name).toBeDefined()
    expect(validateProduct({ ...ok, price: '' }).price).toBeDefined()
    expect(validateProduct({ ...ok, imageUrl: 'http://x.co/a.jpg' }).imageUrl).toBeDefined()
    expect(validateProduct({ ...ok, imageUrl: 'no es un enlace' }).imageUrl).toBeDefined()
    expect(validateProduct({ ...ok, imageUrl: 'https://x.co/a.jpg' })).toEqual({})
  })
  it('arma el cuerpo con nulos para lo vacío', () => {
    expect(productBody(ok)).toEqual({
      name: 'Cera',
      description: null,
      price_cop: 18000,
      availability: 'in_stock',
      image_url: null,
      active: true,
    })
  })
  it('detecta cambios', () => {
    expect(isProductDirty(ok, { ...ok, price: '18000' })).toBe(false)
    expect(isProductDirty(ok, { ...ok, availability: 'out_of_stock' })).toBe(true)
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { ProductCard } from './ProductCard'

describe('ProductCard', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <ProductCard name="Cera mate" priceCop={28000} inStock imageUrl="/cera.png" />
        <ProductCard name="Bálsamo para barba" priceCop={30000} inStock={false} />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('disponible: palabra "Disponible", ícono y precio en pesos', () => {
    const { container } = render(<ProductCard name="Cera mate" priceCop={28000} inStock />)
    expect(screen.getByText('Disponible')).toBeTruthy()
    expect(container.querySelector('article svg:not([width="36"])')).toBeTruthy()
    expect(screen.getByText('$28.000')).toBeTruthy()
  })

  it('agotado: dice "Agotado", nunca solo color', () => {
    render(<ProductCard name="Bálsamo para barba" priceCop={30000} inStock={false} />)
    expect(screen.getByText('Agotado')).toBeTruthy()
    expect(screen.queryByText('Disponible')).toBeNull()
  })

  it('sin imagen muestra el marcador; con imagen, la foto decorativa', () => {
    const { container, rerender } = render(<ProductCard name="Cera" priceCop={1000} inStock />)
    expect(screen.getByText('Foto del producto')).toBeTruthy()
    rerender(<ProductCard name="Cera" priceCop={1000} inStock imageUrl="/cera.png" />)
    expect(screen.queryByText('Foto del producto')).toBeNull()
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')
  })
})

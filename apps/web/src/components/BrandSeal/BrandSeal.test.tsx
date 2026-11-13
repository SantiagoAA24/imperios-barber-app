import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import { BrandSeal } from './BrandSeal'

describe('BrandSeal', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <BrandSeal size={44} />
        <BrandSeal size={96} />
        <BrandSeal size={132} />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('tiene texto alternativo y es cuadrado', () => {
    render(<BrandSeal size={96} />)
    const img = screen.getByRole('img', { name: 'Logo de Barbería Imperio' })
    expect(img.getAttribute('width')).toBe(img.getAttribute('height'))
  })

  it('el resplandor solo aparece desde 96 px', () => {
    const { rerender } = render(<BrandSeal size={44} glow />)
    expect(screen.getByRole('img').className).not.toContain('shadow-logo-glow')
    rerender(<BrandSeal size={96} />)
    expect(screen.getByRole('img').className).toContain('shadow-logo-glow')
  })
})

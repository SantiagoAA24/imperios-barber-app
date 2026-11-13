import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('es decorativo: oculto a lectores de pantalla y sin violaciones', async () => {
    const { container } = render(<Skeleton className="h-control-46" />)
    expect(container.querySelector('[data-skeleton]')?.getAttribute('aria-hidden')).toBe('true')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('desactiva la animación con prefers-reduced-motion', () => {
    const { container } = render(<Skeleton />)
    expect(container.firstElementChild?.className).toContain('motion-reduce:animate-none')
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { StepHeader } from './StepHeader'

describe('StepHeader', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <main>
        <h1>Agenda tu cita</h1>
        <StepHeader step={1} title="Servicio" />
        <StepHeader step={3} title="Día y hora" />
      </main>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('usa un h2 real con el título', () => {
    render(<StepHeader step={2} title="Barbero" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Barbero' })).toBeTruthy()
  })

  it('el número es decorativo y no se lee dos veces', () => {
    render(<StepHeader step={2} title="Barbero" />)
    expect(screen.getByText('2').getAttribute('aria-hidden')).toBe('true')
  })

  it('admite h3', () => {
    render(<StepHeader step={1} title="Detalle" level={3} />)
    expect(screen.getByRole('heading', { level: 3 })).toBeTruthy()
  })

  it('con headingRef el encabezado puede recibir foco por código', () => {
    const ref = { current: null as HTMLHeadingElement | null }
    render(<StepHeader step={2} title="Día y hora" headingRef={ref} />)
    ref.current?.focus()
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Día y hora' }))
    expect(ref.current?.getAttribute('tabindex')).toBe('-1')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { Switch } from './Switch'

describe('Switch', () => {
  it('es un role="switch" con nombre y estado accesibles', () => {
    render(<Switch label="Turno sin cita" checked={false} onCheckedChange={() => {}} />)
    const control = screen.getByRole('switch', { name: 'Turno sin cita' })
    expect(control.getAttribute('aria-checked')).toBe('false')
  })

  it('refleja el estado encendido', () => {
    render(<Switch label="Turno sin cita" checked onCheckedChange={() => {}} />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('avisa el valor contrario al pulsar', () => {
    const onChange = vi.fn()
    render(<Switch label="Trabajo este día" checked={false} onCheckedChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('deshabilitado no cambia', () => {
    const onChange = vi.fn()
    render(<Switch label="Trabajo este día" checked disabled onCheckedChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <Switch label="Turno sin cita" checked={false} onCheckedChange={() => {}} />
        <Switch label="Trabajo este día" checked onCheckedChange={() => {}} />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

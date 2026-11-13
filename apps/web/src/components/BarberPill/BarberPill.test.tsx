import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { UsersIcon } from '../icons'
import { BarberPill } from './BarberPill'

describe('BarberPill', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <BarberPill name="Cualquiera" icon={<UsersIcon size={18} />} selected />
        <BarberPill name="Carlos Beltrán" selected={false} />
        <BarberPill name="Barbero 2" selected={false} disabled />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('saca las iniciales del nombre si no se dan', () => {
    render(<BarberPill name="Carlos Beltrán" selected={false} />)
    expect(screen.getByRole('button', { name: 'Carlos Beltrán' }).textContent).toBe(
      'CBCarlos Beltrán',
    )
  })

  it('la selección va en aria-pressed', () => {
    const { rerender } = render(<BarberPill name="Barbero 1" selected={false} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
    rerender(<BarberPill name="Barbero 1" selected />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('responde al clic y no al estar deshabilitada', () => {
    const onClick = vi.fn()
    const { rerender } = render(<BarberPill name="Barbero 1" selected={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<BarberPill name="Barbero 1" selected={false} onClick={onClick} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

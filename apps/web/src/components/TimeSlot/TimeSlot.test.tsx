import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { declaredHeight } from '../../test/measure'
import { TimeSlot } from './TimeSlot'

describe('TimeSlot', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <div>
        <TimeSlot time="10:00 am" selected={false} />
        <TimeSlot time="11:00 am" selected />
        <TimeSlot time="11:30 am" selected={false} disabled />
      </div>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('la selección va en aria-pressed', () => {
    const { rerender } = render(<TimeSlot time="10:00 am" selected={false} />)
    expect(screen.getByRole('button', { name: '10:00 am' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
    rerender(<TimeSlot time="10:00 am" selected />)
    expect(screen.getByRole('button', { name: '10:00 am' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('no disponible: deshabilitada, no recibe clic', () => {
    const onClick = vi.fn()
    render(<TimeSlot time="11:30 am" selected={false} disabled onClick={onClick} />)
    const slot = screen.getByRole('button', { name: '11:30 am' }) as HTMLButtonElement
    expect(slot.disabled).toBe(true)
    fireEvent.click(slot)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disponible: llama al manejador', () => {
    const onClick = vi.fn()
    render(<TimeSlot time="12:30 pm" selected={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: '12:30 pm' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('mide al menos 44 px de alto', () => {
    render(<TimeSlot time="10:00 am" selected={false} />)
    expect(declaredHeight(screen.getByRole('button'))).toBeGreaterThanOrEqual(44)
  })
})

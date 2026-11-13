import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { declaredHeight } from '../../test/measure'
import { DayChip } from './DayChip'

describe('DayChip', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <DayChip weekday="Vie" day={13} selected />
        <DayChip weekday="Sáb" day={14} selected={false} />
        <DayChip weekday="Dom" day={15} selected={false} disabled />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('muestra el día de la semana y el número', () => {
    render(<DayChip weekday="Vie" day={13} selected={false} />)
    expect(screen.getByText('Vie')).toBeTruthy()
    expect(screen.getByText('13')).toBeTruthy()
  })

  it('la selección va en aria-pressed', () => {
    const { rerender } = render(<DayChip weekday="Vie" day={13} selected={false} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
    rerender(<DayChip weekday="Vie" day={13} selected />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('deshabilitado no responde al clic', () => {
    const onClick = vi.fn()
    render(<DayChip weekday="Dom" day={15} selected={false} disabled onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('mide al menos 44 px de alto', () => {
    render(<DayChip weekday="Vie" day={13} selected={false} />)
    expect(declaredHeight(screen.getByRole('button'))).toBeGreaterThanOrEqual(44)
  })

  it('muestra la nota ("sin cupo") como texto, no solo como estilo', () => {
    render(<DayChip weekday="Dom" day={15} selected={false} disabled note="sin cupo" />)
    expect(screen.getByText('sin cupo')).toBeTruthy()
  })
})

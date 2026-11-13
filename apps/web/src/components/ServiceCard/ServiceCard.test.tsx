import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { declaredHeight } from '../../test/measure'
import { ServiceCard } from './ServiceCard'

describe('ServiceCard', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <ServiceCard name="Corte básico" durationMin={30} priceCop={22000} selected={false} />
        <ServiceCard name="Corte + barba" durationMin={45} priceCop={27000} selected />
        <ServiceCard
          name="Limpieza facial"
          durationMin={60}
          note="con vaporizador"
          priceCop={30000}
          selected={false}
        />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('muestra nombre, duración con nota y precio en pesos', () => {
    render(
      <ServiceCard
        name="Corte + limpieza facial"
        durationMin={60}
        note="con vaporizador"
        priceCop={50000}
        selected={false}
      />,
    )
    expect(screen.getByText('Corte + limpieza facial')).toBeTruthy()
    expect(screen.getByText('1 hora · con vaporizador')).toBeTruthy()
    expect(screen.getByText('$50.000')).toBeTruthy()
  })

  it('marca "~" cuando la duración es aproximada y omite la duración en productos', () => {
    const { rerender } = render(
      <ServiceCard name="Corte" durationMin={45} approximate priceCop={27000} selected={false} />,
    )
    expect(screen.getByText('~45 min')).toBeTruthy()
    rerender(<ServiceCard name="Cera" priceCop={18000} selected={false} />)
    expect(screen.queryByText(/min/)).toBeNull()
  })

  it('expone la selección con aria-pressed, no solo con color', () => {
    const { rerender } = render(<ServiceCard name="Corte" priceCop={22000} selected={false} />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false')
    rerender(<ServiceCard name="Corte" priceCop={22000} selected />)
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true')
  })

  it('llama al manejador y respeta disabled', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <ServiceCard name="Corte" priceCop={22000} selected={false} onClick={onClick} />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(
      <ServiceCard name="Corte" priceCop={22000} selected={false} onClick={onClick} disabled />,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('mide al menos 44 px de alto', () => {
    render(<ServiceCard name="Corte" priceCop={22000} selected={false} />)
    expect(declaredHeight(screen.getByRole('button'))).toBeGreaterThanOrEqual(44)
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { AppointmentCard } from './AppointmentCard'

const props = {
  date: 'viernes 13 nov',
  time: '11:00 am',
  service: 'Corte + barba',
  barber: 'Barbero 1',
  duration: '~45 min',
  totalCop: 27000,
}

describe('AppointmentCard', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container, rerender } = render(<AppointmentCard {...props} />)
    expect(await axe(container)).toHaveNoViolations()
    rerender(<AppointmentCard {...props} muted />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('muestra fecha, hora, servicio, barbero, duración y total en pesos', () => {
    render(<AppointmentCard {...props} />)
    for (const text of ['viernes 13 nov', '11:00 am', 'Corte + barba', 'Barbero 1', '~45 min']) {
      expect(screen.getByText(text)).toBeTruthy()
    }
    expect(screen.getByText('$27.000')).toBeTruthy()
    expect(screen.getByText('Total (se paga en el local)')).toBeTruthy()
  })

  it('nunca muestra el celular', () => {
    render(<AppointmentCard {...props} />)
    expect(screen.queryByText(/\+57|celular/i)).toBeNull()
  })
})

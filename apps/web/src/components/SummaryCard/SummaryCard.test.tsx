import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { Button } from '../Button'
import { Notice } from '../Notice'
import { SummaryCard } from './SummaryCard'

const base = {
  service: 'Corte + barba',
  barber: 'Cualquiera',
  duration: '~45 min',
  totalCop: 27000,
}

describe('SummaryCard', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <main>
        <SummaryCard {...base} dateTime="viernes 13 nov · 11:00 am">
          <Button block>Confirmar cita</Button>
          <Notice>
            Llega puntual: la tolerancia máxima es de 5 minutos después de la hora pactada.
          </Notice>
        </SummaryCard>
      </main>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('sin hora elegida y con el botón deshabilitado no tiene violaciones', async () => {
    const { container } = render(
      <main>
        <SummaryCard {...base} dateTime={null}>
          <Button block disabled>
            Elige una hora para continuar
          </Button>
        </SummaryCard>
      </main>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('repite lo elegido y aclara que el total se paga en el local', () => {
    render(<SummaryCard {...base} dateTime="viernes 13 nov · 11:00 am" />)
    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeTruthy()
    expect(screen.getByText('Corte + barba')).toBeTruthy()
    expect(screen.getByText('viernes 13 nov · 11:00 am')).toBeTruthy()
    expect(screen.getByText('Total (se paga en el local)')).toBeTruthy()
    expect(screen.getByText('$27.000')).toBeTruthy()
  })

  it('sin hora elegida, la fila de fecha dice "Elige una hora"', () => {
    render(<SummaryCard {...base} dateTime={null} />)
    expect(screen.getByText('Elige una hora')).toBeTruthy()
  })

  it('renderiza el botón y el aviso que recibe', () => {
    render(
      <SummaryCard {...base} dateTime={null}>
        <Button disabled>Elige una hora para continuar</Button>
      </SummaryCard>,
    )
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
  })
})

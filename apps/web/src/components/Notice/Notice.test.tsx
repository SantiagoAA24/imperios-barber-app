import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { Notice } from './Notice'

describe('Notice', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <Notice>
          Llega puntual: la tolerancia máxima es de 5 minutos después de la hora pactada.
        </Notice>
        <Notice tone="success">Cita confirmada. Te llegará un recordatorio por WhatsApp.</Notice>
        <Notice tone="danger">Esa hora ya no está disponible. Elige otra.</Notice>
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('el error se anuncia al instante con role="alert"', () => {
    render(<Notice tone="danger">Esa hora ya no está disponible. Elige otra.</Notice>)
    expect(screen.getByRole('alert').textContent).toContain('Esa hora ya no está disponible')
  })

  it('el éxito usa role="status" y la información no tiene rol vivo', () => {
    const { rerender } = render(<Notice tone="success">Cita confirmada.</Notice>)
    expect(screen.getByRole('status')).toBeTruthy()
    rerender(<Notice>Llega puntual.</Notice>)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('siempre lleva un icono además del color', () => {
    const { container, rerender } = render(<Notice>Aviso</Notice>)
    expect(container.querySelector('svg')).toBeTruthy()
    rerender(<Notice tone="danger">Error</Notice>)
    expect(container.querySelector('svg')).toBeTruthy()
    rerender(<Notice tone="success">Éxito</Notice>)
    expect(container.querySelector('svg')).toBeTruthy()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { describe, expect, it, vi } from 'vitest'
import '../../styles/index.css'
import { declaredHeight } from '../../test/measure'
import { Button } from './Button'

describe('Button', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <Button>Confirmar cita</Button>
        <Button variant="secondary">Reagendar</Button>
        <Button disabled>Elige una hora para continuar</Button>
        <Button loading>Confirmando</Button>
        <Button href="/productos">Ver productos</Button>
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('es un botón real y llama al manejador', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Confirmar cita</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cita' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('deshabilitado no dispara clic', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Elige una hora para continuar
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Elige una hora para continuar' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('cargando: se anuncia ocupado y no permite doble envío', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Confirmando
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Confirmando' }) as HTMLButtonElement
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('con href es un enlace real', () => {
    render(<Button href="/productos">Ver productos</Button>)
    expect(screen.getByRole('link', { name: 'Ver productos' }).getAttribute('href')).toBe(
      '/productos',
    )
  })

  it('muestra el icono junto al texto', () => {
    render(<Button icon={<svg data-testid="icono" />}>Agregar</Button>)
    expect(screen.getByTestId('icono')).toBeTruthy()
  })

  it('mide al menos 44 px de alto', () => {
    render(<Button size="md">Cancelar cita</Button>)
    const min = declaredHeight(screen.getByRole('button'))
    expect(min).toBeGreaterThanOrEqual(44)
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { declaredHeight } from '../../test/measure'
import { TextField } from './TextField'

describe('TextField', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <TextField label="Nombre" placeholder="¿Cómo te llamas?" />
        <TextField label="Celular (WhatsApp)" prefix="+57" type="tel" inputMode="numeric" />
        <TextField label="Correo" hint="Usa el correo del negocio" />
        <TextField label="Contraseña" type="password" error="Escribe tu contraseña." />
        <TextField label="Apellido" disabled />
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('une la etiqueta con el campo', () => {
    render(<TextField label="Nombre" />)
    expect(screen.getByLabelText('Nombre')).toBeTruthy()
  })

  it('muestra el prefijo +57 fuera del campo editable', () => {
    render(<TextField label="Celular" prefix="+57" />)
    expect(screen.getByText('+57')).toBeTruthy()
  })

  it('con error: aria-invalid, mensaje enlazado y texto visible', () => {
    render(<TextField label="Correo" error="Ese correo no es válido." />)
    const input = screen.getByLabelText('Correo')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const message = screen.getByText('Ese correo no es válido.')
    expect(input.getAttribute('aria-describedby')).toContain(message.parentElement?.id ?? 'x')
  })

  it('con ayuda: la enlaza con aria-describedby', () => {
    render(<TextField label="Correo" hint="Usa tu correo del negocio" />)
    const hint = screen.getByText('Usa tu correo del negocio')
    expect(screen.getByLabelText('Correo').getAttribute('aria-describedby')).toBe(hint.id)
  })

  it('es controlado', () => {
    function Controlled() {
      const [value, setValue] = useState('')
      return <TextField label="Nombre" value={value} onChange={(e) => setValue(e.target.value)} />
    }
    render(<Controlled />)
    const input = screen.getByLabelText('Nombre') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Ana' } })
    expect(input.value).toBe('Ana')
  })

  it('deshabilitado no es editable', () => {
    render(<TextField label="Apellido" disabled />)
    expect((screen.getByLabelText('Apellido') as HTMLInputElement).disabled).toBe(true)
  })

  it('el campo mide al menos 44 px de alto', () => {
    render(<TextField label="Nombre" />)
    const box = screen.getByLabelText('Nombre').parentElement as HTMLElement
    expect(declaredHeight(box)).toBeGreaterThanOrEqual(44)
  })
})

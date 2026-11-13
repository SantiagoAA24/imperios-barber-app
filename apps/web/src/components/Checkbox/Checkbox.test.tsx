import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { Checkbox } from './Checkbox'

describe('Checkbox', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <>
        <Checkbox>
          Acepto el tratamiento de mis datos personales (<a href="/privacidad">ver política</a>)
        </Checkbox>
        <Checkbox error="Necesitamos tu autorización.">Acepto</Checkbox>
      </>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('se marca al pulsar la etiqueta y avisa el cambio', () => {
    const onChange = vi.fn()
    render(<Checkbox onChange={onChange}>Acepto el tratamiento de mis datos personales</Checkbox>)
    fireEvent.click(screen.getByText('Acepto el tratamiento de mis datos personales'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('el error se asocia a la casilla con aria-describedby y aria-invalid', () => {
    render(<Checkbox error="Necesitamos tu autorización.">Acepto</Checkbox>)
    const box = screen.getByRole('checkbox')
    expect(box.getAttribute('aria-invalid')).toBe('true')
    const id = box.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(id)?.textContent).toContain('Necesitamos tu autorización.')
  })
})

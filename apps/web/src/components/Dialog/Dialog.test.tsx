import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { Dialog } from './Dialog'

describe('Dialog', () => {
  it('abierto: es un <dialog> con nombre accesible y sin violaciones', async () => {
    const { container } = render(
      <Dialog open onClose={() => {}} title="¿Cancelar tu cita?">
        <button data-autofocus>Mantener mi cita</button>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')
    expect(dialog?.hasAttribute('open')).toBe(true)
    expect(screen.getByRole('dialog', { name: '¿Cancelar tu cita?' })).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('al abrir enfoca el elemento con data-autofocus', () => {
    render(
      <Dialog open onClose={() => {}} title="Título">
        <button>Otro</button>
        <button data-autofocus>Mantener mi cita</button>
      </Dialog>,
    )
    expect(document.activeElement?.textContent).toBe('Mantener mi cita')
  })

  it('cerrado no pinta su contenido', () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}} title="Título">
        <p>Contenido</p>
      </Dialog>,
    )
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(false)
    expect(screen.queryByText('Contenido')).toBeNull()
  })

  it('el evento close (Escape) y tocar el fondo avisan con onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Dialog open onClose={onClose} title="Título">
        <p>Contenido</p>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog') as HTMLDialogElement
    fireEvent(dialog, new Event('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByText('Contenido'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

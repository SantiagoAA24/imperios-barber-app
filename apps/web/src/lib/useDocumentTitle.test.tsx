import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { pageTitle, useDocumentTitle } from './useDocumentTitle'

function Page({ title }: { title: string }) {
  useDocumentTitle(title)
  return null
}

describe('useDocumentTitle', () => {
  it('compone «Pantalla · Imperio Barber»', () => {
    expect(pageTitle('Agendar cita')).toBe('Agendar cita · Imperio Barber')
  })

  it('cambia el título al montar y lo restaura al salir', () => {
    document.title = 'Imperio Barber'
    const view = render(<Page title="Mi agenda" />)
    expect(document.title).toBe('Mi agenda · Imperio Barber')
    view.rerender(<Page title="Mi horario" />)
    expect(document.title).toBe('Mi horario · Imperio Barber')
    view.unmount()
    expect(document.title).toBe('Imperio Barber')
  })
})

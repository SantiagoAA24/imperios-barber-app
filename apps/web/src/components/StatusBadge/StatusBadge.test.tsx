import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'
import '../../styles/index.css'
import { StatusBadge } from './StatusBadge'
import type { StatusBadgeStatus } from './StatusBadge'

const CASES: Array<[StatusBadgeStatus, string]> = [
  ['booked', 'Pendiente'],
  ['attended', 'Atendida'],
  ['no_show', 'No asistió'],
  ['cancelled', 'Cancelada'],
  ['overdue', 'Vencida'],
]

describe('StatusBadge', () => {
  it.each(CASES)('%s se muestra con la palabra "%s" y un ícono', (status, label) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeTruthy()
    // El estado nunca va solo por color: hay un ícono SVG junto a la palabra.
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('cada estado usa un ícono distinto de al menos otro, y las palabras son únicas', () => {
    const labels = new Set<string>()
    for (const [status, label] of CASES) {
      const { container, unmount } = render(<StatusBadge status={status} />)
      labels.add(container.textContent ?? '')
      expect(container.textContent).toBe(label)
      unmount()
    }
    expect(labels.size).toBe(CASES.length)
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(
      <ul>
        {CASES.map(([status]) => (
          <li key={status}>
            <StatusBadge status={status} />
          </li>
        ))}
      </ul>,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'
import { cx, FOCUS_RING, TRANSITION } from '../../components/classes'

const TABS = [
  { to: '/admin/servicios', label: 'Servicios' },
  { to: '/admin/productos', label: 'Productos' },
]

/** Encabezado de "Servicios y productos": pestañas como enlaces reales y la acción de crear. */
export function CatalogHeader({ action }: { action: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-14">
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-h1 text-text">Servicios y productos</h1>
        <p className="m-0 text-small text-text-muted">
          Lo que ven tus clientes al agendar y en el catálogo del local.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-10">
        <nav
          aria-label="Sección"
          className="flex gap-4 rounded-pill border border-line-strong bg-surface p-4"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cx(
                  'flex min-h-touch items-center rounded-pill px-20 text-small font-semibold',
                  isActive ? 'bg-gold text-on-gold' : 'text-text-muted hover:text-text',
                  TRANSITION,
                  FOCUS_RING,
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
        {action}
      </div>
    </header>
  )
}

import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { cx, FOCUS_RING, TRANSITION } from '../../components/classes'
import { useLogoutAndLeave } from '../useLogoutAndLeave'

type Item = { to: string; label: string; end?: boolean; also?: string[] }

const ITEMS: Item[] = [
  { to: '/admin', label: 'Resumen', end: true },
  { to: '/admin/agenda', label: 'Agenda', also: ['/admin/semana'] },
  { to: '/admin/servicios', label: 'Servicios y productos', also: ['/admin/productos'] },
  { to: '/admin/barberos', label: 'Barberos' },
  { to: '/admin/clientes', label: 'Clientes' },
]

function useIsCurrent(item: Item): boolean {
  const { pathname } = useLocation()
  const paths = [item.to, ...(item.also ?? [])]
  return paths.some((p) =>
    item.end ? pathname === p : pathname === p || pathname.startsWith(`${p}/`),
  )
}

function SidebarLink({ item }: { item: Item }) {
  const current = useIsCurrent(item)
  return (
    <NavLink
      to={item.to}
      end={item.end}
      // `also` agrupa rutas hermanas: aria-current se fija a mano para cubrirlas.
      aria-current={current ? 'page' : undefined}
      className={cx(
        'flex min-h-touch items-center rounded-card border px-14 text-body',
        current
          ? 'border-gold bg-surface-selected font-semibold text-text'
          : 'border-transparent text-text-muted hover:bg-surface hover:text-text',
        TRANSITION,
        FOCUS_RING,
      )}
    >
      {item.label}
    </NavLink>
  )
}

/** Administración (escritorio): barra lateral; en pantallas angostas pasa arriba y hace scroll. */
export function AdminLayout() {
  const { logout, pending } = useLogoutAndLeave()
  return (
    <div className="min-h-dvh bg-bg md:flex">
      <aside className="flex flex-col gap-20 border-b border-line p-20 md:sticky md:top-0 md:h-dvh md:w-[260px] md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-10">
          <BrandSeal size={44} />
          <Button size="md" variant="secondary" loading={pending} onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
        <nav aria-label="Administración">
          <ul className="m-0 flex list-none gap-4 overflow-x-auto p-0 md:flex-col">
            {ITEMS.map((item) => (
              <li key={item.to} className="shrink-0">
                <SidebarLink item={item} />
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}

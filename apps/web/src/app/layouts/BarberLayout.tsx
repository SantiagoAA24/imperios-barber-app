import { NavLink, Outlet } from 'react-router-dom'
import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { CalendarIcon, ClockIcon, PlusCircleIcon } from '../../components/icons'
import { cx, FOCUS_RING, TRANSITION } from '../../components/classes'
import { useLogoutAndLeave } from '../useLogoutAndLeave'

const TABS = [
  { to: '/barbero', label: 'Agenda', icon: <CalendarIcon size={22} />, end: true },
  { to: '/barbero/nueva', label: 'Nueva cita', icon: <PlusCircleIcon size={22} />, end: false },
  { to: '/barbero/horario', label: 'Mi horario', icon: <ClockIcon size={22} />, end: false },
]

/** Barbero (móvil): cabecera con el sello y barra inferior de 3 pestañas. */
export function BarberLayout() {
  const { logout, pending } = useLogoutAndLeave()
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] pb-[calc(var(--control-54)+var(--space-20))]">
        <header className="flex items-center justify-between px-20 py-14">
          <BrandSeal size={44} />
          <Button size="md" variant="secondary" loading={pending} onClick={logout}>
            Cerrar sesión
          </Button>
        </header>
        <Outlet />
      </div>
      <nav
        aria-label="Principal"
        className="fixed right-[0px] bottom-[0px] left-[0px] z-10 border-t border-line bg-bg"
      >
        <ul className="m-0 mx-auto flex w-full max-w-[480px] list-none p-0">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-control-54 flex-col items-center justify-center gap-4 border-t-2 text-caption',
                    isActive
                      ? 'border-gold font-semibold text-gold'
                      : 'border-transparent text-text-muted hover:text-text',
                    TRANSITION,
                    FOCUS_RING,
                  )
                }
              >
                {tab.icon}
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

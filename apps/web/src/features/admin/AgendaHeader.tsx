import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Button } from '../../components/Button'
import { cx, FOCUS_RING, TRANSITION } from '../../components/classes'
import { ArrowLeftIcon, ChevronRightIcon, PlusIcon } from '../../components/icons'

const NAV_LINK = cx(
  'flex min-h-touch min-w-touch items-center justify-center rounded-field border border-line-strong bg-surface px-14 text-small font-semibold text-text hover:border-gold',
  TRANSITION,
  FOCUS_RING,
)

export type AgendaHeaderProps = {
  view: 'day' | 'week'
  /** AAAA-MM-DD que se está viendo (el lunes en la vista semanal). */
  date: string
  subtitle: string
  prev: { to: string; label: string }
  next: { to: string; label: string }
  todayTo: string
  /** Nombre accesible de la fecha, para el selector "Ir a un día". */
  onNew?: () => void
  children?: ReactNode
}

/** Encabezado común de la agenda: navegación de fecha, alternador Día/Semana (enlaces) y "Nueva cita". */
export function AgendaHeader({
  view,
  date,
  subtitle,
  prev,
  next,
  todayTo,
  onNew,
}: AgendaHeaderProps) {
  const tab = (active: boolean) =>
    cx(
      'flex min-h-touch items-center rounded-pill px-20 text-small font-semibold',
      active ? 'bg-gold text-on-gold' : 'text-text-muted hover:text-text',
      TRANSITION,
      FOCUS_RING,
    )
  return (
    <header className="flex flex-wrap items-end justify-between gap-14">
      <div className="flex flex-col gap-4">
        <h1 className="m-0 font-display text-h1 text-text">Agenda</h1>
        <p className="m-0 text-small text-text-muted">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-10">
        <div className="flex items-center gap-8" role="group" aria-label="Cambiar de fecha">
          <Link to={prev.to} aria-label={prev.label} className={NAV_LINK}>
            <ArrowLeftIcon />
          </Link>
          <Link to={todayTo} className={NAV_LINK}>
            Hoy
          </Link>
          <Link to={next.to} aria-label={next.label} className={NAV_LINK}>
            <ChevronRightIcon />
          </Link>
        </div>
        <nav
          aria-label="Vista"
          className="flex gap-4 rounded-pill border border-line-strong bg-surface p-4"
        >
          <Link
            to={`/admin/agenda?fecha=${date}`}
            aria-current={view === 'day' ? 'page' : undefined}
            className={tab(view === 'day')}
          >
            Día
          </Link>
          <Link
            to={`/admin/semana?fecha=${date}`}
            aria-current={view === 'week' ? 'page' : undefined}
            className={tab(view === 'week')}
          >
            Semana
          </Link>
        </nav>
        {onNew && (
          <Button id="nueva-cita" icon={<PlusIcon />} onClick={onNew}>
            Nueva cita
          </Button>
        )}
      </div>
    </header>
  )
}

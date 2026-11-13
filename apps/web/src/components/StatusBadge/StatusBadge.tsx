import type { ReactNode } from 'react'
import { cx } from '../classes'
import { AlertIcon, CheckCircleIcon, ClockIcon, CrossCircleIcon } from '../icons'

/** `overdue` = cita pendiente que pasó la tolerancia (la decide el servidor: `is_overdue`). */
export type StatusBadgeStatus = 'booked' | 'attended' | 'no_show' | 'cancelled' | 'overdue'

const STATUS: Record<StatusBadgeStatus, { label: string; icon: ReactNode; tone: string }> = {
  booked: { label: 'Pendiente', icon: <ClockIcon size={16} />, tone: 'text-text-muted' },
  attended: { label: 'Atendida', icon: <CheckCircleIcon size={16} />, tone: 'text-success' },
  no_show: { label: 'No asistió', icon: <CrossCircleIcon size={16} />, tone: 'text-danger' },
  cancelled: { label: 'Cancelada', icon: <CrossCircleIcon size={16} />, tone: 'text-text-muted' },
  overdue: { label: 'Vencida', icon: <AlertIcon size={16} />, tone: 'text-danger' },
}

export const STATUS_LABELS = Object.fromEntries(
  Object.entries(STATUS).map(([key, value]) => [key, value.label]),
) as Record<StatusBadgeStatus, string>

/** Estado de una cita: siempre palabra e ícono, nunca solo color. */
export function StatusBadge({
  status,
  className,
}: {
  status: StatusBadgeStatus
  className?: string
}) {
  const { label, icon, tone } = STATUS[status]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-4 whitespace-nowrap text-caption font-semibold font-body',
        tone,
        className,
      )}
    >
      {icon}
      {label}
    </span>
  )
}

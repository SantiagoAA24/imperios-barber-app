import type { ReactNode } from 'react'
import { cx } from '../classes'
import { CheckCircleIcon, ClockIcon, CrossCircleIcon } from '../icons'

export type NoticeProps = {
  tone?: 'info' | 'success' | 'danger'
  children: ReactNode
  className?: string
}

const TONE = {
  info: { text: 'text-text-muted', icon: <ClockIcon className="text-gold" /> },
  success: { text: 'text-success', icon: <CheckCircleIcon /> },
  danger: { text: 'text-danger', icon: <CrossCircleIcon /> },
} as const

export function Notice({ tone = 'info', children, className }: NoticeProps) {
  const { text, icon } = TONE[tone]
  return (
    <div
      // Los errores se anuncian al instante; el éxito, con cortesía.
      role={tone === 'danger' ? 'alert' : tone === 'success' ? 'status' : undefined}
      className={cx('flex items-start gap-10 text-caption font-body', text, className)}
    >
      <span className="mt-[1px] shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../classes'
import { SpinnerIcon } from '../icons'

type Common = {
  variant?: 'primary' | 'secondary'
  /** `lg` = 54 px (acción principal); `md` = 44 px (mínimo táctil). */
  size?: 'lg' | 'md'
  /** Ocupa todo el ancho del contenedor. */
  block?: boolean
  loading?: boolean
  /** Icono de trazo opcional; acompaña siempre al texto. */
  icon?: ReactNode
  children: ReactNode
}

type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof Common> & { href?: undefined }
type AsLink = Common &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof Common> & { href: string }

export type ButtonProps = AsButton | AsLink

const VARIANT = {
  primary:
    'bg-gold text-on-gold enabled:hover:brightness-110 enabled:active:brightness-90 aria-disabled:hover:brightness-100',
  secondary:
    'bg-surface text-text border border-line-strong enabled:hover:bg-surface-selected enabled:hover:border-gold enabled:active:bg-surface-muted',
} as const

const SIZE = { lg: 'min-h-control-54', md: 'min-h-touch' } as const

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'lg',
    block = false,
    loading = false,
    icon,
    children,
    className,
    ...rest
  } = props as Common & { className?: string } & Record<string, unknown>

  const classes = cx(
    'box-border inline-flex items-center justify-center gap-8 rounded-card px-20 text-center text-button font-body',
    SIZE[size],
    VARIANT[variant],
    block && 'flex w-full',
    // Deshabilitado: surface-muted + text-muted, nunca gris genérico.
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-muted disabled:text-text-muted',
    'aria-disabled:cursor-not-allowed aria-disabled:bg-surface-muted aria-disabled:text-text-muted',
    TAPPABLE,
    TRANSITION,
    FOCUS_RING,
    className,
  )

  const content = (
    <>
      {loading ? (
        <SpinnerIcon size={20} className="animate-spin motion-reduce:animate-none" />
      ) : (
        icon
      )}
      <span>{children}</span>
    </>
  )

  if (props.href !== undefined) {
    const anchor = rest as AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <a {...anchor} className={classes} aria-busy={loading || undefined}>
        {content}
      </a>
    )
  }

  const { disabled, type = 'button', ...button } = rest as ButtonHTMLAttributes<HTMLButtonElement>
  return (
    <button
      {...button}
      type={type}
      // Cargando = deshabilitado para evitar dobles envíos, y se anuncia con aria-busy.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  )
}

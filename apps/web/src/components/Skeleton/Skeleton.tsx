import { cx } from '../classes'

export type SkeletonProps = {
  /** Clases de tamaño y forma (alto, ancho, radio) con tokens. */
  className?: string
}

/** Bloque de carga: decorativo y sin animación si la persona pidió menos movimiento. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      data-skeleton
      className={cx(
        'animate-pulse rounded-field bg-surface-muted motion-reduce:animate-none',
        className,
      )}
    />
  )
}

import { cx } from '../classes'

/** "1 cita por revisar" / "3 citas por revisar". */
export function reviewLabel(count: number): string {
  return `${count} ${count === 1 ? 'cita' : 'citas'} por revisar`
}

/**
 * Insignia con un número (p. ej. citas por revisar). Se ve el número; para lectores de pantalla
 * se lee la frase completa. No se pinta con 0.
 */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span
      className={cx(
        'inline-flex min-h-[20px] min-w-[20px] items-center justify-center rounded-pill bg-gold px-[6px] font-body text-caption font-semibold text-on-gold',
        className,
      )}
    >
      <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
      <span className="sr-only">{reviewLabel(count)}</span>
    </span>
  )
}

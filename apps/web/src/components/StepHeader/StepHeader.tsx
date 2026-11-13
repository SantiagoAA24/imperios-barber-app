import { cx } from '../classes'

export type StepHeaderProps = {
  step: number
  title: string
  /** Nivel del encabezado real; por defecto h2 para poder saltar entre secciones. */
  level?: 2 | 3
  id?: string
  className?: string
}

export function StepHeader({ step, title, level = 2, id, className }: StepHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className={cx('flex items-center gap-[12px]', className)}>
      <span
        aria-hidden="true"
        className="flex size-[28px] items-center justify-center rounded-round border border-gold text-label font-semibold text-gold"
      >
        {step}
      </span>
      <Heading id={id} className="m-0 font-display text-h2 text-text">
        {title}
      </Heading>
    </div>
  )
}

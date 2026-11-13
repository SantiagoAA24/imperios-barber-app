import sello from '../../../../../design-system/assets/Logo/imperio-sello.png'
import { cx } from '../classes'

export type BrandSealProps = {
  /** 44 en barras y paneles; 96 o 132 en la cabecera de agendar. */
  size?: 44 | 96 | 132
  /** El resplandor solo desde 96 px y sobre --color-bg. */
  glow?: boolean
  alt?: string
  className?: string
}

export function BrandSeal({
  size = 44,
  glow = size >= 96,
  alt = 'Logo de Barbería Imperio',
  className,
}: BrandSealProps) {
  return (
    <img
      src={sello}
      alt={alt}
      width={size}
      height={size}
      className={cx('block rounded-round', glow && size >= 96 && 'shadow-logo-glow', className)}
    />
  )
}

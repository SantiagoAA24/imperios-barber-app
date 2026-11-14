// Derivados del sello de design-system/assets/Logo (pnpm --filter web assets): el PNG original
// pesa ~360 KB y aquí se muestra a 44-132 px.
import sello88 from '../../assets/sello-88.webp'
import sello264 from '../../assets/sello-264.webp'
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
      // 44 px a 2x = 88; 96 y 132 px salen de la versión de 264 (132 px a 2x).
      src={size === 44 ? sello88 : sello264}
      alt={alt}
      width={size}
      height={size}
      className={cx('block rounded-round', glow && size >= 96 && 'shadow-logo-glow', className)}
    />
  )
}

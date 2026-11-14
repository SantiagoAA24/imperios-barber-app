import { formatCOP } from '../../lib/format'
import { cx } from '../classes'
import { BottleIcon, CheckCircleIcon, CrossCircleIcon } from '../icons'

export type ProductCardProps = {
  name: string
  description?: string | null
  priceCop: number
  inStock: boolean
  /** Foto del producto; si es nula se muestra un marcador. */
  imageUrl?: string | null
  /** Nivel del encabezado con el nombre; 2 cuando la lista cuelga directamente del h1 de la página. */
  headingLevel?: 2 | 3
  className?: string
}

/** Tarjeta de producto del catálogo (catalogo.dc.html). La disponibilidad lleva palabra + ícono. */
export function ProductCard({
  name,
  description,
  priceCop,
  inStock,
  imageUrl,
  headingLevel = 3,
  className,
}: ProductCardProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <article
      className={cx(
        'box-border flex flex-col overflow-hidden rounded-card border border-line bg-surface font-body',
        className,
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          // width/height reservan el espacio (sin saltos de diseño); el CSS la estira al ancho de la tarjeta.
          width={300}
          height={150}
          loading="lazy"
          decoding="async"
          className="block h-[150px] w-full object-cover"
        />
      ) : (
        <div className="flex h-[150px] flex-col items-center justify-center gap-8 bg-surface-muted text-gold">
          <BottleIcon size={36} />
          <span className="text-caption text-text-muted">Foto del producto</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-[6px] p-[12px]">
        <Heading className="m-0 min-h-[40px] text-body-strong text-text">{name}</Heading>
        {description && <p className="m-0 text-caption text-text-muted">{description}</p>}
        <span className="mt-auto font-display text-price text-gold">{formatCOP(priceCop)}</span>
        <span
          className={cx(
            'flex items-center gap-[6px] text-caption',
            inStock ? 'text-success' : 'text-text-muted',
          )}
        >
          {inStock ? <CheckCircleIcon size={16} /> : <CrossCircleIcon size={16} />}
          {inStock ? 'Disponible' : 'Agotado'}
        </span>
      </div>
    </article>
  )
}

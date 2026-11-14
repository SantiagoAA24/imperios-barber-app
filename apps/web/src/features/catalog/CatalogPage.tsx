import { Link } from 'react-router-dom'
import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { ArrowLeftIcon, StoreIcon } from '../../components/icons'
import { Notice } from '../../components/Notice'
import { ProductCard } from '../../components/ProductCard'
import { Skeleton } from '../../components/Skeleton'
import { isTransientError, useProducts } from '../../lib/api/hooks'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export function CatalogPage() {
  useDocumentTitle('Productos')
  const products = useProducts()

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col gap-[28px] px-20 pb-36"
    >
      <header className="flex flex-col gap-20 pt-20">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            aria-label="Volver a agendar"
            className="-ml-10 flex size-touch items-center justify-center text-gold focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            <ArrowLeftIcon size={22} />
          </Link>
          <BrandSeal size={44} />
        </div>
        <div className="flex flex-col gap-8">
          <h1 className="m-0 font-display text-h1 text-text">Productos del local</h1>
          <p className="m-0 text-small text-text-muted">Disponibles para llevar en la barbería.</p>
        </div>
      </header>

      {products.isPending && (
        <div role="status" aria-busy="true" className="grid grid-cols-2 gap-10">
          <span className="sr-only">Cargando productos…</span>
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[260px] rounded-card" />
          ))}
        </div>
      )}

      {products.isError && (
        <RetryNotice onRetry={() => void products.refetch()} loading={products.isFetching}>
          {isTransientError(products.error)
            ? `No pudimos cargar los productos. ${NETWORK_MESSAGE}`
            : products.error.message}
        </RetryNotice>
      )}

      {products.data?.length === 0 && <Notice>Por ahora no hay productos para mostrar.</Notice>}

      {products.data && products.data.length > 0 && (
        <section aria-label="Productos" className="grid grid-cols-2 gap-10">
          {products.data.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              description={product.description}
              priceCop={product.price_cop}
              imageUrl={product.image_url}
              headingLevel={2}
              inStock={product.availability === 'in_stock'}
            />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-14 rounded-summary border border-gold-edge bg-surface p-20">
        <div className="flex items-start gap-10 text-small text-text-muted">
          <StoreIcon size={20} className="mt-[1px] shrink-0 text-gold" />
          <p className="m-0">Se compran directamente en el local.</p>
        </div>
        <Button block href="/">
          Agendar cita
        </Button>
      </section>
    </main>
  )
}

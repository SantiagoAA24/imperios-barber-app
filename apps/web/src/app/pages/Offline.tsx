import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export function Offline() {
  useDocumentTitle('Sin conexión')
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col items-center gap-14 px-20 py-36 text-center"
    >
      <BrandSeal size={96} />
      <h1 className="m-0 font-display text-h1 text-text">Sin conexión</h1>
      <p className="m-0 text-body text-text-muted">
        Parece que no tienes internet. Revisa tu conexión y vuelve a intentarlo.
      </p>
      <div className="flex w-full flex-col gap-10">
        <Button block onClick={() => window.location.reload()}>
          Reintentar
        </Button>
        <Button block variant="secondary" href="/">
          Volver al inicio
        </Button>
      </div>
    </main>
  )
}

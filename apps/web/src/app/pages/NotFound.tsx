import { Button } from '../../components/Button'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export function NotFound() {
  useDocumentTitle('Página no encontrada')
  return (
    <main id="contenido" tabIndex={-1} className="outline-none flex flex-col gap-14 px-20 py-36">
      <h1 className="m-0 font-display text-h1 text-text">No encontramos esa página</h1>
      <p className="m-0 text-body text-text-muted">Revisa el enlace o vuelve al inicio.</p>
      <Button href="/" block>
        Volver al inicio
      </Button>
    </main>
  )
}

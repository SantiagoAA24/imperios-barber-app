import { Component } from 'react'
import type { ReactNode } from 'react'
import { BrandSeal } from '../components/BrandSeal'
import { Button } from '../components/Button'
import { useDocumentTitle } from '../lib/useDocumentTitle'

function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  useDocumentTitle('Algo salió mal')
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none mx-auto flex max-w-[480px] flex-col items-center gap-14 px-20 py-36 text-center"
    >
      <BrandSeal size={96} />
      <h1 className="m-0 font-display text-h1 text-text">Algo salió mal</h1>
      <p role="alert" className="m-0 text-body text-text-muted">
        No es tu culpa: la pantalla tuvo un problema inesperado. Puedes intentarlo de nuevo o volver
        al inicio.
      </p>
      <div className="flex w-full flex-col gap-10">
        <Button block onClick={onRetry}>
          Reintentar
        </Button>
        {/* Enlace real a «/»: recarga la app completa, por si el fallo dejó algo a medias. */}
        <Button block variant="secondary" href="/">
          Volver al inicio
        </Button>
      </div>
    </main>
  )
}

type State = { failed: boolean }

/**
 * Última red de seguridad: si algo lanza al pintar, la persona ve un mensaje amable en lugar de
 * una pantalla en blanco. «Reintentar» vuelve a pintar la app; «Volver al inicio» la recarga.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    // Sin servicio de registro de errores todavía: al menos queda en la consola del navegador.
    console.error('Error no controlado en la pantalla', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <ErrorScreen onRetry={() => this.setState({ failed: false })} />
  }
}

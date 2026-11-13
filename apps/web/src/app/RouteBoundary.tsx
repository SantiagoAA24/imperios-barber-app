import { Component } from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Notice } from '../components/Notice'

type State = { failed: boolean }

/**
 * Atrapa fallos al cargar un área perezosa. Sin red (los chunks del personal no se precachean)
 * lleva a /offline; con red muestra un aviso con un botón para reintentar.
 */
export class RouteBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return <Navigate to="/offline" replace />
    }
    return (
      <div className="flex flex-col gap-14 px-20 py-36">
        <Notice tone="danger">No pudimos cargar esta pantalla. Inténtalo de nuevo.</Notice>
        <Button onClick={() => window.location.reload()}>Reintentar</Button>
      </div>
    )
  }
}

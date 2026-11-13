import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'

/** Aviso de error con un botón "Reintentar" debajo (caída de red o error del servidor). */
export function RetryNotice({
  children,
  onRetry,
  loading = false,
}: {
  children: React.ReactNode
  onRetry: () => void
  loading?: boolean
}) {
  return (
    <div className="flex flex-col items-start gap-10">
      <Notice tone="danger">{children}</Notice>
      <Button size="md" variant="secondary" loading={loading} onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  )
}

export const NETWORK_MESSAGE = 'Revisa tu conexión e inténtalo de nuevo.'

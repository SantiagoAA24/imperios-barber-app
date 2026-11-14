import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { TextField } from '../../components/TextField'
import { homeForRole, useChangePassword, useMe } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

export const MIN_PASSWORD = 10

type Problems = { current?: string; next?: string; repeat?: string }

/** Cambio de la clave temporal: mientras esté pendiente, es lo único que el personal puede usar. */
export function ChangePasswordPage() {
  useDocumentTitle('Cambiar clave')
  const navigate = useNavigate()
  const me = useMe()
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [problems, setProblems] = useState<Problems>({})

  if (me.isPending) {
    return (
      <p role="status" className="m-0 px-20 py-36 text-body text-text-muted">
        Cargando…
      </p>
    )
  }
  if (!me.data) return <Navigate to="/ingresar" replace />
  if (!me.data.must_change_password) return <Navigate to={homeForRole(me.data.role)} replace />

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const found: Problems = {
      current: current ? undefined : 'Escribe tu clave temporal.',
      next:
        next.length >= MIN_PASSWORD
          ? undefined
          : `La clave nueva debe tener al menos ${MIN_PASSWORD} caracteres.`,
      repeat: repeat === next ? undefined : 'Las dos claves nuevas no coinciden.',
    }
    setProblems(found)
    if (found.current || found.next || found.repeat) return
    change.mutate(
      { current, new: next },
      { onSuccess: (user) => navigate(homeForRole(user.role), { replace: true }) },
    )
  }

  const serverMessage =
    change.error instanceof ApiError
      ? change.error.message
      : 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.'

  return (
    <main id="contenido" tabIndex={-1} className="outline-none flex flex-col gap-36 px-20 py-36">
      <div className="flex flex-col items-center gap-14 text-center">
        <BrandSeal size={96} />
        <h1 className="m-0 font-display text-h1 text-text">Crea tu clave</h1>
        <p className="m-0 text-small text-text-muted">
          Entraste con una clave temporal. Elige una propia para continuar.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-14">
        {change.isError && <Notice tone="danger">{serverMessage}</Notice>}
        <TextField
          label="Clave temporal"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={problems.current}
        />
        <TextField
          label="Clave nueva"
          type="password"
          autoComplete="new-password"
          hint={`Mínimo ${MIN_PASSWORD} caracteres.`}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={problems.next}
        />
        <TextField
          label="Repite la clave nueva"
          type="password"
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={problems.repeat}
        />
        <Button type="submit" block loading={change.isPending}>
          Guardar clave
        </Button>
      </form>
    </main>
  )
}

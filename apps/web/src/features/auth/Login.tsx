import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { TextField } from '../../components/TextField'
import { ApiError } from '../../lib/api/client'
import { homeForRole, useLogin, useMe } from '../../lib/api/auth'

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.'
}

export function Login() {
  const navigate = useNavigate()
  const me = useMe()
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [missing, setMissing] = useState<{ email?: string; password?: string }>({})

  if (me.data) return <Navigate to={homeForRole(me.data.role)} replace />

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const problems = {
      email: email.trim() ? undefined : 'Escribe tu correo.',
      password: password ? undefined : 'Escribe tu contraseña.',
    }
    setMissing(problems)
    if (problems.email || problems.password) return
    login.mutate(
      { email: email.trim(), password },
      { onSuccess: (user) => navigate(homeForRole(user.role), { replace: true }) },
    )
  }

  return (
    <main className="flex flex-col gap-36 px-20 py-36">
      <div className="flex flex-col items-center gap-14 text-center">
        <BrandSeal size={96} />
        <h1 className="m-0 font-display text-h1 text-text">Ingresar</h1>
        <p className="m-0 text-small text-text-muted">Acceso para barberos y administración.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-14">
        {login.isError && <Notice tone="danger">{messageFor(login.error)}</Notice>}
        <TextField
          label="Correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={missing.email}
        />
        <TextField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={missing.password}
        />
        <Button type="submit" block loading={login.isPending}>
          Ingresar
        </Button>
      </form>
    </main>
  )
}

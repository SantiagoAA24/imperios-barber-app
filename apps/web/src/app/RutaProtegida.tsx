import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { homeForRole, useMe } from '../lib/api/auth'
import { ApiError } from '../lib/api/client'
import type { UserRole } from '../lib/api/types'

export type RutaProtegidaProps = {
  /** Rol que puede ver estas rutas. */
  role: UserRole
  children: ReactNode
}

/** Consulta /auth/me: sin sesión → /ingresar; otro rol → la home de su propio rol. */
export function RutaProtegida({ role, children }: RutaProtegidaProps) {
  const me = useMe()
  const location = useLocation()

  if (me.isPending) {
    return (
      <p role="status" className="m-0 px-20 py-36 text-body text-text-muted">
        Cargando…
      </p>
    )
  }
  // Sin red no hay forma de saber si hay sesión: se muestra la página de "sin conexión".
  if (me.isError && !(me.error instanceof ApiError)) return <Navigate to="/offline" replace />
  if (me.isError) {
    return (
      <p role="alert" className="m-0 px-20 py-36 text-body text-danger">
        No pudimos verificar tu sesión. Revisa tu conexión e inténtalo de nuevo.
      </p>
    )
  }
  if (!me.data) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />
  // Clave temporal: nada de personal sirve hasta que la cambie.
  if (me.data.must_change_password) return <Navigate to="/cambiar-clave" replace />
  if (me.data.role !== role) return <Navigate to={homeForRole(me.data.role)} replace />
  return <>{children}</>
}

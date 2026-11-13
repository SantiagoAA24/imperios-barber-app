import { useNavigate } from 'react-router-dom'
import { useLogout } from '../lib/api/auth'

/** Cierra la sesión y lleva a /ingresar. */
export function useLogoutAndLeave() {
  const navigate = useNavigate()
  const mutation = useLogout()
  return {
    pending: mutation.isPending,
    logout: () =>
      mutation.mutate(undefined, { onSettled: () => navigate('/ingresar', { replace: true }) }),
  }
}

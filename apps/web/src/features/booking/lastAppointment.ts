export const LAST_APPOINTMENT_KEY = 'imperio:ultima-cita'

/** Guarda el token de la última cita en este navegador. Sin almacenamiento disponible, no pasa nada. */
export function saveLastAppointment(token: string): void {
  try {
    localStorage.setItem(LAST_APPOINTMENT_KEY, token)
  } catch {
    // Modo privado o almacenamiento bloqueado: la cita sigue accesible por su enlace.
  }
}

export function readLastAppointment(): string | null {
  try {
    return localStorage.getItem(LAST_APPOINTMENT_KEY)
  } catch {
    return null
  }
}

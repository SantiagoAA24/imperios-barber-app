// Validación en el cliente solo para avisar rápido; la API vuelve a validar y manda la última palabra.

export const NAME_ERROR = 'Escribe tu nombre (entre 2 y 60 caracteres).'
export const PHONE_ERROR = 'Escribe un celular colombiano de 10 dígitos.'

/** Quita espacios sobrantes: "  Juan   Pérez " -> "Juan Pérez". */
export function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Devuelve el mensaje de error, o `null` si el nombre es válido (2 a 60 caracteres). */
export function validateName(value: string): string | null {
  const length = [...cleanName(value)].length
  return length >= 2 && length <= 60 ? null : NAME_ERROR
}

/**
 * Celular colombiano a 10 dígitos nacionales, o `null` si no es válido.
 * Acepta espacios, guiones, puntos y paréntesis, y el prefijo 57 o +57.
 */
export function nationalPhone(value: string): string | null {
  const text = value.replace(/[\s\-().]/g, '')
  let digits = text
  if (text.startsWith('+')) {
    if (!text.startsWith('+57')) return null
    digits = text.slice(3)
  } else if (text.length === 12 && text.startsWith('57')) {
    digits = text.slice(2)
  }
  return /^3[0-9]{9}$/.test(digits) ? digits : null
}

/** Devuelve el mensaje de error, o `null` si el celular es válido. */
export function validatePhone(value: string): string | null {
  return nationalPhone(value) === null ? PHONE_ERROR : null
}

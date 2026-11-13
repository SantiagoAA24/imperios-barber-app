/** "Actualizado hace 25 s" a partir de la marca de tiempo del último dato recibido. */
export function updatedAgo(updatedAt: number, now: number): string {
  if (!updatedAt) return 'Sin actualizar'
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000))
  if (seconds < 10) return 'Actualizado ahora'
  if (seconds < 60) return `Actualizado hace ${Math.floor(seconds / 5) * 5} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Actualizado hace ${minutes} min`
  return `Actualizado hace ${Math.floor(minutes / 60)} h`
}

export type ComingSoonProps = {
  /** Nombre de la pantalla que se construirá en una fase posterior. */
  name: string
}

export function ComingSoon({ name }: ComingSoonProps) {
  return (
    <main className="flex flex-col gap-10 px-20 py-36">
      <p className="m-0 text-small text-text-muted">{name}</p>
      <h1 className="m-0 font-display text-h1 text-text">Próximamente</h1>
      <p className="m-0 text-body text-text-muted">Estamos terminando esta pantalla.</p>
    </main>
  )
}

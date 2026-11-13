export function Privacy() {
  return (
    <main className="flex flex-col gap-14 px-20 py-36">
      <h1 className="m-0 font-display text-h1 text-text">Privacidad</h1>
      <p className="m-0 text-small text-text-muted">
        Texto provisional: lo revisará el negocio antes de publicar.
      </p>
      <section className="flex flex-col gap-10">
        <h2 className="m-0 font-display text-h2 text-text">Qué datos pedimos</h2>
        <p className="m-0 text-body">
          Para agendar tu cita solo te pedimos tu nombre y tu celular. No necesitas crear una
          cuenta.
        </p>
      </section>
      <section className="flex flex-col gap-10">
        <h2 className="m-0 font-display text-h2 text-text">Para qué los usamos</h2>
        <p className="m-0 text-body">
          Usamos tus datos únicamente para confirmar, recordarte y atender tu cita. No los vendemos
          ni los compartimos con terceros.
        </p>
      </section>
      <section className="flex flex-col gap-10">
        <h2 className="m-0 font-display text-h2 text-text">Tus derechos</h2>
        <p className="m-0 text-body">
          Puedes pedirnos que corrijamos o borremos tus datos escribiéndole al negocio por WhatsApp.
        </p>
      </section>
    </main>
  )
}

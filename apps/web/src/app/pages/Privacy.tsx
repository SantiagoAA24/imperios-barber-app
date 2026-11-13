// PENDIENTE DE REVISIÓN LEGAL: este texto es provisional. Debe revisarlo un abogado (Ley 1581 de
// 2012 y Decreto 1377 de 2013) y completarse con la razón social, el NIT y los datos de contacto
// del responsable antes de salir a producción. Quita esta marca solo cuando esté aprobado.

import { Link } from 'react-router-dom'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-10">
      <h2 className="m-0 font-display text-h2 text-text">{title}</h2>
      {children}
    </section>
  )
}

export function Privacy() {
  return (
    <main className="flex flex-col gap-[28px] px-20 py-36">
      <div className="flex flex-col gap-14">
        <p
          role="note"
          className="m-0 rounded-card border border-danger px-14 py-10 text-label font-semibold tracking-[0.08em] text-danger"
        >
          PENDIENTE DE REVISIÓN LEGAL
        </p>
        <h1 className="m-0 font-display text-h1 text-text">Política de tratamiento de datos</h1>
        <p className="m-0 text-small text-text-muted">
          Texto provisional, en revisión. Aplica la Ley 1581 de 2012 de Colombia (protección de
          datos personales).
        </p>
      </div>

      <Section title="Quién es el responsable">
        <p className="m-0 text-body">
          Imperio Barber es el responsable del tratamiento de tus datos. Los datos de contacto del
          responsable (razón social, NIT, dirección y correo) se publicarán aquí cuando termine la
          revisión.
        </p>
      </Section>

      <Section title="Qué datos guardamos">
        <ul className="m-0 flex list-disc flex-col gap-4 pl-20 text-body">
          <li>Tu nombre.</li>
          <li>Tu número de celular.</li>
          <li>Tu historial de citas: servicio, barbero, fecha, hora y estado.</li>
        </ul>
        <p className="m-0 text-body">
          No te pedimos cuenta, contraseña, documento de identidad ni datos de pago.
        </p>
      </Section>

      <Section title="Para qué los usamos">
        <p className="m-0 text-body">
          Usamos tus datos para gestionar tus citas (agendar, reprogramar o cancelar) y para
          recordártelas. No los vendemos ni los usamos para publicidad de terceros.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p className="m-0 text-body">
          Como titular puedes conocer, actualizar y corregir tus datos, pedir que los eliminemos,
          revocar tu autorización y consultar cómo los usamos. Para ejercer cualquiera de estos
          derechos, escríbele al local por WhatsApp o pídelo en persona; responderemos dentro de los
          plazos que fija la ley.
        </p>
      </Section>

      <Section title="Cuánto tiempo los conservamos">
        <p className="m-0 text-body">
          Mientras uses el servicio o hasta que pidas su eliminación. Este plazo se confirmará en la
          revisión legal.
        </p>
      </Section>

      <Link
        to="/"
        className="text-body-strong text-gold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        Volver a agendar
      </Link>
    </main>
  )
}

import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  BarberPill,
  BrandSeal,
  Button,
  DayChip,
  Notice,
  ServiceCard,
  StepHeader,
  SummaryCard,
  TextField,
  TimeSlot,
} from '../../components'
import { UsersIcon } from '../../components/icons'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-14">
      <h2 className="m-0 border-b border-line pb-8 text-label font-medium text-text-muted">
        {title}
      </h2>
      {children}
    </section>
  )
}

const SLOTS: Array<[string, 'free' | 'off']> = [
  ['10:00 am', 'free'],
  ['10:30 am', 'free'],
  ['11:00 am', 'free'],
  ['11:30 am', 'off'],
  ['12:00 pm', 'off'],
  ['12:30 pm', 'free'],
  ['1:00 pm', 'free'],
  ['1:30 pm', 'free'],
]

/**
 * Galería de componentes (solo en desarrollo, /ui) a 390 px para compararla con
 * design-system/components/<Nombre>/preview.html. Hover/active se ven con el puntero; el foco, con Tab.
 */
export default function UiGallery() {
  const [service, setService] = useState('Corte + barba')
  const [barber, setBarber] = useState('Cualquiera')
  const [day, setDay] = useState(13)
  const [slot, setSlot] = useState('11:00 am')
  const [name, setName] = useState('')

  return (
    <div className="min-h-dvh bg-bg">
      <main className="mx-auto flex w-[390px] flex-col gap-36 px-20 py-36">
        <h1 className="m-0 font-display text-h1 text-text">Componentes</h1>

        <Block title="Button">
          <div className="flex flex-col gap-[12px]">
            <Button block>Confirmar cita</Button>
            <Button block variant="secondary">
              Reagendar
            </Button>
            <Button block disabled>
              Elige una hora para continuar
            </Button>
            <Button block loading>
              Confirmando
            </Button>
            <Button block variant="secondary" loading>
              Cancelando
            </Button>
            <Button block size="md" variant="secondary" icon={<UsersIcon />}>
              Con icono, tamaño md
            </Button>
            <Button block href="/productos">
              Enlace con apariencia de botón
            </Button>
          </div>
        </Block>

        <Block title="ServiceCard">
          <div className="flex flex-col gap-10">
            {[
              ['Corte básico', 30, undefined, 22000],
              ['Corte + barba', 45, undefined, 27000],
              ['Corte + limpieza facial', 60, 'con vaporizador', 50000],
            ].map(([n, d, note, price]) => (
              <ServiceCard
                key={String(n)}
                name={String(n)}
                durationMin={Number(d)}
                note={note ? String(note) : undefined}
                priceCop={Number(price)}
                selected={service === n}
                onClick={() => setService(String(n))}
              />
            ))}
            <ServiceCard name="Cera para peinar" priceCop={18000} selected={false} disabled />
          </div>
        </Block>

        <Block title="BarberPill">
          <div className="flex flex-wrap gap-10">
            <BarberPill
              name="Cualquiera"
              icon={<UsersIcon />}
              selected={barber === 'Cualquiera'}
              onClick={() => setBarber('Cualquiera')}
            />
            {['Barbero 1', 'Barbero 2'].map((b) => (
              <BarberPill key={b} name={b} selected={barber === b} onClick={() => setBarber(b)} />
            ))}
            <BarberPill name="Barbero 3" selected={false} disabled />
          </div>
        </Block>

        <Block title="DayChip">
          <div className="-mr-20 flex gap-10 overflow-x-auto py-4 pr-20">
            {[
              ['Vie', 13],
              ['Sáb', 14],
              ['Dom', 15],
              ['Lun', 16],
              ['Mar', 17],
              ['Mié', 18],
            ].map(([wd, n]) => (
              <DayChip
                key={n}
                weekday={String(wd)}
                day={Number(n)}
                selected={day === n}
                disabled={n === 15}
                onClick={() => setDay(Number(n))}
              />
            ))}
          </div>
        </Block>

        <Block title="TimeSlot">
          <div className="grid grid-cols-4 gap-10">
            {SLOTS.map(([time, state]) => (
              <TimeSlot
                key={time}
                time={time}
                selected={slot === time}
                disabled={state === 'off'}
                onClick={() => setSlot(time)}
              />
            ))}
          </div>
        </Block>

        <Block title="TextField">
          <div className="flex flex-col gap-14">
            <TextField
              label="Nombre"
              placeholder="¿Cómo te llamas?"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              label="Celular (WhatsApp)"
              prefix="+57"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="300 000 0000"
            />
            <TextField label="Correo" hint="Usa el correo con el que te registraron." />
            <TextField
              label="Celular con error"
              prefix="+57"
              defaultValue="300 12"
              error="Escribe un celular de 10 dígitos."
            />
            <TextField label="Campo deshabilitado" disabled defaultValue="No editable" />
          </div>
        </Block>

        <Block title="StepHeader">
          <div className="flex flex-col gap-20">
            <StepHeader step={1} title="Servicio" />
            <StepHeader step={2} title="Barbero" />
            <StepHeader step={3} title="Día y hora" />
          </div>
        </Block>

        <Block title="SummaryCard">
          <SummaryCard
            service="Corte + barba"
            barber={barber}
            dateTime={`viernes ${day} nov · ${slot}`}
            duration="~45 min"
            totalCop={27000}
          >
            <Button block>Confirmar cita</Button>
            <Notice>
              Llega puntual: la tolerancia máxima es de 5 minutos después de la hora pactada.
            </Notice>
          </SummaryCard>
        </Block>

        <Block title="Notice">
          <div className="flex flex-col gap-14">
            <Notice>
              Llega puntual: la tolerancia máxima es de 5 minutos después de la hora pactada.
            </Notice>
            <Notice tone="success">
              Cita confirmada. Te llegará un recordatorio por WhatsApp.
            </Notice>
            <Notice tone="danger">Esa hora ya no está disponible. Elige otra.</Notice>
          </div>
        </Block>

        <Block title="BrandSeal">
          <div className="flex items-center gap-[24px]">
            <BrandSeal size={44} />
            <BrandSeal size={96} />
            <BrandSeal size={132} />
          </div>
        </Block>
      </main>
    </div>
  )
}

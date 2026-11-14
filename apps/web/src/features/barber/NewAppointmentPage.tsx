import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { ServiceCard } from '../../components/ServiceCard'
import { Skeleton } from '../../components/Skeleton'
import { SummaryCard } from '../../components/SummaryCard'
import { Switch } from '../../components/Switch'
import { TextField } from '../../components/TextField'
import { useMe } from '../../lib/api/auth'
import { useCreateBarberAppointment, useNextFree } from '../../lib/api/barber'
import { ApiError } from '../../lib/api/client'
import { isSlotConflict, slotAlternatives } from '../../lib/api/conflict'
import type { Alternative } from '../../lib/api/conflict'
import { isTransientError, useServices } from '../../lib/api/hooks'
import { bogotaDay, formatDayLong, formatDuration, formatTime } from '../../lib/format'
import { cleanName, nationalPhone, PHONE_ERROR, validateName } from '../booking/validators'
import { SlotConflict } from '../booking/SlotConflict'
import { SlotPicker } from '../booking/SlotPicker'
import { useSlotPicker } from '../booking/useSlotPicker'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

const NAME_ERROR = 'Escribe el nombre del cliente (entre 2 y 60 caracteres).'

function SectionTitle({ n, children }: { n: number; children: string }) {
  return (
    <div className="flex items-center gap-10">
      <span
        aria-hidden="true"
        className="flex h-[28px] w-[28px] items-center justify-center rounded-round border border-gold-edge text-label font-semibold text-gold"
      >
        {n}
      </span>
      <h2 className="m-0 font-display text-h2 text-text">{children}</h2>
    </div>
  )
}

/** Nueva cita para quien llega sin cita o llama (barbero-nueva.dc.html). */
export function NewAppointmentPage() {
  useDocumentTitle('Nueva cita')
  const navigate = useNavigate()
  const me = useMe()
  const services = useServices()
  const create = useCreateBarberAppointment()

  const [walkIn, setWalkIn] = useState(false)
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; when?: string }>({})
  const [alternatives, setAlternatives] = useState<Alternative[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const service = services.data?.find((s) => s.id === serviceId) ?? null
  // Con "turno sin cita" no se consulta la disponibilidad de días: solo el primer hueco libre.
  const picker = useSlotPicker(walkIn ? null : serviceId, null, true)
  const nextFree = useNextFree(serviceId, walkIn)

  const chosenStart = walkIn ? (nextFree.data?.starts_at ?? null) : picker.selectedSlot
  const dateTime = chosenStart
    ? walkIn
      ? `Hoy · ${formatTime(chosenStart)}`
      : `${formatDayLong(chosenStart)} · ${formatTime(chosenStart)}`
    : null

  function onSave() {
    const nameError = validateName(name) ? NAME_ERROR : undefined
    const phoneError = phone.trim() && !nationalPhone(phone) ? PHONE_ERROR : undefined
    const whenError = !service
      ? 'Elige el servicio.'
      : !chosenStart
        ? walkIn
          ? 'Todavía no tenemos tu hora de inicio. Espera un momento o reintenta.'
          : 'Elige el día y la hora.'
        : undefined
    setErrors({ name: nameError, phone: phoneError, when: whenError })
    setFailure(null)
    setAlternatives(null)
    if (nameError || phoneError || whenError || !service) return

    create.mutate(
      {
        service_id: service.id,
        client: { name: cleanName(name), phone: nationalPhone(phone) },
        walk_in: walkIn,
        source: walkIn ? 'walk_in' : 'manual',
        ...(walkIn ? {} : { starts_at: chosenStart }),
      },
      {
        onSuccess: (created) => {
          navigate(`/barbero?fecha=${bogotaDay(created.starts_at)}`, {
            replace: true,
            state: {
              flash: `Cita guardada: ${created.client.name} · ${formatTime(created.starts_at)}.`,
            },
          })
        },
        onError: (error: unknown) => {
          if (isSlotConflict(error)) {
            setAlternatives(slotAlternatives(error))
            setFailure(error.message)
            void picker.refresh()
            void nextFree.refetch()
          } else if (error instanceof ApiError && error.status < 500) {
            setFailure(error.message)
            if (error.code === 'no_free_time') void nextFree.refetch()
          } else {
            setFailure(`No pudimos guardar la cita. ${NETWORK_MESSAGE}`)
          }
        },
      },
    )
  }

  return (
    <main id="contenido" tabIndex={-1} className="outline-none flex flex-col gap-20 px-20 pb-20">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-small text-text-muted">Para un cliente que llega o llama</p>
        <h1 className="m-0 font-display text-h1 text-text">Nueva cita</h1>
      </div>

      <section className="flex items-center justify-between gap-14 rounded-card border border-line bg-surface p-14">
        <div className="flex min-w-0 flex-col gap-4">
          <p id="turno-sin-cita" className="m-0 text-body-strong text-text">
            Turno sin cita
          </p>
          <p className="m-0 text-caption text-text-muted">
            El cliente ya está aquí: se agenda en el primer hueco libre.
          </p>
        </div>
        <Switch
          label="Turno sin cita"
          checked={walkIn}
          onCheckedChange={(on) => {
            setWalkIn(on)
            setAlternatives(null)
            setFailure(null)
          }}
        />
      </section>

      <section aria-label="Servicio" className="flex flex-col gap-14">
        <SectionTitle n={1}>Servicio</SectionTitle>
        {services.isPending && (
          <div role="status" aria-busy="true" className="flex flex-col gap-10">
            <span className="sr-only">Cargando servicios…</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[64px] w-full" />
            ))}
          </div>
        )}
        {services.isError && (
          <RetryNotice onRetry={() => void services.refetch()} loading={services.isFetching}>
            {isTransientError(services.error)
              ? `No pudimos cargar los servicios. ${NETWORK_MESSAGE}`
              : (services.error as Error).message}
          </RetryNotice>
        )}
        {services.data && (
          <div className="flex flex-col gap-10">
            {services.data.map((s) => (
              <ServiceCard
                key={s.id}
                name={s.name}
                durationMin={s.duration_min}
                priceCop={s.price_cop}
                note={s.uses_resource ? 'con vaporizador' : undefined}
                selected={s.id === serviceId}
                onClick={() => {
                  setServiceId(s.id)
                  setAlternatives(null)
                  setFailure(null)
                }}
              />
            ))}
          </div>
        )}
      </section>

      {walkIn ? (
        <section aria-label="Hora de inicio" className="flex flex-col gap-14">
          <SectionTitle n={2}>Hora de inicio</SectionTitle>
          {!service && (
            <p className="m-0 text-small text-text-muted">
              Elige un servicio para ver a qué hora empiezas.
            </p>
          )}
          {service && nextFree.isPending && (
            <div role="status" aria-busy="true">
              <span className="sr-only">Calculando tu primer hueco libre…</span>
              <Skeleton className="h-[64px] w-full" />
            </div>
          )}
          {service && nextFree.data && (
            <p
              role="status"
              className="m-0 rounded-card border border-gold-edge bg-surface-selected p-14 font-display text-h2 text-gold"
            >
              Empiezas a las {formatTime(nextFree.data.starts_at)}
            </p>
          )}
          {service && nextFree.isError && (
            <RetryNotice onRetry={() => void nextFree.refetch()} loading={nextFree.isFetching}>
              {nextFree.error instanceof ApiError && nextFree.error.status < 500
                ? nextFree.error.message
                : `No pudimos calcular la hora. ${NETWORK_MESSAGE}`}
            </RetryNotice>
          )}
        </section>
      ) : (
        <section aria-label="Día y hora" className="flex flex-col gap-14">
          <SectionTitle n={2}>Día y hora</SectionTitle>
          <SlotPicker
            picker={picker}
            hasService={serviceId !== null}
            idleMessage="Elige un servicio para ver tus horarios disponibles."
            note={service ? `Duración: ${formatDuration(service.duration_min)}` : undefined}
            onSlot={(startsAt) => {
              picker.chooseSlot(startsAt)
              setAlternatives(null)
              setFailure(null)
            }}
          />
          {errors.when && !walkIn && <Notice tone="danger">{errors.when}</Notice>}
        </section>
      )}

      <section aria-label="Cliente" className="flex flex-col gap-14">
        <SectionTitle n={3}>Cliente</SectionTitle>
        <TextField
          label="Nombre"
          placeholder="¿Cómo se llama?"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          required
        />
        <TextField
          label="Celular (WhatsApp, opcional)"
          prefix="+57"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder="300 000 0000"
          hint="Con celular podrás recordarle su cita por WhatsApp."
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          error={errors.phone}
        />
      </section>

      {failure &&
        (alternatives && alternatives.length > 0 && !walkIn ? (
          <SlotConflict
            alternatives={alternatives}
            selected={picker.selectedSlot}
            message={failure}
            onPick={(startsAt) => {
              picker.chooseSlot(startsAt)
              setAlternatives(null)
              setFailure(null)
            }}
          />
        ) : (
          <Notice tone="danger">{failure}</Notice>
        ))}
      {errors.when && walkIn && <Notice tone="danger">{errors.when}</Notice>}

      <SummaryCard
        title={walkIn ? 'Resumen del turno' : 'Resumen'}
        service={service?.name ?? '—'}
        barber={me.data?.name ?? '—'}
        dateTime={dateTime}
        duration={service ? formatDuration(service.duration_min) : '—'}
        totalCop={service?.price_cop ?? null}
      >
        <Button block loading={create.isPending} onClick={onSave}>
          Guardar cita
        </Button>
      </SummaryCard>
    </main>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Notice } from '../../components/Notice'
import { TextField } from '../../components/TextField'
import { cx, FOCUS_RING } from '../../components/classes'
import {
  useAdminAvailability,
  useAdminBarbers,
  useAdminCreateAppointment,
  useAdminServices,
} from '../../lib/api/admin'
import { ApiError } from '../../lib/api/client'
import { isTransientError } from '../../lib/api/hooks'
import type { AdminAppointment } from '../../lib/api/types'
import { formatTime } from '../../lib/format'
import { NETWORK_MESSAGE } from '../shared/RetryNotice'

const SELECT = cx(
  'box-border h-control-52 min-h-touch w-full min-w-0 rounded-field border border-line-strong bg-surface px-14 text-button text-text font-body',
  FOCUS_RING,
)

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[6px] font-body">
      <label htmlFor={id} className="text-label text-text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

type Problems = Partial<Record<'barber' | 'service' | 'time' | 'name', string>>

/** Formulario de cita manual: barbero, servicio, día, hora y cliente. */
export function NewAppointmentPanel({
  day,
  defaultBarberId,
  onClose,
  onCreated,
}: {
  day: string
  defaultBarberId?: string
  onClose: () => void
  onCreated: (appointment: AdminAppointment) => void
}) {
  const barbers = useAdminBarbers()
  const services = useAdminServices()
  const create = useAdminCreateAppointment()
  const [barberId, setBarberId] = useState(defaultBarberId ?? '')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(day)
  const [start, setStart] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [problems, setProblems] = useState<Problems>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const availability = useAdminAvailability({ barberId, serviceId, date })

  const activeBarbers = (barbers.data?.items ?? []).filter((b) => b.active)
  const activeServices = (services.data?.items ?? []).filter((s) => s.active)
  const slots = availability.data?.slots ?? []

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found: Problems = {
      barber: barberId ? undefined : 'Elige un barbero.',
      service: serviceId ? undefined : 'Elige un servicio.',
      time: start ? undefined : 'Elige una hora.',
      name: name.trim().length >= 2 ? undefined : 'Escribe el nombre del cliente.',
    }
    setProblems(found)
    setServerError(null)
    if (Object.values(found).some(Boolean)) return
    try {
      const created = await create.mutateAsync({
        barber_id: barberId,
        service_id: serviceId,
        starts_at: start,
        client: { name: name.trim(), phone: phone.trim() || null },
      })
      onCreated(created)
    } catch (error) {
      setStart('')
      setServerError(
        error instanceof ApiError && !isTransientError(error) ? error.message : NETWORK_MESSAGE,
      )
    }
  }

  return (
    <aside
      aria-label="Nueva cita"
      className="flex min-w-0 max-w-[380px] flex-[1_1_300px] flex-col gap-14 rounded-summary border border-gold-edge bg-surface p-20"
    >
      <h2 className="m-0 font-display text-h2 text-text">Nueva cita</h2>
      <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-14">
        <Field label="Barbero" id="nc-barbero">
          <select
            id="nc-barbero"
            className={SELECT}
            value={barberId}
            aria-invalid={problems.barber ? true : undefined}
            onChange={(e) => {
              setBarberId(e.target.value)
              setStart('')
            }}
          >
            <option value="">Elige un barbero</option>
            {activeBarbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.display_name}
              </option>
            ))}
          </select>
          {problems.barber && <span className="text-caption text-danger">{problems.barber}</span>}
        </Field>
        <Field label="Servicio" id="nc-servicio">
          <select
            id="nc-servicio"
            className={SELECT}
            value={serviceId}
            aria-invalid={problems.service ? true : undefined}
            onChange={(e) => {
              setServiceId(e.target.value)
              setStart('')
            }}
          >
            <option value="">Elige un servicio</option>
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {problems.service && <span className="text-caption text-danger">{problems.service}</span>}
        </Field>
        <TextField
          label="Día"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setStart('')
          }}
        />
        <Field label="Hora" id="nc-hora">
          <select
            id="nc-hora"
            className={SELECT}
            value={start}
            disabled={!barberId || !serviceId || availability.isPending}
            aria-invalid={problems.time ? true : undefined}
            onChange={(e) => setStart(e.target.value)}
          >
            <option value="">
              {!barberId || !serviceId
                ? 'Elige barbero y servicio'
                : availability.isPending
                  ? 'Buscando horarios…'
                  : slots.length === 0
                    ? 'Sin horarios libres ese día'
                    : 'Elige una hora'}
            </option>
            {slots.map((s) => (
              <option key={s.starts_at} value={s.starts_at}>
                {formatTime(s.starts_at)}
              </option>
            ))}
          </select>
          {problems.time && <span className="text-caption text-danger">{problems.time}</span>}
        </Field>
        <TextField
          label="Nombre del cliente"
          value={name}
          maxLength={60}
          error={problems.name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextField
          label="Celular (opcional)"
          inputMode="tel"
          hint="10 dígitos, para contactarlo por WhatsApp."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {serverError && <Notice tone="danger">{serverError}</Notice>}
        <div className="flex flex-col gap-10">
          <Button type="submit" block loading={create.isPending}>
            Crear cita
          </Button>
          <Button type="button" block variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </aside>
  )
}

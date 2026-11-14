import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarberPill } from '../../components/BarberPill'
import { BrandSeal } from '../../components/BrandSeal'
import { Button } from '../../components/Button'
import { cx, FOCUS_RING } from '../../components/classes'
import { Checkbox } from '../../components/Checkbox'
import { UsersIcon } from '../../components/icons'
import { Notice } from '../../components/Notice'
import { ServiceCard } from '../../components/ServiceCard'
import { Skeleton } from '../../components/Skeleton'
import { StepHeader } from '../../components/StepHeader'
import { SummaryCard } from '../../components/SummaryCard'
import { TextField } from '../../components/TextField'
import { activatedByKeyboard, goToSection } from '../../lib/accessibility'
import { ApiError } from '../../lib/api/client'
import { isSlotConflict, slotAlternatives } from '../../lib/api/conflict'
import type { Alternative } from '../../lib/api/conflict'
import {
  isTransientError,
  useBarbers,
  useCreateAppointment,
  useServices,
} from '../../lib/api/hooks'
import { queryKeys } from '../../lib/api/queryClient'
import { formatCOP, formatDayLong, formatDuration, formatTime } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { saveLastAppointment } from './lastAppointment'
import { SlotConflict } from './SlotConflict'
import { SlotPicker } from './SlotPicker'
import { useSlotPicker } from './useSlotPicker'
import { cleanName, nationalPhone, validateName, validatePhone } from './validators'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

type FieldErrors = { name?: string; phone?: string; consent?: string }
type FormNotice = { message: string; retry: boolean }

export function BookingPage() {
  useDocumentTitle('Agendar cita')
  const navigate = useNavigate()
  const client = useQueryClient()
  const services = useServices()
  const barbers = useBarbers()
  const create = useCreateAppointment()

  const [serviceId, setServiceId] = useState<string | null>(null)
  const [barberId, setBarberId] = useState<string | null>(null) // null = cualquiera
  const picker = useSlotPicker(serviceId, barberId)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // campo trampa: las personas no lo ven
  const [touched, setTouched] = useState({ name: false, phone: false })
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [notice, setNotice] = useState<FormNotice | null>(null)
  const [conflict, setConflict] = useState<Alternative[] | null>(null)

  const step2 = useRef<HTMLHeadingElement>(null)
  const step3 = useRef<HTMLHeadingElement>(null)
  const conflictBox = useRef<HTMLDivElement>(null)
  const inFlight = useRef(false)

  const service = services.data?.find((s) => s.id === serviceId)
  const barber = barbers.data?.find((b) => b.id === barberId)
  const barberLabel = barber?.display_name ?? 'Cualquiera'

  // Una alternativa elegida tras un 409 cuenta como hora elegida aunque la lista aún no se refresque.
  const slot =
    picker.selectedSlot ??
    (conflict?.some((a) => a.starts_at === picker.chosenSlot) ? picker.chosenSlot : null)

  const nameError = (touched.name ? validateName(name) : null) ?? serverErrors.name
  const phoneError = (touched.phone ? validatePhone(phone) : null) ?? serverErrors.phone
  const valid =
    !!service && !!slot && validateName(name) === null && validatePhone(phone) === null && consent
  const busy = create.isPending || create.isSuccess

  useEffect(() => {
    if (conflict) goToSection(conflictBox.current, false)
  }, [conflict])

  function clearFeedback() {
    setConflict(null)
    setNotice(null)
  }

  function pickService(id: string) {
    setServiceId(id)
    clearFeedback()
  }

  function pickBarber(id: string | null, event: React.MouseEvent) {
    setBarberId(id)
    clearFeedback()
    // Con el servicio ya elegido, el paso 1 está completo: se pasa al día y la hora.
    if (serviceId) goToSection(step2.current, activatedByKeyboard(event))
  }

  function pickSlot(startsAt: string, event: React.MouseEvent) {
    picker.chooseSlot(startsAt)
    setNotice(null)
    goToSection(step3.current, activatedByKeyboard(event))
  }

  function submit() {
    if (!valid || !service || !slot || busy || inFlight.current) return
    inFlight.current = true
    setNotice(null)
    setConflict(null)
    setServerErrors({})
    create.mutate(
      {
        service_id: service.id,
        barber_id: barberId,
        starts_at: slot,
        client: { name: cleanName(name), phone: nationalPhone(phone) ?? phone },
        consent,
        website,
      },
      {
        onSuccess: ({ manage_token, appointment }) => {
          saveLastAppointment(manage_token)
          client.setQueryData([...queryKeys.appointment, manage_token], appointment)
          void picker.refresh()
          navigate(`/cita/${manage_token}`, { replace: true })
        },
        onError: (error) => {
          if (isSlotConflict(error)) {
            setConflict(slotAlternatives(error))
            void picker.refresh()
          } else if (error instanceof ApiError && error.code === 'invalid_phone') {
            setServerErrors({ phone: error.message })
          } else if (error instanceof ApiError && error.code === 'invalid_name') {
            setServerErrors({ name: error.message })
          } else if (error instanceof ApiError && error.code === 'consent_required') {
            setServerErrors({ consent: error.message })
          } else if (isTransientError(error)) {
            setNotice({ message: `No pudimos agendar tu cita. ${NETWORK_MESSAGE}`, retry: true })
          } else {
            setNotice({ message: (error as Error).message, retry: false })
          }
        },
        onSettled: (_data, error) => {
          // Si salió bien se navega y la pantalla se desmonta: el bloqueo se mantiene.
          if (error) inFlight.current = false
        },
      },
    )
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit()
  }

  const summaryLine = service
    ? `${service.name}, ${barberLabel}${slot ? `, ${formatDayLong(slot)} a las ${formatTime(slot)}` : ''}. Total ${formatCOP(service.price_cop)}.`
    : ''

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col gap-36 px-20 pb-[220px]"
    >
      <header className="flex flex-col gap-14 pt-20">
        <div className="flex items-center justify-between gap-10">
          <div className="flex items-center gap-10">
            <BrandSeal size={44} />
            <span className="font-display text-h2 text-text">Imperio Barber</span>
          </div>
          <Link
            to="/productos"
            className="inline-flex min-h-touch items-center px-8 text-body-strong text-gold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            Productos
          </Link>
        </div>
        <div className="flex flex-col gap-8">
          <h1 className="m-0 font-display text-h1 text-text">Agenda tu cita</h1>
          <p className="m-0 text-small text-text-muted">
            Sin registro y sin descargas. Elige tu servicio, tu hora y listo.
          </p>
        </div>
      </header>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-36">
        <section aria-labelledby="paso-servicio" className="flex flex-col gap-14">
          <StepHeader step={1} title="Servicio" id="paso-servicio" />
          {services.isPending && (
            <div role="status" aria-busy="true" className="flex flex-col gap-10">
              <span className="sr-only">Cargando servicios…</span>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[64px]" />
              ))}
            </div>
          )}
          {services.isError && (
            <RetryNotice onRetry={() => void services.refetch()} loading={services.isFetching}>
              {isTransientError(services.error)
                ? `No pudimos cargar los servicios. ${NETWORK_MESSAGE}`
                : services.error.message}
            </RetryNotice>
          )}
          {services.data && (
            <div role="group" aria-label="Servicios" className="flex flex-col gap-10">
              {services.data.map((s) => (
                <ServiceCard
                  key={s.id}
                  name={s.name}
                  durationMin={s.duration_min}
                  priceCop={s.price_cop}
                  note={s.uses_resource ? 'Incluye vaporizador' : undefined}
                  selected={s.id === serviceId}
                  onClick={() => pickService(s.id)}
                />
              ))}
            </div>
          )}

          <h3 id="barbero-titulo" className="m-0 mt-8 text-body-strong text-text">
            Barbero
          </h3>
          <div role="group" aria-labelledby="barbero-titulo" className="flex flex-wrap gap-10">
            <BarberPill
              name="Cualquiera"
              icon={<UsersIcon size={16} />}
              selected={barberId === null}
              onClick={(event) => pickBarber(null, event)}
            />
            {barbers.data?.map((b) => (
              <BarberPill
                key={b.id}
                name={b.display_name}
                selected={b.id === barberId}
                onClick={(event) => pickBarber(b.id, event)}
              />
            ))}
            {barbers.isPending && <Skeleton className="h-control-46 w-[120px] rounded-pill" />}
          </div>
          {barbers.isError && (
            <RetryNotice onRetry={() => void barbers.refetch()} loading={barbers.isFetching}>
              {`No pudimos cargar los barberos. ${NETWORK_MESSAGE}`}
            </RetryNotice>
          )}
        </section>

        <section aria-labelledby="paso-hora" className="flex flex-col gap-14">
          <StepHeader step={2} title="Día y hora" id="paso-hora" headingRef={step2} />
          <SlotPicker
            picker={picker}
            hasService={serviceId !== null}
            note={
              service
                ? `Tu servicio dura aprox. ${formatDuration(service.duration_min)}; apartamos el bloque completo.`
                : undefined
            }
            onDay={() => clearFeedback()}
            onSlot={pickSlot}
          />
          {conflict && (
            <div ref={conflictBox}>
              <SlotConflict alternatives={conflict} selected={slot} onPick={pickSlot} />
            </div>
          )}
        </section>

        <section aria-labelledby="paso-datos" className="flex flex-col gap-14">
          <StepHeader step={3} title="Tus datos" id="paso-datos" headingRef={step3} />
          <TextField
            label="Nombre"
            name="name"
            placeholder="¿Cómo te llamas?"
            autoComplete="name"
            value={name}
            error={nameError ?? undefined}
            onChange={(e) => {
              setName(e.target.value)
              setServerErrors((prev) => ({ ...prev, name: undefined }))
            }}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          />
          <TextField
            label="Celular (WhatsApp)"
            name="phone"
            prefix="+57"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="300 000 0000"
            value={phone}
            error={phoneError ?? undefined}
            onChange={(e) => {
              setPhone(e.target.value)
              setServerErrors((prev) => ({ ...prev, phone: undefined }))
            }}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
          />
          <Checkbox
            name="consent"
            checked={consent}
            error={serverErrors.consent}
            onChange={(e) => {
              setConsent(e.target.checked)
              setServerErrors((prev) => ({ ...prev, consent: undefined }))
            }}
          >
            Acepto el tratamiento de mis datos personales.{' '}
            <a
              href="/privacidad"
              target="_blank"
              rel="noopener noreferrer"
              className={cx('text-gold underline underline-offset-2', FOCUS_RING)}
            >
              Leer la política
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </Checkbox>

          {/* Campo trampa: fuera de pantalla con CSS (no display:none, que los bots detectan). */}
          <div
            aria-hidden="true"
            className="absolute top-auto left-[-9999px] h-[1px] w-[1px] overflow-hidden"
          >
            <label>
              Sitio web
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </label>
          </div>
        </section>

        <SummaryCard
          variant="bar"
          service={service?.name ?? 'Elige un servicio'}
          barber={barberLabel}
          dateTime={slot ? `${formatDayLong(slot)} · ${formatTime(slot)}` : null}
          duration={service ? `~${formatDuration(service.duration_min)}` : '—'}
          totalCop={service?.price_cop ?? null}
        >
          {notice &&
            (notice.retry ? (
              <RetryNotice onRetry={submit} loading={create.isPending}>
                {notice.message}
              </RetryNotice>
            ) : (
              <Notice tone="danger">{notice.message}</Notice>
            ))}
          <Button type="submit" block disabled={!valid} loading={busy}>
            {busy ? 'Confirmando…' : 'Confirmar cita'}
          </Button>
        </SummaryCard>
      </form>

      {/* Anuncia el resumen al cambiar la selección sin mover el foco. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {summaryLine}
      </div>
    </main>
  )
}

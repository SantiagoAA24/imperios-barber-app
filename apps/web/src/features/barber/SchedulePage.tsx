import { useState } from 'react'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { Dialog } from '../../components/Dialog'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { Switch } from '../../components/Switch'
import { TextField } from '../../components/TextField'
import { PlusIcon, TrashIcon } from '../../components/icons'
import { cx, FOCUS_RING } from '../../components/classes'
import {
  useCreateTimeOff,
  useDeleteTimeOff,
  useReplaceSchedule,
  useSchedule,
  useTimeOff,
} from '../../lib/api/barber'
import { ApiError } from '../../lib/api/client'
import { isTransientError } from '../../lib/api/hooks'
import type { Conflict, TimeOff } from '../../lib/api/types'
import { bogotaDay, formatDayLong, formatTime } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { ConflictList } from './ConflictList'
import {
  addTramo,
  copyDay,
  MAX_TRAMOS,
  removeTramo,
  setTramo,
  setWorking,
  timeLabel,
  TIME_OPTIONS,
  toBlocks,
  toDraft,
  WEEKDAYS,
} from './scheduleDraft'
import type { Draft } from './scheduleDraft'

function TimeSelect({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  // Si el servidor trae una hora fuera de la lista, igual se muestra.
  const options = TIME_OPTIONS.includes(value) ? TIME_OPTIONS : [...TIME_OPTIONS, value].sort()
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cx(
        'box-border h-control-46 min-h-touch min-w-0 flex-1 rounded-field border border-line-strong bg-surface px-10 text-label text-text font-body',
        FOCUS_RING,
      )}
    >
      {options.map((t) => (
        <option key={t} value={t}>
          {timeLabel(t)}
        </option>
      ))}
    </select>
  )
}

function describeRange(item: TimeOff): string {
  const sameDay = bogotaDay(item.starts_at) === bogotaDay(item.ends_at)
  return sameDay
    ? `${formatDayLong(item.starts_at)} · ${formatTime(item.starts_at)} – ${formatTime(item.ends_at)}`
    : `${formatDayLong(item.starts_at)} ${formatTime(item.starts_at)} → ${formatDayLong(item.ends_at)} ${formatTime(item.ends_at)}`
}

function errorMessage(error: unknown, what: string): string {
  return error instanceof ApiError && !isTransientError(error)
    ? error.message
    : `No pudimos ${what}. ${NETWORK_MESSAGE}`
}

/** Mi horario (barbero-horario.dc.html): días y tramos, copiar entre días y ausencias. */
export function SchedulePage() {
  const schedule = useSchedule()
  const save = useReplaceSchedule()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [copyFrom, setCopyFrom] = useState<number | null>(null)
  const [copyTo, setCopyTo] = useState<number[]>([])
  const [saved, setSaved] = useState(false)

  const server = schedule.data ? toDraft(schedule.data.schedule) : null
  const current = draft ?? server

  function edit(update: (d: Draft) => Draft) {
    if (!current) return
    setDraft(update(current))
    setSaved(false)
    save.reset()
  }

  function onSave() {
    if (!current) return
    save.mutate(toBlocks(current), {
      onSuccess: () => {
        setDraft(null) // vuelve a lo que confirmó el servidor
        setSaved(true)
      },
    })
  }

  return (
    <main className="flex flex-col gap-20 px-20 pb-20">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-small text-text-muted">Cuándo te pueden agendar</p>
        <h1 className="m-0 font-display text-h1 text-text">Mi horario</h1>
      </div>

      {schedule.data && (
        <ConflictList
          conflicts={schedule.data.conflicts}
          title="Estas citas quedaron fuera de tu horario."
        />
      )}

      <section aria-labelledby="dias-titulo" className="flex flex-col gap-14">
        <h2 id="dias-titulo" className="m-0 font-display text-h2 text-text">
          Días de trabajo
        </h2>

        {schedule.isPending && (
          <div role="status" aria-busy="true" className="flex flex-col gap-10">
            <span className="sr-only">Cargando tu horario…</span>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[64px] w-full" />
            ))}
          </div>
        )}
        {schedule.isError && (
          <RetryNotice onRetry={() => void schedule.refetch()} loading={schedule.isFetching}>
            {errorMessage(schedule.error, 'cargar tu horario')}
          </RetryNotice>
        )}

        {current && (
          <ul className="m-0 flex list-none flex-col gap-10 p-0">
            {WEEKDAYS.map((name, weekday) => {
              const tramos = current[weekday] ?? []
              const works = tramos.length > 0
              return (
                <li
                  key={name}
                  className="flex flex-col gap-10 rounded-card border border-line bg-surface p-14"
                >
                  <div className="flex items-center justify-between gap-10">
                    <div className="flex flex-col">
                      <span className="text-body-strong text-text">{name}</span>
                      {!works && <span className="text-caption text-text-muted">Día libre</span>}
                    </div>
                    <Switch
                      label={`Trabajo el ${name.toLowerCase()}`}
                      checked={works}
                      onCheckedChange={(on) => edit((d) => setWorking(d, weekday, on))}
                    />
                  </div>

                  {tramos.map((tramo, index) => (
                    <div key={index} className="flex flex-col gap-8">
                      <div className="flex items-center gap-8">
                        <TimeSelect
                          label={`${name}, tramo ${index + 1}, desde`}
                          value={tramo.start}
                          onChange={(v) => edit((d) => setTramo(d, weekday, index, 'start', v))}
                        />
                        <span aria-hidden="true" className="text-text-muted">
                          –
                        </span>
                        <TimeSelect
                          label={`${name}, tramo ${index + 1}, hasta`}
                          value={tramo.end}
                          onChange={(v) => edit((d) => setTramo(d, weekday, index, 'end', v))}
                        />
                      </div>
                      {index > 0 && (
                        <Button
                          size="md"
                          variant="ghost"
                          icon={<TrashIcon size={18} />}
                          className="self-start"
                          onClick={() => edit((d) => removeTramo(d, weekday, index))}
                        >
                          {`Quitar tramo ${index + 1} del ${name.toLowerCase()}`}
                        </Button>
                      )}
                    </div>
                  ))}

                  {works && (
                    <div className="flex flex-wrap gap-10">
                      {tramos.length < MAX_TRAMOS && (
                        <Button
                          size="md"
                          variant="secondary"
                          icon={<PlusIcon size={18} />}
                          onClick={() => edit((d) => addTramo(d, weekday))}
                        >
                          {`Dejar almuerzo libre, ${name.toLowerCase()}`}
                        </Button>
                      )}
                      <Button
                        size="md"
                        variant="ghost"
                        onClick={() => {
                          setCopyFrom(weekday)
                          setCopyTo([])
                        }}
                      >
                        {`Copiar el ${name.toLowerCase()} a otros días`}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {current && (
          <div className="flex flex-col gap-10">
            {save.isError && (
              <Notice tone="danger">{errorMessage(save.error, 'guardar el horario')}</Notice>
            )}
            {saved && <Notice tone="success">Horario guardado.</Notice>}
            <Button block loading={save.isPending} onClick={onSave}>
              Guardar horario
            </Button>
          </div>
        )}
      </section>

      <TimeOffSection />

      <Dialog
        open={copyFrom !== null}
        onClose={() => setCopyFrom(null)}
        title={copyFrom === null ? '' : `Copiar el ${WEEKDAYS[copyFrom]!.toLowerCase()}`}
      >
        <p className="m-0 text-body text-text-muted">
          Elige los días que tendrán el mismo horario. Se reemplaza el que tengan ahora.
        </p>
        <div className="flex flex-col gap-8">
          {WEEKDAYS.map((name, weekday) =>
            weekday === copyFrom ? null : (
              <Checkbox
                key={name}
                checked={copyTo.includes(weekday)}
                onChange={(event) =>
                  setCopyTo((prev) =>
                    event.target.checked ? [...prev, weekday] : prev.filter((d) => d !== weekday),
                  )
                }
              >
                {name}
              </Checkbox>
            ),
          )}
        </div>
        <div className="flex flex-col gap-10">
          <Button
            block
            disabled={copyTo.length === 0}
            onClick={() => {
              if (copyFrom !== null) edit((d) => copyDay(d, copyFrom, copyTo))
              setCopyFrom(null)
            }}
          >
            Copiar horario
          </Button>
          <Button block variant="secondary" data-autofocus onClick={() => setCopyFrom(null)}>
            Cancelar
          </Button>
        </div>
      </Dialog>
    </main>
  )
}

/** Ausencias (vacaciones, permisos, almuerzo de un día): bloquean la disponibilidad. */
function TimeOffSection() {
  const list = useTimeOff()
  const create = useCreateTimeOff()
  const remove = useDeleteTimeOff()
  const [adding, setAdding] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ from?: string; to?: string }>({})
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [removeError, setRemoveError] = useState<string | null>(null)

  function onAdd() {
    const problems = {
      from: from ? undefined : 'Elige cuándo empieza.',
      to: to ? undefined : 'Elige cuándo termina.',
    }
    setErrors(problems)
    if (problems.from || problems.to) return
    // El campo trae hora local del negocio (Bogotá, UTC-5 todo el año) sin zona: se la añadimos.
    create.mutate(
      {
        starts_at: `${from}:00-05:00`,
        ends_at: `${to}:00-05:00`,
        reason: reason.trim() || null,
      },
      {
        onSuccess: (result) => {
          setConflicts(result.conflicts)
          setAdding(false)
          setFrom('')
          setTo('')
          setReason('')
        },
      },
    )
  }

  return (
    <section aria-labelledby="ausencias-titulo" className="flex flex-col gap-14">
      <h2 id="ausencias-titulo" className="m-0 font-display text-h2 text-text">
        Ausencias
      </h2>

      <ConflictList conflicts={conflicts} title="Estas citas caen dentro de tu ausencia." />

      {list.isPending && <Skeleton className="h-[64px] w-full" />}
      {list.isError && (
        <RetryNotice onRetry={() => void list.refetch()} loading={list.isFetching}>
          {errorMessage(list.error, 'cargar tus ausencias')}
        </RetryNotice>
      )}
      {list.data && list.data.items.length === 0 && !adding && (
        <p className="m-0 text-small text-text-muted">No tienes ausencias programadas.</p>
      )}
      {removeError && <Notice tone="danger">{removeError}</Notice>}

      {list.data && list.data.items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-10 p-0">
          {list.data.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-10 rounded-card border border-line bg-surface p-14"
            >
              <div className="flex min-w-0 flex-col gap-4">
                <span className="text-small font-semibold text-text">{describeRange(item)}</span>
                {item.reason && <span className="text-caption text-text-muted">{item.reason}</span>}
              </div>
              <Button
                size="md"
                variant="danger-outline"
                icon={<TrashIcon size={18} />}
                aria-label={`Quitar ausencia: ${describeRange(item)}`}
                loading={remove.isPending && remove.variables === item.id}
                onClick={() => {
                  setRemoveError(null)
                  remove.mutate(item.id, {
                    onError: (error) => setRemoveError(errorMessage(error, 'quitar la ausencia')),
                  })
                }}
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            onAdd()
          }}
          className="flex flex-col gap-14 rounded-card border border-line bg-surface p-14"
        >
          <TextField
            label="Desde"
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            error={errors.from}
          />
          <TextField
            label="Hasta"
            type="datetime-local"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            error={errors.to}
          />
          <TextField
            label="Motivo (opcional)"
            placeholder="Almuerzo, trámite, vacaciones…"
            maxLength={100}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {create.isError && (
            <Notice tone="danger">{errorMessage(create.error, 'guardar la ausencia')}</Notice>
          )}
          <Button type="submit" block loading={create.isPending}>
            Guardar ausencia
          </Button>
          <Button
            block
            variant="secondary"
            onClick={() => {
              setAdding(false)
              create.reset()
            }}
          >
            Cancelar
          </Button>
        </form>
      ) : (
        <Button
          block
          variant="secondary"
          icon={<PlusIcon size={18} />}
          onClick={() => {
            setAdding(true)
            setConflicts([])
          }}
        >
          Bloquear horas o días
        </Button>
      )}

      <Notice>Las horas bloqueadas no aparecen como disponibles cuando un cliente agenda.</Notice>
    </section>
  )
}

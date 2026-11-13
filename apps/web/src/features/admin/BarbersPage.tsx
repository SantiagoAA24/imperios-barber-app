import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { Switch } from '../../components/Switch'
import { TextField } from '../../components/TextField'
import { PlusIcon } from '../../components/icons'
import {
  useAdminBarbers,
  useCreateBarber,
  useResetBarberPassword,
  useUpdateBarber,
} from '../../lib/api/admin'
import { ApiError } from '../../lib/api/client'
import { isTransientError } from '../../lib/api/hooks'
import type { AdminBarber, BarberConflict } from '../../lib/api/types'
import { formatDayLong, formatTime } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'

type Credential = { name: string; password: string }

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && !isTransientError(error)) return error.message
  return NETWORK_MESSAGE
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/** Clave temporal: se muestra una sola vez; al cerrar el aviso desaparece de la pantalla. */
function TemporaryPassword({ credential, onDone }: { credential: Credential; onDone: () => void }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(credential.password)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <section
      aria-label="Clave temporal"
      className="flex flex-col gap-10 rounded-card border border-gold-edge bg-surface p-14"
    >
      <Notice tone="success">
        Clave temporal de <strong className="font-semibold">{credential.name}</strong>. Entrégasela
        en persona: tendrá que cambiarla al ingresar.
      </Notice>
      <div className="flex flex-wrap items-center gap-10">
        <code
          aria-label="Clave temporal generada"
          className="rounded-field border border-line-strong bg-bg px-14 py-10 text-body-strong select-all text-text"
        >
          {credential.password}
        </code>
        <Button size="md" variant="secondary" onClick={() => void copy()}>
          Copiar
        </Button>
      </div>
      <Notice tone="danger">No volverás a ver esta clave.</Notice>
      <p role="status" className="m-0 text-caption text-text-muted">
        {copied === 'yes' && 'Clave copiada.'}
        {copied === 'no' && 'No pudimos copiarla: selecciónala y cópiala a mano.'}
      </p>
      <Button size="md" className="self-start" onClick={onDone}>
        Ya la copié
      </Button>
    </section>
  )
}

function Conflicts({ name, conflicts }: { name: string; conflicts: BarberConflict[] }) {
  return (
    <section
      aria-label={`Citas pendientes de ${name}`}
      className="flex flex-col gap-10 rounded-card border border-line-strong bg-surface p-14"
    >
      <Notice tone="danger">
        <strong className="font-semibold">
          {name} quedó inactivo y tiene {conflicts.length}{' '}
          {conflicts.length === 1 ? 'cita futura reservada' : 'citas futuras reservadas'}.
        </strong>{' '}
        No se cancelaron: muévelas o cancélalas desde la agenda.
      </Notice>
      <ul className="m-0 flex list-none flex-col gap-4 p-0 text-small text-text">
        {conflicts.map((c) => (
          <li key={c.appointment_id}>
            <span className="font-semibold">{c.client_name}</span> · {c.service_name} ·{' '}
            {formatDayLong(c.starts_at)} · {formatTime(c.starts_at)}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function BarbersPage() {
  const list = useAdminBarbers()
  const create = useCreateBarber()
  const update = useUpdateBarber()
  const reset = useResetBarberPassword()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [problems, setProblems] = useState<{ name?: string; email?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [credential, setCredential] = useState<Credential | null>(null)
  const [conflicts, setConflicts] = useState<{ name: string; items: BarberConflict[] } | null>(null)
  const [confirmOff, setConfirmOff] = useState<AdminBarber | null>(null)
  const [confirmReset, setConfirmReset] = useState<AdminBarber | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)

  const items = list.data?.items ?? []

  function closeForm() {
    setAdding(false)
    setName('')
    setEmail('')
    setProblems({})
    setFormError(null)
    document.getElementById('agregar-barbero')?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = {
      name: name.trim().length >= 2 ? undefined : 'Escribe el nombre (mínimo 2 letras).',
      email: EMAIL.test(email.trim()) ? undefined : 'Escribe un correo válido.',
    }
    setProblems(found)
    setFormError(null)
    if (found.name || found.email) return
    try {
      const created = await create.mutateAsync({
        display_name: name.trim(),
        email: email.trim(),
        visible_in_booking: true,
      })
      setCredential({ name: created.barber.display_name, password: created.temporary_password })
      setConflicts(null)
      closeForm()
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  async function patch(
    barber: AdminBarber,
    body: { active?: boolean; visible_in_booking?: boolean },
  ) {
    setRowError(null)
    setConfirmOff(null)
    try {
      const result = await update.mutateAsync({ id: barber.id, body })
      setConflicts(
        result.conflicts.length > 0
          ? { name: result.barber.display_name, items: result.conflicts }
          : null,
      )
    } catch (error) {
      setRowError(errorMessage(error))
    }
  }

  async function doReset(barber: AdminBarber) {
    setConfirmReset(null)
    setRowError(null)
    try {
      const result = await reset.mutateAsync(barber.id)
      setCredential({ name: barber.display_name, password: result.temporary_password })
      setConflicts(null)
    } catch (error) {
      setRowError(errorMessage(error))
    }
  }

  return (
    <main className="flex flex-col gap-20 px-20 py-20 md:px-36 md:py-36">
      <header className="flex flex-wrap items-end justify-between gap-14">
        <div className="flex flex-col gap-4">
          <h1 className="m-0 font-display text-h1 text-text">Barberos</h1>
          <p className="m-0 text-small text-text-muted">
            Quién atiende y aparece al agendar. Nada se borra: se desactiva.
          </p>
        </div>
        <Button id="agregar-barbero" icon={<PlusIcon />} onClick={() => setAdding(true)}>
          Agregar barbero
        </Button>
      </header>

      {credential && (
        <TemporaryPassword credential={credential} onDone={() => setCredential(null)} />
      )}
      {conflicts && <Conflicts name={conflicts.name} conflicts={conflicts.items} />}
      {rowError && <Notice tone="danger">{rowError}</Notice>}

      {adding && (
        <form
          aria-label="Agregar barbero"
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex max-w-[520px] flex-col gap-14 rounded-summary border border-gold-edge bg-surface p-20"
        >
          <h2 className="m-0 font-display text-h2 text-text">Agregar barbero</h2>
          <TextField
            label="Nombre"
            value={name}
            maxLength={40}
            error={problems.name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label="Correo"
            type="email"
            inputMode="email"
            hint="Con este correo ingresará. Le daremos una clave temporal."
            value={email}
            error={problems.email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {formError && <Notice tone="danger">{formError}</Notice>}
          <div className="flex flex-wrap gap-10">
            <Button type="submit" loading={create.isPending}>
              Crear barbero
            </Button>
            <Button type="button" variant="secondary" onClick={closeForm}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <section
        aria-label="Equipo"
        className="rounded-summary border border-line bg-surface px-14 pb-14 pt-4"
      >
        {list.isPending ? (
          <div role="status" aria-busy="true" className="flex flex-col gap-10 py-14">
            <span className="sr-only">Cargando barberos…</span>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[44px] w-full" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="py-14">
            <RetryNotice onRetry={() => void list.refetch()} loading={list.isFetching}>
              No pudimos cargar los barberos. {NETWORK_MESSAGE}
            </RetryNotice>
          </div>
        ) : items.length === 0 ? (
          <p className="m-0 py-20 text-body text-text-muted">
            Aún no tienes barberos. Agrega el primero con «Agregar barbero».
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-small">
              <caption className="sr-only">Barberos del negocio</caption>
              <thead>
                <tr className="text-left text-text-muted">
                  <th scope="col" className="py-14 pr-8 font-medium">
                    Barbero
                  </th>
                  <th scope="col" className="px-8 py-14 text-center font-medium">
                    Aparece al agendar
                  </th>
                  <th scope="col" className="px-8 py-14 text-center font-medium">
                    Activo
                  </th>
                  <th scope="col" className="py-14 pl-8 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((barber) => (
                  <tr key={barber.id} className="border-t border-line">
                    <th scope="row" className="py-10 pr-8 text-left font-semibold text-text">
                      {barber.display_name}
                      <span className="block text-caption font-normal text-text-muted">
                        {barber.email}
                      </span>
                      {barber.must_change_password && (
                        <span className="block text-caption font-normal text-text-muted">
                          Debe cambiar su clave temporal
                        </span>
                      )}
                      {!barber.active && (
                        <span className="block text-caption font-normal text-text-muted">
                          Inactivo: no puede ingresar
                        </span>
                      )}
                    </th>
                    <td className="px-8 py-4 text-center">
                      <Switch
                        label={`Aparece al agendar: ${barber.display_name}`}
                        checked={barber.visible_in_booking}
                        disabled={update.isPending}
                        onCheckedChange={(next) => void patch(barber, { visible_in_booking: next })}
                      />
                    </td>
                    <td className="px-8 py-4 text-center">
                      <Switch
                        label={`Activo: ${barber.display_name}`}
                        checked={barber.active}
                        disabled={update.isPending}
                        onCheckedChange={(next) =>
                          next ? void patch(barber, { active: true }) : setConfirmOff(barber)
                        }
                      />
                    </td>
                    <td className="py-4 pl-8 text-right">
                      <Button
                        size="md"
                        variant="secondary"
                        aria-label={`Reiniciar clave de ${barber.display_name}`}
                        onClick={() => setConfirmReset(barber)}
                      >
                        Reiniciar clave
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={confirmOff !== null}
        onClose={() => setConfirmOff(null)}
        title="¿Desactivar a este barbero?"
      >
        <p className="m-0 text-body text-text-muted">
          {confirmOff?.display_name} dejará de aparecer al agendar y no podrá ingresar. Sus citas no
          se borran ni se cancelan: te mostraremos las que tiene pendientes.
        </p>
        <div className="flex flex-col gap-10">
          <Button data-autofocus block onClick={() => setConfirmOff(null)}>
            Mantenerlo activo
          </Button>
          <Button
            block
            variant="danger-outline"
            loading={update.isPending}
            onClick={() => confirmOff && void patch(confirmOff, { active: false })}
          >
            Desactivar barbero
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirmReset !== null}
        onClose={() => setConfirmReset(null)}
        title="¿Reiniciar la clave?"
      >
        <p className="m-0 text-body text-text-muted">
          Se generará una clave temporal nueva para {confirmReset?.display_name}, se cerrarán sus
          sesiones y tendrá que cambiarla al ingresar. La verás una sola vez.
        </p>
        <div className="flex flex-col gap-10">
          <Button data-autofocus block onClick={() => setConfirmReset(null)}>
            Cancelar
          </Button>
          <Button
            block
            variant="danger-outline"
            loading={reset.isPending}
            onClick={() => confirmReset && void doReset(confirmReset)}
          >
            Sí, reiniciar clave
          </Button>
        </div>
      </Dialog>
    </main>
  )
}

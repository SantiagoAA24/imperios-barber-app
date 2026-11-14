import { useState } from 'react'
import { Button } from '../../components/Button'
import { Checkbox } from '../../components/Checkbox'
import { Dialog } from '../../components/Dialog'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { Switch } from '../../components/Switch'
import { TextField } from '../../components/TextField'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../../components/classes'
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon } from '../../components/icons'
import {
  useAdminServices,
  useCreateService,
  useDeleteService,
  useReorderServices,
  useUpdateService,
} from '../../lib/api/admin'
import { ApiError } from '../../lib/api/client'
import { isTransientError } from '../../lib/api/hooks'
import type { AdminResource, AdminService } from '../../lib/api/types'
import { formatCOP } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { CatalogHeader } from './CatalogHeader'
import {
  draftFromService,
  EMPTY_DRAFT,
  isDirty,
  moveId,
  toBody,
  validateDraft,
} from './serviceForm'
import type { ServiceDraft, ServiceErrors } from './serviceForm'
import { useUnsavedGuard } from './useUnsavedGuard'
import { useDocumentTitle } from '../../lib/useDocumentTitle'

type Panel = { mode: 'new' } | { mode: 'edit'; id: string } | null

const ICON_BUTTON = cx(
  'inline-flex h-touch w-touch items-center justify-center rounded-field border-0 bg-transparent text-gold disabled:cursor-not-allowed disabled:text-text-muted disabled:opacity-60',
  TAPPABLE,
  TRANSITION,
  FOCUS_RING,
)

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && !isTransientError(error)) return error.message
  return NETWORK_MESSAGE
}

export default function ServicesPage() {
  useDocumentTitle('Administrar servicios')
  const list = useAdminServices()
  const reorder = useReorderServices()
  const update = useUpdateService()
  const [panel, setPanel] = useState<Panel>(null)
  const [dirty, setDirty] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [confirmHide, setConfirmHide] = useState<AdminService | null>(null)
  const { guard, dialog: unsavedDialog } = useUnsavedGuard(dirty)

  const items = list.data?.items ?? []
  const resources = list.data?.resources ?? []
  const editing = panel?.mode === 'edit' ? items.find((s) => s.id === panel.id) : undefined

  function open(next: Panel) {
    guard(() => {
      setDirty(false)
      setPanel(next)
    })
  }

  function close() {
    setDirty(false)
    setPanel(null)
    document.getElementById('agregar-servicio')?.focus()
  }

  async function move(service: AdminService, delta: -1 | 1) {
    const ids = items.map((s) => s.id)
    const next = moveId(ids, service.id, delta)
    if (next === ids) return
    setToggleError(null)
    try {
      await reorder.mutateAsync(next)
      setAnnounce(`${service.name} ahora está en la posición ${next.indexOf(service.id) + 1}.`)
    } catch (error) {
      setToggleError(errorMessage(error))
    }
  }

  async function setActive(service: AdminService, active: boolean) {
    setToggleError(null)
    setConfirmHide(null)
    try {
      await update.mutateAsync({ id: service.id, body: { active } })
      setAnnounce(`${service.name} ${active ? 'ahora es visible' : 'quedó oculto'}.`)
    } catch (error) {
      setToggleError(errorMessage(error))
    }
  }

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="outline-none flex flex-col gap-20 px-20 py-20 md:px-36 md:py-36"
    >
      <CatalogHeader
        action={
          <Button id="agregar-servicio" icon={<PlusIcon />} onClick={() => open({ mode: 'new' })}>
            Agregar servicio
          </Button>
        }
      />
      <p role="status" className="sr-only">
        {announce}
      </p>
      {toggleError && <Notice tone="danger">{toggleError}</Notice>}

      <section className="flex flex-wrap items-start gap-14" aria-label="Servicios">
        <div className="min-w-0 flex-[2_1_600px] overflow-x-auto rounded-summary border border-line bg-surface px-14 pb-14 pt-4">
          {list.isPending ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-10 py-14">
              <span className="sr-only">Cargando servicios…</span>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-[44px] w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <div className="py-14">
              <RetryNotice onRetry={() => void list.refetch()} loading={list.isFetching}>
                No pudimos cargar los servicios. {NETWORK_MESSAGE}
              </RetryNotice>
            </div>
          ) : items.length === 0 ? (
            <p className="m-0 py-20 text-body text-text-muted">
              Aún no tienes servicios. Agrega el primero con «Agregar servicio».
            </p>
          ) : (
            <table className="w-full min-w-[560px] border-collapse text-small">
              <caption className="sr-only">
                Servicios del negocio, en el orden en que se muestran
              </caption>
              <thead>
                <tr className="text-left text-text-muted">
                  <th scope="col" className="py-14 pr-8 font-medium">
                    Servicio
                  </th>
                  <th scope="col" className="px-8 py-14 text-right font-medium">
                    Duración
                  </th>
                  <th scope="col" className="px-8 py-14 text-right font-medium">
                    Precio
                  </th>
                  <th scope="col" className="px-8 py-14 text-center font-medium">
                    Estado
                  </th>
                  <th scope="col" className="py-14 pl-8 text-right font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((service, index) => (
                  <tr
                    key={service.id}
                    className={cx(
                      'border-t border-line',
                      editing?.id === service.id && 'bg-surface-selected',
                    )}
                  >
                    <th scope="row" className="py-10 pr-8 text-left font-semibold text-text">
                      {service.name}
                      {!service.active && (
                        <span className="block text-caption font-normal text-text-muted">
                          Oculto para los clientes
                        </span>
                      )}
                      {service.resource_id && (
                        <span className="block text-caption font-normal text-text-muted">
                          Nota: con vaporizador
                        </span>
                      )}
                    </th>
                    <td className="px-8 py-10 text-right text-text-muted">
                      {service.duration_min} min
                    </td>
                    <td className="px-8 py-10 text-right font-semibold text-gold">
                      {formatCOP(service.price_cop)}
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className="inline-flex items-center gap-8">
                        <Switch
                          label={`Visible para los clientes: ${service.name}`}
                          checked={service.active}
                          disabled={update.isPending}
                          onCheckedChange={(next) =>
                            next ? void setActive(service, true) : setConfirmHide(service)
                          }
                        />
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-4 pl-8 text-right">
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Subir ${service.name}`}
                        disabled={index === 0 || reorder.isPending}
                        onClick={() => void move(service, -1)}
                      >
                        <ArrowUpIcon />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Bajar ${service.name}`}
                        disabled={index === items.length - 1 || reorder.isPending}
                        onClick={() => void move(service, 1)}
                      >
                        <ArrowDownIcon />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Editar ${service.name}`}
                        onClick={() => open({ mode: 'edit', id: service.id })}
                      >
                        <PencilIcon />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {panel && (panel.mode === 'new' || editing) && (
          <ServicePanel
            key={panel.mode === 'edit' ? panel.id : 'new'}
            service={editing}
            resources={resources}
            onDirtyChange={setDirty}
            onClose={() => guard(close)}
            onDone={close}
          />
        )}
      </section>

      <Dialog
        open={confirmHide !== null}
        onClose={() => setConfirmHide(null)}
        title="¿Ocultar este servicio?"
      >
        <p className="m-0 text-body text-text-muted">
          «{confirmHide?.name}» dejará de aparecer al agendar. Las citas que ya existen no cambian y
          puedes volver a mostrarlo cuando quieras.
        </p>
        <div className="flex flex-col gap-10">
          <Button data-autofocus block onClick={() => setConfirmHide(null)}>
            Mantenerlo visible
          </Button>
          <Button
            block
            variant="danger-outline"
            loading={update.isPending}
            onClick={() => confirmHide && void setActive(confirmHide, false)}
          >
            Ocultar servicio
          </Button>
        </div>
      </Dialog>
      {unsavedDialog}
    </main>
  )
}

type PanelProps = {
  service: AdminService | undefined
  resources: AdminResource[]
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  onDone: () => void
}

function ServicePanel({ service, resources, onDirtyChange, onClose, onDone }: PanelProps) {
  const create = useCreateService()
  const update = useUpdateService()
  const remove = useDeleteService()
  const initial = service ? draftFromService(service) : EMPTY_DRAFT
  const [draft, setDraft] = useState<ServiceDraft>(initial)
  const [errors, setErrors] = useState<ServiceErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [historyMessage, setHistoryMessage] = useState<string | null>(null)
  const resource = resources[0] ?? null

  function change(patch: Partial<ServiceDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    setSaved(false)
    onDirtyChange(isDirty(next, initial))
  }

  async function save() {
    const found = validateDraft(draft)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return
    const body = toBody(draft, resource?.id ?? null)
    try {
      if (service) {
        await update.mutateAsync({ id: service.id, body })
        setSaved(true)
        onDirtyChange(false)
      } else {
        await create.mutateAsync(body)
        onDone()
      }
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  async function doDelete() {
    if (!service) return
    setConfirmDelete(false)
    try {
      await remove.mutateAsync(service.id)
      onDone()
    } catch (error) {
      if (error instanceof ApiError && error.code === 'has_history') {
        setHistoryMessage(error.message)
      } else {
        setServerError(errorMessage(error))
      }
    }
  }

  async function deactivateInstead() {
    if (!service) return
    try {
      await update.mutateAsync({ id: service.id, body: { active: false } })
      setHistoryMessage(null)
      onDone()
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  const saving = create.isPending || update.isPending
  const title = service ? 'Editar servicio' : 'Agregar servicio'

  return (
    <aside
      aria-label={title}
      className="flex min-w-0 max-w-[380px] flex-[1_1_320px] flex-col gap-14 rounded-summary border border-gold-edge bg-surface p-20"
    >
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-display text-h2 text-text">{title}</h2>
        {service && <span className="text-caption text-text-muted">{service.name}</span>}
      </div>
      <form
        className="flex flex-col gap-14"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <TextField
          label="Nombre"
          value={draft.name}
          maxLength={60}
          error={errors.name}
          onChange={(event) => change({ name: event.target.value })}
        />
        <div className="grid grid-cols-2 gap-10">
          <TextField
            label="Duración (min)"
            inputMode="numeric"
            value={draft.duration}
            error={errors.duration}
            onChange={(event) => change({ duration: event.target.value })}
          />
          <TextField
            label="Precio"
            inputMode="numeric"
            value={draft.price}
            error={errors.price}
            onChange={(event) => change({ price: event.target.value })}
            onBlur={() => {
              const digits = draft.price.replace(/\D/g, '')
              if (digits !== '' && Number(digits) <= 1_000_000) {
                setDraft((d) => ({ ...d, price: formatCOP(Number(digits)) }))
              }
            }}
          />
        </div>
        <TextField
          label="Descripción para el cliente"
          hint="Opcional, máximo 200 caracteres."
          value={draft.description}
          error={errors.description}
          onChange={(event) => change({ description: event.target.value })}
        />
        {resource && (
          <Checkbox
            checked={draft.usesResource}
            onChange={(event) => change({ usesResource: event.target.checked })}
          >
            <span>
              Usa la máquina vaporizadora
              <span className="block text-caption text-text-muted">
                Solo un cliente a la vez, aunque haya más barberos libres.
              </span>
            </span>
          </Checkbox>
        )}
        <div className="flex items-center justify-between gap-10">
          <span className="text-small text-text">
            Visible para los clientes
            <span className="block text-caption text-text-muted">
              {draft.active ? 'Aparece al agendar.' : 'Oculto: no aparece al agendar.'}
            </span>
          </span>
          <Switch
            label="Visible para los clientes"
            checked={draft.active}
            onCheckedChange={(active) => change({ active })}
          />
        </div>
        {service && (
          <p className="m-0 text-caption text-text-muted">
            Cambiar el precio o la duración solo afecta las citas nuevas; las citas que ya existen
            conservan los suyos.
          </p>
        )}
        {serverError && <Notice tone="danger">{serverError}</Notice>}
        {saved && <Notice tone="success">Cambios guardados.</Notice>}
        {historyMessage && (
          <div className="flex flex-col items-start gap-10">
            <Notice tone="danger">{historyMessage}</Notice>
            <Button
              size="md"
              variant="secondary"
              loading={update.isPending}
              onClick={() => void deactivateInstead()}
            >
              Desactivar
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-10 pt-4">
          <Button type="submit" block loading={saving}>
            {service ? 'Guardar cambios' : 'Crear servicio'}
          </Button>
          <Button type="button" block variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {service && (
            <Button
              type="button"
              size="md"
              variant="danger-outline"
              block
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar servicio
            </Button>
          )}
        </div>
      </form>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Eliminar este servicio?"
      >
        <p className="m-0 text-body text-text-muted">
          «{service?.name}» se borrará para siempre. Si ya tiene citas, no se podrá eliminar y te
          sugeriremos desactivarlo.
        </p>
        <div className="flex flex-col gap-10">
          <Button data-autofocus block onClick={() => setConfirmDelete(false)}>
            Conservar servicio
          </Button>
          <Button block variant="danger" loading={remove.isPending} onClick={() => void doDelete()}>
            Sí, eliminar
          </Button>
        </div>
      </Dialog>
    </aside>
  )
}

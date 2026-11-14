import { useState } from 'react'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Notice } from '../../components/Notice'
import { Skeleton } from '../../components/Skeleton'
import { Switch } from '../../components/Switch'
import { TextField } from '../../components/TextField'
import { cx, FOCUS_RING, TAPPABLE, TRANSITION } from '../../components/classes'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CrossCircleIcon,
  PencilIcon,
  PlusIcon,
} from '../../components/icons'
import {
  useAdminProducts,
  useCreateProduct,
  useDeleteProduct,
  useReorderProducts,
  useUpdateProduct,
} from '../../lib/api/admin'
import { ApiError } from '../../lib/api/client'
import { isTransientError } from '../../lib/api/hooks'
import type { AdminProduct } from '../../lib/api/types'
import { formatCOP } from '../../lib/format'
import { NETWORK_MESSAGE, RetryNotice } from '../shared/RetryNotice'
import { CatalogHeader } from './CatalogHeader'
import {
  draftFromProduct,
  EMPTY_PRODUCT,
  isProductDirty,
  productBody,
  validateProduct,
} from './productForm'
import type { ProductDraft, ProductErrors } from './productForm'
import { moveId } from './serviceForm'
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

export default function ProductsPage() {
  useDocumentTitle('Administrar productos')
  const list = useAdminProducts()
  const reorder = useReorderProducts()
  const update = useUpdateProduct()
  const [panel, setPanel] = useState<Panel>(null)
  const [dirty, setDirty] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)
  const [confirmHide, setConfirmHide] = useState<AdminProduct | null>(null)
  const { guard, dialog: unsavedDialog } = useUnsavedGuard(dirty)

  const items = list.data?.items ?? []
  const editing = panel?.mode === 'edit' ? items.find((p) => p.id === panel.id) : undefined

  function open(next: Panel) {
    guard(() => {
      setDirty(false)
      setPanel(next)
    })
  }

  function close() {
    setDirty(false)
    setPanel(null)
    document.getElementById('agregar-producto')?.focus()
  }

  async function move(product: AdminProduct, delta: -1 | 1) {
    const ids = items.map((p) => p.id)
    const next = moveId(ids, product.id, delta)
    if (next === ids) return
    setRowError(null)
    try {
      await reorder.mutateAsync(next)
      setAnnounce(`${product.name} ahora está en la posición ${next.indexOf(product.id) + 1}.`)
    } catch (error) {
      setRowError(errorMessage(error))
    }
  }

  async function setActive(product: AdminProduct, active: boolean) {
    setRowError(null)
    setConfirmHide(null)
    try {
      await update.mutateAsync({ id: product.id, body: { active } })
      setAnnounce(`${product.name} ${active ? 'ahora es visible' : 'quedó oculto'}.`)
    } catch (error) {
      setRowError(errorMessage(error))
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
          <Button id="agregar-producto" icon={<PlusIcon />} onClick={() => open({ mode: 'new' })}>
            Agregar producto
          </Button>
        }
      />
      <p role="status" className="sr-only">
        {announce}
      </p>
      {rowError && <Notice tone="danger">{rowError}</Notice>}

      <section className="flex flex-wrap items-start gap-14" aria-label="Productos">
        <div className="min-w-0 flex-[2_1_600px] overflow-x-auto rounded-summary border border-line bg-surface px-14 pb-14 pt-4">
          {list.isPending ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-10 py-14">
              <span className="sr-only">Cargando productos…</span>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-[44px] w-full" />
              ))}
            </div>
          ) : list.isError ? (
            <div className="py-14">
              <RetryNotice onRetry={() => void list.refetch()} loading={list.isFetching}>
                No pudimos cargar los productos. {NETWORK_MESSAGE}
              </RetryNotice>
            </div>
          ) : items.length === 0 ? (
            <p className="m-0 py-20 text-body text-text-muted">
              Aún no tienes productos. Agrega el primero con «Agregar producto».
            </p>
          ) : (
            <table className="w-full min-w-[560px] border-collapse text-small">
              <caption className="sr-only">
                Productos del catálogo, en el orden en que se muestran
              </caption>
              <thead>
                <tr className="text-left text-text-muted">
                  <th scope="col" className="py-14 pr-8 font-medium">
                    Producto
                  </th>
                  <th scope="col" className="px-8 py-14 text-right font-medium">
                    Precio
                  </th>
                  <th scope="col" className="px-8 py-14 font-medium">
                    Disponibilidad
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
                {items.map((product, index) => (
                  <tr
                    key={product.id}
                    className={cx(
                      'border-t border-line',
                      editing?.id === product.id && 'bg-surface-selected',
                    )}
                  >
                    <th scope="row" className="py-10 pr-8 text-left font-semibold text-text">
                      {product.name}
                      {!product.active && (
                        <span className="block text-caption font-normal text-text-muted">
                          Oculto para los clientes
                        </span>
                      )}
                    </th>
                    <td className="px-8 py-10 text-right font-semibold text-gold">
                      {formatCOP(product.price_cop)}
                    </td>
                    <td className="px-8 py-10">
                      {product.availability === 'in_stock' ? (
                        <span className="inline-flex items-center gap-4 text-success">
                          <CheckCircleIcon size={16} /> Disponible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-4 text-danger">
                          <CrossCircleIcon size={16} /> Agotado
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-4 text-center">
                      <Switch
                        label={`Visible para los clientes: ${product.name}`}
                        checked={product.active}
                        disabled={update.isPending}
                        onCheckedChange={(next) =>
                          next ? void setActive(product, true) : setConfirmHide(product)
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap py-4 pl-8 text-right">
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Subir ${product.name}`}
                        disabled={index === 0 || reorder.isPending}
                        onClick={() => void move(product, -1)}
                      >
                        <ArrowUpIcon />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Bajar ${product.name}`}
                        disabled={index === items.length - 1 || reorder.isPending}
                        onClick={() => void move(product, 1)}
                      >
                        <ArrowDownIcon />
                      </button>
                      <button
                        type="button"
                        className={ICON_BUTTON}
                        aria-label={`Editar ${product.name}`}
                        onClick={() => open({ mode: 'edit', id: product.id })}
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
          <ProductPanel
            key={panel.mode === 'edit' ? panel.id : 'new'}
            product={editing}
            onDirtyChange={setDirty}
            onClose={() => guard(close)}
            onDone={close}
          />
        )}
      </section>

      <Dialog
        open={confirmHide !== null}
        onClose={() => setConfirmHide(null)}
        title="¿Ocultar este producto?"
      >
        <p className="m-0 text-body text-text-muted">
          «{confirmHide?.name}» dejará de aparecer en el catálogo. Puedes volver a mostrarlo cuando
          quieras.
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
            Ocultar producto
          </Button>
        </div>
      </Dialog>
      {unsavedDialog}
    </main>
  )
}

type PanelProps = {
  product: AdminProduct | undefined
  onDirtyChange: (dirty: boolean) => void
  onClose: () => void
  onDone: () => void
}

function ProductPanel({ product, onDirtyChange, onClose, onDone }: PanelProps) {
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const remove = useDeleteProduct()
  const initial = product ? draftFromProduct(product) : EMPTY_PRODUCT
  const [draft, setDraft] = useState<ProductDraft>(initial)
  const [errors, setErrors] = useState<ProductErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function change(patch: Partial<ProductDraft>) {
    const next = { ...draft, ...patch }
    setDraft(next)
    setSaved(false)
    onDirtyChange(isProductDirty(next, initial))
  }

  async function save() {
    const found = validateProduct(draft)
    setErrors(found)
    setServerError(null)
    if (Object.keys(found).length > 0) return
    const body = productBody(draft)
    try {
      if (product) {
        await update.mutateAsync({ id: product.id, body })
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
    if (!product) return
    setConfirmDelete(false)
    try {
      await remove.mutateAsync(product.id)
      onDone()
    } catch (error) {
      setServerError(errorMessage(error))
    }
  }

  const title = product ? 'Editar producto' : 'Agregar producto'

  return (
    <aside
      aria-label={title}
      className="flex min-w-0 max-w-[380px] flex-[1_1_320px] flex-col gap-14 rounded-summary border border-gold-edge bg-surface p-20"
    >
      <div className="flex flex-col gap-4">
        <h2 className="m-0 font-display text-h2 text-text">{title}</h2>
        {product && <span className="text-caption text-text-muted">{product.name}</span>}
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
        <TextField
          label="Descripción"
          hint="Opcional, máximo 200 caracteres."
          value={draft.description}
          error={errors.description}
          onChange={(event) => change({ description: event.target.value })}
        />
        <TextField
          label="Enlace de la foto"
          hint="Opcional. Solo enlaces https://; por ahora no se suben archivos."
          type="url"
          value={draft.imageUrl}
          error={errors.imageUrl}
          onChange={(event) => change({ imageUrl: event.target.value })}
        />
        <div className="flex items-center justify-between gap-10">
          <span className="text-small text-text">
            Hay en inventario
            <span className="block text-caption text-text-muted">
              {draft.availability === 'in_stock' ? 'Disponible.' : 'Se muestra como «Agotado».'}
            </span>
          </span>
          <Switch
            label="Hay en inventario"
            checked={draft.availability === 'in_stock'}
            onCheckedChange={(on) => change({ availability: on ? 'in_stock' : 'out_of_stock' })}
          />
        </div>
        <div className="flex items-center justify-between gap-10">
          <span className="text-small text-text">
            Visible para los clientes
            <span className="block text-caption text-text-muted">
              {draft.active ? 'Aparece en el catálogo.' : 'Oculto: no aparece en el catálogo.'}
            </span>
          </span>
          <Switch
            label="Visible para los clientes"
            checked={draft.active}
            onCheckedChange={(active) => change({ active })}
          />
        </div>
        {serverError && <Notice tone="danger">{serverError}</Notice>}
        {saved && <Notice tone="success">Cambios guardados.</Notice>}
        <div className="flex flex-col gap-10 pt-4">
          <Button type="submit" block loading={create.isPending || update.isPending}>
            {product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
          <Button type="button" block variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {product && (
            <Button
              type="button"
              size="md"
              variant="danger-outline"
              block
              onClick={() => setConfirmDelete(true)}
            >
              Eliminar producto
            </Button>
          )}
        </div>
      </form>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Eliminar este producto?"
      >
        <p className="m-0 text-body text-text-muted">
          «{product?.name}» se borrará del catálogo para siempre. Si solo quieres quitarlo por un
          tiempo, ocúltalo.
        </p>
        <div className="flex flex-col gap-10">
          <Button data-autofocus block onClick={() => setConfirmDelete(false)}>
            Conservar producto
          </Button>
          <Button block variant="danger" loading={remove.isPending} onClick={() => void doDelete()}>
            Sí, eliminar
          </Button>
        </div>
      </Dialog>
    </aside>
  )
}

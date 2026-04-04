import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useEffect, useMemo, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { orderStatusDeleteUserMessage } from '../lib/api/errors'
import {
  createOrderStatus,
  deleteOrderStatus,
  downloadOrderStatusesExport,
  fetchOrderStatusAuditLog,
  fetchOrderStatuses,
  reorderOrderStatuses,
  toggleOrderStatusVisibility,
  updateOrderStatus,
  type OrderStatusAuditItem,
  type OrderStatusRecord,
  type OrderStatusWriteInput,
} from '../lib/api/order-statuses'

const COLOR_PRESETS = [
  'Yellow',
  'Blue',
  'Indigo',
  'Green',
  'Red',
  'Gray',
  'Amber',
  'Violet',
  'Emerald',
  'Rose',
] as const

function indicatorDotClass(color: string): string {
  const c = color.trim().toLowerCase()
  const map: Record<string, string> = {
    yellow: 'bg-amber-400',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    green: 'bg-emerald-500',
    emerald: 'bg-emerald-600',
    red: 'bg-red-500',
    rose: 'bg-rose-500',
    gray: 'bg-slate-400',
    grey: 'bg-slate-400',
  }
  if (c.startsWith('#') && /^#[0-9a-f]{3,8}$/i.test(c)) {
    return '' // use inline style
  }
  return map[c] ?? 'bg-slate-400'
}

function indicatorDotStyle(color: string): CSSProperties | undefined {
  const c = color.trim()
  if (c.startsWith('#') && /^#[0-9a-f]{3,8}$/i.test(c)) {
    return { backgroundColor: c }
  }
  return undefined
}

function StatusGlyph({ name }: { name: string }) {
  const n = name.trim().toLowerCase()
  const common = 'h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400'
  if (n.includes('pending')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (n.includes('confirm')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (n.includes('pack')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  }
  if (n.includes('ship')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125v-9.75m0 0c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v3.75m0 0h3.375m0 0h3.375m-3.375 0v-3.75m0 3.75h-3.375m0 0H9.75m-3 0v3.75m0-3.75H3.375m6.375 0v3.75m0-3.75h3.375m0 0h3.375"
        />
      </svg>
    )
  }
  if (n.includes('deliver')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    )
  }
  if (n.includes('cancel')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  }
  if (n.includes('return')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
        />
      </svg>
    )
  }
  if (n.includes('refund')) {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m0 0h-9.75m9.75 0c0 .621-.504 1.125-1.125 1.125h-9.75c-.621 0-1.125-.504-1.125-1.125m9.75 0v-9.75c0-.621-.504-1.125-1.125-1.125h-9.75c-.621 0-1.125.504-1.125 1.125v9.75"
        />
      </svg>
    )
  }
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  )
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function SortableTableRow({
  row,
  children,
}: {
  row: OrderStatusRecord
  children: (dragHandleProps: ButtonHTMLAttributes<HTMLButtonElement>) => ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(row.id),
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  }

  return (
    <tr ref={setNodeRef} style={style} className="text-slate-800 dark:text-slate-200">
      {children({
        ...attributes,
        ...listeners,
        type: 'button' as const,
        className:
          'cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing dark:hover:bg-slate-800 dark:hover:text-slate-300',
        'aria-label': 'Drag to reorder',
      })}
    </tr>
  )
}

type EditorMode = { type: 'create' } | { type: 'edit'; row: OrderStatusRecord }

function emptyForm(): OrderStatusWriteInput {
  return {
    name: '',
    indicator_color: 'Blue',
    description: '',
    is_visible: true,
  }
}

function rowToForm(row: OrderStatusRecord): OrderStatusWriteInput {
  return {
    name: row.name,
    indicator_color: row.indicator_color,
    description: row.description ?? '',
    is_visible: row.is_visible,
  }
}

function StatusEditorModal(props: {
  open: boolean
  mode: EditorMode | null
  form: OrderStatusWriteInput
  onChange: (f: OrderStatusWriteInput) => void
  onClose: () => void
  onSave: () => void
  saving: boolean
}) {
  const { open, mode, form, onChange, onClose, onSave, saving } = props
  if (!open || !mode) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          {mode.type === 'create' ? 'New status' : 'Edit status'}
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="e.g. Pending"
            />
          </label>
          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Indicator color</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {COLOR_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onChange({ ...form, indicator_color: p })}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                    form.indicator_color === p
                      ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={form.indicator_color}
              onChange={(e) => onChange({ ...form, indicator_color: e.target.value })}
              placeholder="Or hex e.g. #3B82F6"
            />
          </div>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Description</span>
            <textarea
              className="mt-1 min-h-[88px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={form.description ?? ''}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              placeholder="What this status means for your team"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={form.is_visible ?? true}
              onChange={(e) => onChange({ ...form, is_visible: e.target.checked })}
            />
            Visible to customers
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AuditModal(props: {
  open: boolean
  onClose: () => void
  token: string | null
  showApiError: (e: unknown) => void
}) {
  const { open, onClose, token, showApiError } = props
  const [page, setPage] = useState(1)
  const perPage = 15
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<OrderStatusAuditItem[]>([])
  const [totalPages, setTotalPages] = useState(0)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const res = await fetchOrderStatusAuditLog(token, page, perPage)
      setRows(res.data)
      setTotalPages(res.pagination.total_pages)
    } catch (e) {
      showApiError(e)
      setRows([])
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [open, token, page, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (open) setPage(1)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Audit log</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-2 py-2">When</th>
                <th className="px-2 py-2">Action</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">By</th>
                <th className="px-2 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-slate-500">
                    No audit entries.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="text-slate-800 dark:text-slate-200">
                    <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-600 dark:text-slate-400">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
                        {r.action}
                      </span>
                    </td>
                    <td className="px-2 py-2">{r.status_name ?? '—'}</td>
                    <td className="px-2 py-2 text-slate-600 dark:text-slate-400">{r.changed_by}</td>
                    <td className="max-w-[200px] truncate px-2 py-2 font-mono text-xs text-slate-500" title={JSON.stringify(r.diff)}>
                      {Object.keys(r.diff ?? {}).length ? JSON.stringify(r.diff) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <span className="text-xs text-slate-500">
            Page {page}
            {totalPages > 0 ? ` of ${totalPages}` : ''}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-600"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || (totalPages > 0 && page >= totalPages)}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteStatusModal(props: {
  row: OrderStatusRecord
  candidates: OrderStatusRecord[]
  reassignTargetId: string
  onReassignTargetId: (v: string) => void
  onClose: () => void
  onConfirmMoveAndDelete: () => void
  busy: boolean
}) {
  const {
    row,
    candidates,
    reassignTargetId,
    onReassignTargetId,
    onClose,
    onConfirmMoveAndDelete,
    busy,
  } = props
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Delete status</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-800 dark:text-slate-200">{row.name}</span> has{' '}
          <span className="tabular-nums">{formatInt(row.orders_count)}</span> order
          {row.orders_count === 1 ? '' : 's'}. Choose another status to move them to, then the configuration
          row will be removed.
        </p>
        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
            Add at least one other status before deleting this one.
          </p>
        ) : (
          <label className="mt-4 block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Move orders to</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
              value={reassignTargetId}
              onChange={(e) => onReassignTargetId(e.target.value)}
            >
              {candidates.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} ({formatInt(c.orders_count)} orders)
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || candidates.length === 0 || !reassignTargetId}
            onClick={onConfirmMoveAndDelete}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Move orders and delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function OrderLifecyclePage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [items, setItems] = useState<OrderStatusRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [reordering, setReordering] = useState(false)

  const [deleteModalRow, setDeleteModalRow] = useState<OrderStatusRecord | null>(null)
  const [reassignTargetId, setReassignTargetId] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null)
  const [form, setForm] = useState<OrderStatusWriteInput>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [auditOpen, setAuditOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchOrderStatuses(token)
      const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      setItems(sorted)
    } catch (e) {
      showApiError(e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const sortableIds = useMemo(() => items.map((i) => String(i.id)), [items])

  async function persistOrder(next: OrderStatusRecord[]) {
    const order = next.map((s, idx) => ({ id: s.id, sort_order: (idx + 1) * 10 }))
    setReordering(true)
    try {
      await reorderOrderStatuses(token, order)
      showToast('Order updated.', 'success')
      await loadList()
    } catch (e) {
      showApiError(e)
      await loadList()
    } finally {
      setReordering(false)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => String(i.id) === active.id)
    const newIndex = items.findIndex((i) => String(i.id) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    void persistOrder(next)
  }

  function openCreate() {
    setEditorMode({ type: 'create' })
    setForm(emptyForm())
    setEditorOpen(true)
  }

  function openEdit(row: OrderStatusRecord) {
    setEditorMode({ type: 'edit', row })
    setForm(rowToForm(row))
    setEditorOpen(true)
  }

  async function handleSaveEditor() {
    if (!editorMode) return
    const desc = (form.description ?? '').trim()
    const payload: OrderStatusWriteInput = {
      name: form.name.trim(),
      indicator_color: form.indicator_color.trim(),
      description: desc === '' ? null : desc,
      is_visible: form.is_visible,
    }
    if (!payload.name || !payload.indicator_color) {
      showToast('Name and indicator color are required.', 'error')
      return
    }
    setSaving(true)
    try {
      if (editorMode.type === 'create') {
        await createOrderStatus(token, payload)
        showToast('Status created.', 'success')
      } else {
        await updateOrderStatus(token, editorMode.row.id, payload)
        showToast('Status updated.', 'success')
      }
      setEditorOpen(false)
      setEditorMode(null)
      await loadList()
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  const deleteCandidates = useMemo(() => {
    if (!deleteModalRow) return []
    return items.filter((i) => i.id !== deleteModalRow.id)
  }, [items, deleteModalRow])

  async function executeDelete(row: OrderStatusRecord, reassignToId?: number) {
    setDeleteBusy(true)
    try {
      await deleteOrderStatus(
        token,
        row.id,
        reassignToId != null ? { reassignOrdersToStatusId: reassignToId } : undefined,
      )
      showToast('Status deleted.', 'success')
      setDeleteModalRow(null)
      await loadList()
    } catch (e) {
      showToast(orderStatusDeleteUserMessage(e), 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  function initiateDelete(row: OrderStatusRecord) {
    if (row.is_system) {
      showToast('System statuses cannot be deleted.', 'error')
      return
    }
    if (row.orders_count > 0) {
      const others = items.filter((i) => i.id !== row.id)
      if (others.length === 0) {
        showToast('Add another status before deleting this one.', 'error')
        return
      }
      setReassignTargetId(String(others[0].id))
      setDeleteModalRow(row)
      return
    }
    if (!window.confirm(`Delete status “${row.name}”? This cannot be undone.`)) return
    void executeDelete(row)
  }

  async function handleToggleVisibility(row: OrderStatusRecord) {
    try {
      await toggleOrderStatusVisibility(token, row.id)
      showToast('Visibility updated.', 'success')
      await loadList()
    } catch (e) {
      showApiError(e)
    }
  }

  async function handleExport() {
    try {
      await downloadOrderStatusesExport(token)
      showToast('Export started.', 'success')
    } catch (e) {
      showApiError(e)
    }
  }

  const total = items.length

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Status Lifecycle</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure your order workflow by defining custom statuses. Drag to reorder the sequence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setAuditOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Audit logs
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add status
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="w-10 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Indicator</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Visible</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        No statuses yet. Add one to get started.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <SortableTableRow key={row.id} row={row}>
                        {(handleProps) => (
                          <>
                            <td className="px-2 py-3 align-middle">
                              <button {...handleProps}>
                                <svg
                                  className="h-5 w-5"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  aria-hidden
                                >
                                  <circle cx="9" cy="6" r="1.5" />
                                  <circle cx="15" cy="6" r="1.5" />
                                  <circle cx="9" cy="12" r="1.5" />
                                  <circle cx="15" cy="12" r="1.5" />
                                  <circle cx="9" cy="18" r="1.5" />
                                  <circle cx="15" cy="18" r="1.5" />
                                </svg>
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <StatusGlyph name={row.name} />
                                <span className="font-medium text-slate-900 dark:text-slate-50">{row.name}</span>
                                {row.is_system ? (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                    system
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${indicatorDotClass(row.indicator_color)}`}
                                  style={indicatorDotStyle(row.indicator_color)}
                                />
                                <span className="text-slate-600 dark:text-slate-300">{row.indicator_color}</span>
                              </div>
                            </td>
                            <td className="max-w-xs px-4 py-3 text-slate-600 dark:text-slate-400">
                              {row.description?.trim() ? row.description : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  row.is_visible
                                    ? 'border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'border border-slate-500/35 bg-slate-500/15 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {row.is_visible ? 'VISIBLE' : 'HIDDEN'}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800 dark:text-slate-200">
                              {formatInt(row.orders_count)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                                  title="Edit"
                                  aria-label="Edit"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => initiateDelete(row)}
                                  disabled={row.is_system}
                                  className="rounded-lg p-2 text-red-600/80 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                                  title={row.is_system ? 'System status cannot be deleted' : 'Delete'}
                                  aria-label="Delete"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                    />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleVisibility(row)}
                                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                                  title="Toggle customer visibility"
                                  aria-label="Toggle customer visibility"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </SortableTableRow>
                    ))
                  )}
                </tbody>
              </SortableContext>
            </table>
          </DndContext>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {total} of {total} total statuses
            {reordering ? <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">Saving order…</span> : null}
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Automated triggers</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Map statuses to webhooks or email templates to automate your notifications automatically.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </span>
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Customer view</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Only statuses marked as visible will be shown in the customer&apos;s order history page.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </span>
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Reordering</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            The order defined here determines the sequence in the order management dropdowns.
          </p>
        </div>
      </div>

      {deleteModalRow ? (
        <DeleteStatusModal
          row={deleteModalRow}
          candidates={deleteCandidates}
          reassignTargetId={reassignTargetId}
          onReassignTargetId={setReassignTargetId}
          onClose={() => !deleteBusy && setDeleteModalRow(null)}
          onConfirmMoveAndDelete={() => {
            const n = Number.parseInt(reassignTargetId, 10)
            if (!Number.isFinite(n) || n <= 0) {
              showToast('Pick a valid target status.', 'error')
              return
            }
            void executeDelete(deleteModalRow, n)
          }}
          busy={deleteBusy}
        />
      ) : null}

      <StatusEditorModal
        open={editorOpen}
        mode={editorMode}
        form={form}
        onChange={setForm}
        onClose={() => {
          setEditorOpen(false)
          setEditorMode(null)
        }}
        onSave={() => void handleSaveEditor()}
        saving={saving}
      />

      <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} token={token} showApiError={showApiError} />
    </div>
  )
}

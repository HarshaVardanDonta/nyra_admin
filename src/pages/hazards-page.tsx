import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { ApiError } from '../lib/api/errors'
import {
  createHazard,
  deleteHazard,
  fetchHazards,
  patchHazard,
  type Hazard,
  type HazardWrite,
} from '../lib/api/hazards'

type HazardForm = {
  key: string
  label: string
  color: string
  isActive: boolean
}

function sortHazards(list: Hazard[]) {
  return [...list].sort((a, b) => {
    const aA = a.isActive ? 0 : 1
    const bA = b.isActive ? 0 : 1
    if (aA !== bA) return aA - bA
    return a.key.localeCompare(b.key)
  })
}

function normalizeHazardKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '-')
}

export function HazardsPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [hazards, setHazards] = useState<Hazard[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<HazardForm>({
    key: '',
    label: '',
    color: '#f59e0b',
    isActive: true,
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const { hazards: list } = await fetchHazards(token, { limit: 500, offset: 0 })
      setHazards(sortHazards(list))
    } catch (e) {
      showApiError(e)
      setHazards([])
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  const activeCount = useMemo(() => hazards.filter((h) => h.isActive).length, [hazards])

  function openCreate() {
    setEditingId(null)
    setForm({ key: '', label: '', color: '#f59e0b', isActive: true })
    setModalOpen(true)
  }

  function openEdit(h: Hazard) {
    setEditingId(h.id)
    setForm({ key: h.key, label: h.label, color: h.color, isActive: h.isActive })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in to save.', 'error')
      return
    }
    const key = normalizeHazardKey(form.key)
    const label = form.label.trim()
    const color = form.color.trim()
    if (!key || !label || !color) {
      showToast('Key, label, and color are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: HazardWrite = { key, label, color, isActive: form.isActive }
      if (editingId) {
        const updated = await patchHazard(token, editingId, payload)
        setHazards((prev) => sortHazards(prev.map((x) => (x.id === updated.id ? updated : x))))
      } else {
        const created = await createHazard(token, payload)
        setHazards((prev) => sortHazards([created, ...prev]))
      }
      setModalOpen(false)
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!token) return
    const ok = window.confirm('Delete this hazard? Products referencing this hazard key will still keep the key in their descriptions.')
    if (!ok) return
    setBusyId(id)
    try {
      await deleteHazard(token, id)
      setHazards((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setHazards((prev) => prev.filter((x) => x.id !== id))
        showToast('Hazard was already deleted.', 'info')
      } else {
        showApiError(e)
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">Hazards</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Master list of hazard labels + colors. Products reference hazards by key in the rich description JSON.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Active: <span className="font-medium text-slate-700 dark:text-slate-200">{activeCount}</span> · Total:{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{hazards.length}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Add hazard
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
        ) : hazards.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No hazards yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Key</th>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hazards.map((h) => (
                  <tr key={h.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      {h.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-600/10 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{h.label}</div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{h.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-200">{h.key}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-5 w-5 rounded border border-slate-200 dark:border-slate-700"
                          style={{ backgroundColor: h.color }}
                          aria-hidden
                        />
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{h.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(h)}
                        className="mr-3 text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === h.id}
                        onClick={() => void handleDelete(h.id)}
                        className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        {busyId === h.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="hazard-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
            <h2 id="hazard-modal-title" className="text-lg font-semibold">
              {editingId ? 'Edit hazard' : 'Add hazard'}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={handleSave}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Active</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                  className={[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition',
                    form.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700',
                  ].join(' ')}
                  aria-pressed={form.isActive}
                >
                  <span
                    className={[
                      'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                      form.isActive ? 'translate-x-5' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Label</label>
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                  placeholder="e.g. Danger"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Key</label>
                <input
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                  placeholder="e.g. danger"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Used in product descriptions as a stable reference. Lowercase letters, numbers, dashes/underscores.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Color (hex)</label>
                  <input
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
                    placeholder="#DC2626"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-transparent p-1 dark:border-slate-700"
                    aria-label="Pick color"
                  />
                  <span
                    className="inline-block h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700"
                    style={{ backgroundColor: form.color }}
                    aria-hidden
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}


import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  createExclusiveOfferFilterCategory,
  deleteExclusiveOfferFilterCategory,
  fetchExclusiveOfferFilterCategories,
  updateExclusiveOfferFilterCategory,
  type ExclusiveOfferFilterCategory,
} from '../lib/api/exclusive-offers'

export function ExclusiveOfferFilterCategoriesPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [items, setItems] = useState<ExclusiveOfferFilterCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [newKey, setNewKey] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newSort, setNewSort] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!token) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const rows = await fetchExclusiveOfferFilterCategories(token)
      setItems(rows)
    } catch (e) {
      showApiError(e)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in to create categories.', 'error')
      return
    }
    const fk = newKey.trim().toLowerCase()
    const lb = newLabel.trim()
    if (!fk || !lb) {
      showToast('Filter key and label are required.', 'error')
      return
    }
    let sortOrder: number | undefined
    if (newSort.trim() !== '') {
      const n = Number.parseInt(newSort, 10)
      if (!Number.isFinite(n)) {
        showToast('Sort order must be a number.', 'error')
        return
      }
      sortOrder = n
    }
    setCreating(true)
    try {
      await createExclusiveOfferFilterCategory(token, {
        filterKey: fk,
        label: lb,
        sortOrder,
      })
      showToast('Filter category created.', 'success')
      setNewKey('')
      setNewLabel('')
      setNewSort('')
      await load()
    } catch (err) {
      showApiError(err)
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveRow(row: ExclusiveOfferFilterCategory) {
    if (!token) return
    try {
      await updateExclusiveOfferFilterCategory(token, row.id, {
        label: row.label.trim(),
        sortOrder: row.sortOrder,
      })
      showToast('Saved.', 'success')
      await load()
    } catch (e) {
      showApiError(e)
    }
  }

  async function handleDeleteRow(id: string, filterKey: string) {
    if (!token) return
    if (
      !window.confirm(
        `Delete filter category “${filterKey}”? Offers using this key must be reassigned first.`,
      )
    ) {
      return
    }
    try {
      await deleteExclusiveOfferFilterCategory(token, id)
      showToast('Filter category deleted.', 'success')
      await load()
    } catch (e) {
      showApiError(e)
    }
  }

  function patchLocal(id: string, patch: Partial<Pick<ExclusiveOfferFilterCategory, 'label' | 'sortOrder'>>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exclusive offer filter categories</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Keys power the homepage pill filters (with “All offers”). Create keys here, then assign them when editing
            offers.
          </p>
          <Link
            to="/exclusive-offers"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to exclusive offers
          </Link>
        </div>
      </div>

      <section className="mb-10 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Add category</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Use a stable slug (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">snake_case</code>, lowercase,
          starts with a letter).
        </p>
        <form onSubmit={(e) => void handleCreate(e)} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Filter key</label>
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="e.g. clearance_sale"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Display label</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Clearance"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Sort order</label>
            <input
              value={newSort}
              onChange={(e) => setNewSort(e.target.value)}
              placeholder="optional"
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No filter categories yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Label
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Key
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sort
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                    <td className="px-4 py-3">
                      <input
                        value={row.label}
                        onChange={(e) => patchLocal(row.id, { label: e.target.value })}
                        className="w-full min-w-[8rem] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-700 dark:text-slate-300">{row.filterKey}</td>
                    <td className="max-w-[6rem] px-4 py-3">
                      <input
                        type="number"
                        value={row.sortOrder}
                        onChange={(e) =>
                          patchLocal(row.id, { sortOrder: Number.parseInt(e.target.value, 10) || 0 })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <button
                        type="button"
                        onClick={() => void handleSaveRow(row)}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Save
                      </button>
                      <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => void handleDeleteRow(row.id, row.filterKey)}
                        className="font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { ApiError } from '../lib/api/errors'
import { createFAQ, deleteFAQ, fetchFAQs, patchFAQ, type FAQ, type FAQWrite } from '../lib/api/faqs'

type FAQForm = {
  question: string
  answer: string
  isPublished: boolean
}

function sortFAQs(list: FAQ[]) {
  return [...list].sort((a, b) => {
    const aP = a.isPublished ? 0 : 1
    const bP = b.isPublished ? 0 : 1
    if (aP !== bP) return aP - bP
    return b.id.localeCompare(a.id)
  })
}

export function FaqsPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FAQForm>({ question: '', answer: '', isPublished: true })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const { faqs: list } = await fetchFAQs(token, { limit: 500, offset: 0 })
      setFaqs(sortFAQs(list))
    } catch (e) {
      showApiError(e)
      setFaqs([])
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  const publishedCount = useMemo(() => faqs.filter((f) => f.isPublished).length, [faqs])

  function openCreate() {
    setEditingId(null)
    setForm({ question: '', answer: '', isPublished: true })
    setModalOpen(true)
  }

  function openEdit(f: FAQ) {
    setEditingId(f.id)
    setForm({ question: f.question, answer: f.answer, isPublished: f.isPublished })
    setModalOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in to save.', 'error')
      return
    }
    const q = form.question.trim()
    const a = form.answer.trim()
    if (!q || !a) {
      showToast('Question and answer are required.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload: FAQWrite = { question: q, answer: a, isPublished: form.isPublished }
      if (editingId) {
        const updated = await patchFAQ(token, editingId, payload)
        setFaqs((prev) => sortFAQs(prev.map((x) => (x.id === updated.id ? updated : x))))
      } else {
        const created = await createFAQ(token, payload)
        setFaqs((prev) => sortFAQs([created, ...prev]))
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
    const ok = window.confirm('Delete this FAQ? This will also remove it from any products that appended it.')
    if (!ok) return
    setBusyId(id)
    try {
      await deleteFAQ(token, id)
      setFaqs((prev) => prev.filter((x) => x.id !== id))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setFaqs((prev) => prev.filter((x) => x.id !== id))
        showToast('FAQ was already deleted.', 'info')
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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">FAQs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Universal FAQ bank for storefront. Published FAQs are shown on Home and appended to product pages.
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Published: <span className="font-medium text-slate-700 dark:text-slate-200">{publishedCount}</span> · Total:{' '}
            <span className="font-medium text-slate-700 dark:text-slate-200">{faqs.length}</span>
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
            Add FAQ
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1220]">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
        ) : faqs.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No FAQs yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Question</th>
                  <th className="px-4 py-3">Answer</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3">
                      {f.isPublished ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-600/10 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="max-w-[420px] px-4 py-3 align-top">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{f.question}</div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{f.id}</div>
                    </td>
                    <td className="max-w-[520px] px-4 py-3 align-top text-slate-600 dark:text-slate-300">
                      <div className="line-clamp-3 whitespace-pre-wrap">{f.answer}</div>
                    </td>
                    <td className="px-4 py-3 text-right align-top">
                      <button
                        type="button"
                        onClick={() => openEdit(f)}
                        className="mr-3 text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === f.id}
                        onClick={() => void handleDelete(f.id)}
                        className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        {busyId === f.id ? 'Deleting…' : 'Delete'}
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
          aria-labelledby="faq-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
            <h2 id="faq-modal-title" className="text-lg font-semibold">
              {editingId ? 'Edit FAQ' : 'Add FAQ'}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={handleSave}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Published</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, isPublished: !f.isPublished }))}
                  className={[
                    'relative inline-flex h-6 w-11 items-center rounded-full transition',
                    form.isPublished ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700',
                  ].join(' ')}
                  aria-pressed={form.isPublished}
                >
                  <span
                    className={[
                      'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                      form.isPublished ? 'translate-x-5' : 'translate-x-1',
                    ].join(' ')}
                  />
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Question</label>
                <input
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Answer</label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
                  required
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
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


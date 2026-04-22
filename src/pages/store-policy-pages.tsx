import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  getStorePolicyPages,
  patchStorePolicyPages,
  type StorePolicyPages,
} from '../lib/api/storePolicyPages'

const empty = (): StorePolicyPages => ({
  privacyPolicyMarkdown: '',
  termsOfServiceMarkdown: '',
  cookiePolicyMarkdown: '',
  deliveryPolicyMarkdown: '',
  updatedAt: undefined,
})

export function StorePolicyPagesPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const baseId = useId()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<StorePolicyPages>(empty)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const s = await getStorePolicyPages(token)
      setForm({ ...empty(), ...s })
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  function set<K extends keyof StorePolicyPages>(key: K, v: StorePolicyPages[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in again to continue.', 'error')
      return
    }
    if (!form.privacyPolicyMarkdown.trim()) {
      showToast('Privacy Policy is required.', 'error')
      return
    }
    if (!form.termsOfServiceMarkdown.trim()) {
      showToast('Terms of Service is required.', 'error')
      return
    }
    if (!form.cookiePolicyMarkdown.trim()) {
      showToast('Cookie Policy is required.', 'error')
      return
    }
    if (!form.deliveryPolicyMarkdown.trim()) {
      showToast('Delivery Policy is required.', 'error')
      return
    }

    setSaving(true)
    try {
      await patchStorePolicyPages(token, form)
      showToast('Policy pages saved.', 'success')
      await load()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50'

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-24 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Policy pages</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          These pages are published immediately to the storefront and should be written in Markdown.
          {form.updatedAt ? (
            <>
              {' '}
              <span className="tabular-nums">Last updated: {String(form.updatedAt)}</span>
            </>
          ) : null}
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="max-w-4xl space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Privacy Policy</h2>
          <label
            htmlFor={`${baseId}-privacy`}
            className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Markdown
          </label>
          <textarea
            id={`${baseId}-privacy`}
            className={`${inputClass} min-h-[220px] font-mono`}
            value={form.privacyPolicyMarkdown}
            onChange={(e) => set('privacyPolicyMarkdown', e.target.value)}
            placeholder="Write Privacy Policy in Markdown…"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Terms of Service</h2>
          <label
            htmlFor={`${baseId}-terms`}
            className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Markdown
          </label>
          <textarea
            id={`${baseId}-terms`}
            className={`${inputClass} min-h-[220px] font-mono`}
            value={form.termsOfServiceMarkdown}
            onChange={(e) => set('termsOfServiceMarkdown', e.target.value)}
            placeholder="Write Terms of Service in Markdown…"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Cookie Policy</h2>
          <label
            htmlFor={`${baseId}-cookies`}
            className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Markdown
          </label>
          <textarea
            id={`${baseId}-cookies`}
            className={`${inputClass} min-h-[220px] font-mono`}
            value={form.cookiePolicyMarkdown}
            onChange={(e) => set('cookiePolicyMarkdown', e.target.value)}
            placeholder="Write Cookie Policy in Markdown…"
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Delivery Policy</h2>
          <label
            htmlFor={`${baseId}-delivery`}
            className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            Markdown
          </label>
          <textarea
            id={`${baseId}-delivery`}
            className={`${inputClass} min-h-[220px] font-mono`}
            value={form.deliveryPolicyMarkdown}
            onChange={(e) => set('deliveryPolicyMarkdown', e.target.value)}
            placeholder="Write Delivery Policy in Markdown…"
          />
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={saving}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Reload
          </button>
        </div>
      </form>
    </div>
  )
}


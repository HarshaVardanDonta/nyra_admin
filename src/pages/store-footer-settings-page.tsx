import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  getStoreFooterSettings,
  patchStoreFooterSettings,
  type StoreFooterSettings,
  type StoreFooterSettingsSocial,
} from '../lib/api/storeFooterSettings'

function phoneDisplayToTelHref(displayRaw: string): string {
  const display = String(displayRaw ?? '').trim()
  if (!display) return ''
  if (/^tel:/i.test(display)) return display
  // Keep digits and a single leading "+"
  const cleaned = display.replace(/[^\d+]/g, '')
  const normalized = cleaned.startsWith('+') ? `+${cleaned.slice(1).replace(/\+/g, '')}` : cleaned.replace(/\+/g, '')
  const digits = normalized.replace(/[^\d]/g, '')
  if (!digits) return ''
  return `tel:${normalized.startsWith('+') ? normalized : digits}`
}

function telHrefToDisplay(hrefRaw: string): string {
  const href = String(hrefRaw ?? '').trim()
  if (!href) return ''
  return href.replace(/^tel:/i, '')
}

const empty = (): StoreFooterSettings => ({
  brandName: '',
  tagline: '',
  contact: {
    phoneDisplay: '',
    phoneHref: '',
    email: '',
    cin: '',
    officeLabel: '',
    officeLines: [],
  },
  socials: [],
  updatedAt: undefined,
})

const defaultSocialLabels = ['Instagram', 'Facebook', 'YouTube', 'X', 'LinkedIn'] as const

function normalizeSocialRows(rows: StoreFooterSettingsSocial[]): StoreFooterSettingsSocial[] {
  const map = new Map<string, StoreFooterSettingsSocial>()
  for (const r of rows ?? []) {
    const label = String(r?.label ?? '').trim()
    const href = String(r?.href ?? '').trim()
    const enabled = typeof r?.enabled === 'boolean' ? r.enabled : true
    if (!label && !href) continue
    map.set(label || href, { label, href, enabled })
  }

  const out: StoreFooterSettingsSocial[] = []
  for (const label of defaultSocialLabels) {
    const row =
      rows?.find((r) => String(r?.label ?? '').trim() === label) ??
      map.get(label) ??
      ({ label, href: '', enabled: true } satisfies StoreFooterSettingsSocial)
    out.push({
      label,
      href: String(row.href ?? '').trim(),
      enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
    })
  }

  const extras = Array.from(map.values()).filter(
    (r) => !defaultSocialLabels.includes(r.label as any),
  )
  return [...out, ...extras]
}

export function StoreFooterSettingsPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const baseId = useId()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<StoreFooterSettings>(empty)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const s = await getStoreFooterSettings(token)
      const sContact = s.contact ?? {}
      const phoneDisplay =
        String(sContact.phoneDisplay ?? '').trim() ||
        telHrefToDisplay(String(sContact.phoneHref ?? '').trim())
      setForm({
        ...empty(),
        ...s,
        contact: { ...empty().contact, ...sContact, phoneDisplay },
        socials: normalizeSocialRows(s.socials ?? []),
      })
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  function set<K extends keyof StoreFooterSettings>(key: K, v: StoreFooterSettings[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  function setContact<K extends keyof StoreFooterSettings['contact']>(
    key: K,
    v: StoreFooterSettings['contact'][K],
  ) {
    setForm((f) => ({ ...f, contact: { ...f.contact, [key]: v } }))
  }

  function setSocial(index: number, patch: Partial<StoreFooterSettingsSocial>) {
    setForm((f) => ({
      ...f,
      socials: f.socials.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  const officeLinesText = useMemo(() => (form.contact.officeLines ?? []).join('\n'), [form.contact.officeLines])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in again to continue.', 'error')
      return
    }
    setSaving(true)
    try {
      await patchStoreFooterSettings(token, {
        ...form,
        contact: {
          ...form.contact,
          phoneHref: phoneDisplayToTelHref(form.contact.phoneDisplay),
          officeLines: (form.contact.officeLines ?? []).map((l) => String(l).trim()).filter(Boolean),
        },
        socials: (form.socials ?? [])
          .map((s) => ({
            label: String(s.label ?? '').trim(),
            href: String(s.href ?? '').trim(),
            enabled: typeof s.enabled === 'boolean' ? s.enabled : true,
          }))
          .filter((s) => s.label || s.href),
      })
      showToast('Footer settings saved.', 'success')
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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Footer</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Configure the storefront footer content. Link groups are not editable here.
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
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Brand</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-brand`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Brand name
              </label>
              <input
                id={`${baseId}-brand`}
                className={inputClass}
                value={form.brandName}
                onChange={(e) => set('brandName', e.target.value)}
                placeholder="Store brand name"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${baseId}-tagline`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Tagline
              </label>
              <textarea
                id={`${baseId}-tagline`}
                className={`${inputClass} min-h-[88px]`}
                value={form.tagline}
                onChange={(e) => set('tagline', e.target.value)}
                placeholder="Short line shown under the brand name"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contact</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${baseId}-phone-display`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Phone
              </label>
              <input
                id={`${baseId}-phone-display`}
                className={inputClass}
                value={form.contact.phoneDisplay}
                onChange={(e) => setContact('phoneDisplay', e.target.value)}
                placeholder="+91 ..."
              />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Link preview:{' '}
                <span className="font-mono">{phoneDisplayToTelHref(form.contact.phoneDisplay) || '—'}</span>
              </div>
            </div>
            <div>
              <label htmlFor={`${baseId}-email`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Email
              </label>
              <input
                id={`${baseId}-email`}
                className={inputClass}
                value={form.contact.email}
                onChange={(e) => setContact('email', e.target.value)}
                placeholder="support@..."
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-cin`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                CIN
              </label>
              <input
                id={`${baseId}-cin`}
                className={inputClass}
                value={form.contact.cin}
                onChange={(e) => setContact('cin', e.target.value)}
                placeholder="Company identification number"
              />
            </div>
            <div>
              <label htmlFor={`${baseId}-office-label`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Office label
              </label>
              <input
                id={`${baseId}-office-label`}
                className={inputClass}
                value={form.contact.officeLabel}
                onChange={(e) => setContact('officeLabel', e.target.value)}
                placeholder="Registered Office"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${baseId}-office-lines`} className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Office address lines (one per line)
              </label>
              <textarea
                id={`${baseId}-office-lines`}
                className={`${inputClass} min-h-[120px] font-mono`}
                value={officeLinesText}
                onChange={(e) =>
                  setContact(
                    'officeLines',
                    e.target.value
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean),
                  )
                }
                placeholder="Line 1\nLine 2\nLine 3"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Social links</h2>
          <div className="mt-4 space-y-4">
            {(form.socials ?? []).map((row, idx) => (
              <div key={`${row.label}-${idx}`} className="grid gap-3 sm:grid-cols-4">
                <div>
                  <label
                    htmlFor={`${baseId}-social-label-${idx}`}
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Label
                  </label>
                  <input
                    id={`${baseId}-social-label-${idx}`}
                    className={inputClass}
                    value={row.label}
                    onChange={(e) => setSocial(idx, { label: e.target.value })}
                    placeholder="Instagram"
                    disabled={defaultSocialLabels.includes(row.label as any)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`${baseId}-social-href-${idx}`}
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    URL (https://…)
                  </label>
                  <input
                    id={`${baseId}-social-href-${idx}`}
                    className={inputClass}
                    value={row.href}
                    onChange={(e) => setSocial(idx, { href: e.target.value })}
                    placeholder="https://…"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900"
                      checked={typeof row.enabled === 'boolean' ? row.enabled : true}
                      onChange={(e) => setSocial(idx, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>
              </div>
            ))}
          </div>
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


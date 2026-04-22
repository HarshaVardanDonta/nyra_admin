import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  getStoreInvoiceSettings,
  patchStoreInvoiceSettings,
  uploadStoreInvoiceLogo,
  type InvoiceExtraId,
  type StoreInvoiceSettings,
} from '../lib/api/storeInvoice'

const emptySettings = (): StoreInvoiceSettings => ({
  documentTitle: '',
  tradingName: '',
  sellerLegalName: '',
  sellerAddress: '',
  sellerCountry: '',
  gstin: '',
  pan: '',
  cin: '',
  extraIds: [],
  supportEmail: '',
  supportPhone: '',
  websiteUrl: '',
  termsAndConditions: '',
  footerNote: '',
  logoUrl: '',
  productTableColumns: [],
})

const productTableColumnOptions: { key: string; label: string; hint: string }[] = [
  { key: 'sno', label: 'S.No', hint: 'Row number (1, 2, 3, …)' },
  { key: 'item', label: 'Item', hint: 'Product name (and variant label)' },
  { key: 'sku', label: 'SKU', hint: 'Product SKU' },
  { key: 'qty', label: 'Qty', hint: 'Quantity' },
  { key: 'unit', label: 'Unit', hint: 'Per-unit price' },
  { key: 'tax', label: 'Tax (slabs)', hint: 'CGST/SGST/etc. per line' },
  { key: 'total', label: 'Total', hint: 'Line subtotal' },
]

export function StoreInvoiceSettingsPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const baseId = useId()
  const logoFileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [form, setForm] = useState<StoreInvoiceSettings>(emptySettings)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const s = await getStoreInvoiceSettings(token)
      setForm({ ...emptySettings(), ...s, extraIds: s.extraIds?.length ? s.extraIds : [] })
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  function set<K extends keyof StoreInvoiceSettings>(key: K, v: StoreInvoiceSettings[K]) {
    setForm((f) => ({ ...f, [key]: v }))
  }

  function addExtraId() {
    setForm((f) => ({
      ...f,
      extraIds: [...f.extraIds, { label: '', value: '' }],
    }))
  }

  function updateExtraId(index: number, patch: Partial<InvoiceExtraId>) {
    setForm((f) => ({
      ...f,
      extraIds: f.extraIds.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  function removeExtraId(index: number) {
    setForm((f) => ({
      ...f,
      extraIds: f.extraIds.filter((_, i) => i !== index),
    }))
  }

  function ensureProductTableDefault(cols: string[] | undefined): string[] {
    const v = Array.isArray(cols) ? cols : []
    return v.length ? v : ['sno', 'item', 'sku', 'qty', 'unit', 'tax', 'total']
  }

  function toggleProductColumn(key: string, on: boolean) {
    setForm((f) => {
      const current = ensureProductTableDefault(f.productTableColumns)
      const has = current.includes(key)
      if (on && !has) return { ...f, productTableColumns: [...current, key] }
      if (!on && has) return { ...f, productTableColumns: current.filter((k) => k !== key) }
      return f
    })
  }

  function moveProductColumn(key: string, dir: -1 | 1) {
    setForm((f) => {
      const current = ensureProductTableDefault(f.productTableColumns)
      const idx = current.indexOf(key)
      if (idx < 0) return f
      const j = idx + dir
      if (j < 0 || j >= current.length) return f
      const next = [...current]
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return { ...f, productTableColumns: next }
    })
  }

  async function onLogoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !token) return
    setLogoUploading(true)
    try {
      const url = await uploadStoreInvoiceLogo(token, file)
      set('logoUrl', url)
      showToast('Logo uploaded to storage.', 'success')
    } catch (err) {
      showApiError(err)
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in again to continue.', 'error')
      return
    }
    setSaving(true)
    try {
      await patchStoreInvoiceSettings(token, form)
      showToast('Invoice template saved.', 'success')
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
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Invoice & PDF</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          All seller and legal text on customer and admin invoice PDFs comes from these fields. Line items and
          totals are always taken from the order.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="max-w-3xl space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Document</h2>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Document title
            <input
              className={inputClass}
              value={form.documentTitle}
              onChange={(e) => set('documentTitle', e.target.value)}
              placeholder="e.g. Tax invoice"
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Product table</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Choose which columns appear in the invoice line-items table, and their order.
          </p>

          {(() => {
            const cols = ensureProductTableDefault(form.productTableColumns)
            return (
              <div className="mt-3 space-y-2">
                {productTableColumnOptions.map((opt) => {
                  const checked = cols.includes(opt.key)
                  const idx = cols.indexOf(opt.key)
                  return (
                    <div
                      key={`${baseId}-ptc-${opt.key}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/50"
                    >
                      <label className="flex min-w-[220px] flex-1 items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={(e) => toggleProductColumn(opt.key, e.target.checked)}
                        />
                        <span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">{opt.label}</span>
                          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
                        </span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!checked || idx <= 0}
                          onClick={() => moveProductColumn(opt.key, -1)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={!checked || idx < 0 || idx >= cols.length - 1}
                          onClick={() => moveProductColumn(opt.key, 1)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  )
                })}

                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <span className="font-medium">Current order:</span> {cols.join(' → ')}
                </div>
              </div>
            )
          })()}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Seller / company</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Trading name (optional)
              <input
                className={inputClass}
                value={form.tradingName}
                onChange={(e) => set('tradingName', e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Legal name
              <input
                className={inputClass}
                value={form.sellerLegalName}
                onChange={(e) => set('sellerLegalName', e.target.value)}
              />
            </label>
          </div>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Address (multi-line)
            <textarea
              className={`${inputClass} min-h-[88px] resize-y font-mono text-xs`}
              value={form.sellerAddress}
              onChange={(e) => set('sellerAddress', e.target.value)}
              rows={4}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Country
            <input
              className={inputClass}
              value={form.sellerCountry}
              onChange={(e) => set('sellerCountry', e.target.value)}
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Identifiers</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              GSTIN
              <input className={inputClass} value={form.gstin} onChange={(e) => set('gstin', e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              PAN
              <input className={inputClass} value={form.pan} onChange={(e) => set('pan', e.target.value)} />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              CIN
              <input className={inputClass} value={form.cin} onChange={(e) => set('cin', e.target.value)} />
            </label>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Extra identifiers
              </h3>
              <button
                type="button"
                onClick={() => addExtraId()}
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Add row
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {form.extraIds.map((row, i) => (
                <div key={`${baseId}-ex-${i}`} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[120px] flex-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                    Label
                    <input
                      className={inputClass}
                      value={row.label}
                      onChange={(e) => updateExtraId(i, { label: e.target.value })}
                    />
                  </label>
                  <label className="min-w-[120px] flex-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                    Value
                    <input
                      className={inputClass}
                      value={row.value}
                      onChange={(e) => updateExtraId(i, { value: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeExtraId(i)}
                    className="mb-0.5 rounded-lg border border-red-200 px-2 py-2 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contact & logo</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Support email
              <input
                className={inputClass}
                value={form.supportEmail}
                onChange={(e) => set('supportEmail', e.target.value)}
                type="email"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Support phone
              <input
                className={inputClass}
                value={form.supportPhone}
                onChange={(e) => set('supportPhone', e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 sm:col-span-2">
              Website URL
              <input
                className={inputClass}
                value={form.websiteUrl}
                onChange={(e) => set('websiteUrl', e.target.value)}
                placeholder="https://"
              />
            </label>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Invoice logo</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Choose an image — it is resized in the browser, then uploaded to Cloudflare R2. The public URL is
                saved with your invoice template when you click Save.
              </p>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden
                onChange={(ev) => void onLogoFileSelected(ev)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={logoUploading || !token}
                  onClick={() => logoFileRef.current?.click()}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {logoUploading ? 'Uploading…' : form.logoUrl ? 'Replace image' : 'Choose image'}
                </button>
                {form.logoUrl ? (
                  <button
                    type="button"
                    onClick={() => set('logoUrl', '')}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>
              {form.logoUrl ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Preview
                  </p>
                  <img
                    src={form.logoUrl}
                    alt=""
                    className="mt-2 max-h-28 max-w-full rounded-md object-contain"
                  />
                  <p className="mt-2 truncate font-mono text-[11px] text-slate-500 dark:text-slate-400" title={form.logoUrl}>
                    {form.logoUrl}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Terms & footer</h2>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Terms and conditions
            <textarea
              className={`${inputClass} min-h-[140px] resize-y`}
              value={form.termsAndConditions}
              onChange={(e) => set('termsAndConditions', e.target.value)}
              rows={8}
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Footer note
            <input
              className={inputClass}
              value={form.footerNote}
              onChange={(e) => set('footerNote', e.target.value)}
            />
          </label>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save invoice template'}
          </button>
        </div>
      </form>
    </div>
  )
}

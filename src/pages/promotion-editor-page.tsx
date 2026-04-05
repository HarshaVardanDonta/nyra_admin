import { useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchCatalogCategories, fetchProductsList, type CatalogCategory, type CatalogProductRow } from '../lib/api/catalog'
import { fetchCollectionsList, type CollectionRecord } from '../lib/api/collections'
import {
  createPromotion,
  fetchPromotionDetail,
  numericIdFromResourceId,
  updatePromotion,
  type PromotionTargetType,
  type PromotionWriteInput,
} from '../lib/api/promotions'
import { resolveMediaUrl } from '../lib/media-url'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../lib/datetime-local'
import { AdminDateTimeField } from '../components/admin-date-field'

const MAX_BYTES = 2 * 1024 * 1024

function cleanStoredMediaUrl(url: string): string {
  const t = url.trim()
  if (!t) return ''
  try {
    const host = new URL(t).hostname.toLowerCase()
    if (host === 'example.com' || host === 'www.example.com') return ''
    if (host === 'cdn.example.com' || host.endsWith('.example.com')) return ''
  } catch {
    return t
  }
  return t
}

function Toggle({
  checked,
  onChange,
  id,
  label,
  sub,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  label?: string
  sub?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-slate-200">
            {label}
          </label>
        ) : null}
        {sub ? <p className="text-xs text-slate-500">{sub}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label ?? 'Toggle'}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-blue-600' : 'bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-1 left-1 block h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}

function FileDrop({
  id,
  label,
  hint,
  accept,
  file,
  onFile,
  previewUrl,
}: {
  id: string
  label: string
  hint: string
  accept: string
  file: File | null
  onFile: (f: File | null) => void
  previewUrl?: string
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-200">{label}</p>
      <label
        htmlFor={id}
        className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-600 bg-[#0f1419] px-4 py-12 text-center transition hover:border-blue-500/50"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="mb-3 max-h-40 w-full max-w-full rounded-lg object-cover" />
        ) : (
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </span>
        )}
        <span className="text-sm font-medium text-slate-300">
          {file ? file.name : 'Click to upload or drag and drop'}
        </span>
        <span className="mt-1 text-xs text-slate-500">{hint}</span>
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            onFile(f)
          }}
        />
      </label>
      {file || previewUrl ? (
        <button
          type="button"
          onClick={() => onFile(null)}
          className="mt-2 text-xs font-medium text-red-400 hover:underline"
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

export function PromotionEditorPage() {
  const { promotionId } = useParams<{ promotionId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const isEdit = Boolean(promotionId)
  const baseId = useId()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerUrl, setBannerUrl] = useState('')
  const [bannerObjectUrl, setBannerObjectUrl] = useState<string | null>(null)

  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [priorityOrder, setPriorityOrder] = useState(1)
  const [isActive, setIsActive] = useState(true)

  const [targetType, setTargetType] = useState<PromotionTargetType>('collection')
  const [targetIdStr, setTargetIdStr] = useState<string | undefined>(undefined)
  const [targetLabel, setTargetLabel] = useState('')

  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerDebounced, setPickerDebounced] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerCollections, setPickerCollections] = useState<CollectionRecord[]>([])
  const [pickerProducts, setPickerProducts] = useState<CatalogProductRow[]>([])

  useEffect(() => {
    const t = window.setTimeout(() => setPickerDebounced(pickerSearch.trim()), 300)
    return () => window.clearTimeout(t)
  }, [pickerSearch])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const c = await fetchCatalogCategories()
        if (!cancelled) setCategories(c)
      } catch {
        if (!cancelled) setCategories([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!bannerFile) {
      setBannerObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(bannerFile)
    setBannerObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [bannerFile])

  const bannerPreview = bannerObjectUrl || (bannerUrl ? resolveMediaUrl(bannerUrl) : '')

  useEffect(() => {
    if (!isEdit || !promotionId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const p = await fetchPromotionDetail(token, promotionId)
        if (cancelled) return
        setTitle(p.title)
        setDescription(p.description)
        setBannerUrl(p.bannerImageUrl)
        setBannerFile(null)
        setStartLocal(isoToDatetimeLocal(p.startDate))
        setEndLocal(isoToDatetimeLocal(p.expirationDate))
        setPriorityOrder(p.priorityOrder)
        setIsActive(p.isActive)
        const tt = (p.targetType as PromotionTargetType) || 'collection'
        setTargetType(['collection', 'product', 'category'].includes(tt) ? tt : 'collection')
        setTargetIdStr(p.targetId != null ? String(p.targetId) : undefined)
        setTargetLabel(p.targetLabel)
      } catch (e) {
        if (!cancelled) showApiError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, promotionId, token, showApiError])

  useEffect(() => {
    if (!pickerOpen) return
    let cancelled = false
    ;(async () => {
      setPickerLoading(true)
      try {
        if (targetType === 'collection') {
          const { items } = await fetchCollectionsList(token, { limit: 100, offset: 0, status: 'all' })
          const q = pickerDebounced.toLowerCase()
          const filtered = q ? items.filter((c) => c.name.toLowerCase().includes(q)) : items
          if (!cancelled) setPickerCollections(filtered.slice(0, 40))
        } else if (targetType === 'product') {
          const { items } = await fetchProductsList(token, {
            limit: 30,
            offset: 0,
            search: pickerDebounced || undefined,
            publication: 'published',
          })
          if (!cancelled) setPickerProducts(items)
        } else {
          const q = pickerDebounced.toLowerCase()
          const filtered = q
            ? categories.filter((c) => c.name.toLowerCase().includes(q))
            : categories
          if (!cancelled) {
            setPickerCollections(
              filtered.slice(0, 50).map((c) => ({
                id: c.id,
                name: c.name,
                slug: c.slug ?? '',
                description: '',
                bannerImageUrl: '',
                thumbnailUrl: '',
                displayAsStrip: false,
                displayPriority: 1,
                status: 'published',
                createdAt: '',
                updatedAt: '',
                productCount: 0,
                products: [],
              })),
            )
          }
        }
      } catch {
        if (!cancelled) {
          setPickerCollections([])
          setPickerProducts([])
        }
      } finally {
        if (!cancelled) setPickerLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pickerOpen, pickerDebounced, targetType, token, categories])

  function checkFile(f: File | null) {
    if (!f) return null
    if (f.size > MAX_BYTES) {
      showToast('Image must be 2MB or smaller.', 'error')
      return null
    }
    return f
  }

  function buildWriteInput(): PromotionWriteInput {
    const tid =
      targetIdStr != null && targetIdStr !== '' ? Number.parseInt(targetIdStr, 10) : undefined
    const validTid = tid != null && Number.isFinite(tid) && tid > 0 ? tid : undefined
    return {
      title,
      bannerImageUrl: cleanStoredMediaUrl(bannerUrl),
      description,
      startDate: datetimeLocalToIso(startLocal),
      expirationDate: datetimeLocalToIso(endLocal),
      priorityOrder: Number.isFinite(priorityOrder) ? priorityOrder : 1,
      isActive,
      targetType,
      targetId: validTid,
    }
  }

  async function handleSave() {
    if (!token) {
      showToast('Sign in to save.', 'error')
      return
    }
    if (!title.trim()) {
      showToast('Title is required.', 'error')
      return
    }
    setSaving(true)
    try {
      const input = buildWriteInput()
      if (isEdit && promotionId) {
        await updatePromotion(token, promotionId, input, bannerFile)
        showToast('Promotion updated.', 'success')
        navigate(`/promotions/${encodeURIComponent(promotionId)}`)
      } else {
        const created = await createPromotion(token, input, bannerFile)
        showToast('Promotion created.', 'success')
        navigate(`/promotions/${encodeURIComponent(created.id)}`)
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  function selectTarget(id: string, label: string, productCount?: number) {
    const num = numericIdFromResourceId(id)
    if (num == null) {
      showToast('Could not read target id.', 'error')
      return
    }
    setTargetIdStr(String(num))
    setTargetLabel(
      productCount != null ? `${label} · ${productCount} items` : label,
    )
    setPickerOpen(false)
    setPickerSearch('')
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? 'Edit promotion' : 'Create Promotion'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Design and schedule a new marketing campaign across your store.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={isEdit && promotionId ? `/promotions/${encodeURIComponent(promotionId)}` : '/promotions'}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Promotion'}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Basic information</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor={`${baseId}-title`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Promotion title
                </label>
                <input
                  id={`${baseId}-title`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Summer Flash Sale 2024"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
              </div>
              <FileDrop
                id={`${baseId}-banner`}
                label="Promotion banner"
                hint="Recommended size: 1200 × 512px (PNG, JPG). Max 2MB."
                accept="image/png,image/jpeg,image/webp"
                file={bannerFile}
                onFile={(f) => setBannerFile(checkFile(f))}
                previewUrl={bannerPreview}
              />
              <div>
                <label htmlFor={`${baseId}-desc`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Description
                </label>
                <textarea
                  id={`${baseId}-desc`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Describe the details of this promotion..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Redirect target</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Where shoppers go when they tap the banner.</p>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor={`${baseId}-tt`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Target type
                </label>
                <select
                  id={`${baseId}-tt`}
                  value={targetType}
                  onChange={(e) => {
                    setTargetType(e.target.value as PromotionTargetType)
                    setTargetIdStr(undefined)
                    setTargetLabel('')
                  }}
                  className="select-tail mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                >
                  <option value="collection">Collection</option>
                  <option value="product">Product</option>
                  <option value="category">Category</option>
                </select>
              </div>
              {targetIdStr ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{targetLabel || 'Selected target'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {targetType} · id {targetIdStr}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetIdStr(undefined)
                      setTargetLabel('')
                    }}
                    className="shrink-0 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="w-full rounded-lg border border-dashed border-slate-300 py-8 text-sm font-medium text-slate-600 transition hover:border-blue-500/50 hover:text-blue-600 dark:border-slate-600 dark:text-slate-300 dark:hover:text-blue-400"
                >
                  Choose {targetType}…
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Scheduling</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Start date &amp; time</label>
                <div className="mt-1">
                  <AdminDateTimeField value={startLocal} onChange={setStartLocal} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Expiration date &amp; time</label>
                <div className="mt-1">
                  <AdminDateTimeField value={endLocal} onChange={setEndLocal} />
                </div>
              </div>
              <p className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="text-blue-500" aria-hidden>
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                Use a job or scheduler on the server to auto-activate by start time when needed.
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Configuration</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor={`${baseId}-pri`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Priority order
                </label>
                <input
                  id={`${baseId}-pri`}
                  type="number"
                  min={0}
                  value={priorityOrder}
                  onChange={(e) => setPriorityOrder(Number.parseInt(e.target.value, 10) || 0)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lower numbers sort first in API lists.</p>
              </div>
              <Toggle
                id={`${baseId}-active`}
                label="Promotion status"
                sub={isActive ? 'Currently active' : 'Paused'}
                checked={isActive}
                onChange={setIsActive}
              />
            </div>
          </section>

          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 dark:bg-blue-500/10">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-50">Pro tip</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              High-quality lifestyle photography for banners often improves click-through compared to generic pack shots.
            </p>
          </div>
        </div>
      </div>

      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Choose target"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPickerOpen(false)
          }}
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-[#111827]">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Select {targetType}
              </p>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={`Search ${targetType}…`}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-2 pb-4">
              {pickerLoading ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">Loading…</p>
              ) : targetType === 'product' ? (
                <ul className="space-y-1">
                  {pickerProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => selectTarget(p.id, p.name)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-50">
                          {p.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-1">
                  {pickerCollections.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() =>
                          selectTarget(
                            c.id,
                            c.name,
                            targetType === 'collection' ? c.productCount : undefined,
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-50">
                          {c.name}
                        </span>
                        {targetType === 'collection' ? (
                          <span className="shrink-0 text-xs text-slate-500">{c.productCount} items</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!pickerLoading &&
              (targetType === 'product' ? pickerProducts.length === 0 : pickerCollections.length === 0) ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">No matches.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

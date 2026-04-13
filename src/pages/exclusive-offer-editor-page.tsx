import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  createExclusiveOffer,
  fetchExclusiveOfferDetail,
  fetchExclusiveOfferFilterCategories,
  updateExclusiveOffer,
  type ExclusiveOfferWriteInput,
  type ExclusiveOfferFilterCategory,
} from '../lib/api/exclusive-offers'
import { resolveMediaUrl } from '../lib/media-url'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../lib/datetime-local'
import { AdminDateTimeField } from '../components/admin-date-field'

const MAX_BYTES = 2 * 1024 * 1024

/** Storefront routes only — leading slash, no https:// or .. (validated on save). */
const DESTINATION_PATH_PRESETS: readonly { label: string; path: string; hint?: string }[] = [
  { label: 'Shop', path: '/shop' },
  { label: 'Browse categories', path: '/browse-categories' },
  { label: 'Blogs', path: '/blogs' },
  { label: 'Collection', path: '/collections/', hint: 'add collection slug after this' },
]

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
        <button type="button" onClick={() => onFile(null)} className="mt-2 text-xs font-medium text-red-400 hover:underline">
          Remove
        </button>
      ) : null}
    </div>
  )
}

export function ExclusiveOfferEditorPage() {
  const { offerId } = useParams<{ offerId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const isEdit = Boolean(offerId)
  const baseId = useId()
  const destinationInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [chipText, setChipText] = useState('')
  const [chipColor, setChipColor] = useState('#dc2626')
  const [filterCategories, setFilterCategories] = useState<ExclusiveOfferFilterCategory[]>([])
  const [filterCatsLoading, setFilterCatsLoading] = useState(true)
  const [filterKey, setFilterKey] = useState('')
  const [destinationPath, setDestinationPath] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null)

  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [priorityOrder, setPriorityOrder] = useState(1)
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!imageFile) {
      setImageObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(imageFile)
    setImageObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [imageFile])

  function checkFile(f: File | null): File | null {
    if (!f) return null
    if (f.size > MAX_BYTES) {
      showToast('Image must be 2MB or smaller.', 'error')
      return null
    }
    return f
  }

  const filterSelectOptions = useMemo(() => {
    const rows = filterCategories.map((c) => ({ key: c.filterKey, label: c.label }))
    if (filterKey && !rows.some((r) => r.key === filterKey)) {
      rows.push({ key: filterKey, label: `${filterKey} (admin list)` })
    }
    return rows
  }, [filterCategories, filterKey])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cats = await fetchExclusiveOfferFilterCategories(token)
        if (cancelled) return
        setFilterCategories(cats)
        if (!isEdit && cats.length > 0) {
          setFilterKey((prev) => (prev === '' ? cats[0].filterKey : prev))
        }
      } catch {
        if (!cancelled) setFilterCategories([])
      } finally {
        if (!cancelled) setFilterCatsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, isEdit])

  useEffect(() => {
    if (!isEdit || !offerId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const o = await fetchExclusiveOfferDetail(token, offerId)
        if (cancelled) return
        setTitle(o.title)
        setSubtitle(o.subtitle)
        setChipText(o.chipText)
        setChipColor(o.chipColor || '#dc2626')
        setFilterKey(o.filterKey ? o.filterKey.trim() : '')
        setDestinationPath(o.destinationPath ?? '')
        setImageUrl(cleanStoredMediaUrl(o.imageUrl))
        setPriorityOrder(o.priorityOrder ?? 1)
        setIsActive(o.isActive !== false)
        setStartLocal(isoToDatetimeLocal(o.startDate))
        setEndLocal(isoToDatetimeLocal(o.endDate))
      } catch (e) {
        showApiError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, offerId, token, showApiError])

  const imagePreview = imageObjectUrl ?? (imageUrl ? resolveMediaUrl(imageUrl) : undefined)

  function buildWriteInput(): ExclusiveOfferWriteInput {
    return {
      title,
      subtitle,
      chipText,
      chipColor,
      filterKey,
      destinationPath,
      imageUrl: cleanStoredMediaUrl(imageUrl),
      priorityOrder: Number.isFinite(priorityOrder) ? priorityOrder : 1,
      isActive,
      startDate: datetimeLocalToIso(startLocal),
      endDate: datetimeLocalToIso(endLocal),
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
    if (!chipText.trim()) {
      showToast('Chip text is required.', 'error')
      return
    }
    if (!filterKey.trim()) {
      showToast('Choose a filter category (configure under Offer filter categories if none exist).', 'error')
      return
    }
    const destTrim = destinationPath.trim()
    if (destTrim !== '' && !destTrim.startsWith('/')) {
      showToast('If set, destination path must start with / (e.g. /shop). Leave blank for display-only.', 'error')
      return
    }
    const input = buildWriteInput()
    if (!isEdit && !input.imageUrl.trim() && !imageFile) {
      showToast('Add an image (upload or URL).', 'error')
      return
    }
    setSaving(true)
    try {
      if (isEdit && offerId) {
        await updateExclusiveOffer(token, offerId, input, imageFile)
        showToast('Exclusive offer updated.', 'success')
        navigate(`/exclusive-offers/${encodeURIComponent(offerId)}`)
      } else {
        const created = await createExclusiveOffer(token, input, imageFile)
        showToast('Exclusive offer created.', 'success')
        navigate(`/exclusive-offers/${encodeURIComponent(created.id)}`)
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
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
          <h1 className="text-2xl font-semibold tracking-tight">{isEdit ? 'Edit exclusive offer' : 'New exclusive offer'}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Shown on the storefront homepage strip (not the hero carousel).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={isEdit && offerId ? `/exclusive-offers/${encodeURIComponent(offerId)}` : '/exclusive-offers'}
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Card content</h2>
            <div className="mt-4 space-y-4">
              <FileDrop
                id={`${baseId}-img`}
                label="Image"
                hint="Square or wide image; PNG, JPG, WebP. Max 2MB."
                accept="image/png,image/jpeg,image/webp"
                file={imageFile}
                onFile={(f) => setImageFile(checkFile(f))}
                previewUrl={imagePreview}
              />
              <div>
                <label htmlFor={`${baseId}-url`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Or image URL
                </label>
                <input
                  id={`${baseId}-url`}
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-title`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Title
                </label>
                <input
                  id={`${baseId}-title`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-sub`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Subtitle
                </label>
                <input
                  id={`${baseId}-sub`}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`${baseId}-chip`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Chip text
                  </label>
                  <input
                    id={`${baseId}-chip`}
                    value={chipText}
                    onChange={(e) => setChipText(e.target.value)}
                    placeholder="e.g. FLASH SALE"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm uppercase text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                  />
                </div>
                <div>
                  <label htmlFor={`${baseId}-color`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Chip color
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id={`${baseId}-color`}
                      type="color"
                      value={chipColor.length === 7 ? chipColor : '#dc2626'}
                      onChange={(e) => setChipColor(e.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white p-1 dark:border-slate-700"
                      aria-label="Chip color"
                    />
                    <input
                      value={chipColor}
                      onChange={(e) => setChipColor(e.target.value)}
                      placeholder="#dc2626"
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor={`${baseId}-fk`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Filter category
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Used for storefront pill filters (with “All offers”).{' '}
                  <Link
                    to="/exclusive-offers/filter-categories"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Manage categories
                  </Link>
                </p>
                <select
                  id={`${baseId}-fk`}
                  value={filterKey}
                  onChange={(e) => setFilterKey(e.target.value)}
                  disabled={filterCatsLoading && filterSelectOptions.length === 0}
                  className="select-tail mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50 disabled:opacity-60"
                >
                  {filterCatsLoading && filterSelectOptions.length === 0 ? (
                    <option value="">Loading categories…</option>
                  ) : null}
                  {filterSelectOptions.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {!filterCatsLoading && filterSelectOptions.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    No filter categories yet. Add at least one under Offer filter categories before saving.
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor={`${baseId}-dest`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Destination path{' '}
                  <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Leave empty to show the image on the homepage only (no tap / navigation). Otherwise use an in-app path
                  starting with <code className="rounded bg-slate-100 px-1 text-[11px] dark:bg-slate-800">/</code> — not a
                  full URL.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="mr-1 self-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Insert
                  </span>
                  {DESTINATION_PATH_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      title={
                        preset.hint ? `${preset.path} — ${preset.hint}` : `Set path to ${preset.path}`
                      }
                      onClick={() => {
                        setDestinationPath(preset.path)
                        queueMicrotask(() => {
                          const el = destinationInputRef.current
                          if (!el) return
                          el.focus()
                          if (preset.path === '/collections/') {
                            const len = el.value.length
                            el.setSelectionRange(len, len)
                          }
                        })
                      }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 transition hover:border-blue-400/50 hover:bg-blue-50 hover:text-blue-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-slate-800"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input
                  ref={destinationInputRef}
                  id={`${baseId}-dest`}
                  value={destinationPath}
                  onChange={(e) => setDestinationPath(e.target.value)}
                  placeholder="Optional — e.g. /shop"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 outline-none ring-blue-500/30 focus:ring-2 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Examples when linking:{' '}
                  <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/shop</code>,{' '}
                  <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/collections/summer-seeds</code>,{' '}
                  <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/blogs/announcements</code>.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Schedule</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor={`${baseId}-start`} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Start (optional)
                </label>
                <div className="mt-1">
                  <AdminDateTimeField id={`${baseId}-start`} value={startLocal} onChange={setStartLocal} />
                </div>
              </div>
              <div>
                <label htmlFor={`${baseId}-end`} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  End (optional)
                </label>
                <div className="mt-1">
                  <AdminDateTimeField id={`${baseId}-end`} value={endLocal} onChange={setEndLocal} />
                </div>
              </div>
              <div>
                <label htmlFor={`${baseId}-pri`} className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Priority
                </label>
                <input
                  id={`${baseId}-pri`}
                  type="number"
                  min={0}
                  value={priorityOrder}
                  onChange={(e) => setPriorityOrder(Number.parseInt(e.target.value, 10) || 0)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50"
                />
              </div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">Active</span>
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

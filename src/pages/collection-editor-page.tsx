import { useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  addCollectionProducts,
  collectionSlugSegment,
  createCollection,
  fetchCollectionDetail,
  removeCollectionProduct,
  slugifySegment,
  toApiCollectionSlug,
  updateCollection,
  type CollectionWriteBody,
} from '../lib/api/collections'
import {
  categoryBreadcrumb,
  fetchCatalogCategories,
  fetchProductsList,
  normalizeCatalogProductRow,
  type CatalogCategory,
  type CatalogProductRow,
} from '../lib/api/catalog'
import { formatInr } from '../lib/api/products'
import { resolveMediaUrl } from '../lib/media-url'

const MAX_BYTES = 2 * 1024 * 1024

/** Strip demo/placeholder hosts so we never persist fake CDN URLs. */
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
          <label
            htmlFor={id}
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
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
  tall,
}: {
  id: string
  label: string
  hint: string
  accept: string
  file: File | null
  onFile: (f: File | null) => void
  previewUrl?: string
  tall?: boolean
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
      </p>
      <label
        htmlFor={id}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-blue-500/50 dark:border-slate-600 dark:bg-[#0f1419] ${
          tall ? 'min-h-[140px] py-12' : 'py-10'
        }`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="mb-3 max-h-32 w-full max-w-full rounded-lg object-cover" />
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
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
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

export function CollectionEditorPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const isEdit = Boolean(collectionId)
  const baseId = useId()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  const [name, setName] = useState('')
  const [slugSegment, setSlugSegment] = useState('')
  const [description, setDescription] = useState('')
  const [displayAsStrip, setDisplayAsStrip] = useState(true)
  const [displayPriority, setDisplayPriority] = useState(1)
  const [status, setStatus] = useState<'published' | 'draft'>('published')

  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [thumbFile, setThumbFile] = useState<File | null>(null)
  const [bannerUrl, setBannerUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [bannerObjectUrl, setBannerObjectUrl] = useState<string | null>(null)
  const [thumbObjectUrl, setThumbObjectUrl] = useState<string | null>(null)

  const [products, setProducts] = useState<CatalogProductRow[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerDebounced, setPickerDebounced] = useState('')
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerRows, setPickerRows] = useState<CatalogProductRow[]>([])

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

  useEffect(() => {
    if (!thumbFile) {
      setThumbObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(thumbFile)
    setThumbObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [thumbFile])

  const bannerPreview = bannerObjectUrl || (bannerUrl ? resolveMediaUrl(bannerUrl) : '')
  const thumbPreview = thumbObjectUrl || (thumbnailUrl ? resolveMediaUrl(thumbnailUrl) : '')

  useEffect(() => {
    if (!isEdit || !collectionId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const col = await fetchCollectionDetail(token, collectionId)
        if (cancelled) return
        setName(col.name)
        setSlugSegment(collectionSlugSegment(col.slug))
        setDescription(col.description)
        setDisplayAsStrip(col.displayAsStrip)
        setDisplayPriority(col.displayPriority)
        setStatus(col.status.toLowerCase() === 'draft' ? 'draft' : 'published')
        setBannerUrl(col.bannerImageUrl)
        setThumbnailUrl(col.thumbnailUrl)
        setBannerFile(null)
        setThumbFile(null)
        setProducts(col.products)
      } catch (e) {
        if (!cancelled) showApiError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, collectionId, token, showApiError])

  useEffect(() => {
    if (isEdit || slugTouched) return
    setSlugSegment(slugifySegment(name))
  }, [name, isEdit, slugTouched])

  useEffect(() => {
    if (!pickerOpen) return
    let cancelled = false
    ;(async () => {
      setPickerLoading(true)
      try {
        const { items } = await fetchProductsList(token, {
          limit: 30,
          offset: 0,
          search: pickerDebounced || undefined,
          publication: 'published',
        })
        if (!cancelled) setPickerRows(items)
      } catch {
        if (!cancelled) setPickerRows([])
      } finally {
        if (!cancelled) setPickerLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pickerOpen, pickerDebounced, token])

  function checkFile(f: File | null) {
    if (!f) return null
    if (f.size > MAX_BYTES) {
      showToast('Image must be 2MB or smaller.', 'error')
      return null
    }
    return f
  }

  function buildJsonBody(): CollectionWriteBody {
    const slug = toApiCollectionSlug(slugSegment)
    return {
      name: name.trim(),
      slug: slug || toApiCollectionSlug(slugifySegment(name.trim())) || '/collections/untitled',
      description: description.trim(),
      bannerImageUrl: cleanStoredMediaUrl(bannerUrl),
      thumbnailUrl: cleanStoredMediaUrl(thumbnailUrl),
      displayAsStrip,
      displayPriority: Number.isFinite(displayPriority) ? displayPriority : 1,
      status,
    }
  }

  function buildFormData(): FormData {
    const fd = new FormData()
    const body = buildJsonBody()
    fd.set('name', body.name)
    fd.set('slug', body.slug)
    fd.set('description', body.description)
    fd.set('bannerImageUrl', body.bannerImageUrl)
    fd.set('thumbnailUrl', body.thumbnailUrl)
    fd.set('displayAsStrip', body.displayAsStrip ? 'true' : 'false')
    fd.set('displayPriority', String(body.displayPriority))
    fd.set('status', body.status)
    if (bannerFile && bannerFile.size > 0) fd.set('banner', bannerFile)
    if (thumbFile && thumbFile.size > 0) fd.set('thumbnail', thumbFile)
    return fd
  }

  const productIdSet = useMemo(() => new Set(products.map((p) => p.id)), [products])

  async function handleSave() {
    if (!token) {
      showToast('Sign in to save.', 'error')
      return
    }
    if (!name.trim()) {
      showToast('Collection name is required.', 'error')
      return
    }
    setSaving(true)
    try {
      const hasRealUpload =
        (bannerFile !== null && bannerFile.size > 0) || (thumbFile !== null && thumbFile.size > 0)
      if (isEdit && collectionId) {
        const payload = hasRealUpload ? buildFormData() : buildJsonBody()
        await updateCollection(token, collectionId, payload)
        showToast('Collection updated.', 'success')
        navigate(`/collections/${encodeURIComponent(collectionId)}`)
      } else {
        const created = await createCollection(token, hasRealUpload ? buildFormData() : buildJsonBody())
        const newId = created.id
        if (products.length > 0) {
          await addCollectionProducts(
            token,
            newId,
            products.map((p) => p.id),
          )
        }
        showToast('Collection created.', 'success')
        navigate(`/collections/${encodeURIComponent(newId)}`)
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveProduct(pid: string) {
    if (!token) return
    if (isEdit && collectionId) {
      try {
        await removeCollectionProduct(token, collectionId, pid)
        setProducts((prev) => prev.filter((p) => p.id !== pid))
        showToast('Removed from collection.', 'success')
      } catch (e) {
        showApiError(e)
      }
    } else {
      setProducts((prev) => prev.filter((p) => p.id !== pid))
    }
  }

  async function handleAddFromPicker(row: CatalogProductRow) {
    if (productIdSet.has(row.id)) {
      showToast('Product is already in this collection.', 'error')
      return
    }
    if (isEdit && collectionId) {
      try {
        await addCollectionProducts(token, collectionId, [row.id])
        setProducts((prev) => [...prev, normalizeCatalogProductRow(row)])
        showToast('Product added.', 'success')
        setPickerOpen(false)
      } catch (e) {
        showApiError(e)
      }
    } else {
      setProducts((prev) => [...prev, normalizeCatalogProductRow(row)])
      setPickerOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-slate-50 text-slate-500 dark:bg-[#0b0e14] dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-w-0 bg-slate-50 px-4 pt-6 pb-32 text-slate-900 dark:bg-[#0b0e14] dark:text-slate-200 sm:px-6 lg:p-10">
      <nav className="mb-6 text-sm text-slate-500 dark:text-slate-500">
        <Link to="/collections" className="hover:text-blue-600 dark:hover:text-blue-400">
          Collections
        </Link>
        <span className="mx-2">/</span>
        <span className="text-blue-400">{isEdit ? 'Edit' : 'Create'} Collection</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
          {isEdit ? 'Edit collection' : 'Create collection'}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to={isEdit && collectionId ? `/collections/${encodeURIComponent(collectionId)}` : '/collections'}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#151b23] dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/40"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save collection'}
          </button>
        </div>
      </div>

      <div className="min-w-0 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#151b23] dark:shadow-xl">
            <div className="mb-4 flex items-center gap-2 text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Basic information</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Collection name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Essentials"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0f1419] dark:text-white dark:placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Slug
                </label>
                <div className="flex rounded-lg border border-slate-200 bg-white focus-within:border-blue-500 dark:border-slate-700 dark:bg-[#0f1419]">
                  <span className="flex items-center border-r border-slate-200 px-3 text-xs text-slate-500 dark:border-slate-700">
                    /collections/
                  </span>
                  <input
                    value={slugSegment}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setSlugSegment(e.target.value)
                    }}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none dark:text-white"
                    placeholder="summer-essentials"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Describe this collection for your customers…"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0f1419] dark:text-white dark:placeholder:text-slate-600"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#151b23] dark:shadow-xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-blue-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Product selection</h2>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-sm font-medium text-blue-400 hover:text-blue-300"
              >
                + Add products
              </button>
            </div>
            <label className="relative mb-4 block">
              <span className="sr-only">Search products in table</span>
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
              </svg>
              <input
                readOnly
                placeholder="Use Add products to search the catalog…"
                className="w-full cursor-default rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-[#0f1419]"
              />
            </label>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-[#0f1419]">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No products linked yet.
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => {
                      const thumb = p.thumbnailUrl ? resolveMediaUrl(p.thumbnailUrl) : ''
                      const stock = p.stockQuantity ?? 0
                      const oos = p.isOutOfStock || stock <= 0
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                                {thumb ? (
                                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                                <p className="truncate text-xs text-slate-500">
                                  {categoryBreadcrumb(categories, p.categoryId)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.sku ?? '—'}</td>
                          <td className="px-4 py-3">{formatInr(p.basePrice)}</td>
                          <td className="px-4 py-3">
                            <span className={oos ? 'text-red-400' : 'text-emerald-400'}>
                              {oos ? 'Out of stock' : `${stock} in stock`}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => void handleRemoveProduct(p.id)}
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                              title="Remove"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#151b23] dark:shadow-xl">
            <div className="mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-200">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h2 className="font-semibold">Media</h2>
            </div>
            <FileDrop
              id={`${baseId}-banner`}
              label="Banner image"
              hint="1200 × 400px suggested"
              accept="image/png,image/jpeg,image/webp,image/gif"
              file={bannerFile}
              onFile={(f) => setBannerFile(checkFile(f))}
              previewUrl={bannerPreview}
              tall
            />
            <div className="mt-6">
              <FileDrop
                id={`${baseId}-thumb`}
                label="Thumbnail"
                hint="Square image for list views"
                accept="image/png,image/jpeg,image/webp,image/gif"
                file={thumbFile}
                onFile={(f) => setThumbFile(checkFile(f))}
                previewUrl={thumbPreview}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#151b23] dark:shadow-xl">
            <div className="mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-200">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21h15V10.5" />
              </svg>
              <h2 className="font-semibold">Homepage settings</h2>
            </div>
            <Toggle
              id={`${baseId}-strip`}
              checked={displayAsStrip}
              onChange={setDisplayAsStrip}
              label="Display as strip"
              sub="Show this collection as a scrollable row on the homepage."
            />
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Display priority
              </label>
              <input
                type="number"
                min={0}
                max={999}
                value={displayPriority}
                onChange={(e) => setDisplayPriority(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0f1419] dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-500">Lower numbers appear first.</p>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#151b23] dark:shadow-xl">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-blue-400">Status</p>
            <div className="space-y-3">
              <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700">
                <input
                  type="radio"
                  name="cstatus"
                  checked={status === 'published'}
                  onChange={() => setStatus('published')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Published</p>
                  <p className="text-xs text-slate-500">Visible to all customers.</p>
                </div>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700">
                <input
                  type="radio"
                  name="cstatus"
                  checked={status === 'draft'}
                  onChange={() => setStatus('draft')}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Draft</p>
                  <p className="text-xs text-slate-500">Only visible to administrators.</p>
                </div>
              </label>
            </div>
          </section>
        </aside>
      </div>

      {pickerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-label="Add products"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#151b23]">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h3 className="font-semibold text-white">Add products</h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="Search by name, SKU or ID…"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-[#0f1419] dark:text-white dark:placeholder:text-slate-600"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto border-t border-slate-800">
              {pickerLoading ? (
                <p className="p-6 text-center text-sm text-slate-500">Loading…</p>
              ) : pickerRows.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">No products found.</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {pickerRows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => void handleAddFromPicker(row)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-800/80"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-white">{row.name}</p>
                          <p className="truncate text-xs text-slate-500">{row.sku ?? row.id}</p>
                        </div>
                        <span className="text-xs font-medium text-blue-400">Add</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

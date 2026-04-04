import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  fetchCatalogBrands,
  fetchCatalogCategories,
  fetchCatalogProductByKey,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogProductRow,
} from '../lib/api/catalog'
import {
  createProduct,
  parseInrInputToRupees,
  rupeesToFormString,
  updateProduct,
  type ProductSeoInput,
  type ProductStatusInput,
  type ProductVariantInput,
} from '../lib/api/products'
import { resolveMediaUrl } from '../lib/media-url'

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function Toggle({
  checked,
  onChange,
  id,
  label,
  sub,
  hideLabel,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  label?: string
  sub?: string
  hideLabel?: boolean
}) {
  const btn = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? 'Toggle'}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-1 left-1 block h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
  if (hideLabel) return btn
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {label}
          </label>
        ) : null}
        {sub ? <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
      </div>
      {btn}
    </div>
  )
}

function emptyVariant(): ProductVariantInput {
  return { name: '', values: [] }
}

/** Catalog/API may send values as a non-array (e.g. map, null, or { value: "x" }[]). */
function coerceVariantValues(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'value' in item) {
          const v = (item as { value?: unknown }).value
          return typeof v === 'string' ? v : v != null ? String(v) : ''
        }
        if (item && typeof item === 'object' && 'label' in item) {
          const v = (item as { label?: unknown }).label
          return typeof v === 'string' ? v : v != null ? String(v) : ''
        }
        return String(item)
      })
      .filter((s) => s.trim().length > 0)
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .map((x) => (typeof x === 'string' ? x : x != null ? String(x) : ''))
      .filter((s) => s.trim().length > 0)
  }
  return []
}

function asVariantValueArray(v: unknown): string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : coerceVariantValues(v)
}

function mapProductToForm(p: CatalogProductRow) {
  const variants: ProductVariantInput[] = Array.isArray(p.variants)
    ? p.variants.map((v) => ({
        name: typeof v?.name === 'string' ? v.name : '',
        values: coerceVariantValues(v?.values),
      }))
    : []
  return {
    name: p.name ?? '',
    description: p.description ?? '',
    brandId: p.brand?.id ?? p.brandId ?? '',
    categoryId: p.category?.id ?? p.categoryId ?? '',
    basePriceRupees: rupeesToFormString(p.basePrice),
    discountPriceRupees: rupeesToFormString(
      p.discountPrice === null || p.discountPrice === undefined ? undefined : p.discountPrice,
    ),
    hasSpecialDiscount: Boolean(p.hasSpecialDiscount),
    discountExpiry: p.discountExpiry ? p.discountExpiry.slice(0, 10) : '',
    sku: p.sku ?? '',
    stockQuantity: String(p.stockQuantity ?? 0),
    isOutOfStock: Boolean(p.isOutOfStock),
    variantsEnabled: variants.length > 0,
    variants: variants.length ? variants : [emptyVariant(), emptyVariant()],
    slug: p.seo?.slug ?? slugify(p.name ?? ''),
    metaTitle: p.seo?.metaTitle ?? '',
    metaDescription: p.seo?.metaDescription ?? '',
    visibility: p.status?.visibility ?? 'public',
    scheduledAt: p.status?.scheduledAt ? p.status.scheduledAt.slice(0, 16) : '',
  }
}

export function ProductEditorPage() {
  const { productId } = useParams<{ productId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const dupId = (location.state as { duplicateFromId?: string } | null)?.duplicateFromId
  const isEdit = Boolean(productId)
  const baseId = useId()

  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(isEdit || Boolean(dupId))
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [basePriceRupees, setBasePriceRupees] = useState('0')
  const [discountPriceRupees, setDiscountPriceRupees] = useState('0')
  const [hasSpecialDiscount, setHasSpecialDiscount] = useState(false)
  const [discountExpiry, setDiscountExpiry] = useState('')
  const [sku, setSku] = useState('')
  const [stockQuantity, setStockQuantity] = useState('0')
  const [isOutOfStock, setIsOutOfStock] = useState(false)
  const [variantsEnabled, setVariantsEnabled] = useState(true)
  const [variants, setVariants] = useState<ProductVariantInput[]>([
    { name: 'size', values: ['Small', 'Medium', 'Large'] },
    { name: 'color', values: ['Midnight Black', 'Arctic White'] },
  ])
  const [slug, setSlug] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [scheduledAt, setScheduledAt] = useState('')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaJsonInput, setMediaJsonInput] = useState('')
  const [existingMedia, setExistingMedia] = useState<unknown[]>([])
  const [existingThumb, setExistingThumb] = useState('')

  const loadMeta = useCallback(async () => {
    const [b, c] = await Promise.all([fetchCatalogBrands(), fetchCatalogCategories()])
    setBrands(b)
    setCategories(c)
  }, [])

  useEffect(() => {
    void loadMeta().catch((e) => showApiError(e))
  }, [loadMeta, showApiError])

  useEffect(() => {
    const key = dupId ?? productId
    if (!key) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const p = await fetchCatalogProductByKey(key)
        if (cancelled) return
        const f = mapProductToForm(p)
        setName(dupId ? `${f.name} (copy)` : f.name)
        setDescription(f.description)
        setBrandId(f.brandId)
        setCategoryId(f.categoryId)
        setBasePriceRupees(f.basePriceRupees || '0')
        setDiscountPriceRupees(f.discountPriceRupees || '0')
        setHasSpecialDiscount(f.hasSpecialDiscount)
        setDiscountExpiry(f.discountExpiry)
        setSku(dupId ? `${f.sku}-COPY` : f.sku)
        setStockQuantity(f.stockQuantity)
        setIsOutOfStock(f.isOutOfStock)
        setVariantsEnabled(f.variantsEnabled)
        setVariants(f.variants)
        setSlug(dupId ? `${f.slug}-copy` : f.slug)
        setMetaTitle(f.metaTitle)
        setMetaDescription(f.metaDescription)
        setVisibility(f.visibility)
        setScheduledAt(f.scheduledAt)
        setExistingMedia(Array.isArray(p.media) ? p.media : [])
        setExistingThumb(p.thumbnailUrl ? resolveMediaUrl(p.thumbnailUrl) : '')
      } catch (e) {
        if (!cancelled) showApiError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId, dupId, showApiError])

  useEffect(() => {
    if (!slug && name) setSlug(slugify(name))
  }, [name, slug])

  function addVariantOption() {
    setVariants((v) => [...v, emptyVariant()])
  }

  function removeVariantOption(i: number) {
    setVariants((v) => v.filter((_, j) => j !== i))
  }

  function setVariantName(i: number, nameVal: string) {
    setVariants((v) => v.map((row, j) => (j === i ? { ...row, name: nameVal } : row)))
  }

  function addVariantValue(i: number, val: string) {
    const t = val.trim()
    if (!t) return
    setVariants((v) =>
      v.map((row, j) =>
        j === i ? { ...row, values: [...asVariantValueArray(row.values), t] } : row,
      ),
    )
  }

  function removeVariantValue(i: number, vi: number) {
    setVariants((v) =>
      v.map((row, j) =>
        j === i
          ? { ...row, values: asVariantValueArray(row.values).filter((_, k) => k !== vi) }
          : row,
      ),
    )
  }

  function buildVariantsPayload(): ProductVariantInput[] {
    if (!variantsEnabled) return []
    return variants
      .map((v) => ({
        name: v.name.trim().toLowerCase(),
        values: coerceVariantValues(v.values),
      }))
      .map((v) => ({ ...v, values: v.values.map((x) => x.trim()).filter(Boolean) }))
      .filter((v) => v.name && v.values.length > 0)
  }

  function buildSeo(): ProductSeoInput {
    return {
      slug: slug.trim() || slugify(name),
      metaTitle: metaTitle.trim() || name.trim(),
      metaDescription: metaDescription.trim(),
    }
  }

  function buildStatus(published: boolean): ProductStatusInput {
    return {
      isPublished: published,
      visibility,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    }
  }

  /** Keeps existing catalog media and merges optional extra media JSON (e.g. video URLs). */
  function mediaPayloadForJsonPatch(): unknown[] {
    const base = [...existingMedia]
    const raw = mediaJsonInput.trim()
    if (!raw) return base
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return [...base, ...parsed]
    } catch {
      /* ignore invalid JSON; base payload still saves */
    }
    return base
  }

  function buildProductFormData(published: boolean): FormData {
    const fd = new FormData()
    fd.set('name', name.trim())
    fd.set('description', description.trim())
    fd.set('brandId', brandId)
    fd.set('categoryId', categoryId)
    fd.set('basePrice', String(parseInrInputToRupees(basePriceRupees)))
    fd.set('discountPrice', String(parseInrInputToRupees(discountPriceRupees)))
    fd.set('hasSpecialDiscount', String(hasSpecialDiscount))
    if (discountExpiry) {
      fd.set('discountExpiry', new Date(discountExpiry + 'T12:00:00Z').toISOString())
    }
    fd.set('sku', sku.trim())
    fd.set('stockQuantity', String(Number.parseInt(stockQuantity, 10) || 0))
    fd.set('isOutOfStock', String(isOutOfStock))
    fd.set('variants', JSON.stringify(buildVariantsPayload()))
    fd.set('seo', JSON.stringify(buildSeo()))
    fd.set('status', JSON.stringify(buildStatus(published)))
    if (mediaJsonInput.trim()) {
      fd.set('mediaJson', mediaJsonInput.trim())
    }
    for (const file of mediaFiles.slice(0, 10)) {
      fd.append('media', file)
    }
    return fd
  }

  async function handleSubmit(mode: 'draft' | 'publish') {
    if (!token) {
      showToast('Sign in again to continue.', 'error')
      return
    }
    if (!name.trim()) {
      showToast('Product name is required.', 'error')
      return
    }
    if (!brandId || !categoryId) {
      showToast('Select a brand and category.', 'error')
      return
    }

    const published = mode === 'publish'
    setSaving(true)
    try {
      if (isEdit && productId) {
        if (mediaFiles.length > 0) {
          await updateProduct(token, productId, buildProductFormData(published))
        } else {
          const body: Record<string, unknown> = {
            name: name.trim(),
            description: description.trim(),
            brandId,
            categoryId,
            basePrice: parseInrInputToRupees(basePriceRupees),
            discountPrice: parseInrInputToRupees(discountPriceRupees),
            hasSpecialDiscount,
            discountExpiry: discountExpiry
              ? new Date(discountExpiry + 'T12:00:00Z').toISOString()
              : null,
            sku: sku.trim(),
            stockQuantity: Number.parseInt(stockQuantity, 10) || 0,
            isOutOfStock,
            media: mediaPayloadForJsonPatch(),
            variants: buildVariantsPayload(),
            seo: buildSeo(),
            status: buildStatus(published),
          }
          await updateProduct(token, productId, body)
        }
        showToast(published ? 'Product published' : 'Draft saved', 'success')
        navigate('/products')
      } else {
        const fd = buildProductFormData(published)
        await createProduct(token, fd)
        showToast(published ? 'Product published' : 'Draft saved', 'success')
        navigate('/products')
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  const ready =
    Boolean(name.trim() && brandId && categoryId && sku.trim() && buildSeo().slug)

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading product…
      </div>
    )
  }

  return (
    <div className="p-6 pb-36 text-slate-900 dark:text-slate-50 lg:p-10">
      <div className="mb-8">
        <Link
          to="/products"
          className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          ← Back to products
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          {isEdit ? 'Edit product' : 'Create New Product'}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Fill in the primary details and configurations for your new listing.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Basic information
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Product name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wireless Noise Cancelling Headphones"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Description
                </label>
                <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/80">
                    <span className="rounded px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Bold · Italic · List · Link
                    </span>
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write a detailed product description…"
                    rows={6}
                    className="w-full resize-y border-0 bg-white px-3 py-2 text-sm outline-none dark:bg-[#0f1419]"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Brand
                  </label>
                  <select
                    value={brandId}
                    onChange={(e) => setBrandId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">Select Brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Media &amp; gallery
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">Max 10 images</span>
            </div>
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 transition hover:border-blue-400/60 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-500/40">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const list = e.target.files ? [...e.target.files] : []
                  setMediaFiles((prev) => [...prev, ...list].slice(0, 10))
                }}
              />
              <svg className="mb-2 h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Click to upload or drag and drop
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                PNG, JPG or WebP (Max 5MB each)
              </span>
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {existingThumb && !mediaFiles.length ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-blue-500/50">
                  <img src={existingThumb} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 text-[9px] font-bold text-white">
                    MAIN
                  </span>
                </div>
              ) : null}
              {mediaFiles.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                >
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {i === 0 ? (
                    <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 text-[9px] font-bold text-white">
                      MAIN
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] text-white"
                    onClick={() => setMediaFiles((m) => m.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
                <span className="text-slate-400">+</span>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Extra media JSON (videos URLs, optional)
              </label>
              <textarea
                value={mediaJsonInput}
                onChange={(e) => setMediaJsonInput(e.target.value)}
                placeholder='[{"url":"https://...","type":"video","isPrimary":false}]'
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-slate-700 dark:bg-slate-900/80"
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Variants</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Enable</span>
                <Toggle
                  id={`${baseId}-var`}
                  checked={variantsEnabled}
                  onChange={setVariantsEnabled}
                  label="Enable variants"
                  hideLabel
                />
              </div>
            </div>
            {variantsEnabled ? (
              <div className="mt-4 space-y-5">
                {variants.map((opt, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <input
                        value={opt.name}
                        onChange={(e) => setVariantName(i, e.target.value)}
                        placeholder="Option name (e.g. SIZE)"
                        className="w-full max-w-xs rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold uppercase tracking-wide dark:border-slate-700 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => removeVariantOption(i)}
                        className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {asVariantValueArray(opt.values).map((val, vi) => (
                        <span
                          key={vi}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                        >
                          {val}
                          <button
                            type="button"
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            onClick={() => removeVariantValue(i, vi)}
                            aria-label="Remove value"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <VariantValueAdd
                        onAdd={(v) => addVariantValue(i, v)}
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addVariantOption}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                >
                  + Add another option
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              SEO optimization
            </h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  URL slug
                </label>
                <div className="mt-1 flex rounded-lg border border-slate-200 bg-slate-50 text-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <span className="shrink-0 border-r border-slate-200 px-3 py-2 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    mystore.com/products/
                  </span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Meta title
                </label>
                <input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Meta description
                </label>
                <textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="w-full shrink-0 space-y-6 lg:w-[320px]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pricing</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Base price
                </label>
                <div className="mt-1 flex rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                  <span className="border-r border-slate-200 px-3 py-2 text-slate-500 dark:border-slate-700">₹</span>
                  <input
                    value={basePriceRupees}
                    onChange={(e) => setBasePriceRupees(e.target.value)}
                    inputMode="decimal"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Discount price
                </label>
                <div className="mt-1 flex rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                  <span className="border-r border-slate-200 px-3 py-2 text-slate-500 dark:border-slate-700">₹</span>
                  <input
                    value={discountPriceRupees}
                    onChange={(e) => setDiscountPriceRupees(e.target.value)}
                    inputMode="decimal"
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <Toggle
                id={`${baseId}-spec`}
                checked={hasSpecialDiscount}
                onChange={setHasSpecialDiscount}
                label="Special discount"
                sub="LIMITED TIME OFFER"
              />
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Discount expiration
                </label>
                <input
                  type="date"
                  value={discountExpiry}
                  onChange={(e) => setDiscountExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Inventory</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">SKU code</label>
                <input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Stock quantity
                </label>
                <input
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <Toggle
                id={`${baseId}-oos`}
                checked={isOutOfStock}
                onChange={setIsOutOfStock}
                label="Mark as out of stock"
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Product status</h2>
            <div
              className={`mt-4 rounded-lg border p-3 ${
                ready
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-amber-500/40 bg-amber-500/10'
              }`}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {ready ? 'Ready to publish' : 'Missing required fields'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {ready
                  ? 'All mandatory fields are filled.'
                  : 'Name, brand, category, SKU, and slug are required.'}
              </p>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Visibility</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-sm font-medium text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
                >
                  <option value="public">Public</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Scheduled for</span>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="max-w-[10rem] rounded border border-slate-200 bg-white px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              {!scheduledAt ? (
                <p className="text-right text-xs text-slate-500 dark:text-slate-400">Now</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0a0c10]/95 lg:left-[260px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Discard changes
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit('draft')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={saving || !ready}
              onClick={() => void handleSubmit('publish')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
            >
              Publish Product
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VariantValueAdd({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 dark:border-slate-600">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onAdd(v)
            setV('')
          }
        }}
        placeholder="+ Add value"
        className="w-24 border-0 bg-transparent text-xs outline-none"
      />
      <button
        type="button"
        className="text-xs text-blue-600 dark:text-blue-400"
        onClick={() => {
          onAdd(v)
          setV('')
        }}
      >
        Add
      </button>
    </span>
  )
}

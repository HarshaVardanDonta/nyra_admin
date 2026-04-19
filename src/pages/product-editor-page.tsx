import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  fetchCatalogBrands,
  fetchCatalogCategories,
  fetchProductByKey,
  type CatalogBrand,
  type CatalogCategory,
  type CatalogProductRow,
} from '../lib/api/catalog'
import {
  fetchFAQs,
  fetchProductFAQs,
  putProductFAQs,
  type FAQ,
  type ProductFAQWriteItem,
} from '../lib/api/faqs'
import { fetchHazards, type Hazard } from '../lib/api/hazards'
import {
  createProduct,
  normalizeProductMediaForApi,
  parseInrInputToRupees,
  rupeesToFormString,
  updateProduct,
  type ProductSeoInput,
  type ProductStatusInput,
  type ProductVariantInput,
} from '../lib/api/products'
import { resolveMediaUrl } from '../lib/media-url'
import {
  APPLICATION_GUIDE_COLUMN_LABELS,
  emptyApplicationGuideRow,
  emptyProductDescriptionV1,
  parseProductDescription,
  serializeProductDescriptionV1,
  type ApplicationGuideRow,
  type ProductDescriptionV1,
} from '../lib/productDescription'
import { AdminDateField, AdminDateTimeField } from '../components/admin-date-field'

const MAX_MEDIA_FILES = 10
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type PendingProductMedia = {
  id: string
  file: File
  objectUrl: string
}

function createPendingProductMedia(file: File): PendingProductMedia {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `pm-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  return { id, file, objectUrl: URL.createObjectURL(file) }
}

/** Clone media row and set isPrimary (clears PascalCase duplicate for JSON). */
function patchMediaItemPrimary(item: unknown, isPrimary: boolean): unknown {
  if (!item || typeof item !== 'object') return item
  const o = { ...(item as Record<string, unknown>) }
  o.isPrimary = isPrimary
  delete o.IsPrimary
  return o
}

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
  return { name: '', values: [], defaultValue: '', valuePriceAdjustments: {} }
}

function sanitizeValuePriceAdjustments(
  m: Record<string, number> | undefined,
): Record<string, number> {
  if (!m || typeof m !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, n] of Object.entries(m)) {
    if (typeof n === 'number' && Number.isFinite(n)) out[k] = n
  }
  return out
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

/** Minimum total Δ ₹ across all variant value combinations (for price floor checks). */
function minAdjustmentSumAcrossCombinations(rows: ProductVariantInput[]): number {
  if (rows.length === 0) return 0
  let minSum = Infinity
  function walk(i: number, acc: number) {
    if (i === rows.length) {
      minSum = Math.min(minSum, acc)
      return
    }
    const vals = coerceVariantValues(rows[i].values)
      .map((x) => x.trim())
      .filter(Boolean)
    const adjMap = rows[i].valuePriceAdjustments ?? {}
    for (const val of vals) {
      const n = adjMap[val]
      const delta = typeof n === 'number' && Number.isFinite(n) ? n : 0
      walk(i + 1, acc + delta)
    }
  }
  walk(0, 0)
  return minSum === Infinity ? 0 : minSum
}

function variantPriceAdjustmentErrorMessage(
  baseRupees: number,
  discountRupees: number,
  variantPayload: ProductVariantInput[],
): string | null {
  if (variantPayload.length === 0) return null
  const minSum = minAdjustmentSumAcrossCombinations(variantPayload)
  if (baseRupees + minSum < 0) {
    return 'Variant Δ ₹ would make the base price negative for some combinations. Reduce negative deltas or increase the base price.'
  }
  if (discountRupees + minSum < 0) {
    return 'Variant Δ ₹ would make the sale price negative for some combinations. Reduce negative deltas or increase the discount price.'
  }
  return null
}

const APPLICATION_GUIDE_KEYS: (keyof ApplicationGuideRow)[] = [
  'targetContext',
  'dosageDensity',
  'applicationMethod',
  'interval',
  'technicalSpecs',
]

function taxRateToPercentString(r: number | null | undefined): string {
  if (r == null || !Number.isFinite(r)) return ''
  const pct = r <= 1 ? r * 100 : r
  const rounded = Math.round(pct * 1e6) / 1e6
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function mapProductToForm(p: CatalogProductRow) {
  const variants: ProductVariantInput[] = Array.isArray(p.variants)
    ? p.variants.map((v) => ({
        name: typeof v?.name === 'string' ? v.name : '',
        values: coerceVariantValues(v?.values),
        defaultValue:
          typeof v?.defaultValue === 'string' ? v.defaultValue : '',
        valuePriceAdjustments: sanitizeValuePriceAdjustments(
          v?.valuePriceAdjustments,
        ),
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
    productTaxOverride: Boolean(
      (p.taxComponents && p.taxComponents.length > 0) ||
        (p.taxRate != null && p.taxRate !== undefined),
    ),
    taxRows:
      p.taxComponents && p.taxComponents.length
        ? p.taxComponents.map((c, i) => ({
            id: `tc-${i}`,
            label: c.label,
            percentStr: taxRateToPercentString(c.rate),
          }))
        : p.taxRate != null && p.taxRate !== undefined
          ? [{ id: 'legacy', label: 'GST', percentStr: taxRateToPercentString(p.taxRate) }]
          : [
              { id: 'a', label: 'CGST', percentStr: '9' },
              { id: 'b', label: 'SGST', percentStr: '9' },
            ],
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
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const pendingMediaRef = useRef<PendingProductMedia[]>([])

  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(isEdit || Boolean(dupId))
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [descDoc, setDescDoc] = useState<ProductDescriptionV1>(() => emptyProductDescriptionV1())
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
    {
      name: 'size',
      values: ['Small', 'Medium', 'Large'],
      defaultValue: '',
      valuePriceAdjustments: {},
    },
    {
      name: 'color',
      values: ['Midnight Black', 'Arctic White'],
      defaultValue: '',
      valuePriceAdjustments: {},
    },
  ])
  const [slug, setSlug] = useState('')
  const [metaTitle, setMetaTitle] = useState('')
  const [metaDescription, setMetaDescription] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [scheduledAt, setScheduledAt] = useState('')
  const [productTaxOverride, setProductTaxOverride] = useState(false)
  const [taxRows, setTaxRows] = useState<
    { id: string; label: string; percentStr: string }[]
  >([
    { id: 'a', label: 'CGST', percentStr: '9' },
    { id: 'b', label: 'SGST', percentStr: '9' },
  ])
  const [pendingMedia, setPendingMedia] = useState<PendingProductMedia[]>([])
  const [mediaJsonInput, setMediaJsonInput] = useState('')
  const [existingMedia, setExistingMedia] = useState<unknown[]>([])
  const [existingThumb, setExistingThumb] = useState('')

  const [hazards, setHazards] = useState<Hazard[]>([])
  const [hazardsLoading, setHazardsLoading] = useState(false)

  const [faqBank, setFaqBank] = useState<FAQ[]>([])
  const [faqLoading, setFaqLoading] = useState(false)
  const [faqSearch, setFaqSearch] = useState('')
  const [productFaqs, setProductFaqs] = useState<
    (
      | { kind: 'universal'; faqId: string }
      | { kind: 'custom'; id: string; question: string; answer: string }
    )[]
  >([])

  pendingMediaRef.current = pendingMedia

  const loadMeta = useCallback(async () => {
    const [b, c] = await Promise.all([fetchCatalogBrands(), fetchCatalogCategories()])
    setBrands(b)
    setCategories(c)
  }, [])

  useEffect(() => {
    void loadMeta().catch((e) => showApiError(e))
  }, [loadMeta, showApiError])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setFaqLoading(true)
      try {
        const { faqs } = await fetchFAQs(token, { limit: 500, offset: 0 })
        if (!cancelled) setFaqBank(faqs)
      } catch (e) {
        if (!cancelled) showApiError(e)
      } finally {
        if (!cancelled) setFaqLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, showApiError])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      setHazardsLoading(true)
      try {
        const { hazards } = await fetchHazards(token, { limit: 500, offset: 0 })
        if (!cancelled) setHazards(hazards)
      } catch (e) {
        if (!cancelled) showApiError(e)
      } finally {
        if (!cancelled) setHazardsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, showApiError])

  useEffect(() => {
    const key = dupId ?? productId
    if (!key) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const p = await fetchProductByKey(token, key)
        if (cancelled) return
        const f = mapProductToForm(p)
        setName(dupId ? `${f.name} (copy)` : f.name)
        {
          const parsed = parseProductDescription(f.description)
          if (parsed.kind === 'plain') {
            setDescDoc({
              ...emptyProductDescriptionV1(),
              detailedDescription: parsed.text,
            })
          } else {
            setDescDoc(parsed.doc)
          }
        }
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
        setProductTaxOverride(f.productTaxOverride)
        setTaxRows(f.taxRows)
        setExistingMedia(Array.isArray(p.media) ? p.media : [])
        setExistingThumb(p.thumbnailUrl ? resolveMediaUrl(p.thumbnailUrl) : '')

        if (token && key.startsWith('prd_')) {
          try {
            const { items } = await fetchProductFAQs(token, key)
            if (!cancelled) {
              const mapped: ({ kind: 'universal'; faqId: string } | { kind: 'custom'; id: string; question: string; answer: string })[] =
                items.map((it, i) => {
                  if (it.faqId) return { kind: 'universal', faqId: it.faqId }
                  return {
                    kind: 'custom',
                    id: `${baseId}-pf-${i}`,
                    question: it.question ?? '',
                    answer: it.answer ?? '',
                  }
                })
              setProductFaqs(mapped)
            }
          } catch (e) {
            if (!cancelled) showApiError(e)
          }
        } else if (!cancelled) {
          setProductFaqs([])
        }
      } catch (e) {
        if (!cancelled) showApiError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productId, dupId, token, baseId, showApiError])

  useEffect(() => {
    setPendingMedia((prev) => {
      for (const p of prev) {
        URL.revokeObjectURL(p.objectUrl)
      }
      return []
    })
  }, [productId, dupId])

  useEffect(() => {
    return () => {
      for (const p of pendingMediaRef.current) {
        URL.revokeObjectURL(p.objectUrl)
      }
    }
  }, [])

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

  function setVariantDefaultValue(i: number, defaultVal: string) {
    setVariants((v) =>
      v.map((row, j) => (j === i ? { ...row, defaultValue: defaultVal } : row)),
    )
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
      v.map((row, j) => {
        if (j !== i) return row
        const vals = asVariantValueArray(row.values)
        const removed = vals[vi]
        const nextVals = vals.filter((_, k) => k !== vi)
        let nextDefault = row.defaultValue ?? ''
        if (nextDefault === removed) nextDefault = ''
        const adj = { ...(row.valuePriceAdjustments ?? {}) }
        delete adj[removed]
        return {
          ...row,
          values: nextVals,
          defaultValue: nextDefault,
          valuePriceAdjustments: adj,
        }
      }),
    )
  }

  function setVariantValuePrice(
    i: number,
    valueStr: string,
    raw: string,
  ) {
    const t = raw.trim()
    const n = t === '' || t === '-' ? null : Number.parseFloat(t)
    setVariants((v) =>
      v.map((row, j) => {
        if (j !== i) return row
        const adj = { ...(row.valuePriceAdjustments ?? {}) }
        if (n === null || !Number.isFinite(n) || n === 0) {
          delete adj[valueStr]
        } else {
          adj[valueStr] = Math.round(n)
        }
        return { ...row, valuePriceAdjustments: adj }
      }),
    )
  }

  function buildVariantsPayload(): ProductVariantInput[] {
    if (!variantsEnabled) return []
    return variants
      .map((v) => {
        const values = coerceVariantValues(v.values)
          .map((x) => x.trim())
          .filter(Boolean)
        const name = v.name.trim().toLowerCase()
        let dv = (v.defaultValue ?? '').trim()
        if (dv && !values.includes(dv)) dv = ''
        const row: ProductVariantInput = { name, values }
        if (dv) row.defaultValue = dv
        const srcAdj = v.valuePriceAdjustments ?? {}
        const adj: Record<string, number> = {}
        for (const val of values) {
          const n = srcAdj[val]
          if (typeof n === 'number' && Number.isFinite(n) && n !== 0) {
            adj[val] = Math.round(n)
          }
        }
        if (Object.keys(adj).length) row.valuePriceAdjustments = adj
        return row
      })
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
    fd.set('description', serializeProductDescriptionV1(descDoc))
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
    const mergedMedia = normalizeProductMediaForApi(mediaPayloadForJsonPatch())
    if (mergedMedia.length > 0) {
      fd.set('mediaJson', JSON.stringify(mergedMedia))
    }
    for (const { file } of pendingMedia.slice(0, MAX_MEDIA_FILES)) {
      fd.append('media', file)
    }
    if (productTaxOverride) {
      const comps: { label: string; rate: number }[] = []
      for (const row of taxRows) {
        const label = row.label.trim() || 'Tax'
        const t = row.percentStr.trim().replace(/%/g, '')
        if (!t) continue
        const n = Number.parseFloat(t.replace(/[^0-9.-]/g, ''))
        if (!Number.isFinite(n) || n < 0 || n > 100) continue
        comps.push({ label, rate: n / 100 })
      }
      if (comps.length > 0) {
        fd.set('taxComponents', JSON.stringify(comps))
      }
    }
    return fd
  }

  const variantPriceError = useMemo(() => {
    if (!variantsEnabled) return null
    const payload = buildVariantsPayload()
    if (payload.length === 0) return null
    const baseRupees = parseInrInputToRupees(basePriceRupees)
    const discountRupees = parseInrInputToRupees(discountPriceRupees)
    return variantPriceAdjustmentErrorMessage(baseRupees, discountRupees, payload)
  }, [variantsEnabled, variants, basePriceRupees, discountPriceRupees])

  const attachedUniversalFAQIDs = useMemo(() => {
    return new Set(productFaqs.filter((x) => x.kind === 'universal').map((x) => x.faqId))
  }, [productFaqs])

  const filteredFAQBank = useMemo(() => {
    const q = faqSearch.trim().toLowerCase()
    if (!q) return faqBank
    return faqBank.filter((f) => {
      return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
    })
  }, [faqBank, faqSearch])

  function toggleUniversalFAQ(faqId: string) {
    setProductFaqs((prev) => {
      const idx = prev.findIndex((x) => x.kind === 'universal' && x.faqId === faqId)
      if (idx >= 0) return prev.filter((_, i) => i !== idx)
      return [...prev, { kind: 'universal', faqId }]
    })
  }

  function addCustomFAQ() {
    setProductFaqs((prev) => [
      ...prev,
      { kind: 'custom', id: `${baseId}-cfaq-${Date.now()}`, question: '', answer: '' },
    ])
  }

  function moveFAQ(from: number, dir: -1 | 1) {
    setProductFaqs((prev) => {
      const to = from + dir
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const tmp = next[from]
      next[from] = next[to]
      next[to] = tmp
      return next
    })
  }

  function removeFAQ(index: number) {
    setProductFaqs((prev) => prev.filter((_, i) => i !== index))
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
    if (variantPriceError) {
      showToast(variantPriceError, 'error')
      return
    }
    if (productTaxOverride) {
      let sum = 0
      for (const row of taxRows) {
        const t = row.percentStr.trim().replace(/%/g, '')
        if (!t) {
          showToast('Fill each tax row percent or remove the row.', 'error')
          return
        }
        const n = Number.parseFloat(t.replace(/[^0-9.-]/g, ''))
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          showToast('Each tax percent must be between 0 and 100.', 'error')
          return
        }
        sum += n
      }
      if (taxRows.length === 0) {
        showToast('Add at least one tax component or turn off override.', 'error')
        return
      }
      if (sum > 100.0001) {
        showToast('Sum of tax percents cannot exceed 100%.', 'error')
        return
      }
    }

    const published = mode === 'publish'
    setSaving(true)
    try {
      const productFaqPayload: ProductFAQWriteItem[] = productFaqs.map((it) => {
        if (it.kind === 'universal') return { faqId: it.faqId }
        return { question: it.question, answer: it.answer }
      })

      if (isEdit && productId) {
        // Multipart only: this backend matches the working Postman/curl flow; JSON PATCH can fail silently.
        await updateProduct(token, productId, buildProductFormData(published))
        await putProductFAQs(token, productId, productFaqPayload)
        showToast(published ? 'Product published' : 'Draft saved', 'success')
        navigate('/products')
      } else {
        const fd = buildProductFormData(published)
        const created = await createProduct(token, fd)
        const newId = typeof created?.id === 'string' ? created.id : ''
        if (newId) {
          await putProductFAQs(token, newId, productFaqPayload)
        }
        showToast(published ? 'Product published' : 'Draft saved', 'success')
        navigate('/products')
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  const baseReady = Boolean(
    name.trim() && brandId && categoryId && sku.trim() && buildSeo().slug,
  )
  const ready = baseReady && !variantPriceError

  const addMediaFilesFromList = useCallback((files: File[]) => {
    const next: PendingProductMedia[] = []
    for (const f of files) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type)) continue
      if (f.size > MAX_IMAGE_BYTES) continue
      next.push(createPendingProductMedia(f))
    }
    if (next.length === 0) return
    setPendingMedia((prev) => {
      const merged = [...prev, ...next]
      if (merged.length <= MAX_MEDIA_FILES) return merged
      const overflow = merged.slice(MAX_MEDIA_FILES)
      for (const o of overflow) {
        URL.revokeObjectURL(o.objectUrl)
      }
      return merged.slice(0, MAX_MEDIA_FILES)
    })
  }, [])

  const removePendingMedia = useCallback((id: string) => {
    setPendingMedia((prev) => {
      const row = prev.find((p) => p.id === id)
      if (row) URL.revokeObjectURL(row.objectUrl)
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const setExistingMediaPrimaryAt = useCallback((index: number) => {
    setExistingMedia((prev) =>
      prev.map((item, j) => {
        const norm = normalizeProductMediaForApi([item])[0]
        if (!norm) return item
        if (norm.type.toLowerCase() === 'video') {
          return patchMediaItemPrimary(item, false)
        }
        return patchMediaItemPrimary(item, j === index)
      }),
    )
  }, [])

  /** Clears primary on saved media and moves this upload first so the backend marks it primary (see multipart handler). */
  const makePendingMediaPrimary = useCallback((id: string) => {
    setExistingMedia((prev) => prev.map((item) => patchMediaItemPrimary(item, false)))
    setPendingMedia((prev) => {
      const idx = prev.findIndex((p) => p.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      const [row] = next.splice(idx, 1)
      next.unshift(row)
      return next
    })
  }, [])

  const openMediaPicker = useCallback(() => {
    mediaInputRef.current?.click()
  }, [])

  const onMediaDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onMediaDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const list = e.dataTransfer.files?.length ? [...e.dataTransfer.files] : []
      addMediaFilesFromList(list)
    },
    [addMediaFilesFromList],
  )

  /** True when mediaJson already marks a saved item as primary (first new file is only primary if this is false). */
  const existingJsonHasPrimary = useMemo(
    () => normalizeProductMediaForApi(existingMedia).some((m) => m.isPrimary),
    [existingMedia],
  )

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading product…
      </div>
    )
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-36 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
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

      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
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
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Product description
                  </label>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Structured sections are saved as JSON in the description field for the storefront.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Detailed description
                  </label>
                  <textarea
                    value={descDoc.detailedDescription}
                    onChange={(e) =>
                      setDescDoc((d) => ({ ...d, detailedDescription: e.target.value }))
                    }
                    placeholder="Write the main product copy…"
                    rows={6}
                    className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-slate-700 dark:bg-[#0f1419]"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Composition
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setDescDoc((d) => {
                            const texts = [...(d.composition?.texts ?? [])]
                            texts.push('')
                            return {
                              ...d,
                              composition: {
                                ...(d.composition ?? { texts: [], hazardKey: '' }),
                                texts,
                              },
                            }
                          })
                        }
                        className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        + Add line
                      </button>
                    </div>
                    <div className="mt-1 space-y-2">
                      {(descDoc.composition?.texts?.length ? descDoc.composition.texts : ['']).map((t, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={t}
                            onChange={(e) =>
                              setDescDoc((d) => {
                                const base =
                                  d.composition?.texts?.length ? [...d.composition.texts] : ['']
                                base[i] = e.target.value
                                return {
                                  ...d,
                                  composition: {
                                    ...(d.composition ?? { texts: [], hazardKey: '' }),
                                    texts: base,
                                  },
                                }
                              })
                            }
                            placeholder="e.g. Chlorantraniliprole 18.50% SC"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setDescDoc((d) => {
                                const base =
                                  d.composition?.texts?.length ? [...d.composition.texts] : ['']
                                const texts = base.filter((_, j) => j !== i)
                                return {
                                  ...d,
                                  composition: {
                                    ...(d.composition ?? { texts: [], hazardKey: '' }),
                                    texts,
                                  },
                                }
                              })
                            }
                            className="shrink-0 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Hazard
                    </label>
                    <select
                      value={descDoc.composition?.hazardKey ?? ''}
                      onChange={(e) =>
                        setDescDoc((d) => ({
                          ...d,
                          composition: {
                            ...(d.composition ?? { texts: [], hazardKey: '' }),
                            hazardKey: e.target.value,
                          },
                        }))
                      }
                      className="select-tail mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      disabled={hazardsLoading}
                    >
                      <option value="">None</option>
                      {descDoc.composition?.hazardKey &&
                      !hazards.some((h) => h.key === descDoc.composition?.hazardKey) ? (
                        <option value={descDoc.composition?.hazardKey}>
                          Unknown ({descDoc.composition?.hazardKey})
                        </option>
                      ) : null}
                      {hazards
                        .filter((h) => h.isActive)
                        .sort((a, b) => a.label.localeCompare(b.label))
                        .map((h) => (
                          <option key={h.id} value={h.key}>
                            {h.label}
                          </option>
                        ))}
                    </select>
                    {descDoc.composition?.hazardKey ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span
                          className="inline-block h-4 w-4 rounded border border-slate-200 dark:border-slate-700"
                          style={{
                            backgroundColor:
                              hazards.find((h) => h.key === descDoc.composition?.hazardKey)?.color ??
                              'transparent',
                          }}
                          aria-hidden
                        />
                        <span className="truncate">
                          {hazards.find((h) => h.key === descDoc.composition?.hazardKey)?.label ??
                            descDoc.composition?.hazardKey}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Application guide
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDescDoc((d) => ({
                          ...d,
                          applicationGuide: {
                            rows: [...d.applicationGuide.rows, emptyApplicationGuideRow()],
                          },
                        }))
                      }
                      className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                    >
                      + Add row
                    </button>
                  </div>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full min-w-[720px] border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                          {APPLICATION_GUIDE_COLUMN_LABELS.map((h) => (
                            <th
                              key={h}
                              className="px-2 py-2 text-left font-semibold text-slate-700 dark:text-slate-200"
                            >
                              {h}
                            </th>
                          ))}
                          <th className="w-10 px-1 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {descDoc.applicationGuide.rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-4 text-center text-slate-500 dark:text-slate-400"
                            >
                              No rows yet. Use “Add row”.
                            </td>
                          </tr>
                        ) : (
                          descDoc.applicationGuide.rows.map((row, ri) => (
                            <tr
                              key={ri}
                              className="border-b border-slate-100 dark:border-slate-800"
                            >
                              {APPLICATION_GUIDE_KEYS.map((key) => (
                                <td key={key} className="p-1 align-top">
                                  <input
                                    value={row[key]}
                                    onChange={(e) =>
                                      setDescDoc((d) => {
                                        const rows = [...d.applicationGuide.rows]
                                        rows[ri] = { ...rows[ri], [key]: e.target.value }
                                        return { ...d, applicationGuide: { rows } }
                                      })
                                    }
                                    className="w-full min-w-[100px] rounded border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                                  />
                                </td>
                              ))}
                              <td className="p-1 align-top">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDescDoc((d) => ({
                                      ...d,
                                      applicationGuide: {
                                        rows: d.applicationGuide.rows.filter((_, j) => j !== ri),
                                      },
                                    }))
                                  }
                                  className="text-xs font-medium text-red-600 dark:text-red-400"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      How to grow
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDescDoc((d) => ({
                          ...d,
                          howToGrow: [...d.howToGrow, { title: '', detail: '' }],
                        }))
                      }
                      className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                    >
                      + Add step
                    </button>
                  </div>
                  <div className="mt-2 space-y-3">
                    {descDoc.howToGrow.map((step, si) => (
                      <div
                        key={si}
                        className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            Step {si + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDescDoc((d) => ({
                                ...d,
                                howToGrow: d.howToGrow.filter((_, j) => j !== si),
                              }))
                            }
                            className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          value={step.title}
                          onChange={(e) =>
                            setDescDoc((d) => {
                              const howToGrow = [...d.howToGrow]
                              howToGrow[si] = { ...howToGrow[si], title: e.target.value }
                              return { ...d, howToGrow }
                            })
                          }
                          placeholder="Step title"
                          className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                        <textarea
                          value={step.detail}
                          onChange={(e) =>
                            setDescDoc((d) => {
                              const howToGrow = [...d.howToGrow]
                              howToGrow[si] = { ...howToGrow[si], detail: e.target.value }
                              return { ...d, howToGrow }
                            })
                          }
                          placeholder="Details"
                          rows={2}
                          className="mt-2 w-full resize-y rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Technical specifications
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDescDoc((d) => ({
                          ...d,
                          technicalSpecs: [...d.technicalSpecs, { label: '', value: '' }],
                        }))
                      }
                      className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
                    >
                      + Add field
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {descDoc.technicalSpecs.map((spec, ti) => (
                      <div key={ti} className="flex flex-wrap items-center gap-2">
                        <input
                          value={spec.label}
                          onChange={(e) =>
                            setDescDoc((d) => {
                              const technicalSpecs = [...d.technicalSpecs]
                              technicalSpecs[ti] = {
                                ...technicalSpecs[ti],
                                label: e.target.value,
                              }
                              return { ...d, technicalSpecs }
                            })
                          }
                          placeholder="Label"
                          className="min-w-[120px] flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                        <input
                          value={spec.value}
                          onChange={(e) =>
                            setDescDoc((d) => {
                              const technicalSpecs = [...d.technicalSpecs]
                              technicalSpecs[ti] = {
                                ...technicalSpecs[ti],
                                value: e.target.value,
                              }
                              return { ...d, technicalSpecs }
                            })
                          }
                          placeholder="Value"
                          className="min-w-[120px] flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDescDoc((d) => ({
                              ...d,
                              technicalSpecs: d.technicalSpecs.filter((_, j) => j !== ti),
                            }))
                          }
                          className="text-xs font-medium text-red-600 dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
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
                    className="select-tail mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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
                    className="select-tail mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">FAQs</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Append universal FAQs and add custom product-specific FAQs. Product FAQs show first, then universal.
                </p>
              </div>
              <button
                type="button"
                onClick={addCustomFAQ}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                + Custom FAQ
              </button>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Universal FAQ bank
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {faqLoading ? 'Loading…' : `${faqBank.length} total`}
                  </span>
                </div>
                <input
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Search FAQs…"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <div className="mt-3 max-h-[320px] overflow-y-auto pr-1">
                  {filteredFAQBank.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No FAQs match your search.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFAQBank.map((f) => {
                        const checked = attachedUniversalFAQIDs.has(f.id)
                        return (
                          <label
                            key={f.id}
                            className={[
                              'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition',
                              checked
                                ? 'border-blue-500/40 bg-blue-600/5'
                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-900',
                            ].join(' ')}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleUniversalFAQ(f.id)}
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                                {f.question}
                              </div>
                              <div className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
                                {f.answer}
                              </div>
                              {!f.isPublished ? (
                                <div className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                  Draft (won’t show on storefront)
                                </div>
                              ) : null}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#0b1220]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Appended to this product
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{productFaqs.length} items</div>
                </div>
                <div className="mt-3 space-y-3">
                  {productFaqs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nothing appended yet.
                    </div>
                  ) : (
                    productFaqs.map((it, i) => (
                      <div
                        key={it.kind === 'universal' ? it.faqId : it.id}
                        className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {it.kind === 'universal' ? 'Universal' : 'Custom'} · #{i + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => moveFAQ(i, -1)}
                              className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                              title="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              onClick={() => moveFAQ(i, 1)}
                              className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                              title="Move down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFAQ(i)}
                              className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/30"
                              title="Remove"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {it.kind === 'universal' ? (
                          <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                            {faqBank.find((f) => f.id === it.faqId)?.question ?? it.faqId}
                          </div>
                        ) : (
                          <div className="mt-2 space-y-2">
                            <input
                              value={it.question}
                              onChange={(e) =>
                                setProductFaqs((prev) =>
                                  prev.map((x, j) =>
                                    j === i && x.kind === 'custom' ? { ...x, question: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="Question"
                              className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                            <textarea
                              value={it.answer}
                              onChange={(e) =>
                                setProductFaqs((prev) =>
                                  prev.map((x, j) =>
                                    j === i && x.kind === 'custom' ? { ...x, answer: e.target.value } : x,
                                  ),
                                )
                              }
                              placeholder="Answer"
                              rows={3}
                              className="w-full resize-y rounded border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Media &amp; gallery
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Max {MAX_MEDIA_FILES} new uploads per save
              </span>
            </div>
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              tabIndex={-1}
              className="sr-only"
              aria-hidden
              onChange={(e) => {
                const list = e.target.files ? [...e.target.files] : []
                addMediaFilesFromList(list)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={openMediaPicker}
              onDragOver={onMediaDragOver}
              onDrop={onMediaDrop}
              className="mt-4 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-left transition hover:border-blue-400/60 hover:bg-blue-50/30 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-blue-500/40"
            >
              <svg className="mb-2 h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Click to upload or drag and drop
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                PNG, JPG or WebP (Max 5MB each)
              </span>
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {existingMedia.map((item, i) => {
                const norm = normalizeProductMediaForApi([item])[0]
                if (!norm) return null
                const src = resolveMediaUrl(norm.url)
                const isVideo = norm.type.toLowerCase() === 'video'
                return (
                  <div
                    key={`existing-${i}-${norm.url}`}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    {isVideo ? (
                      <div className="flex h-full w-full items-center justify-center bg-slate-800 text-center text-[10px] font-medium text-white">
                        Video
                      </div>
                    ) : (
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    )}
                    {norm.isPrimary ? (
                      <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 text-[9px] font-bold text-white">
                        MAIN
                      </span>
                    ) : null}
                    {!isVideo && !norm.isPrimary ? (
                      <button
                        type="button"
                        className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5 text-[9px] font-semibold text-white hover:bg-black/80"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setExistingMediaPrimaryAt(i)
                        }}
                      >
                        Set main
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Remove from gallery"
                      className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-black/75"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setExistingMedia((m) => m.filter((_, j) => j !== i))
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {existingMedia.length === 0 && existingThumb ? (
                <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-blue-500/50">
                  <img src={existingThumb} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 text-[9px] font-bold text-white">
                    MAIN
                  </span>
                  <button
                    type="button"
                    aria-label="Remove thumbnail"
                    className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-black/75"
                    onClick={() => setExistingThumb('')}
                  >
                    ×
                  </button>
                </div>
              ) : null}
              {pendingMedia.map((p, i) => {
                const pendingIsMain = i === 0 && !existingJsonHasPrimary
                return (
                  <div
                    key={p.id}
                    className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <img
                      src={p.objectUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {pendingIsMain ? (
                      <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 text-[9px] font-bold text-white">
                        MAIN
                      </span>
                    ) : null}
                    {!pendingIsMain ? (
                      <button
                        type="button"
                        className="absolute bottom-0 left-0 right-0 bg-black/65 py-0.5 text-[9px] font-semibold text-white hover:bg-black/80"
                        onClick={() => makePendingMediaPrimary(p.id)}
                      >
                        Set main
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Remove image"
                      className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-black/75"
                      onClick={() => removePendingMedia(p.id)}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
              {pendingMedia.length < MAX_MEDIA_FILES ? (
                <button
                  type="button"
                  onClick={openMediaPicker}
                  className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-blue-400/60 hover:bg-blue-50/40 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-blue-500/40 dark:hover:text-blue-400"
                  aria-label="Add images"
                >
                  <span className="text-xl font-light leading-none">+</span>
                </button>
              ) : null}
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
            {variantPriceError ? (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
              >
                {variantPriceError}
              </div>
            ) : null}
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
                    <div className="mt-2 space-y-2">
                      {asVariantValueArray(opt.values).map((val, vi) => {
                        const delta = opt.valuePriceAdjustments?.[val]
                        return (
                          <div
                            key={`${val}-${vi}`}
                            className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800/80"
                          >
                            <span className="min-w-0 flex-1 text-xs font-medium text-slate-800 dark:text-slate-100">
                              {val}
                            </span>
                            <label className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                              Δ ₹
                              <input
                                type="number"
                                step={1}
                                placeholder="0"
                                value={
                                  delta === undefined || delta === 0
                                    ? ''
                                    : String(delta)
                                }
                                onChange={(e) =>
                                  setVariantValuePrice(i, val, e.target.value)
                                }
                                className="w-20 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs tabular-nums dark:border-slate-600 dark:bg-slate-900"
                              />
                            </label>
                            <button
                              type="button"
                              className="shrink-0 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                              onClick={() => removeVariantValue(i, vi)}
                              aria-label="Remove value"
                            >
                              ×
                            </button>
                          </div>
                        )
                      })}
                      <VariantValueAdd
                        onAdd={(v) => addVariantValue(i, v)}
                      />
                    </div>
                    {asVariantValueArray(opt.values).length > 0 ? (
                      <div className="mt-3">
                        <label
                          htmlFor={`${baseId}-var-def-${i}`}
                          className="text-xs font-medium text-slate-500 dark:text-slate-400"
                        >
                          Default for quick add (storefront)
                        </label>
                        <select
                          id={`${baseId}-var-def-${i}`}
                          value={opt.defaultValue ?? ''}
                          onChange={(e) => setVariantDefaultValue(i, e.target.value)}
                          className="mt-1 w-full max-w-xs rounded border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                        >
                          <option value="">First value in list</option>
                          {asVariantValueArray(opt.values).map((val) => (
                            <option key={val} value={val}>
                              {val}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
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

        <div className="w-full min-w-0 shrink-0 space-y-6 lg:w-[320px]">
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
                <div className="mt-1">
                  <AdminDateField
                    value={discountExpiry}
                    onChange={setDiscountExpiry}
                    className="dark:bg-slate-900"
                  />
                </div>
              </div>
              <Toggle
                id={`${baseId}-tax-ov`}
                checked={productTaxOverride}
                onChange={setProductTaxOverride}
                label="Override store tax structure"
                sub="CGST / SGST / IGST rows"
              />
              {productTaxOverride ? (
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Components</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTaxRows((r) => [
                          ...r,
                          { id: `${baseId}-tx-${Date.now()}`, label: '', percentStr: '' },
                        ])
                      }
                      className="text-xs font-medium text-blue-600 dark:text-blue-400"
                    >
                      + Add
                    </button>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {taxRows.map((row, i) => (
                      <li key={row.id} className="flex flex-wrap items-end gap-2">
                        <input
                          value={row.label}
                          onChange={(e) =>
                            setTaxRows((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                            )
                          }
                          placeholder="Label"
                          className="min-w-[88px] flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                        />
                        <input
                          value={row.percentStr}
                          onChange={(e) =>
                            setTaxRows((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, percentStr: e.target.value } : x)),
                            )
                          }
                          placeholder="%"
                          inputMode="decimal"
                          className="w-16 rounded border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => setTaxRows((prev) => prev.filter((_, j) => j !== i))}
                          disabled={taxRows.length <= 1}
                          className="text-xs text-slate-500 disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                    Uncheck override to use store default. Sum of percents must be ≤ 100%.
                  </p>
                </div>
              ) : null}
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
                  : variantPriceError && baseReady
                    ? 'border-red-500/40 bg-red-500/10'
                    : 'border-amber-500/40 bg-amber-500/10'
              }`}
            >
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {ready
                  ? 'Ready to publish'
                  : !baseReady
                    ? 'Missing required fields'
                    : variantPriceError ?? 'Cannot save'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {ready
                  ? 'All mandatory fields are filled.'
                  : !baseReady
                    ? 'Name, brand, category, SKU, and slug are required.'
                    : variantPriceError
                      ? 'Adjust base or discount price, or reduce negative Δ ₹ on variants, so the lowest combination is not below zero.'
                      : ''}
              </p>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Visibility</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="select-tail rounded border border-slate-200 bg-white px-2 py-0.5 text-sm font-medium text-blue-600 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-400"
                >
                  <option value="public">Public</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">Scheduled for</span>
                <AdminDateTimeField
                  value={scheduledAt}
                  onChange={setScheduledAt}
                  placeholder="Now"
                  className="max-w-[12rem] shrink-0 rounded border border-slate-200 px-1 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 w-full border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0a0c10]/95">
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
            {!isEdit ? (
              <button
                type="button"
                disabled={saving || !!variantPriceError}
                onClick={() => void handleSubmit('draft')}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Save Draft
              </button>
            ) : null}
            <button
              type="button"
              disabled={saving || !ready}
              onClick={() => void handleSubmit('publish')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
            >
              {isEdit ? 'Save changes' : 'Publish Product'}
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

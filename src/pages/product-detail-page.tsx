import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchProductByKey, type CatalogProductRow } from '../lib/api/catalog'
import { formatInr, patchProductFromCatalog } from '../lib/api/products'
import { resolveMediaUrl } from '../lib/media-url'
import { APPLICATION_GUIDE_COLUMN_LABELS, parseProductDescription } from '../lib/productDescription'

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function stockLabel(p: CatalogProductRow) {
  if (p.isOutOfStock) return 'Out of stock'
  const q = p.stockQuantity ?? 0
  if (q <= 0) return 'Out of stock'
  if (q < 15) return `Low stock (${formatInt(q)})`
  return `In stock (${formatInt(q)})`
}

function statusBadgeClass(p: CatalogProductRow) {
  const live = p.status?.isPublished !== false
  return live
    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-slate-500/40 bg-slate-500/15 text-slate-600 dark:text-slate-300'
}

function statusLabel(p: CatalogProductRow) {
  return p.status?.isPublished === false ? 'Draft' : 'Live'
}

function hazardBadge(h: string) {
  switch (h) {
    case 'danger':
      return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
    case 'warning':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
    case 'caution':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200'
    default:
      return 'border-slate-500/35 bg-slate-500/10 text-slate-600 dark:text-slate-300'
  }
}

function mediaUrls(p: CatalogProductRow): string[] {
  const raw = Array.isArray(p.media) ? p.media : []
  const out: string[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const u = o.url ?? o.URL
    if (typeof u === 'string' && u.trim()) out.push(resolveMediaUrl(u.trim()))
  }
  const thumb = p.thumbnailUrl ? resolveMediaUrl(p.thumbnailUrl) : ''
  if (thumb && !out.includes(thumb)) out.unshift(thumb)
  return out
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [product, setProduct] = useState<CatalogProductRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [imgIndex, setImgIndex] = useState(0)
  const [unpublishing, setUnpublishing] = useState(false)

  const load = useCallback(async () => {
    if (!productId) return
    setLoading(true)
    try {
      const p = await fetchProductByKey(token, productId)
      setProduct(p)
      setImgIndex(0)
    } catch (e) {
      showApiError(e)
      setProduct(null)
    } finally {
      setLoading(false)
    }
  }, [productId, token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  const parsedDesc = useMemo(() => {
    const raw = product?.description ?? ''
    return parseProductDescription(raw)
  }, [product?.description])

  const urls = useMemo(() => (product ? mediaUrls(product) : []), [product])
  const mainImg = urls[imgIndex] ?? ''

  const isDraft = product?.status?.isPublished === false

  async function handleTogglePublish() {
    if (!token || !product?.id) {
      showToast('Sign in again to continue.', 'error')
      return
    }
    if (
      !window.confirm(
        isDraft
          ? `Publish “${product.name}” to the storefront?`
          : `Unpublish “${product.name}” from the storefront?`,
      )
    )
      return
    setUnpublishing(true)
    try {
      await patchProductFromCatalog(token, product.id, { status: { isPublished: isDraft } })
      showToast(isDraft ? 'Product published' : 'Product unpublished', 'success')
      await load()
    } catch (e) {
      showApiError(e)
    } finally {
      setUnpublishing(false)
    }
  }

  if (loading || !product) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : 'Product not found.'}
      </div>
    )
  }

  const base = product.basePrice ?? null
  const disc = product.discountPrice ?? null
  const showDiscount =
    Boolean(product.hasSpecialDiscount) &&
    typeof base === 'number' &&
    typeof disc === 'number' &&
    disc > 0 &&
    base > 0 &&
    disc < base

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <nav className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/products" className="hover:text-blue-600 dark:hover:text-blue-400">
          Products
        </Link>
        <span className="mx-2">›</span>
        <span className="text-slate-800 dark:text-slate-200">{product.name}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{product.name}</h1>
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(product)}`}
            >
              {statusLabel(product)}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            SKU: <span className="font-mono">{product.sku ?? '—'}</span>
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{stockLabel(product)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/products/new', { state: { duplicateFromId: product.id } })}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Duplicate
          </button>
          <Link
            to={`/products/${encodeURIComponent(product.id)}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Edit product
          </Link>
          <button
            type="button"
            disabled={unpublishing || !token}
            onClick={() => void handleTogglePublish()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
            title={token ? undefined : 'Sign in to publish/unpublish'}
          >
            {isDraft ? 'Publish' : 'Unpublish'}
          </button>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Gallery</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60">
            {mainImg ? (
              <img src={mainImg} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center text-sm text-slate-400">
                No image
              </div>
            )}
          </div>
          {urls.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto py-1">
              {urls.map((u, i) => (
                <button
                  key={`${u}-${i}`}
                  type="button"
                  onClick={() => setImgIndex(i)}
                  className={
                    i === imgIndex
                      ? 'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ring-inset ring-blue-600'
                      : 'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-slate-200 hover:ring-slate-300 dark:ring-slate-700 dark:hover:ring-slate-600'
                  }
                  aria-label={`Show image ${i + 1}`}
                >
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div className="min-w-0 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pricing</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Base price</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatInr(base)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Discount price</p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {showDiscount ? formatInr(disc) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Discount flag</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {product.hasSpecialDiscount ? 'ON' : 'OFF'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Description</h2>
            {parsedDesc.kind === 'plain' ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {parsedDesc.text?.trim() ? parsedDesc.text : '—'}
              </p>
            ) : (
              <div className="mt-4 space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Detailed description
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {parsedDesc.doc.detailedDescription?.trim()
                      ? parsedDesc.doc.detailedDescription
                      : '—'}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Composition
                      </p>
                      {parsedDesc.doc.composition?.texts?.length ? (
                        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm font-medium text-slate-800 dark:text-slate-200">
                          {parsedDesc.doc.composition.texts
                            .map((t) => String(t))
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .map((t, i) => (
                              <li key={i}>{t}</li>
                            ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">—</p>
                      )}
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${hazardBadge(parsedDesc.doc.composition?.hazardKey ?? '')}`}
                    >
                      {parsedDesc.doc.composition?.hazardKey
                        ? parsedDesc.doc.composition.hazardKey
                        : 'no hazard'}
                    </span>
                  </div>
                </div>

                {parsedDesc.doc.technicalSpecs.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Technical specifications
                    </p>
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {parsedDesc.doc.technicalSpecs
                            .filter((x) => x.label.trim() || x.value.trim())
                            .map((row, i) => (
                              <tr key={i}>
                                <td className="w-1/2 px-3 py-2 text-slate-600 dark:text-slate-300">
                                  {row.label || '—'}
                                </td>
                                <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">
                                  {row.value || '—'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {parsedDesc.doc.applicationGuide.rows.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      Application guide
                    </p>
                    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      <table className="min-w-[720px] w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                            {APPLICATION_GUIDE_COLUMN_LABELS.map((h) => (
                              <th key={h} className="px-3 py-2 text-left">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {parsedDesc.doc.applicationGuide.rows.map((r, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.targetContext || '—'}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.dosageDensity || '—'}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.applicationMethod || '—'}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.interval || '—'}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.technicalSpecs || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {parsedDesc.doc.howToGrow.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      How to grow
                    </p>
                    <ol className="mt-3 space-y-2">
                      {parsedDesc.doc.howToGrow
                        .filter((s) => s.title.trim() || s.detail.trim())
                        .map((s, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                          >
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              Step {i + 1}
                            </p>
                            {s.title ? (
                              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {s.title}
                              </p>
                            ) : null}
                            {s.detail ? (
                              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                                {s.detail}
                              </p>
                            ) : null}
                          </li>
                        ))}
                    </ol>
                  </div>
                ) : null}
              </div>
            )}
          </section>

          {Array.isArray(product.variants) && product.variants.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Variants</h2>
              <div className="mt-4 space-y-3">
                {product.variants
                  .filter((v) => v?.name?.trim() && Array.isArray(v.values) && v.values.length > 0)
                  .map((v, i) => (
                    <div
                      key={`${v.name}-${i}`}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {v.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Default: <span className="font-mono">{v.defaultValue || '—'}</span>
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {v.values.map((val) => (
                          <span
                            key={val}
                            className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            {val}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}


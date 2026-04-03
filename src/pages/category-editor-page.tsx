import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  categoryIdFromCreateResponse,
  createCategory,
  fetchCategoryDetail,
  updateCategoryJson,
  updateCategoryMultipart,
} from '../lib/api/categories'
import { fetchCatalogCategories, type CatalogCategory } from '../lib/api/catalog'
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
          <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {label}
          </label>
        ) : null}
        {sub ? <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
      </div>
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
      <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
      <label
        htmlFor={id}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 text-center transition hover:border-blue-500/50 hover:bg-slate-100/80 dark:border-slate-600 dark:bg-slate-900/40 dark:hover:border-blue-500/40 dark:hover:bg-slate-800/60 ${
          tall ? 'min-h-[140px] py-12' : 'py-10'
        }`}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="mb-3 max-h-32 w-full max-w-full rounded-lg object-cover" />
        ) : (
          <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </span>
        )}
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {file ? file.name : 'Click to upload or drag and drop'}
        </span>
        <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</span>
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
          className="mt-2 text-xs font-medium text-red-600 hover:underline dark:text-red-400"
        >
          Remove
        </button>
      ) : null}
    </div>
  )
}

const slugPrefix =
  (import.meta.env.VITE_CATEGORY_SLUG_PREFIX as string | undefined)?.trim() || 'nyra.store/cat/'

const MAX_BYTES = 2 * 1024 * 1024

export function CategoryEditorPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const isEdit = Boolean(categoryId)
  const baseId = useId()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [parents, setParents] = useState<CatalogCategory[]>([])

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [parentCategoryId, setParentCategoryId] = useState('')
  const [displayOrder, setDisplayOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [thumbObjectUrl, setThumbObjectUrl] = useState<string | null>(null)
  const [bannerObjectUrl, setBannerObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const c = await fetchCatalogCategories()
        if (!cancelled) setParents(c)
      } catch {
        if (!cancelled) setParents([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const parentFromQuery = searchParams.get('parent')?.trim() ?? ''
  useEffect(() => {
    if (!isEdit && parentFromQuery) setParentCategoryId(parentFromQuery)
  }, [isEdit, parentFromQuery])

  const parentChoices = useMemo(() => {
    if (!categoryId) return parents
    return parents.filter((c) => c.id !== categoryId)
  }, [parents, categoryId])

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(thumbnailFile)
    setThumbObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [thumbnailFile])

  useEffect(() => {
    if (!bannerFile) {
      setBannerObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(bannerFile)
    setBannerObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [bannerFile])

  const thumbPreview = thumbObjectUrl || (thumbnailUrl ? resolveMediaUrl(thumbnailUrl) : '')
  const bannerPreview = bannerObjectUrl || (bannerUrl ? resolveMediaUrl(bannerUrl) : '')

  useEffect(() => {
    if (!isEdit || !categoryId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const cat = await fetchCategoryDetail(token, categoryId)
        if (cancelled) return
        setName(cat.name)
        setSlug(cat.slug ?? slugify(cat.name))
        setDescription(cat.description ?? '')
        setParentCategoryId(cat.parentCategoryId ?? '')
        setDisplayOrder(cat.displayOrder ?? 0)
        setIsActive(cat.isActive !== false)
        setThumbnailUrl(cat.thumbnailUrl ?? '')
        setBannerUrl(cat.bannerUrl ?? '')
        setThumbnailFile(null)
        setBannerFile(null)
      } catch (e) {
        if (!cancelled) showApiError(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isEdit, categoryId, token, showApiError])

  useEffect(() => {
    if (isEdit || slugTouched) return
    setSlug(slugify(name))
  }, [name, isEdit, slugTouched])

  function checkFile(f: File | null) {
    if (!f) return true
    if (f.size > MAX_BYTES) {
      showToast('Each image must be 2MB or smaller.', 'error')
      return false
    }
    return true
  }

  const appendCategoryFields = useCallback(
    (fd: FormData) => {
      fd.set('name', name.trim())
      fd.set('slug', slug.trim())
      fd.set('description', description.trim())
      fd.set('displayOrder', String(displayOrder))
      fd.set('isActive', String(isActive))
      if (parentCategoryId) fd.set('parentCategoryId', parentCategoryId)
      if (thumbnailFile) fd.set('thumbnail', thumbnailFile)
      if (bannerFile) fd.set('banner', bannerFile)
    },
    [name, slug, description, displayOrder, isActive, parentCategoryId, thumbnailFile, bannerFile],
  )

  async function handleSave() {
    if (!token) {
      showToast('Sign in to save categories.', 'error')
      return
    }
    if (!name.trim() || !slug.trim()) {
      showToast('Name and slug are required.', 'error')
      return
    }
    if (!checkFile(thumbnailFile) || !checkFile(bannerFile)) return
    setSaving(true)
    try {
      if (!isEdit) {
        const fd = new FormData()
        appendCategoryFields(fd)
        const res = await createCategory(token, fd)
        const id = categoryIdFromCreateResponse(res)
        showToast('Category created.', 'success')
        navigate(id ? `/categories/${encodeURIComponent(id)}` : '/categories')
        return
      }
      if (!categoryId) return
      if (thumbnailFile || bannerFile) {
        const fd = new FormData()
        appendCategoryFields(fd)
        await updateCategoryMultipart(token, categoryId, fd)
      } else {
        await updateCategoryJson(token, categoryId, {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          parentCategoryId: parentCategoryId || null,
          displayOrder,
          isActive,
          thumbnailUrl: thumbnailUrl.trim(),
          bannerUrl: bannerUrl.trim(),
        })
      }
      showToast('Category updated.', 'success')
      navigate(`/categories/${encodeURIComponent(categoryId)}`)
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading category…
      </div>
    )
  }

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? 'Edit category' : 'Create New Category'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Organize your products with hierarchies and visual assets.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={isEdit && categoryId ? `/categories/${encodeURIComponent(categoryId)}` : '/categories'}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Category'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="text-slate-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              Basic Information
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor={`${baseId}-name`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Category name
                </label>
                <input
                  id={`${baseId}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Electronics"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-slug`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Category slug
                </label>
                <div className="mt-1.5 flex rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                  <span className="flex items-center border-r border-slate-200 px-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {slugPrefix}
                  </span>
                  <input
                    id={`${baseId}-slug`}
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setSlug(e.target.value)
                    }}
                    placeholder="electronics"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-0"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</p>
                <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80">
                  <div className="flex gap-1 border-b border-slate-200 px-2 py-1.5 dark:border-slate-700">
                    <span className="rounded p-1.5 text-slate-400" title="Bold" aria-hidden>
                      <strong className="text-xs">B</strong>
                    </span>
                    <span className="rounded p-1.5 text-slate-400" title="Italic" aria-hidden>
                      <em className="text-xs">I</em>
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="p-1.5 text-xs text-slate-400">List · Link</span>
                  </div>
                  <textarea
                    id={`${baseId}-desc`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    placeholder="Write a short description for this category…"
                    className="w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-0"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="text-slate-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
                </svg>
              </span>
              Hierarchy &amp; Organization
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor={`${baseId}-parent`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Parent category
                </label>
                <select
                  id={`${baseId}-parent`}
                  value={parentCategoryId}
                  onChange={(e) => setParentCategoryId(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">None (Top Level)</option>
                  {parentChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${baseId}-order`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Display order
                </label>
                <input
                  id={`${baseId}-order`}
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value) || 0)}
                  className="mt-1.5 w-full max-w-[120px] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm tabular-nums outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80"
                />
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Higher numbers appear last
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="text-slate-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </span>
              Visibility
            </h2>
            <div className="mt-4">
              <Toggle
                id={`${baseId}-active`}
                label="Active on storefront"
                sub={
                  isActive
                    ? 'Currently the category is Active and visible to customers on the storefront.'
                    : 'Hidden categories stay out of navigation until re-enabled.'
                }
                checked={isActive}
                onChange={setIsActive}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <span className="text-slate-400" aria-hidden>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </span>
              Category assets
            </h2>
            <div className="mt-4 flex flex-col gap-6">
              <FileDrop
                id={`${baseId}-thumb`}
                label="Thumbnail image"
                hint="PNG, JPG or WEBP (max 2MB)"
                accept="image/png,image/jpeg,image/webp"
                file={thumbnailFile}
                onFile={(f) => {
                  if (f && !checkFile(f)) return
                  setThumbnailFile(f)
                  if (!f) setThumbnailUrl('')
                }}
                previewUrl={thumbPreview}
              />
              <FileDrop
                id={`${baseId}-banner`}
                label="Banner image"
                hint="Recommended size: 1200 × 400px · max 2MB"
                accept="image/png,image/jpeg,image/webp"
                file={bannerFile}
                tall
                onFile={(f) => {
                  if (f && !checkFile(f)) return
                  setBannerFile(f)
                  if (!f) setBannerUrl('')
                }}
                previewUrl={bannerPreview}
              />
            </div>
          </section>

          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 dark:bg-blue-500/10">
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                ?
              </span>
              <div>
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Tips for SEO</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Use descriptive names, short URL slugs, and meaningful alt text on images so search engines can
                  understand this category.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

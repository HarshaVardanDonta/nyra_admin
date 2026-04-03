import { useCallback, useEffect, useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  brandIdFromCreateResponse,
  createBrand,
  fetchBrandDetail,
  updateBrandJson,
  updateBrandMultipart,
} from '../lib/api/brands'
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
      <p className="mb-2 text-sm font-medium text-slate-800 dark:text-slate-200">{label}</p>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center transition hover:border-blue-500/50 hover:bg-slate-100/80 dark:border-slate-600 dark:bg-slate-900/40 dark:hover:border-blue-500/40 dark:hover:bg-slate-800/60"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="mb-3 max-h-28 max-w-full rounded-lg object-contain" />
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
  (import.meta.env.VITE_STORE_SLUG_PREFIX as string | undefined)?.trim() || 'nyra.store/brands/'

export function BrandEditorPage() {
  const { brandId } = useParams<{ brandId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const isEdit = Boolean(brandId)
  const baseId = useId()

  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isFeatured, setIsFeatured] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [logoObjectUrl, setLogoObjectUrl] = useState<string | null>(null)
  const [bannerObjectUrl, setBannerObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!logoFile) {
      setLogoObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(logoFile)
    setLogoObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [logoFile])

  useEffect(() => {
    if (!bannerFile) {
      setBannerObjectUrl(null)
      return
    }
    const u = URL.createObjectURL(bannerFile)
    setBannerObjectUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [bannerFile])

  const logoPreview = logoObjectUrl || (logoUrl ? resolveMediaUrl(logoUrl) : '')
  const bannerPreview = bannerObjectUrl || (bannerUrl ? resolveMediaUrl(bannerUrl) : '')

  useEffect(() => {
    if (!isEdit || !brandId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const b = await fetchBrandDetail(token, brandId)
        if (cancelled) return
        setName(b.name)
        setSlug(b.slug ?? slugify(b.name))
        setDescription(b.description ?? '')
        setWebsiteUrl(b.websiteUrl ?? '')
        setIsActive(b.isActive !== false)
        setIsFeatured(Boolean(b.isFeatured))
        setLogoUrl(b.logoUrl ?? '')
        setBannerUrl(b.bannerUrl ?? '')
        setLogoFile(null)
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
  }, [isEdit, brandId, token, showApiError])

  useEffect(() => {
    if (isEdit || slugTouched) return
    setSlug(slugify(name))
  }, [name, isEdit, slugTouched])

  const appendBrandFields = useCallback(
    (fd: FormData) => {
      fd.set('name', name.trim())
      fd.set('slug', slug.trim())
      fd.set('description', description.trim())
      fd.set('websiteUrl', websiteUrl.trim())
      fd.set('isActive', String(isActive))
      fd.set('isFeatured', String(isFeatured))
      if (logoFile) fd.set('logo', logoFile)
      if (bannerFile) fd.set('banner', bannerFile)
    },
    [name, slug, description, websiteUrl, isActive, isFeatured, logoFile, bannerFile],
  )

  async function handleSave() {
    if (!token) {
      showToast('Sign in to save brands.', 'error')
      return
    }
    if (!name.trim() || !slug.trim()) {
      showToast('Name and slug are required.', 'error')
      return
    }
    setSaving(true)
    try {
      if (!isEdit) {
        const fd = new FormData()
        appendBrandFields(fd)
        const res = await createBrand(token, fd)
        const id = brandIdFromCreateResponse(res)
        showToast('Brand created.', 'success')
        navigate(id ? `/brands/${encodeURIComponent(id)}` : '/brands')
        return
      }
      if (!brandId) return
      if (logoFile || bannerFile) {
        const fd = new FormData()
        appendBrandFields(fd)
        await updateBrandMultipart(token, brandId, fd)
      } else {
        await updateBrandJson(token, brandId, {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          websiteUrl: websiteUrl.trim(),
          isActive,
          isFeatured,
          logoUrl: logoUrl.trim(),
          bannerUrl: bannerUrl.trim(),
        })
      }
      showToast('Brand updated.', 'success')
      navigate(`/brands/${encodeURIComponent(brandId)}`)
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading brand…
      </div>
    )
  }

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? 'Edit brand' : 'Create New Brand'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isEdit ? 'Update storefront presence and assets.' : 'Add a partner brand to your catalog.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={isEdit && brandId ? `/brands/${encodeURIComponent(brandId)}` : '/brands'}
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
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save Brand'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Basic Information</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor={`${baseId}-name`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Brand name
                </label>
                <input
                  id={`${baseId}-name`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nike, Apple"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-slug`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Slug
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
                    placeholder="nike"
                    className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-0"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor={`${baseId}-desc`}
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Description
                </label>
                <textarea
                  id={`${baseId}-desc`}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Briefly describe the brand's history or products…"
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Brand assets</h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <FileDrop
                id={`${baseId}-logo`}
                label="Brand logo"
                hint="SVG, PNG, JPG (max. 800×400px)"
                accept="image/svg+xml,image/png,image/jpeg,image/webp"
                file={logoFile}
                onFile={(f) => {
                  setLogoFile(f)
                  if (!f) setLogoUrl('')
                }}
                previewUrl={logoPreview}
              />
              <FileDrop
                id={`${baseId}-banner`}
                label="Banner image"
                hint="1200×400px recommended"
                accept="image/png,image/jpeg,image/webp"
                file={bannerFile}
                onFile={(f) => {
                  setBannerFile(f)
                  if (!f) setBannerUrl('')
                }}
                previewUrl={bannerPreview}
              />
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
            <div className="mt-4 flex flex-col gap-5">
              <div>
                <label
                  htmlFor={`${baseId}-web`}
                  className="text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Website URL
                </label>
                <input
                  id={`${baseId}-web`}
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://nike.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <Toggle
                id={`${baseId}-active`}
                label="Active status"
                sub="Brand visible on storefront"
                checked={isActive}
                onChange={setIsActive}
              />
              <Toggle
                id={`${baseId}-feat`}
                label="Featured brand"
                sub="Highlight in homepage sliders"
                checked={isFeatured}
                onChange={setIsFeatured}
              />
            </div>
          </section>

          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 dark:bg-blue-500/10">
            <div className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                i
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">SEO tip</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Setting a clear brand description and slug helps search engines index your brand products more
                  efficiently.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

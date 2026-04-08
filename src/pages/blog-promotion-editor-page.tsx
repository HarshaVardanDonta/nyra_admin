import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AdminDateTimeField } from '../components/admin-date-field'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  createBlogPromotion,
  fetchBlogPromotionDetail,
  updateBlogPromotion,
  type BlogPromotionCTA,
  type BlogPromotionWriteInput,
} from '../lib/api/blog-promotions'
import { fetchBlogDetail, fetchBlogsList, uploadBlogBodyImage, type BlogSummary } from '../lib/api/blogs'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../lib/datetime-local'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

export function BlogPromotionEditorPage() {
  const { blogPromotionId } = useParams<{ blogPromotionId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()
  const isNew = !blogPromotionId || blogPromotionId === 'new'

  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [pendingObjectUrl, setPendingObjectUrl] = useState<string | null>(null)

  const [blogId, setBlogId] = useState('')
  const [selectedBlogTitle, setSelectedBlogTitle] = useState('')
  const [blogSearch, setBlogSearch] = useState('')
  const debouncedBlogSearch = useDebounced(blogSearch, 400)
  const [blogPickerOpen, setBlogPickerOpen] = useState(false)
  const blogWrapRef = useRef<HTMLDivElement>(null)
  const blogInputRef = useRef<HTMLInputElement>(null)
  const blogPanelPortalRef = useRef<HTMLDivElement>(null)
  const [blogPanelRect, setBlogPanelRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  const [blogCandidates, setBlogCandidates] = useState<BlogSummary[]>([])
  const [blogsLoading, setBlogsLoading] = useState(false)

  const [priorityOrder, setPriorityOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [ctas, setCtas] = useState<BlogPromotionCTA[]>([{ label: '', url: '' }])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return () => {
      if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl)
    }
  }, [pendingObjectUrl])

  function setStagedImageFile(f: File | null) {
    setPendingImageFile(f)
    setPendingObjectUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl)
      return f ? URL.createObjectURL(f) : null
    })
  }

  function clearStagedImageFile() {
    setPendingImageFile(null)
    setPendingObjectUrl((prevUrl) => {
      if (prevUrl) URL.revokeObjectURL(prevUrl)
      return null
    })
  }

  function checkImageFile(f: File | null): File | null {
    if (!f) return null
    if (!f.type.startsWith('image/')) {
      showToast('Choose an image file.', 'error')
      return null
    }
    if (f.size > MAX_IMAGE_BYTES) {
      showToast('Image must be 2MB or smaller.', 'error')
      return null
    }
    return f
  }

  const load = useCallback(async () => {
    if (!token || isNew || !blogPromotionId) return
    setLoading(true)
    try {
      const p = await fetchBlogPromotionDetail(token, blogPromotionId)
      setTitle(p.title)
      setImageUrl(p.imageUrl)
      clearStagedImageFile()
      setBlogId(p.blogId)
      setSelectedBlogTitle('')
      setPriorityOrder(p.priorityOrder)
      setIsActive(p.isActive)
      setStartLocal(isoToDatetimeLocal(p.startAt))
      setEndLocal(isoToDatetimeLocal(p.endAt))
      setCtas(p.ctaButtons.length > 0 ? p.ctaButtons : [{ label: '', url: '' }])
      if (p.blogId.trim()) {
        try {
          const b = await fetchBlogDetail(token, p.blogId)
          setSelectedBlogTitle(b.title)
        } catch {
          setSelectedBlogTitle('')
        }
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [token, blogPromotionId, isNew, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!token) return
    setBlogsLoading(true)
    void (async () => {
      try {
        const q = debouncedBlogSearch.trim()
        const { items } = await fetchBlogsList(token, {
          limit: 80,
          offset: 0,
          search: q || undefined,
        })
        setBlogCandidates(items)
      } catch {
        setBlogCandidates([])
      } finally {
        setBlogsLoading(false)
      }
    })()
  }, [token, debouncedBlogSearch])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (blogWrapRef.current?.contains(t)) return
      if (blogPanelPortalRef.current?.contains(t)) return
      setBlogPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const measureBlogPanel = useCallback(() => {
    const el = blogInputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setBlogPanelRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 280),
    })
  }, [])

  useLayoutEffect(() => {
    if (!blogPickerOpen) {
      setBlogPanelRect(null)
      return
    }
    measureBlogPanel()
    window.addEventListener('scroll', measureBlogPanel, true)
    window.addEventListener('resize', measureBlogPanel)
    return () => {
      window.removeEventListener('scroll', measureBlogPanel, true)
      window.removeEventListener('resize', measureBlogPanel)
    }
  }, [blogPickerOpen, measureBlogPanel, debouncedBlogSearch, blogCandidates])

  const blogSearchPending = blogPickerOpen && blogSearch.trim() !== debouncedBlogSearch.trim()

  function pickBlog(b: BlogSummary) {
    setBlogId(b.id)
    setSelectedBlogTitle(b.title)
    setBlogSearch('')
    setBlogPickerOpen(false)
  }

  function clearBlog() {
    setBlogId('')
    setSelectedBlogTitle('')
    setBlogSearch('')
  }

  const imagePreviewSrc = useMemo(
    () => pendingObjectUrl || (imageUrl.trim() ? imageUrl.trim() : null),
    [pendingObjectUrl, imageUrl],
  )

  function buildInput(finalImage: string): BlogPromotionWriteInput {
    const buttons = ctas
      .map((c) => ({ label: c.label.trim(), url: c.url.trim() }))
      .filter((c) => c.label && c.url)
    return {
      title,
      imageUrl: finalImage,
      blogId: blogId.trim(),
      ctaButtons: buttons,
      priorityOrder,
      isActive,
      startAt: datetimeLocalToIso(startLocal),
      endAt: datetimeLocalToIso(endLocal),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!blogId.trim()) {
      showToast('Select a blog.', 'error')
      return
    }
    setSaving(true)
    try {
      let finalImageUrl = imageUrl.trim()
      if (pendingImageFile) {
        finalImageUrl = await uploadBlogBodyImage(token, pendingImageFile)
        clearStagedImageFile()
        setImageUrl(finalImageUrl)
      }
      if (!finalImageUrl) {
        showToast('Add a promotion image (upload or URL).', 'error')
        setSaving(false)
        return
      }
      const input = buildInput(finalImageUrl)
      if (isNew) {
        const p = await createBlogPromotion(token, input)
        showToast('Blog promotion created.', 'success')
        navigate(`/blog-promotions/${encodeURIComponent(p.id)}`, { replace: true })
      } else if (blogPromotionId) {
        await updateBlogPromotion(token, blogPromotionId, input)
        showToast('Saved.', 'success')
        navigate(`/blog-promotions/${encodeURIComponent(blogPromotionId)}`, { replace: true })
      }
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-xl px-4 py-12 text-sm text-slate-500 md:px-8">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 py-8 md:px-8">
      <Link to="/blog-promotions" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        ← Blog promotions
      </Link>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        {isNew ? 'New blog promotion' : 'Edit blog promotion'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          Title
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </label>

        <div className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Image</span>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Upload via the same blog image pipeline (Cloudflare), or paste a public image URL.
          </p>
          {imagePreviewSrc ? (
            <img
              src={imagePreviewSrc}
              alt=""
              className="mt-2 max-h-44 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
            />
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = checkImageFile(e.target.files?.[0] ?? null)
                  e.target.value = ''
                  if (!f) return
                  setStagedImageFile(f)
                  setImageUrl('')
                }}
              />
              Choose file
            </label>
            {pendingImageFile ? (
              <button
                type="button"
                className="text-xs text-slate-600 underline hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => {
                  clearStagedImageFile()
                }}
              >
                Remove upload
              </button>
            ) : null}
          </div>
          <input
            value={imageUrl}
            onChange={(e) => {
              clearStagedImageFile()
              setImageUrl(e.target.value)
            }}
            placeholder="https://…"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </div>

        <div ref={blogWrapRef} className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Blog</span>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Search by title, slug, or id — pick from the list.
          </p>
          {blogId ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50">
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {selectedBlogTitle || 'Selected blog'}
                </span>
                <span className="ml-2 font-mono text-xs text-slate-500">{blogId}</span>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                onClick={clearBlog}
              >
                Clear
              </button>
            </div>
          ) : null}
          <div className="mt-2">
            <input
              ref={blogInputRef}
              type="text"
              value={blogSearch}
              onChange={(e) => {
                setBlogSearch(e.target.value)
                setBlogPickerOpen(true)
              }}
              onFocus={() => setBlogPickerOpen(true)}
              placeholder={blogId ? 'Change blog — search…' : 'Search blogs…'}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            />
            {blogPickerOpen && blogPanelRect
              ? createPortal(
                  <div
                    ref={blogPanelPortalRef}
                    className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
                    style={{
                      position: 'fixed',
                      top: blogPanelRect.top,
                      left: blogPanelRect.left,
                      width: blogPanelRect.width,
                      zIndex: 10050,
                    }}
                  >
                    {blogSearchPending && !blogsLoading ? (
                      <p
                        className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-400 dark:border-slate-800"
                        aria-live="polite"
                      >
                        Searching…
                      </p>
                    ) : null}
                    {blogsLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Loading…</p>
                    ) : blogCandidates.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">No blogs match this search.</p>
                    ) : (
                      blogCandidates.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          disabled={b.id === blogId}
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickBlog(b)}
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-50">{b.title}</span>
                          <span className="font-mono text-xs text-slate-500">
                            {b.id} · {b.slug}
                          </span>
                        </button>
                      ))
                    )}
                  </div>,
                  document.body,
                )
              : null}
          </div>
        </div>

        <label className="block text-sm">
          Priority (lower first)
          <input
            type="number"
            value={priorityOrder}
            onChange={(e) => setPriorityOrder(Number.parseInt(e.target.value, 10) || 0)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">Start (optional)</span>
            <div className="mt-1">
              <AdminDateTimeField value={startLocal} onChange={setStartLocal} placeholder="Select start" />
            </div>
          </div>
          <div className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300">End (optional)</span>
            <div className="mt-1">
              <AdminDateTimeField value={endLocal} onChange={setEndLocal} placeholder="Select end" />
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">CTA buttons</span>
            <button
              type="button"
              className="text-xs text-blue-600 dark:text-blue-400"
              onClick={() => setCtas((c) => [...c, { label: '', url: '' }])}
            >
              + Add
            </button>
          </div>
          {ctas.map((c, i) => (
            <div key={i} className="flex flex-col gap-2 sm:flex-row">
              <input
                placeholder="Label"
                value={c.label}
                onChange={(e) => {
                  const next = [...ctas]
                  next[i] = { ...next[i], label: e.target.value }
                  setCtas(next)
                }}
                className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              />
              <input
                placeholder="URL"
                value={c.url}
                onChange={(e) => {
                  const next = [...ctas]
                  next[i] = { ...next[i], url: e.target.value }
                  setCtas(next)
                }}
                className="flex-[2] rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link
            to={isNew ? '/blog-promotions' : `/blog-promotions/${encodeURIComponent(blogPromotionId!)}`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

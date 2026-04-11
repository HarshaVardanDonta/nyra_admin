import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BlogEditorJs } from '../components/blog-editor-js'
import { BlogLocalImagesProvider, useBlogLocalImages } from '../contexts/blog-local-images-context'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchCatalogProductByKey, fetchProductsList, type CatalogProductRow } from '../lib/api/catalog'
import {
  createBlog,
  fetchBlogDetail,
  fetchBlogTagNames,
  updateBlog,
  type BlogWriteInput,
} from '../lib/api/blogs'
import {
  emptyEditorOutput,
  hasEditorJsMeaningfulContent,
  isLegacyHtmlBody,
  parseEditorJsBody,
} from '../lib/editorjs-body'

function LegacyHtmlBlogEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-100">
        This post uses legacy HTML. Edit the source below, or recreate the article as a new post using the block
        editor.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="min-h-[min(60vh,560px)] w-full rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  )
}

function slugifyHint(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return debounced
}

function BlogEditorPageInner() {
  const { blogId } = useParams<{ blogId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()
  const { resolveAndUpload } = useBlogLocalImages()
  const isNew = !blogId || blogId === 'new'

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [body, setBody] = useState('') // stored as HTML (API/back-compat)
  const [editorKey, setEditorKey] = useState(0)
  const bodyApiRef = useRef<{ getHtml: () => Promise<string> } | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [tagMenuOpen, setTagMenuOpen] = useState(false)
  const tagWrapRef = useRef<HTMLDivElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
  const tagListPortalRef = useRef<HTMLUListElement>(null)
  const [tagMenuRect, setTagMenuRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )

  const [productSearch, setProductSearch] = useState('')
  const debouncedProductSearch = useDebounced(productSearch, 450)
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const productWrapRef = useRef<HTMLDivElement>(null)
  const productInputRef = useRef<HTMLInputElement>(null)
  const productPanelPortalRef = useRef<HTMLDivElement>(null)
  const [productPanelRect, setProductPanelRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  const [productCandidates, setProductCandidates] = useState<CatalogProductRow[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<CatalogProductRow[]>([])

  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  /** Snapshot of `body` from the server (or cleared for “new”); not updated on every keystroke — drives Editor.js initial props with `editorKey`. */
  const [editorSeedBody, setEditorSeedBody] = useState('')
  const loadGenerationRef = useRef(0)

  const editorInitialData = useMemo(() => {
    const p = parseEditorJsBody(editorSeedBody)
    if (p) return p
    return emptyEditorOutput()
  }, [editorKey, editorSeedBody])

  const load = useCallback(async () => {
    if (!token || isNew || !blogId) return
    const gen = ++loadGenerationRef.current
    setLoading(true)
    try {
      const b = await fetchBlogDetail(token, blogId)
      if (gen !== loadGenerationRef.current) return
      setTitle(b.title)
      setSlug(b.slug)
      setSlugTouched(true)
      setBody(b.body)
      setEditorSeedBody(b.body)
      setEditorKey((k) => k + 1)
      setSelectedTags(b.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))
      setIsPublished(b.isPublished)
      const ids = b.productIds
      if (ids.length > 0) {
        const rows = await Promise.all(
          ids.map(async (id) => {
            try {
              return await fetchCatalogProductByKey(id)
            } catch {
              return { id, name: id } as CatalogProductRow
            }
          }),
        )
        setSelectedProducts(rows.filter((r) => r.id))
      } else {
        setSelectedProducts([])
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [token, blogId, isNew, showApiError])

  useEffect(() => {
    if (isNew) {
      setEditorSeedBody('')
    }
  }, [isNew])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!token) return
    void (async () => {
      try {
        const names = await fetchBlogTagNames(token, 800)
        setTagSuggestions(names)
      } catch {
        setTagSuggestions([])
      }
    })()
  }, [token])

  useEffect(() => {
    if (!token) return
    setProductsLoading(true)
    void (async () => {
      try {
        const q = debouncedProductSearch.trim()
        const { items } = await fetchProductsList(token, {
          limit: q ? 100 : 80,
          offset: 0,
          search: q || undefined,
          publication: 'all',
        })
        setProductCandidates(items)
      } catch {
        setProductCandidates([])
      } finally {
        setProductsLoading(false)
      }
    })()
  }, [token, debouncedProductSearch])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (tagWrapRef.current?.contains(t)) return
      if (tagListPortalRef.current?.contains(t)) return
      setTagMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (productWrapRef.current?.contains(t)) return
      if (productPanelPortalRef.current?.contains(t)) return
      setProductPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filteredTagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase()
    const pool = tagSuggestions.filter((t) => !selectedTags.includes(t))
    if (!q) return pool.slice(0, 16)
    const starts = pool.filter((t) => t.startsWith(q))
    const contains = pool.filter((t) => !t.startsWith(q) && t.includes(q))
    return [...starts, ...contains].slice(0, 16)
  }, [tagInput, tagSuggestions, selectedTags])

  const tagInputNormalized = tagInput.trim().toLowerCase()
  const exactTagExistsInCatalog =
    tagInputNormalized.length > 0 && tagSuggestions.some((t) => t === tagInputNormalized)
  const canCreateTag =
    tagInputNormalized.length > 0 &&
    !selectedTags.includes(tagInputNormalized) &&
    !exactTagExistsInCatalog

  const displayedProductRows = useMemo(() => {
    const q = debouncedProductSearch.trim().toLowerCase()
    if (!q) return productCandidates
    return productCandidates.filter((p) => {
      const name = (p.name ?? '').toLowerCase()
      const id = (p.id ?? '').toLowerCase()
      const sku = (p.sku ?? '').toLowerCase()
      const slug = (p.seo?.slug ?? '').toLowerCase()
      return name.includes(q) || id.includes(q) || sku.includes(q) || slug.includes(q)
    })
  }, [productCandidates, debouncedProductSearch])

  const productSearchPending =
    productPickerOpen && productSearch.trim() !== debouncedProductSearch.trim()

  const measureTagMenu = useCallback(() => {
    const el = tagInputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setTagMenuRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 280),
    })
  }, [])

  useLayoutEffect(() => {
    if (!tagMenuOpen) {
      setTagMenuRect(null)
      return
    }
    measureTagMenu()
    window.addEventListener('scroll', measureTagMenu, true)
    window.addEventListener('resize', measureTagMenu)
    return () => {
      window.removeEventListener('scroll', measureTagMenu, true)
      window.removeEventListener('resize', measureTagMenu)
    }
  }, [tagMenuOpen, measureTagMenu, tagInput])

  const measureProductPanel = useCallback(() => {
    const el = productInputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setProductPanelRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 280),
    })
  }, [])

  useLayoutEffect(() => {
    if (!productPickerOpen) {
      setProductPanelRect(null)
      return
    }
    measureProductPanel()
    window.addEventListener('scroll', measureProductPanel, true)
    window.addEventListener('resize', measureProductPanel)
    return () => {
      window.removeEventListener('scroll', measureProductPanel, true)
      window.removeEventListener('resize', measureProductPanel)
    }
  }, [productPickerOpen, measureProductPanel, debouncedProductSearch, productCandidates])

  function addTag(name: string) {
    const n = name.trim().toLowerCase()
    if (!n || selectedTags.includes(n)) return
    setSelectedTags((s) => [...s, n])
    setTagInput('')
    setTagMenuOpen(false)
  }

  function removeTag(name: string) {
    setSelectedTags((s) => s.filter((x) => x !== name))
  }

  function addProduct(p: CatalogProductRow) {
    if (!p.id || selectedProducts.some((x) => x.id === p.id)) return
    setSelectedProducts((s) => [...s, p])
    setProductSearch('')
    setProductPickerOpen(false)
  }

  function removeProduct(id: string) {
    setSelectedProducts((s) => s.filter((x) => x.id !== id))
  }

  function buildInput(): BlogWriteInput {
    const s =
      slug.trim() ||
      slugifyHint(title) ||
      title.trim().toLowerCase().replace(/\s+/g, '-')
    return {
      title: title.trim(),
      body,
      slug: s,
      isPublished,
      tags: selectedTags,
      productIds: selectedProducts.map((p) => p.id),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    const trimmed = body.trim()
    if (isLegacyHtmlBody(body)) {
      if (!trimmed || trimmed === '<p></p>') {
        showToast('Add some body content.', 'error')
        return
      }
    } else if (!hasEditorJsMeaningfulContent(body)) {
      showToast('Add some body content.', 'error')
      return
    }
    setSaving(true)
    try {
      const { html: resolvedBody, revokePendingBlobs } = await resolveAndUpload(body, token)
      const input: BlogWriteInput = {
        ...buildInput(),
        body: resolvedBody,
      }
      if (isNew) {
        const b = await createBlog(token, input)
        revokePendingBlobs()
        showToast('Blog created.', 'success')
        navigate(`/blogs/${encodeURIComponent(b.id)}`, { replace: true })
      } else if (blogId) {
        await updateBlog(token, blogId, input)
        revokePendingBlobs()
        showToast('Blog saved.', 'success')
        navigate(`/blogs/${encodeURIComponent(blogId)}`, { replace: true })
      }
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500 md:px-8">Loading…</div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <div className="flex items-center gap-3 text-sm">
        <Link to="/blogs" className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          ← Blogs
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
        {isNew ? 'New blog' : 'Edit blog'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Title</span>
          <input
            required
            value={title}
            onChange={(e) => {
              const v = e.target.value
              setTitle(v)
              if (!slugTouched && isNew) {
                setSlug(slugifyHint(v))
              }
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Slug</span>
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true)
              setSlug(e.target.value)
            }}
            placeholder="url-friendly-slug"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          />
        </label>

        <div className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Body</span>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Block editor (Editor.js): headings, lists, callouts, figures with captions, links, and highlights.
            Images stay local until you save, then upload to Cloudflare.
          </p>
          <div className="mt-2">
            {isLegacyHtmlBody(body) ? (
              <LegacyHtmlBlogEditor value={body} onChange={setBody} />
            ) : (
              <BlogEditorJs
                key={editorKey}
                initialData={editorInitialData}
                onChange={setBody}
                placeholder="Write your article…"
              />
            )}
          </div>
        </div>

        <div ref={tagWrapRef} className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Tags</span>
          <p className="mt-0.5 text-xs text-slate-500">Pick existing tags or create new ones.</p>
          <div className="mt-2 flex min-h-[42px] flex-wrap gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900">
            {selectedTags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200"
              >
                {t}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-blue-500/25"
                  aria-label={`Remove ${t}`}
                  onClick={() => removeTag(t)}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={tagInputRef}
              className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none dark:text-slate-100"
              placeholder="Type to search or add…"
              value={tagInput}
              onChange={(e) => {
                setTagInput(e.target.value)
                setTagMenuOpen(true)
              }}
              onFocus={() => setTagMenuOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filteredTagSuggestions.length > 0) {
                    addTag(filteredTagSuggestions[0])
                  } else if (canCreateTag) {
                    addTag(tagInput)
                  }
                }
              }}
            />
          </div>
          {tagMenuOpen && tagMenuRect && (filteredTagSuggestions.length > 0 || canCreateTag)
            ? createPortal(
                <ul
                  ref={tagListPortalRef}
                  className="max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
                  style={{
                    position: 'fixed',
                    top: tagMenuRect.top,
                    left: tagMenuRect.left,
                    width: tagMenuRect.width,
                    zIndex: 10050,
                  }}
                >
                  {filteredTagSuggestions.map((t) => (
                    <li key={t}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addTag(t)}
                      >
                        {t}
                        {tagInputNormalized && t === tagInputNormalized ? (
                          <span className="ml-2 text-xs text-slate-400">existing</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {canCreateTag ? (
                    <li>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-slate-50 dark:text-emerald-400 dark:hover:bg-slate-800"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addTag(tagInput)}
                      >
                        Create new tag “{tagInputNormalized}”
                      </button>
                    </li>
                  ) : null}
                </ul>,
                document.body,
              )
            : null}
        </div>

        <div ref={productWrapRef} className="block text-sm">
          <span className="text-slate-600 dark:text-slate-300">Related products</span>
          <p className="mt-0.5 text-xs text-slate-500">Search catalog and add from the list.</p>
          {selectedProducts.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {selectedProducts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-slate-900 dark:text-slate-50">{p.name || p.id}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{p.id}</span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-red-600 hover:underline dark:text-red-400"
                    onClick={() => removeProduct(p.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-2">
            <input
              ref={productInputRef}
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value)
                setProductPickerOpen(true)
              }}
              onFocus={() => setProductPickerOpen(true)}
              placeholder="Search products — click to browse recent catalog"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            />
            {productPickerOpen && productPanelRect
              ? createPortal(
                  <div
                    ref={productPanelPortalRef}
                    className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
                    style={{
                      position: 'fixed',
                      top: productPanelRect.top,
                      left: productPanelRect.left,
                      width: productPanelRect.width,
                      zIndex: 10050,
                    }}
                  >
                    {productSearchPending && !productsLoading ? (
                      <p
                        className="border-b border-slate-100 px-3 py-1.5 text-xs text-slate-400 dark:border-slate-800"
                        aria-live="polite"
                      >
                        Searching…
                      </p>
                    ) : null}
                    {productsLoading ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Loading…</p>
                    ) : displayedProductRows.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        {productCandidates.length === 0
                          ? 'No products in catalog match.'
                          : 'No products match your search in this page — try a different term.'}
                      </p>
                    ) : (
                      displayedProductRows.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          disabled={selectedProducts.some((x) => x.id === p.id)}
                          className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addProduct(p)}
                        >
                          <span className="font-medium text-slate-900 dark:text-slate-50">{p.name}</span>
                          <span className="font-mono text-xs text-slate-500">{p.id}</span>
                        </button>
                      ))
                    )}
                  </div>,
                  document.body,
                )
              : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">Pick from the catalog list (search narrows results).</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="rounded border-slate-300"
          />
          Published
        </label>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <Link
            to={isNew ? '/blogs' : `/blogs/${encodeURIComponent(blogId!)}`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

export function BlogEditorPage() {
  return (
    <BlogLocalImagesProvider>
      <BlogEditorPageInner />
    </BlogLocalImagesProvider>
  )
}

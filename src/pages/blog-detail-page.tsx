import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  deleteBlog,
  fetchBlogAnalytics,
  fetchBlogDetail,
  type BlogAnalytics,
  type BlogRecord,
} from '../lib/api/blogs'

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function BlogBodyContent({ body }: { body: string }) {
  const t = body.trim()
  const looksLikeHtml = t.startsWith('<') && /<\/[a-z][\s>]|<br\s*\/?>/i.test(t)
  if (looksLikeHtml) {
    return (
      <div
        className="blog-body-html blog-article-prose rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    )
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-200">
        {body}
      </pre>
    </div>
  )
}

export function BlogDetailPage() {
  const { blogId } = useParams<{ blogId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const [blog, setBlog] = useState<BlogRecord | null>(null)
  const [analytics, setAnalytics] = useState<BlogAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    if (!blogId || !token) return
    setLoading(true)
    try {
      const [b, a] = await Promise.all([
        fetchBlogDetail(token, blogId),
        fetchBlogAnalytics(token, blogId),
      ])
      setBlog(b)
      setAnalytics(a)
    } catch (e) {
      showApiError(e)
      setBlog(null)
    } finally {
      setLoading(false)
    }
  }, [blogId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleDelete() {
    if (!token || !blogId || !blog) return
    if (!window.confirm(`Delete blog “${blog.title}”?`)) return
    setDeleting(true)
    try {
      await deleteBlog(token, blogId)
      showToast('Blog deleted.', 'success')
      navigate('/blogs')
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500 md:px-8">Loading…</div>
    )
  }
  if (!blog) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500 md:px-8">Blog not found.</div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to="/blogs" className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            ← Blogs
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{blog.title}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">/{blog.slug}</p>
          <span
            className={[
              'mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
              blog.isPublished
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
            ].join(' ')}
          >
            {blog.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/blogs/${encodeURIComponent(blogId!)}/edit`}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-lg border border-red-400/50 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {analytics ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Article views</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Counts from the public catalog when readers open this post (tracked per period).
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">7 days</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatInt(analytics.viewsLast7Days)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">30 days</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatInt(analytics.viewsLast30Days)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">365 days</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatInt(analytics.viewsLast365Days)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">All time</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {formatInt(analytics.viewsAllTime)}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {blog.tags.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Tags</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {blog.tags.map((t) => (
              <span
                key={t}
                className="inline-flex rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-700/80 dark:text-slate-200"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {blog.products.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Related products</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {blog.products.map((p) => (
              <Link
                key={p.id}
                to={`/products/${encodeURIComponent(p.id)}/edit`}
                className={[
                  'flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:border-slate-600 dark:hover:bg-slate-900',
                  p.missing ? 'opacity-80' : '',
                ].join(' ')}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                      No img
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                    {p.missing ? 'Product no longer available' : p.name || p.id}
                  </p>
                  {p.sku ? (
                    <p className="truncate font-mono text-xs text-slate-500">{p.sku}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.missing ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                        Missing
                      </span>
                    ) : null}
                    {!p.isPublished ? (
                      <span className="rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
                        Unpublished
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : blog.productIds.length > 0 ? (
        <div className="text-sm">
          <p className="font-medium text-slate-700 dark:text-slate-200">Products</p>
          <ul className="mt-1 font-mono text-xs text-slate-500">
            {blog.productIds.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {blog.relatedBlogs.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Related (by tags)</h2>
          <ul className="mt-2 space-y-2">
            {blog.relatedBlogs.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/blogs/${encodeURIComponent(r.id)}`}
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.title}
                </Link>
                <span className="ml-2 text-xs text-slate-500">({r.tagOverlap} shared)</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BlogBodyContent body={blog.body} />
    </div>
  )
}

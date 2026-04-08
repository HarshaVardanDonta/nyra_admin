import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { deleteBlogPromotion, fetchBlogPromotionDetail, type BlogPromotionRecord } from '../lib/api/blog-promotions'
import { resolveMediaUrl } from '../lib/media-url'

export function BlogPromotionDetailPage() {
  const { blogPromotionId } = useParams<{ blogPromotionId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const [promo, setPromo] = useState<BlogPromotionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    if (!blogPromotionId || !token) return
    setLoading(true)
    try {
      const p = await fetchBlogPromotionDetail(token, blogPromotionId)
      setPromo(p)
    } catch (e) {
      showApiError(e)
      setPromo(null)
    } finally {
      setLoading(false)
    }
  }, [blogPromotionId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

  async function handleDelete() {
    if (!token || !blogPromotionId || !promo) return
    if (!window.confirm(`Delete promotion “${promo.title}”?`)) return
    setDeleting(true)
    try {
      await deleteBlogPromotion(token, blogPromotionId)
      showToast('Deleted.', 'success')
      navigate('/blog-promotions')
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500 md:px-8">Loading…</div>
  }
  if (!promo) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-500 md:px-8">Not found.</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <Link
        to="/blog-promotions"
        className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
      >
        ← Blog promotions
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{promo.title}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{promo.blogId}</p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/blog-promotions/${encodeURIComponent(blogPromotionId!)}/edit`}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-lg border border-red-400/50 px-3 py-2 text-sm text-red-600 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>

      {promo.imageUrl ? (
        <img
          src={resolveMediaUrl(promo.imageUrl)}
          alt=""
          className="max-h-64 w-full rounded-xl object-cover"
        />
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Priority</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">{promo.priorityOrder}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Active</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">{promo.isActive ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Start</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">{promo.startAt ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">End</dt>
          <dd className="font-medium text-slate-900 dark:text-slate-50">{promo.endAt ?? '—'}</dd>
        </div>
      </dl>

      {promo.ctaButtons.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">CTAs</h2>
          <ul className="mt-2 space-y-2">
            {promo.ctaButtons.map((c, i) => (
              <li key={i}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {c.label}
                </a>
                <span className="ml-2 font-mono text-xs text-slate-500">{c.url}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

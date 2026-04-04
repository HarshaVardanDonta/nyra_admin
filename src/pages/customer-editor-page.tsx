import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchCustomer, updateCustomer, type CustomerWriteBody } from '../lib/api/customers'

export function CustomerEditorPage() {
  const { customerId: idParam } = useParams<{ customerId: string }>()
  const customerId = Number(idParam)
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [status, setStatus] = useState('active')
  const [membershipTier, setMembershipTier] = useState('')
  const [membershipSince, setMembershipSince] = useState('')
  const [source, setSource] = useState('')

  const load = useCallback(async () => {
    if (!token || !Number.isFinite(customerId) || customerId <= 0) return
    setLoading(true)
    try {
      const c = await fetchCustomer(token, customerId)
      setFirstName(c.firstName)
      setLastName(c.lastName)
      setEmail(c.email)
      setPhone(c.phone)
      setAvatarUrl(c.avatarUrl)
      setStatus(c.status || 'active')
      setMembershipTier(c.membershipTier)
      setSource(c.source)
      setMembershipSince(
        c.membershipSince != null && Number.isFinite(c.membershipSince)
          ? String(c.membershipSince)
          : '',
      )
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [token, customerId, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !Number.isFinite(customerId) || customerId <= 0) return
    const ms = membershipSince.trim()
    let membershipSinceNum: number | null = null
    if (ms !== '') {
      const n = Number(ms)
      if (!Number.isFinite(n)) {
        showToast('Membership since must be a number (e.g. year).', 'error')
        return
      }
      membershipSinceNum = Math.trunc(n)
    }
    const body: CustomerWriteBody = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      avatarUrl: avatarUrl.trim(),
      status: status.trim() || 'active',
      membershipTier: membershipTier.trim(),
      membershipSince: membershipSinceNum,
      source: source.trim(),
    }
    setSaving(true)
    try {
      await updateCustomer(token, customerId, body)
      showToast('Customer updated.', 'success')
      navigate(`/customers/${customerId}`, { replace: true })
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  if (!Number.isFinite(customerId) || customerId <= 0) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400 lg:p-10">
        Invalid customer id.
      </div>
    )
  }

  if (!token) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400 lg:p-10">
        Sign in to edit this customer.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <nav className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
        <Link to="/customers" className="transition hover:underline">
          Customers
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <Link to={`/customers/${customerId}`} className="transition hover:underline">
          Details
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500 dark:text-slate-400">Edit</span>
      </nav>

      <h1 className="text-2xl font-semibold tracking-tight">Edit customer</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Update profile fields stored for this customer.
      </p>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-8 max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            First name
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Last name
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Avatar URL
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Status
          <input
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            placeholder="active"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Membership tier
            <input
              value={membershipTier}
              onChange={(e) => setMembershipTier(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
            Membership since (year)
            <input
              value={membershipSince}
              onChange={(e) => setMembershipSince(e.target.value)}
              placeholder="2023"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Source
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <Link
            to={`/customers/${customerId}`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

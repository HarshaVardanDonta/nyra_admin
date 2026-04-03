import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useTheme } from '../contexts/use-theme'
import { sendOtp, verifyAdminOtp } from '../lib/api/auth'
import { ApiError } from '../lib/api/errors'

function BrandMark() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15 text-blue-600"
        aria-hidden
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8h15l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 4H3" />
          <path d="M10 11v4M14 11v4" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        Nyra Admin
      </span>
    </div>
  )
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const showOtpStep = Boolean(requestId)

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = phone.trim()
    if (!trimmed) {
      setError('Enter your phone number')
      return
    }
    setLoading(true)
    try {
      const { request_id } = await sendOtp(trimmed)
      setRequestId(request_id)
      setOtp('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedPhone = phone.trim()
    const trimmedOtp = otp.trim()
    if (!requestId || !trimmedOtp) {
      setError('Enter the code we sent you')
      return
    }
    setLoading(true)
    try {
      const { token } = await verifyAdminOtp({
        phone: trimmedPhone,
        otp: trimmedOtp,
        request_id: requestId,
      })
      login(token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  function handleChangeNumber() {
    setRequestId(null)
    setOtp('')
    setError(null)
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.08),transparent),rgb(241_245_249)] px-4 py-12 dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent),rgb(11_17_32)]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden
      >
        <svg
          className="h-full w-full"
          preserveAspectRatio="none"
          viewBox="0 0 400 120"
        >
          <path
            d="M0,90 Q100,20 200,70 T400,40 L400,120 L0,120 Z"
            fill="url(#g)"
          />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative w-full max-w-[400px] rounded-xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
        <div className="mb-8">
          <BrandMark />
          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {showOtpStep
              ? 'Enter the OTP sent to your phone'
              : 'Sign in with your admin phone number'}
          </p>
        </div>

        {error ? (
          <div
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {!showOtpStep ? (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            <div className="text-left">
              <label
                htmlFor="phone"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                placeholder="+919876543210"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <p className="text-left text-xs text-slate-500 dark:text-slate-400">
              Code sent to{' '}
              <span className="text-slate-900 dark:text-slate-50">{phone.trim()}</span>
              <button
                type="button"
                onClick={handleChangeNumber}
                className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
              >
                Change
              </button>
            </p>
            <div className="text-left">
              <label
                htmlFor="otp"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                One-time code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(ev) => setOtp(ev.target.value)}
                placeholder="Enter OTP"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        )}
        <div className="mt-6 flex justify-center border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            onClick={toggleTheme}
            className="text-xs font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50"
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </div>
    </div>
  )
}

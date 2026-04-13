import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PhoneInput, defaultCountries } from 'react-international-phone'
import 'react-international-phone/style.css'
import { useAuth } from '../contexts/use-auth'
import { useTheme } from '../contexts/use-theme'
import {
  exchangeMsg91WidgetSession,
  sendOtp,
  verifyAdminOtp,
} from '../lib/api/auth'
import { ApiError, getErrorMessage } from '../lib/api/errors'
import {
  getMsg91WidgetCredentials,
  initMsg91Widget,
  msg91RetryOtp,
  msg91SendOtp,
  msg91VerifyOtp,
  toMsg91MobileIdentifier,
  useMsg91WidgetLogin,
  useMsg91WidgetServerProxy,
} from '../lib/msg91-widget'

const INDIA_ONLY_COUNTRIES = defaultCountries.filter((c) => c[1] === 'in')

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
  const widgetMode = useMsg91WidgetLogin()
  const serverProxyMode = useMsg91WidgetServerProxy()
  const [widgetReady, setWidgetReady] = useState(!widgetMode)
  const [phone, setPhone] = useState('+91')
  const [otp, setOtp] = useState('')
  const [requestId, setRequestId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  useEffect(() => {
    if (!widgetMode) {
      setWidgetReady(true)
      return
    }
    if (serverProxyMode) {
      setWidgetReady(true)
      return
    }
    const creds = getMsg91WidgetCredentials()
    if (!creds) {
      return
    }
    let cancelled = false
    setWidgetReady(false)
    void initMsg91Widget(creds.widgetId, creds.authToken)
      .then(() => {
        if (!cancelled) {
          setWidgetReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not initialize MSG91 OTP widget')
          setWidgetReady(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [widgetMode, serverProxyMode])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const showOtpStep = Boolean(requestId)
  const trimmedPhone = phone.trim()

  const localDigits = phoneInput.replace(/\D/g, '')
  const canSendOtp =
    country === '+91' &&
    localDigits.length === 10 &&
    /^[6-9]/.test(localDigits) &&
    !loading &&
    !(widgetMode && !widgetReady)

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!trimmedPhone || trimmedPhone === '+91') {
      setError('Enter your phone number')
      return
    }
    if (widgetMode && !widgetReady) {
      setError('OTP widget is still loading')
      return
    }
    setLoading(true)
    try {
      if (widgetMode) {
        const identifier = toMsg91MobileIdentifier(trimmedPhone)
        if (!identifier) {
          setError('Enter a valid Indian mobile number (10 digits or +91…)')
          return
        }
        const req = await msg91SendOtp(identifier)
        setRequestId(req)
        setOtp('')
      } else {
        const { request_id } = await sendOtp(trimmedPhone)
        setRequestId(request_id)
        setOtp('')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedOtp = otp.trim()
    const localPhone = normalizeIndiaLocalPhone(phoneInput)
    if (!requestId || !trimmedOtp) {
      setError('Enter the code we sent you')
      return
    }
    if (!trimmedPhone) {
      setError('Enter your phone number')
      return
    }
    setLoading(true)
    try {
      if (widgetMode) {
        const accessToken = await msg91VerifyOtp(requestId, trimmedOtp)
        const { token, refresh_token } =
          await exchangeMsg91WidgetSession(accessToken)
        login(token, refresh_token)
        navigate('/dashboard', { replace: true })
      } else {
        const { token, refresh_token } = await verifyAdminOtp({
          phone: localPhone,
          otp: trimmedOtp,
          request_id: requestId,
        })
        login(token, refresh_token)
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendWidgetOtp() {
    if (!requestId || !widgetMode || resendLoading) {
      return
    }
    setError(null)
    setResendLoading(true)
    try {
      await msg91RetryOtp(requestId)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : getErrorMessage(err))
    } finally {
      setResendLoading(false)
    }
  }

  function handleChangeNumber() {
    setRequestId(null)
    setOtp('')
    setError(null)
  }

  const displayPhone =
    localDigits.length === 10
      ? `+91 ${localDigits.slice(0, 5)} ${localDigits.slice(5)}`
      : `+91 ${localDigits}`

  return (
    <div className="relative h-full min-h-0 overflow-y-auto overscroll-y-contain bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.08),transparent),rgb(241_245_249)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(37,99,235,0.12),transparent),rgb(11_17_32)]">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
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

      <div className="relative flex min-h-full items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-[400px] rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20 sm:p-8">
          <div className="mb-8">
            <BrandMark />
            <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {showOtpStep
                ? 'Enter the OTP sent to your phone'
                : 'Sign in with your admin phone number'}
            </p>
            {widgetMode ? (
              <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
                Secured with MSG91 OTP
                {serverProxyMode ? ' · via Nyra API' : ''}
                {!widgetReady ? ' · Initializing…' : ''}
              </p>
            ) : null}
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
              <div className="w-full min-w-0">
                <label
                  htmlFor="phone"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                >
                  Phone number
                </label>
                <PhoneInput
                  defaultCountry="in"
                  countries={INDIA_ONLY_COUNTRIES}
                  value={phone}
                  onChange={setPhone}
                  inputProps={{
                    id: 'phone',
                    name: 'phone',
                    autoComplete: 'tel',
                    placeholder: '9876543210',
                  }}
                  className="w-full [&_.react-international-phone-country-selector-button]:rounded-lg [&_.react-international-phone-country-selector-button]:border-slate-300 [&_.react-international-phone-country-selector-button]:bg-white dark:[&_.react-international-phone-country-selector-button]:border-slate-600 dark:[&_.react-international-phone-country-selector-button]:bg-slate-900 [&_.react-international-phone-country-selector-button]:text-slate-900 dark:[&_.react-international-phone-country-selector-button]:text-slate-50 [&_.react-international-phone-input]:w-full [&_.react-international-phone-input]:rounded-lg [&_.react-international-phone-input]:border-slate-300 [&_.react-international-phone-input]:bg-white [&_.react-international-phone-input]:px-3 [&_.react-international-phone-input]:py-2.5 [&_.react-international-phone-input]:text-sm [&_.react-international-phone-input]:text-slate-900 [&_.react-international-phone-input]:outline-none [&_.react-international-phone-input]:transition [&_.react-international-phone-input]:placeholder:text-slate-500 [&_.react-international-phone-input]:focus:border-blue-600 [&_.react-international-phone-input]:focus:ring-4 [&_.react-international-phone-input]:focus:ring-blue-500/20 dark:[&_.react-international-phone-input]:border-slate-600 dark:[&_.react-international-phone-input]:bg-slate-900 dark:[&_.react-international-phone-input]:text-slate-50 dark:[&_.react-international-phone-input]:placeholder:text-slate-400 dark:[&_.react-international-phone-input]:focus:border-blue-500"
                />
              </div>
              {country !== '+91' ? (
                <p className="text-left text-xs text-amber-700 dark:text-amber-200/90">
                  OTP is available for +91 only right now.
                </p>
              ) : null}
              <button
                type="submit"
                disabled={!canSendOtp}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <p className="text-left text-xs text-slate-500 dark:text-slate-400">
                Code sent to{' '}
                <span className="text-slate-900 dark:text-slate-50">
                  {trimmedPhone}
                </span>
                <button
                  type="button"
                  onClick={handleChangeNumber}
                  className="ml-2 text-blue-600 hover:underline dark:text-blue-400"
                >
                  Change
                </button>
              </p>
              {widgetMode ? (
                <div className="text-left">
                  <button
                    type="button"
                    onClick={handleResendWidgetOtp}
                    disabled={resendLoading}
                    className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-400"
                  >
                    {resendLoading ? 'Resending…' : 'Resend code (SMS)'}
                  </button>
                </div>
              ) : null}
              <div className="text-left">
                <label
                  htmlFor="otp"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
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
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-ink placeholder:text-slate-400 focus:border-brand-deep focus:outline-none focus:ring-2 focus:ring-brand-deep/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50 dark:placeholder:text-slate-400 dark:focus:border-brand-deep dark:focus:ring-brand-deep/30"
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
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { ApiError } from '../lib/api/errors'
import {
  createDeliveryPincodeRule,
  deleteDeliveryPincodeRule,
  fetchDeliveryPincodeRule,
  fetchDeliveryPincodeRules,
  updateDeliveryPincodeRule,
  type DeliveryPincodeRule,
  type DeliveryPincodeRuleWrite,
} from '../lib/api/delivery-pincode-rules'

function formatMoneyINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

const PIN_RE = /^[0-9]{6}$/

export function DeliveryPincodeRulesPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [rules, setRules] = useState<DeliveryPincodeRule[]>([])
  const [loading, setLoading] = useState(true)

  const [checkInput, setCheckInput] = useState('')
  const [checkBusy, setCheckBusy] = useState(false)
  const [checkResult, setCheckResult] = useState<
    | { kind: 'ok'; rule: DeliveryPincodeRule }
    | { kind: 'missing' }
    | { kind: 'idle' }
  >({ kind: 'idle' })

  const [modalOpen, setModalOpen] = useState(false)
  const [editingPincode, setEditingPincode] = useState<string | null>(null)
  const [form, setForm] = useState<DeliveryPincodeRuleWrite>({
    pincode: '',
    minDeliveryDays: 2,
    maxDeliveryDays: 5,
    deliveryFeeRupees: 49,
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { rules: list } = await fetchDeliveryPincodeRules(token, { limit: 500, offset: 0 })
      setRules(list.sort((a, b) => a.pincode.localeCompare(b.pincode)))
    } catch (e) {
      showApiError(e)
      setRules([])
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditingPincode(null)
    setForm({
      pincode: '',
      minDeliveryDays: 2,
      maxDeliveryDays: 5,
      deliveryFeeRupees: 49,
      notes: '',
    })
    setModalOpen(true)
  }

  function openEdit(r: DeliveryPincodeRule) {
    setEditingPincode(r.pincode)
    setForm({
      pincode: r.pincode,
      minDeliveryDays: r.minDeliveryDays,
      maxDeliveryDays: r.maxDeliveryDays,
      deliveryFeeRupees: r.deliveryFeePaise / 100,
      notes: r.notes ?? '',
    })
    setModalOpen(true)
  }

  async function handleSaveModal(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in to save.', 'error')
      return
    }
    const pc = form.pincode.replace(/\D/g, '').slice(0, 6)
    if (!PIN_RE.test(pc)) {
      showToast('Enter a valid 6-digit pincode.', 'error')
      return
    }
    if (form.minDeliveryDays < 0 || form.maxDeliveryDays < form.minDeliveryDays) {
      showToast('Invalid day range.', 'error')
      return
    }
    if (form.deliveryFeeRupees < 0) {
      showToast('Fee cannot be negative.', 'error')
      return
    }
    setSaving(true)
    try {
      if (editingPincode) {
        await updateDeliveryPincodeRule(token, editingPincode, {
          minDeliveryDays: form.minDeliveryDays,
          maxDeliveryDays: form.maxDeliveryDays,
          deliveryFeeRupees: form.deliveryFeeRupees,
          notes: form.notes,
        })
        showToast('Rule updated.', 'success')
      } else {
        await createDeliveryPincodeRule(token, { ...form, pincode: pc })
        showToast('Rule created.', 'success')
      }
      setModalOpen(false)
      void load()
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pincode: string) {
    if (!token) return
    if (!window.confirm(`Delete delivery rule for ${pincode}?`)) return
    try {
      await deleteDeliveryPincodeRule(token, pincode)
      showToast('Rule deleted.', 'success')
      void load()
    } catch (e) {
      showApiError(e)
    }
  }

  async function runPincodeCheck() {
    const raw = checkInput.replace(/\D/g, '').slice(0, 6)
    if (!PIN_RE.test(raw)) {
      showToast('Enter a 6-digit pincode to check.', 'error')
      return
    }
    if (!token) {
      showToast('Sign in to check.', 'error')
      return
    }
    setCheckBusy(true)
    setCheckResult({ kind: 'idle' })
    try {
      const rule = await fetchDeliveryPincodeRule(token, raw)
      setCheckResult({ kind: 'ok', rule })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setCheckResult({ kind: 'missing' })
      } else {
        showApiError(e)
        setCheckResult({ kind: 'idle' })
      }
    } finally {
      setCheckBusy(false)
    }
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery pincode rules</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Configure delivery time and fees per pincode. The storefront uses these for estimates at checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add rule
        </button>
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm dark:border-slate-800 dark:from-[#111827] dark:to-[#0d1117]">
        <div className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/80">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Check pincode availability</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            See whether delivery is configured for a pincode before a customer asks.
          </p>
        </div>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Pincode</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={checkInput}
              onChange={(e) => setCheckInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runPincodeCheck()
              }}
              placeholder="e.g. 411001"
              className="mt-1.5 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
          <button
            type="button"
            disabled={checkBusy}
            onClick={() => void runPincodeCheck()}
            className="shrink-0 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-50"
          >
            {checkBusy ? 'Checking…' : 'Check'}
          </button>
        </div>
        {checkResult.kind === 'ok' ? (
          <div className="mx-4 mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Delivery available</p>
            <dl className="mt-2 grid gap-1 text-sm text-emerald-900/90 dark:text-emerald-100/90 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Pincode</dt>
                <dd className="font-mono font-medium">{checkResult.rule.pincode}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Delivery fee</dt>
                <dd className="font-medium">{formatMoneyINR(checkResult.rule.deliveryFeePaise / 100)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Est. days</dt>
                <dd>
                  {checkResult.rule.minDeliveryDays === checkResult.rule.maxDeliveryDays
                    ? `${checkResult.rule.minDeliveryDays} day(s)`
                    : `${checkResult.rule.minDeliveryDays}–${checkResult.rule.maxDeliveryDays} days`}
                </dd>
              </div>
              {checkResult.rule.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Notes</dt>
                  <dd>{checkResult.rule.notes}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
        {checkResult.kind === 'missing' ? (
          <div className="mx-4 mb-4 rounded-lg border border-amber-500/45 bg-amber-500/10 px-4 py-3 dark:border-amber-500/35 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Delivery not configured</p>
            <p className="mt-1 text-sm text-amber-900/85 dark:text-amber-100/85">
              There is no delivery rule for this pincode. Add a row in the table below to enable delivery and set timing
              and fees.
            </p>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold">All rules ({rules.length})</h2>
        </div>
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No rules yet. Add one to start.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Pincode</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Fee</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Notes</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rules.map((r) => (
                  <tr key={r.pincode} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono font-medium">{r.pincode}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {r.minDeliveryDays === r.maxDeliveryDays
                        ? `${r.minDeliveryDays}d`
                        : `${r.minDeliveryDays}–${r.maxDeliveryDays}d`}
                    </td>
                    <td className="px-4 py-3">{formatMoneyINR(r.deliveryFeePaise / 100)}</td>
                    <td className="hidden max-w-xs truncate px-4 py-3 text-slate-600 dark:text-slate-400 md:table-cell">
                      {r.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="mr-2 text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(r.pincode)}
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="rule-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
            <h2 id="rule-modal-title" className="text-lg font-semibold">
              {editingPincode ? `Edit ${editingPincode}` : 'Add rule'}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={handleSaveModal}>
              {!editingPincode ? (
                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Pincode</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={form.pincode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        pincode: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Min days</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.minDeliveryDays}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, minDeliveryDays: Number(e.target.value) || 0 }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Max days</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.maxDeliveryDays}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxDeliveryDays: Number(e.target.value) || 0 }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Delivery fee (INR)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={form.deliveryFeeRupees}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deliveryFeeRupees: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

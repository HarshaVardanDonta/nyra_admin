import { useCallback, useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { getStoreTaxSettings, patchStoreTaxSettings } from '../lib/api/storeTax'

function rateToPercentString(rate: number): string {
  if (!Number.isFinite(rate) || rate < 0) return ''
  const pct = rate <= 1 ? rate * 100 : rate
  const rounded = Math.round(pct * 1e6) / 1e6
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded).replace(/\.?0+$/, '')
}

export function StoreTaxSettingsPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const baseId = useId()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<{ id: string; label: string; percentStr: string }[]>([
    { id: 'a', label: 'CGST', percentStr: '9' },
    { id: 'b', label: 'SGST', percentStr: '9' },
  ])

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const s = await getStoreTaxSettings(token)
      if (s.defaultTaxComponents.length > 0) {
        setRows(
          s.defaultTaxComponents.map((c, i) => ({
            id: `load-${i}`,
            label: c.label,
            percentStr: rateToPercentString(c.rate),
          })),
        )
      } else {
        const r = s.defaultTaxRate
        if (r > 0) {
          const half = r / 2
          setRows([
            { id: 'cgst', label: 'CGST', percentStr: rateToPercentString(half) },
            { id: 'sgst', label: 'SGST', percentStr: rateToPercentString(half) },
          ])
        } else {
          setRows([
            { id: 'cgst', label: 'CGST', percentStr: '9' },
            { id: 'sgst', label: 'SGST', percentStr: '9' },
          ])
        }
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  function addRow() {
    setRows((r) => [...r, { id: `${baseId}-${Date.now()}`, label: '', percentStr: '' }])
  }

  function removeRow(index: number) {
    setRows((r) => r.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in again to continue.', 'error')
      return
    }
    const comps: { label: string; rate: number }[] = []
    let sumPct = 0
    for (const row of rows) {
      const label = row.label.trim() || 'Tax'
      const t = row.percentStr.trim().replace(/%/g, '')
      if (!t) {
        showToast('Each row needs a tax percent.', 'error')
        return
      }
      const n = Number.parseFloat(t.replace(/[^0-9.-]/g, ''))
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        showToast('Percents must be between 0 and 100.', 'error')
        return
      }
      sumPct += n
      comps.push({ label, rate: n / 100 })
    }
    if (comps.length === 0) {
      showToast('Add at least one tax component.', 'error')
      return
    }
    if (sumPct > 100.0001) {
      showToast('Sum of component percents cannot exceed 100%.', 'error')
      return
    }
    setSaving(true)
    try {
      await patchStoreTaxSettings(token, { defaultTaxComponents: comps })
      showToast('Store tax structure saved.', 'success')
      await load()
    } catch (e) {
      showApiError(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-24 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          ← Back to dashboard
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Store tax</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Named components applied to post-discount merchandise. Each rate is a fraction of line net. A usual
          intra-state default is{' '}
          <span className="font-medium text-slate-600 dark:text-slate-300">CGST + SGST</span> (e.g. 9% + 9%
          = 18%); use a single row such as <span className="font-medium text-slate-600 dark:text-slate-300">IGST</span>{' '}
          when you want one bucket (e.g. 18%). Product editor can override per SKU.
        </p>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]"
      >
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tax components</label>
          <button
            type="button"
            onClick={() => addRow()}
            className="text-xs font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            + Add component
          </button>
        </div>
        <ul className="mt-3 space-y-3">
          {rows.map((row, i) => (
            <li key={row.id} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[100px] flex-1">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Name
                </label>
                <input
                  value={row.label}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  placeholder="e.g. CGST"
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div className="w-24">
                <label className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  %
                </label>
                <input
                  value={row.percentStr}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, j) => (j === i ? { ...x, percentStr: e.target.value } : x)),
                    )
                  }
                  inputMode="decimal"
                  placeholder="9"
                  className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length <= 1}
                className="mb-0.5 rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Sum of percents must not exceed 100%. For a single bucket (e.g. IGST 18%), use one row.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}

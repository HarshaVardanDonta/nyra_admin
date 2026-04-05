import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function startOfLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseDateOnly(value: string): Date | null {
  const t = value.trim()
  if (!t) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const d = new Date(y, mo, day)
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null
  return d
}

function parseDatetimeLocalValue(value: string): Date | null {
  const t = value.trim()
  if (!t) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(t)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const hh = Number(m[4])
  const mm = Number(m[5])
  const d = new Date(y, mo, day, hh, mm, 0, 0)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function formatTriggerDate(d: Date) {
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTriggerDateTime(d: Date) {
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function calendarCells(viewYear: number, viewMonth0: number): Date[] {
  const first = new Date(viewYear, viewMonth0, 1)
  const pad = first.getDay()
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(viewYear, viewMonth0, 1 - pad + i))
  }
  return cells
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

type DialogMode = 'date' | 'datetime-local'

function DatePickerDialog({
  open,
  mode,
  value,
  onClose,
  onCommit,
}: {
  open: boolean
  mode: DialogMode
  value: string
  onClose: () => void
  onCommit: (next: string) => void
}) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth0, setViewMonth0] = useState(() => new Date().getMonth())
  const [selectedDay, setSelectedDay] = useState<Date>(() => startOfLocalDay(new Date()))
  const [timeH, setTimeH] = useState(0)
  const [timeM, setTimeM] = useState(0)

  useEffect(() => {
    if (!open) return
    const parsed =
      mode === 'date' ? parseDateOnly(value) : parseDatetimeLocalValue(value)
    const base = parsed ?? new Date()
    const day = startOfLocalDay(base)
    setSelectedDay(day)
    setViewYear(day.getFullYear())
    setViewMonth0(day.getMonth())
    setTimeH(base.getHours())
    setTimeM(base.getMinutes())
  }, [open, value, mode])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const commitDate = useCallback(
    (day: Date) => {
      const y = day.getFullYear()
      const m = day.getMonth()
      const d = day.getDate()
      onCommit(`${y}-${pad2(m + 1)}-${pad2(d)}`)
      onClose()
    },
    [onCommit, onClose],
  )

  const commitDatetime = useCallback(
    (day: Date) => {
      const y = day.getFullYear()
      const m = day.getMonth()
      const d = day.getDate()
      onCommit(`${y}-${pad2(m + 1)}-${pad2(d)}T${pad2(timeH)}:${pad2(timeM)}`)
      onClose()
    },
    [onCommit, onClose, timeH, timeM],
  )

  const applyDatetime = useCallback(() => {
    commitDatetime(selectedDay)
  }, [commitDatetime, selectedDay])

  const cells = calendarCells(viewYear, viewMonth0)
  const monthLabel = new Date(viewYear, viewMonth0, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  })

  const goPrev = () => {
    if (viewMonth0 === 0) {
      setViewMonth0(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth0((m) => m - 1)
    }
  }

  const goNext = () => {
    if (viewMonth0 === 11) {
      setViewMonth0(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth0((m) => m + 1)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-[#111827]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Previous month"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{monthLabel}</p>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Next month"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((cell, i) => {
            const inMonth = cell.getMonth() === viewMonth0
            const isSelected = sameLocalDay(cell, selectedDay)
            return (
              <button
                key={`${cell.getTime()}-${i}`}
                type="button"
                onClick={() => {
                  const day = startOfLocalDay(cell)
                  setSelectedDay(day)
                  if (mode === 'date') {
                    commitDate(day)
                  } else {
                    commitDatetime(day)
                  }
                }}
                className={[
                  'aspect-square rounded-lg text-sm font-medium transition',
                  inMonth
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-400 dark:text-slate-600',
                  isSelected
                    ? 'bg-blue-600 text-white dark:bg-blue-600 dark:text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800',
                ].join(' ')}
              >
                {cell.getDate()}
              </button>
            )
          })}
        </div>

        {mode === 'datetime-local' ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Time</span>
            <div className="flex flex-1 items-center gap-2">
              <select
                value={timeH}
                onChange={(e) => setTimeH(Number(e.target.value))}
                className="select-tail min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#0f1419] dark:text-slate-100"
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {pad2(h)}
                  </option>
                ))}
              </select>
              <span className="text-slate-500">:</span>
              <select
                value={timeM}
                onChange={(e) => setTimeM(Number(e.target.value))}
                className="select-tail min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-[#0f1419] dark:text-slate-100"
              >
                {Array.from({ length: 60 }, (_, m) => (
                  <option key={m} value={m}>
                    {pad2(m)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={applyDatetime}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
            >
              Apply
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const defaultTriggerClass =
  'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-900 transition hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-[#0f1419] dark:text-slate-50 dark:hover:border-slate-600'

const calendarIcon = (
  <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
    />
  </svg>
)

export function AdminDateField({
  id,
  value,
  onChange,
  className,
  placeholder = 'Select date',
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const autoId = useId()
  const triggerId = id ?? autoId
  const [open, setOpen] = useState(false)
  const parsed = parseDateOnly(value)

  return (
    <>
      <button
        type="button"
        id={triggerId}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={[defaultTriggerClass, className].filter(Boolean).join(' ')}
      >
        <span className={parsed ? 'text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'}>
          {parsed ? formatTriggerDate(parsed) : placeholder}
        </span>
        {calendarIcon}
      </button>
      <DatePickerDialog
        open={open}
        mode="date"
        value={value}
        onClose={() => setOpen(false)}
        onCommit={onChange}
      />
    </>
  )
}

export function AdminDateTimeField({
  id,
  value,
  onChange,
  className,
  placeholder = 'Select date & time',
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const autoId = useId()
  const triggerId = id ?? autoId
  const [open, setOpen] = useState(false)
  const parsed = parseDatetimeLocalValue(value)

  return (
    <>
      <button
        type="button"
        id={triggerId}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={[defaultTriggerClass, className].filter(Boolean).join(' ')}
      >
        <span className={parsed ? 'text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'}>
          {parsed ? formatTriggerDateTime(parsed) : placeholder}
        </span>
        {calendarIcon}
      </button>
      <DatePickerDialog
        open={open}
        mode="datetime-local"
        value={value}
        onClose={() => setOpen(false)}
        onCommit={onChange}
      />
    </>
  )
}

import { CalendarDays } from 'lucide-react'
import { useRef } from 'react'
import type { TaskStatus } from '../api'
import { dueState, formatDueDate, type DueState } from '../lib/dates'

// colour coordinated pills based on due date
const PILL_STYLES: Record<DueState, string> = {
  none: 'border-dashed border-slate-300 bg-white/60 text-slate-500',
  done: 'border-slate-200 bg-slate-100 text-slate-500',
  overdue: 'border-rose-200 bg-rose-100 text-rose-700',
  soon: 'border-amber-200 bg-amber-100 text-amber-800',
  later: 'border-sky-200 bg-sky-50 text-sky-800',
}

interface DuePillProps {
  dueDate: string | null
  status: TaskStatus
  today: string
  label: string
  disabled?: boolean
  onChange: (dueDate: string | null) => void
}

// calendar pill, colour shows how close the due date is
// click it to open the browser's date picker
export default function DuePill({
  dueDate,
  status,
  today,
  label,
  disabled = false,
  onChange,
}: DuePillProps) {
  const input = useRef<HTMLInputElement>(null)
  const state = dueState(dueDate, status, today)

  let text = 'Add due date'
  if (dueDate) {
    text = formatDueDate(dueDate, today)
    if (state === 'overdue') text = `Overdue · ${text}`
  }

  function openPicker() {
    try {
      input.current?.showPicker()
    } catch {
      input.current?.focus()
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        aria-label={`${label}: ${dueDate ?? 'none'}`}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:brightness-95 disabled:opacity-50 ${PILL_STYLES[state]}`}
      >
        <CalendarDays size={12} aria-hidden="true" />
        {text}
      </button>
      {/* Hidden under the pill so the browser's picker opens next to it. */}
      <input
        ref={input}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={dueDate ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  )
}

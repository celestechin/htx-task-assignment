import { CalendarDays } from 'lucide-react'
import type { TaskStatus } from '../api'
import { dueState, formatDayMonthYear, formatDueDate, type DueState } from '../lib/dates'
import { usePopover } from '../lib/usePopover'
import Calendar from './Calendar'

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

// clicking it opens a calendar to pick or clear the date
// amber within 2 days, red when overdue, grey once done
export default function DuePill({
  dueDate,
  status,
  today,
  label,
  disabled = false,
  onChange,
}: DuePillProps) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>()
  const state = dueState(dueDate, status, today)

  let text = 'Add due date'
  if (dueDate) {
    text = formatDueDate(dueDate, today)
    if (state === 'overdue') text = `Overdue · ${text}`
  }

  function choose(isoDate: string | null) {
    setOpen(false)
    if (isoDate !== dueDate) onChange(isoDate)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${dueDate ? formatDayMonthYear(dueDate) : 'none'}`}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium hover:brightness-95 disabled:opacity-50 ${PILL_STYLES[state]}`}
      >
        <CalendarDays size={12} aria-hidden="true" />
        {text}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute top-full left-0 z-20 mt-2 rounded-2xl border border-violet-100 bg-white p-2 shadow-lg shadow-violet-200/50"
        >
          <Calendar value={dueDate} onSelect={choose} />
          {dueDate && (
            <div className="border-t border-violet-50 px-2 pt-2 text-right">
              <button
                type="button"
                onClick={() => choose(null)}
                className="text-xs font-medium text-violet-600 hover:text-violet-800"
              >
                Clear due date
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

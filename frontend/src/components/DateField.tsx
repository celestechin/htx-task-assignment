import { CalendarDays } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatDayMonthYear, parseDayMonthYear } from '../lib/dates'
import Calendar from './Calendar'

interface DateFieldProps {
  id: string
  value: string | null
  onChange: (isoDate: string | null) => void
}

// a date input for forms (DD/MM/YYYY), type it or pick it from the calendar
export default function DateField({ id, value, onChange }: DateFieldProps) {
  const input = useRef<HTMLInputElement>(null)
  // what's in the box, which can be half typed, separate from the real date value
  const [text, setText] = useState(value ? formatDayMonthYear(value) : '')
  const [showCalendar, setShowCalendar] = useState(false)

  // half-typed or impossible date blocks the form from submitting
  function setValid(valid: boolean) {
    input.current?.setCustomValidity(valid ? '' : 'Enter a date as DD/MM/YYYY')
  }

  // only pass a date up once it's a full, real date
  function handleTyping(raw: string) {
    setText(raw)
    if (raw.trim() === '') {
      setValid(true)
      onChange(null)
      return
    }
    const isoDate = parseDayMonthYear(raw)
    setValid(isoDate !== null)
    if (isoDate) onChange(isoDate)
  }

  function choose(isoDate: string | null) {
    setText(isoDate ? formatDayMonthYear(isoDate) : '')
    setValid(true)
    setShowCalendar(false)
    onChange(isoDate)
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/YYYY"
          value={text}
          onChange={(event) => handleTyping(event.target.value)}
          className="w-36 rounded-xl border border-violet-100 px-3 py-1.5 text-sm invalid:border-rose-300 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
        <button
          type="button"
          aria-label="Choose a date from the calendar"
          aria-expanded={showCalendar}
          onClick={() => setShowCalendar(!showCalendar)}
          className="rounded-full p-1.5 text-violet-500 hover:bg-violet-100"
        >
          <CalendarDays size={18} aria-hidden="true" />
        </button>
        {text && (
          <button
            type="button"
            onClick={() => choose(null)}
            className="text-xs font-medium text-violet-600 hover:text-violet-800"
          >
            Clear
          </button>
        )}
      </div>
      {showCalendar && (
        <div className="mt-2 inline-block rounded-2xl border border-violet-100 bg-white p-2 shadow-sm">
          <Calendar value={value} onSelect={choose} />
        </div>
      )}
    </div>
  )
}

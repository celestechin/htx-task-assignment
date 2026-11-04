import { DayPicker } from 'react-day-picker'
import { enGB } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { fromIsoDate, toIsoDate } from '../lib/dates'

interface CalendarProps {
  value: string | null
  onSelect: (isoDate: string) => void
}

// a month calendar, weeks start on monday 
// the browser's own date input follows the computer's format, this one is always DD/MM/YYYY
export default function Calendar({ value, onSelect }: CalendarProps) {
  const selected = value ? fromIsoDate(value) : undefined
  return (
    <DayPicker
      className="calendar-pastel"
      mode="single"
      locale={enGB}
      weekStartsOn={1}
      selected={selected}
      defaultMonth={selected}
      // clicking the selected day again passes undefined, keep the date instead
      onSelect={(date) => date && onSelect(toIsoDate(date))}
    />
  )
}

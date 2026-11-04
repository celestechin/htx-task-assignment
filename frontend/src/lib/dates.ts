import type { TaskStatus } from '../api'

export type DueState = 'none' | 'done' | 'overdue' | 'soon' | 'later'

// tasks due within this many days count as "due soon"
export const DUE_SOON_DAYS = 2

// dates go to and from the api as "2026-11-05"
// people see and type them as "05/11/2026" (DD/MM/YYYY)

// a Date as "2026-11-05" in the user's own time zone
// not toISOString(), that uses UTC and can land on the wrong day
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayString(now = new Date()): string {
  return toIsoDate(now)
}

export function fromIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// changing format to DD/MM/YYYY
export function formatDayMonthYear(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}/${month}/${year}`
}

// "5/11/2026" or "05/11/2026" -> "2026-11-05"
// returns null if it's not a real date, e.g. 31/02/2026
export function parseDayMonthYear(text: string): string | null {
  const match = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(text)
  if (!match) return null
  const [, day, month, year] = match.map(Number)
  const date = new Date(year, month - 1, day)
  // js quietly rolls 31/02 over to 03/03, so check the day didn't change
  const isRealDate =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return isRealDate ? toIsoDate(date) : null
}

function daysBetween(from: string, to: string): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.round((Date.parse(to) - Date.parse(from)) / millisecondsPerDay)
}

// decides the pill colour
// done tasks go grey no matter the date
export function dueState(dueDate: string | null, status: TaskStatus, today: string): DueState {
  if (!dueDate) return 'none'
  if (status === 'Done') return 'done'
  const daysLeft = daysBetween(today, dueDate)
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= DUE_SOON_DAYS) return 'soon'
  return 'later'
}

// display "Today", "Tomorrow", or a short date like "4 Nov"
export function formatDueDate(dueDate: string, today: string): string {
  const daysLeft = daysBetween(today, dueDate)
  if (daysLeft === 0) return 'Today'
  if (daysLeft === 1) return 'Tomorrow'
  const sameYear = dueDate.slice(0, 4) === today.slice(0, 4)
  return fromIsoDate(dueDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

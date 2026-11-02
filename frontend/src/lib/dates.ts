import type { TaskStatus } from '../api'

export type DueState = 'none' | 'done' | 'overdue' | 'soon' | 'later'

// tasks due within this many days count as "due soon"
export const DUE_SOON_DAYS = 2

// today as "2026-11-05" in the user's own time zone
export function todayString(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
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

// "Today", "Tomorrow" or a short date like "5 Nov"
export function formatDueDate(dueDate: string, today: string): string {
  const daysLeft = daysBetween(today, dueDate)
  if (daysLeft === 0) return 'Today'
  if (daysLeft === 1) return 'Tomorrow'
  const [year, month, day] = dueDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const sameYear = year === Number(today.slice(0, 4))
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

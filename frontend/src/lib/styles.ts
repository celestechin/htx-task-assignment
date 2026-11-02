import type { TaskPriority, TaskStatus } from '../api'

// colours in one place so every part of the app matches

export const STATUS_STYLES: Record<TaskStatus, string> = {
  'To-do': 'bg-sky-100 text-sky-800 border-sky-200',
  'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
  Done: 'bg-emerald-100 text-emerald-800 border-emerald-200',
}

export const PRIORITY_STYLES: Record<TaskPriority, { pill: string; icon: string; accent: string }> = {
  High: {
    pill: 'bg-rose-100 text-rose-800 border-rose-200',
    icon: 'fill-rose-400 text-rose-500',
    accent: 'border-l-rose-300',
  },
  Medium: {
    pill: 'bg-amber-100 text-amber-800 border-amber-200',
    icon: 'fill-amber-300 text-amber-500',
    accent: 'border-l-amber-300',
  },
  Low: {
    pill: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: 'fill-emerald-300 text-emerald-500',
    accent: 'border-l-emerald-300',
  },
}

const AVATAR_STYLES = [
  'bg-violet-200 text-violet-900',
  'bg-pink-200 text-pink-900',
  'bg-sky-200 text-sky-900',
  'bg-emerald-200 text-emerald-900',
  'bg-amber-200 text-amber-900',
  'bg-teal-200 text-teal-900',
]

// same developer always gets the same colour
export function avatarStyle(developerId: number): string {
  return AVATAR_STYLES[developerId % AVATAR_STYLES.length]
}

// "Alice" -> "AL", "Mary Tan" -> "MT"
export function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : name.slice(0, 2)
  return letters.toUpperCase()
}

export const BUTTON_PRIMARY =
  'rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-200 hover:bg-violet-600 disabled:opacity-50'

export const BUTTON_SECONDARY =
  'rounded-full border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50'

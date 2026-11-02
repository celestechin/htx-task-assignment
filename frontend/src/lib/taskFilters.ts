import type { Task, TaskPriority, TaskStatus } from '../api'
import { dueState } from './dates'

export interface TaskFilters {
  search: string
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  unassigned: boolean
  overdue: boolean
  dueSoon: boolean
}

export const NO_FILTERS: TaskFilters = {
  search: '',
  statuses: [],
  priorities: [],
  unassigned: false,
  overdue: false,
  dueSoon: false,
}

// a task in the filtered list
// matches = false is a parent only kept so its matching subtask still has context
export interface VisibleTask {
  task: Task
  matches: boolean
  subtasks: VisibleTask[]
}

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.statuses.length > 0 ||
    filters.priorities.length > 0 ||
    filters.unassigned ||
    filters.overdue ||
    filters.dueSoon
  )
}

// options in the same group are OR (high or low), different groups are AND (high and unassigned)
export function taskMatches(task: Task, filters: TaskFilters, today: string): boolean {
  const search = filters.search.trim().toLowerCase()
  if (search && !task.title.toLowerCase().includes(search)) return false
  if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false
  if (filters.unassigned && task.assignee !== null) return false

  if (filters.overdue || filters.dueSoon) {
    const state = dueState(task.dueDate, task.status, today)
    const wanted = (filters.overdue && state === 'overdue') || (filters.dueSoon && state === 'soon')
    if (!wanted) return false
  }
  return true
}

// keep a task if it matches or anything under it matches
export function filterTasks(tasks: Task[], filters: TaskFilters, today: string): VisibleTask[] {
  return tasks.flatMap((task) => {
    const subtasks = filterTasks(task.subtasks, filters, today)
    const matches = taskMatches(task, filters, today)
    return matches || subtasks.length > 0 ? [{ task, matches, subtasks }] : []
  })
}

export function countTasks(tasks: Task[]): number {
  return tasks.reduce((total, task) => total + 1 + countTasks(task.subtasks), 0)
}

export function countMatches(visible: VisibleTask[]): number {
  return visible.reduce(
    (total, item) => total + (item.matches ? 1 : 0) + countMatches(item.subtasks),
    0,
  )
}

// counts every subtask below a task at all levels, and how many are done
export function subtaskProgress(task: Task): { done: number; total: number } {
  return task.subtasks.reduce(
    (progress, subtask) => {
      const below = subtaskProgress(subtask)
      return {
        done: progress.done + below.done + (subtask.status === 'Done' ? 1 : 0),
        total: progress.total + below.total + 1,
      }
    },
    { done: 0, total: 0 },
  )
}

import type { NewTask } from './api'

// a task on the create form that hasn't been saved yet
export interface TaskDraft extends NewTask {
  key: number // lets React tell drafts apart when one is removed
  subtasks: TaskDraft[]
}

// a simple counter for keys, no database id exists until it's saved
let nextKey = 1

// a blank task with the same defaults as the backend
export function newTaskDraft(): TaskDraft {
  return { key: nextKey++, title: '', skillIds: [], subtasks: [] }
}

// the key only matters to react, so leave it out of what we send to the api
// (the backend would reject it as an unknown field)
export function toNewTask({ title, skillIds, subtasks }: TaskDraft): NewTask {
  return { title, skillIds, subtasks: subtasks.map(toNewTask) }
}

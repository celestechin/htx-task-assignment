export const TASK_STATUSES = ['To-do', 'In Progress', 'Done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export interface Skill {
  id: number
  name: string
}

export interface Developer {
  id: number
  name: string
  skills: Skill[]
}

// a task as the api sends it back
export interface Task {
  id: number
  title: string
  status: TaskStatus
  parentId: number | null
  skillsPending: boolean
  skills: Skill[]
  assignee: { id: number; name: string } | null
  subtasks: Task[]
}

// what we send to create a task, empty skillIds = let gemini pick
export interface NewTask {
  title: string
  skillIds: number[]
  subtasks: NewTask[]
}

// only the fields being changed get sent
export interface TaskChanges {
  status?: TaskStatus
  assigneeId?: number | null
}

// wraps fetch so every call adds /api and the json header in the same way
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    // pull the message out of the backend's error format so pages can just show error.message
    // for validation errors the first field's message is the most useful one
    const body = await response.json().catch(() => null)
    const message = body?.error?.details?.[0]?.message ?? body?.error?.message
    throw new Error(message ?? 'Something went wrong. Please try again.')
  }
  return response.json()
}

// one small function per endpoint
export const getTasks = () => request<Task[]>('/tasks')
export const getDevelopers = () => request<Developer[]>('/developers')
export const getSkills = () => request<Skill[]>('/skills')

export const createTask = (task: NewTask) =>
  request<Task>('/tasks', { method: 'POST', body: JSON.stringify(task) })

export const updateTask = (id: number, changes: TaskChanges) =>
  request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) })

export const retryIdentifySkills = (id: number) =>
  request<Task>(`/tasks/${id}/identify-skills`, { method: 'POST' })

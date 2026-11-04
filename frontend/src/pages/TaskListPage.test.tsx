import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteTask,
  getDevelopers,
  getSkills,
  getTasks,
  updateTask,
  type Task,
} from '../api'
import TaskListPage from './TaskListPage'

// swap the api for fakes so these run without the backend
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  getTasks: vi.fn(),
  getDevelopers: vi.fn(),
  getSkills: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  retryIdentifySkills: vi.fn(),
}))

const frontend = { id: 1, name: 'Frontend' }
const backend = { id: 2, name: 'Backend' }

function makeTask(id: number, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: 'To-do',
    priority: 'Medium',
    dueDate: null,
    parentId: null,
    skillsPending: false,
    skillsSource: 'user',
    skills: [frontend],
    assignee: null,
    subtasks: [],
    ...overrides,
  }
}

async function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TaskListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByRole('heading', { name: 'Tasks' })
}

const card = (title: string) => screen.getByRole('article', { name: title })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getTasks).mockResolvedValue([
    makeTask(1, 'Unassigned task'),
    makeTask(2, 'Assigned task', {
      assignee: { id: 1, name: 'Alice' },
      priority: 'High',
      skillsSource: 'ai',
      subtasks: [
        makeTask(3, 'Finished subtask', { parentId: 2, status: 'Done' }),
        makeTask(4, 'Open subtask', { parentId: 2 }),
      ],
    }),
  ])
  vi.mocked(getDevelopers).mockResolvedValue([
    { id: 1, name: 'Alice', skills: [frontend] },
    { id: 2, name: 'Bob', skills: [backend] },
  ])
  vi.mocked(getSkills).mockResolvedValue([frontend, backend])
  vi.mocked(updateTask).mockResolvedValue({} as Task)
  vi.mocked(deleteTask).mockResolvedValue(undefined)
})

// the task list: popups, menus, filters, edit and delete
describe('TaskListPage', () => {
  it('asks for an assignee before changing the status of an unassigned task', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.selectOptions(screen.getByLabelText('Status of Unassigned task'), 'Done')

    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Please assign this task to a developer before changing its status.',
    )
    expect(updateTask).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Status of Unassigned task')).toHaveValue('To-do')

    await user.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('changes the status of an assigned task', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.selectOptions(screen.getByLabelText('Status of Assigned task'), 'In Progress')

    expect(updateTask).toHaveBeenCalledWith(2, { status: 'In Progress' })
  })

  it('shows subtask progress and marks AI-chosen skills', async () => {
    await renderPage()

    const progress = within(card('Assigned task')).getAllByRole('progressbar')[0]
    expect(progress).toHaveAttribute('aria-valuenow', '1')
    expect(progress).toHaveAttribute('aria-valuemax', '2')
    expect(within(card('Assigned task')).getAllByText('(skills identified by AI)')).toHaveLength(1)
    expect(within(card('Unassigned task')).queryByText('(skills identified by AI)')).toBeNull()
  })

  it('only offers developers with every required skill', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'Assignee of Unassigned task: Unassigned' }))
    const menu = screen.getByRole('menu', { name: 'Choose assignee for Unassigned task' })
    expect(within(menu).getByRole('menuitemradio', { name: /Alice/ })).toBeInTheDocument()
    expect(within(menu).queryByRole('menuitemradio', { name: /Bob/ })).toBeNull()

    await user.click(within(menu).getByRole('menuitemradio', { name: /Alice/ }))
    expect(updateTask).toHaveBeenCalledWith(1, { assigneeId: 1 })
  })

  it('changes priority from the coloured pill', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'Priority of Unassigned task: Medium' }))
    await user.click(screen.getByRole('menuitemradio', { name: 'High' }))

    expect(updateTask).toHaveBeenCalledWith(1, { priority: 'High' })
  })

  it('filters by search text and keeps the parent of a matching subtask', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.type(screen.getByLabelText('Search tasks'), 'open')

    expect(screen.queryByRole('article', { name: 'Unassigned task' })).toBeNull()
    expect(card('Assigned task')).toHaveClass('opacity-60')
    expect(card('Open subtask')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Finished subtask' })).toBeNull()
    expect(screen.getByText('Showing 1 of 4 tasks')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(card('Unassigned task')).toBeInTheDocument()
  })

  it('combines toggle filters', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'High', pressed: false }))
    expect(screen.queryByRole('article', { name: 'Unassigned task' })).toBeNull()
    expect(card('Assigned task')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Unassigned', pressed: false }))
    expect(screen.getByText('No tasks match these filters.')).toBeInTheDocument()
  })

  it('confirms before deleting and mentions the subtasks', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'Actions for Assigned task' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete this task?' })
    expect(dialog).toHaveTextContent('and its 2 subtasks will be deleted')
    expect(deleteTask).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(vi.mocked(deleteTask).mock.calls[0][0]).toBe(2)
  })

  it('lifts a card above the next one while its menu is open', async () => {
    const user = userEvent.setup()
    await renderPage()

    const item = card('Unassigned task').closest('li') as HTMLElement
    expect(item.className).toContain('has-[[aria-expanded=true]]:z-30')
    await user.click(screen.getByRole('button', { name: 'Assignee of Unassigned task: Unassigned' }))
    expect(item.querySelector('[aria-expanded="true"]')).not.toBeNull()
  })

  it('picks a due date from the calendar and shows it day first', async () => {
    const user = userEvent.setup()
    vi.mocked(getTasks).mockResolvedValue([
      makeTask(1, 'Dated task', { dueDate: '2030-03-04' }),
    ])
    await renderPage()

    expect(card('Dated task')).toHaveTextContent('4 Mar 2030')
    await user.click(screen.getByRole('button', { name: 'Due date of Dated task: 04/03/2030' }))
    const calendar = screen.getByRole('dialog', { name: 'Due date of Dated task' })
    await user.click(within(calendar).getByRole('button', { name: /10 March 2030/ }))

    expect(updateTask).toHaveBeenCalledWith(1, { dueDate: '2030-03-10' })
  })

  it('edits a task and only sends what changed', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'Actions for Assigned task' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit task' })
    const title = within(dialog).getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Renamed task')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    expect(updateTask).toHaveBeenCalledWith(2, { title: 'Renamed task' })
  })
})

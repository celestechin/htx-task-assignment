import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDevelopers, getTasks, updateTask, type Task } from '../api'
import TaskListPage from './TaskListPage'

// swap the api for fakes so these run without the backend
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  getTasks: vi.fn(),
  getDevelopers: vi.fn(),
  updateTask: vi.fn(),
  retryIdentifySkills: vi.fn(),
}))

const frontend = { id: 1, name: 'Frontend' }

function makeTask(id: number, title: string, assignee: Task['assignee']): Task {
  return {
    id,
    title,
    status: 'To-do',
    parentId: null,
    skillsPending: false,
    skills: [frontend],
    assignee,
    subtasks: [],
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
  await screen.findByRole('table')
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getTasks).mockResolvedValue([
    makeTask(1, 'Unassigned task', null),
    makeTask(2, 'Assigned task', { id: 1, name: 'Alice' }),
  ])
  vi.mocked(getDevelopers).mockResolvedValue([{ id: 1, name: 'Alice', skills: [frontend] }])
  vi.mocked(updateTask).mockResolvedValue({} as Task)
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
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

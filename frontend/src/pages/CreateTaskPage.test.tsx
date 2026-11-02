import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTask, getSkills, type Task } from '../api'
import CreateTaskPage from './CreateTaskPage'

// swap the api for fakes so these run without the backend
vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  createTask: vi.fn(),
  getSkills: vi.fn(),
}))

const nameOf = (number: string) => (number === '1' ? 'Task 1' : `Subtask ${number}`)

const titleBox = (number: string) => screen.getByLabelText(`${nameOf(number)} Title`)
const queryTitleBox = (number: string) => screen.queryByLabelText(`${nameOf(number)} Title`)
const card = (number: string) => titleBox(number).closest('div.rounded-2xl') as HTMLElement

const addSubtaskUnder = (number: string) =>
  userEvent.click(screen.getByRole('button', { name: `Add subtask under ${number}` }))

async function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <CreateTaskPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findAllByRole('checkbox')
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getSkills).mockResolvedValue([
    { id: 1, name: 'Frontend' },
    { id: 2, name: 'Backend' },
  ])
  vi.mocked(createTask).mockResolvedValue({} as Task)
})

// uses the form like a user would: find by label or button name, click, type, check
describe('CreateTaskPage', () => {
  it('starts with one task and no subtasks', async () => {
    await renderPage()

    expect(titleBox('1')).toBeInTheDocument()
    expect(queryTitleBox('1.1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save task' })).toBeInTheDocument()
  })

  it('numbers subtasks and nested subtasks like the wireframe', async () => {
    await renderPage()

    await addSubtaskUnder('1')
    await addSubtaskUnder('1.1')
    await addSubtaskUnder('1.1')

    expect(titleBox('1.1')).toBeInTheDocument()
    expect(titleBox('1.1.1')).toBeInTheDocument()
    expect(titleBox('1.1.2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Subtask 1.1.2' })).toBeInTheDocument()
  })

  it('says how many tasks the Save button will save', async () => {
    await renderPage()

    await addSubtaskUnder('1')
    expect(screen.getByRole('button', { name: 'Save task and 1 subtask' })).toBeInTheDocument()

    await addSubtaskUnder('1.1')
    expect(screen.getByRole('button', { name: 'Save task and 2 subtasks' })).toBeInTheDocument()
  })

  it('submits the whole tree without the React keys', async () => {
    const user = userEvent.setup()
    await renderPage()

    await addSubtaskUnder('1')
    await addSubtaskUnder('1.1')
    await user.type(titleBox('1'), 'Parent')
    await user.type(titleBox('1.1'), 'Child')
    await user.type(titleBox('1.1.1'), 'Grandchild')
    await user.click(within(card('1.1')).getByRole('checkbox', { name: 'Backend' }))
    await user.click(within(card('1.1')).getByRole('radio', { name: 'High' }))
    await user.type(screen.getByLabelText('Subtask 1.1 Due date'), '2026-12-01')
    await user.click(screen.getByRole('button', { name: /^Save task/ }))

    expect(vi.mocked(createTask).mock.calls[0][0]).toEqual({
      title: 'Parent',
      skillIds: [],
      priority: 'Medium',
      dueDate: null,
      subtasks: [
        {
          title: 'Child',
          skillIds: [2],
          priority: 'High',
          dueDate: '2026-12-01',
          subtasks: [
            { title: 'Grandchild', skillIds: [], priority: 'Medium', dueDate: null, subtasks: [] },
          ],
        },
      ],
    })
  })

  it('removes a subtask with everything below it and renumbers the rest', async () => {
    const user = userEvent.setup()
    await renderPage()

    await addSubtaskUnder('1')
    await addSubtaskUnder('1')
    await addSubtaskUnder('1.1')
    await user.type(titleBox('1.2'), 'Keep me')
    await user.click(screen.getByRole('button', { name: 'Remove Subtask 1.1' }))

    expect(queryTitleBox('1.1.1')).not.toBeInTheDocument()
    expect(queryTitleBox('1.2')).not.toBeInTheDocument()
    expect(titleBox('1.1')).toHaveValue('Keep me')
  })

  it('stops offering subtasks at the tenth level', async () => {
    await renderPage()

    let number = '1'
    for (let level = 1; level < 10; level++) {
      await addSubtaskUnder(number)
      number += '.1'
    }

    expect(titleBox(number)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: `Add subtask under ${number}` }),
    ).not.toBeInTheDocument()
  })

  it('shows the error from the server and keeps what was typed', async () => {
    const user = userEvent.setup()
    vi.mocked(createTask).mockRejectedValue(new Error('Title is required'))
    await renderPage()

    await user.type(titleBox('1'), 'Parent')
    await user.click(screen.getByRole('button', { name: 'Save task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required')
    expect(titleBox('1')).toHaveValue('Parent')
  })
})

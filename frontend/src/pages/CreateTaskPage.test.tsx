import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTask, getSkills, type Task } from '../api'
import CreateTaskPage from './CreateTaskPage'

vi.mock('../api', () => ({ createTask: vi.fn(), getSkills: vi.fn() }))

const task = (number: string) =>
  screen.getByLabelText(`Task ${number} title`).closest('div.rounded-lg') as HTMLElement

const addSubtaskTo = (number: string) =>
  userEvent.click(within(task(number)).getByRole('button', { name: 'Add Subtask' }))

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

    expect(screen.getByLabelText('Task 1 title')).toBeInTheDocument()
    expect(screen.queryByLabelText('Task 1.1 title')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('numbers subtasks and nested subtasks like the wireframe', async () => {
    await renderPage()

    await addSubtaskTo('1')
    await addSubtaskTo('1.1')
    await addSubtaskTo('1.1')

    expect(screen.getByLabelText('Task 1.1 title')).toBeInTheDocument()
    expect(screen.getByLabelText('Task 1.1.1 title')).toBeInTheDocument()
    expect(screen.getByLabelText('Task 1.1.2 title')).toBeInTheDocument()
  })

  it('submits the whole tree without the React keys', async () => {
    const user = userEvent.setup()
    await renderPage()

    await addSubtaskTo('1')
    await addSubtaskTo('1.1')
    await user.type(screen.getByLabelText('Task 1 title'), 'Parent')
    await user.type(screen.getByLabelText('Task 1.1 title'), 'Child')
    await user.type(screen.getByLabelText('Task 1.1.1 title'), 'Grandchild')
    await user.click(within(task('1.1')).getByRole('checkbox', { name: 'Backend' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(vi.mocked(createTask).mock.calls[0][0]).toEqual({
      title: 'Parent',
      skillIds: [],
      subtasks: [
        {
          title: 'Child',
          skillIds: [2],
          subtasks: [{ title: 'Grandchild', skillIds: [], subtasks: [] }],
        },
      ],
    })
  })

  it('removes a subtask with everything below it and renumbers the rest', async () => {
    const user = userEvent.setup()
    await renderPage()

    await addSubtaskTo('1')
    await addSubtaskTo('1')
    await addSubtaskTo('1.1')
    await user.type(screen.getByLabelText('Task 1.2 title'), 'Keep me')
    await user.click(within(task('1.1')).getByRole('button', { name: 'Remove' }))

    expect(screen.queryByLabelText('Task 1.1.1 title')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Task 1.2 title')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Task 1.1 title')).toHaveValue('Keep me')
  })

  it('stops offering subtasks at the tenth level', async () => {
    await renderPage()

    let number = '1'
    for (let level = 1; level < 10; level++) {
      await addSubtaskTo(number)
      number += '.1'
    }

    expect(
      within(task(number)).queryByRole('button', { name: 'Add Subtask' }),
    ).not.toBeInTheDocument()
  })

  it('shows the error from the server and keeps what was typed', async () => {
    const user = userEvent.setup()
    vi.mocked(createTask).mockRejectedValue(new Error('Title is required'))
    await renderPage()

    await user.type(screen.getByLabelText('Task 1 title'), 'Parent')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Title is required')
    expect(screen.getByLabelText('Task 1 title')).toHaveValue('Parent')
  })
})

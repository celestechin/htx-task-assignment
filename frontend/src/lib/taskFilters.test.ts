import { describe, expect, it } from 'vitest'
import type { Task } from '../api'
import { dueState, formatDueDate, todayString } from './dates'
import { countMatches, filterTasks, NO_FILTERS, subtaskProgress } from './taskFilters'

const TODAY = '2026-11-02'

function makeTask(id: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    status: 'To-do',
    priority: 'Medium',
    dueDate: null,
    parentId: null,
    skillsPending: false,
    skillsSource: 'user',
    skills: [],
    assignee: null,
    subtasks: [],
    ...overrides,
  }
}

// plain functions, so these just call them with a fixed "today" and check the answer
describe('dueState', () => {
  it.each([
    [null, 'To-do', 'none'],
    ['2026-11-01', 'To-do', 'overdue'],
    ['2026-11-02', 'To-do', 'soon'],
    ['2026-11-04', 'In Progress', 'soon'],
    ['2026-11-05', 'To-do', 'later'],
    ['2026-11-01', 'Done', 'done'],
  ] as const)('due %s while %s is %s', (dueDate, status, expected) => {
    expect(dueState(dueDate, status, TODAY)).toBe(expected)
  })

  it('names today and tomorrow', () => {
    expect(formatDueDate('2026-11-02', TODAY)).toBe('Today')
    expect(formatDueDate('2026-11-03', TODAY)).toBe('Tomorrow')
  })

  it('formats today in local time', () => {
    expect(todayString(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('filterTasks', () => {
  const tasks = [
    makeTask(1, { title: 'Design homepage', priority: 'High', dueDate: '2026-11-01' }),
    makeTask(2, {
      title: 'Audit logs',
      assignee: { id: 1, name: 'Bob' },
      subtasks: [makeTask(3, { title: 'Write the homepage copy', parentId: 2 })],
    }),
  ]

  it('shows everything when no filters are set', () => {
    expect(countMatches(filterTasks(tasks, NO_FILTERS, TODAY))).toBe(3)
  })

  it('keeps a non-matching parent when a subtask matches', () => {
    const visible = filterTasks(tasks, { ...NO_FILTERS, search: 'HOMEPAGE' }, TODAY)
    expect(visible.map((item) => [item.task.id, item.matches])).toEqual([
      [1, true],
      [2, false],
    ])
    expect(visible[1].subtasks[0].task.id).toBe(3)
  })

  it('combines options in a group with OR and groups with AND', () => {
    const highOrLow = filterTasks(tasks, { ...NO_FILTERS, priorities: ['High', 'Low'] }, TODAY)
    expect(countMatches(highOrLow)).toBe(1)

    const highAndAssigned = filterTasks(
      tasks,
      { ...NO_FILTERS, priorities: ['High'], unassigned: true },
      TODAY,
    )
    expect(countMatches(highAndAssigned)).toBe(1)

    const overdue = filterTasks(tasks, { ...NO_FILTERS, overdue: true }, TODAY)
    expect(overdue.map((item) => item.task.id)).toEqual([1])
  })
})

describe('subtaskProgress', () => {
  it('counts subtasks at every level', () => {
    const task = makeTask(1, {
      subtasks: [
        makeTask(2, {
          status: 'Done',
          subtasks: [makeTask(3, { status: 'Done' }), makeTask(4)],
        }),
      ],
    })
    expect(subtaskProgress(task)).toEqual({ done: 2, total: 3 })
  })
})

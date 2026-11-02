import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteTask,
  getDevelopers,
  getSkills,
  getTasks,
  retryIdentifySkills,
  updateTask,
  type Task,
  type TaskChanges,
} from '../api'
import ConfirmDialog from '../components/ConfirmDialog'
import EditTaskDialog from '../components/EditTaskDialog'
import FilterBar from '../components/FilterBar'
import NoticeDialog from '../components/NoticeDialog'
import TaskCard, { AiLegend } from '../components/TaskCard'
import { todayString } from '../lib/dates'
import { BUTTON_PRIMARY } from '../lib/styles'
import {
  countMatches,
  countTasks,
  filterTasks,
  NO_FILTERS,
  type TaskFilters,
} from '../lib/taskFilters'

// the main page: filters, task cards and the popups
export default function TaskListPage() {
  // load data
  const queryClient = useQueryClient()
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const developers = useQuery({ queryKey: ['developers'], queryFn: getDevelopers })
  const skills = useQuery({ queryKey: ['skills'], queryFn: getSkills })

  // remembers what's on screen: filters, popup message, task being edited or deleted
  const [filters, setFilters] = useState<TaskFilters>(NO_FILTERS)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  // after any change, fetch the list again so the screen shows what the server saved
  const refreshTasks = () => queryClient.invalidateQueries({ queryKey: ['tasks'] })

  // errors from the server show in the same popup as other messages
  const update = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: TaskChanges }) =>
      updateTask(id, changes),
    onError: (error) => setNotice(error.message),
    onSettled: refreshTasks,
  })

  const retrySkills = useMutation({
    mutationFn: retryIdentifySkills,
    onError: (error) => setNotice(error.message),
    onSettled: refreshTasks,
  })

  const remove = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => setDeleting(null),
    onError: (error) => {
      setDeleting(null)
      setNotice(error.message)
    },
    onSettled: refreshTasks,
  })

  // ensure each task is assigned first before changing status
  // the backend checks this too, this just saves a pointless request
  function handleUpdate(task: Task, changes: TaskChanges) {
    if (changes.status !== undefined && !task.assignee) {
      setNotice('Please assign this task to a developer before changing its status.')
      return
    }
    update.mutate({ id: task.id, changes })
  }

  if (tasks.isPending || developers.isPending) {
    return <p className="text-slate-500">Loading tasks...</p>
  }

  if (tasks.isError || developers.isError) {
    return (
      <p role="alert" className="text-rose-700">
        Could not load tasks. Please check that the server is running.
      </p>
    )
  }

  const today = todayString()
  const visible = filterTasks(tasks.data, filters, today)
  // for the delete popup, so it can warn how many subtasks go too
  const deletingSubtasks = deleting ? countTasks(deleting.subtasks) : 0

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-violet-950">Tasks</h1>
          <AiLegend />
        </div>
        <Link to="/tasks/new" className={`inline-flex items-center gap-1 ${BUTTON_PRIMARY}`}>
          <Plus size={16} aria-hidden="true" />
          New task
        </Link>
      </div>

      {tasks.data.length === 0 ? (
        <p className="rounded-2xl bg-white/70 p-6 text-slate-500">
          No tasks yet.{' '}
          <Link to="/tasks/new" className="font-medium text-violet-600 underline">
            Create the first one
          </Link>
          .
        </p>
      ) : (
        <>
          <FilterBar
            filters={filters}
            shown={countMatches(visible)}
            total={countTasks(tasks.data)}
            onChange={setFilters}
          />
          {visible.length === 0 ? (
            <p className="rounded-2xl bg-white/70 p-6 text-center text-slate-500">
              No tasks match these filters.
            </p>
          ) : (
            <ul className="space-y-4">
              {visible.map((item) => (
                <TaskCard
                  key={item.task.id}
                  item={item}
                  developers={developers.data}
                  today={today}
                  savingTaskId={update.isPending ? update.variables.id : null}
                  retryingTaskId={retrySkills.isPending ? retrySkills.variables : null}
                  onUpdate={handleUpdate}
                  onRetrySkills={(task) => retrySkills.mutate(task.id)}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {/* popups live at page level, cards just ask for them to open */}
      <NoticeDialog message={notice} onClose={() => setNotice(null)} />
      <EditTaskDialog task={editing} skills={skills.data ?? []} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this task?"
        message={
          deletingSubtasks > 0
            ? `"${deleting?.title}" and its ${deletingSubtasks} subtask${deletingSubtasks === 1 ? '' : 's'} will be deleted. This cannot be undone.`
            : `"${deleting?.title}" will be deleted. This cannot be undone.`
        }
        confirmLabel="Delete"
        busy={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

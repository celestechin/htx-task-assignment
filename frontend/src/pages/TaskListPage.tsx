import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  getDevelopers,
  getTasks,
  TASK_STATUSES,
  updateTask,
  type Developer,
  type Task,
  type TaskChanges,
  type TaskStatus,
} from '../api'

const selectClass =
  'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50'

// a developer can take a task only if they have every skill it needs
function isEligible(developer: Developer, task: Task) {
  return task.skills.every((required) =>
    developer.skills.some((skill) => skill.id === required.id),
  )
}

// each task goes right after its parent, depth is used for the indent
function flattenTasks(tasks: Task[], depth = 0): { task: Task; depth: number }[] {
  return tasks.flatMap((task) => [
    { task, depth },
    ...flattenTasks(task.subtasks, depth + 1),
  ])
}

// the main page: filters, task cards and the popups
export default function TaskListPage() {
  // load data
  const queryClient = useQueryClient()
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: getTasks })
  const developers = useQuery({ queryKey: ['developers'], queryFn: getDevelopers })

  const update = useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: TaskChanges }) =>
      updateTask(id, changes),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  if (tasks.isPending || developers.isPending) {
    return <p className="text-slate-500">Loading tasks...</p>
  }

  if (tasks.isError || developers.isError) {
    return (
      <p role="alert" className="text-red-700">
        Could not load tasks. Please check that the server is running.
      </p>
    )
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Tasks</h1>

      {update.isError && (
        <p role="alert" className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
          {update.error.message}
        </p>
      )}

      {tasks.data.length === 0 ? (
        <p className="text-slate-500">
          No tasks yet.{' '}
          <Link to="/tasks/new" className="text-blue-700 underline">
            Create the first one
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Task Title</th>
                <th className="px-4 py-3 font-medium">Skills</th>
                <th className="w-40 px-4 py-3 font-medium">Status</th>
                <th className="w-40 px-4 py-3 font-medium">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {flattenTasks(tasks.data).map(({ task, depth }) => {
                const isSaving = update.isPending && update.variables.id === task.id
                return (
                  <tr key={task.id} className="border-b border-slate-100 last:border-0">
                    <td
                      className="px-4 py-3 align-top"
                      style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
                    >
                      {task.title}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {task.skills.map((skill) => skill.name).join(', ')}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        aria-label={`Status of ${task.title}`}
                        className={selectClass}
                        disabled={isSaving}
                        value={task.status}
                        onChange={(event) =>
                          update.mutate({
                            id: task.id,
                            changes: { status: event.target.value as TaskStatus },
                          })
                        }
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <select
                        aria-label={`Assignee of ${task.title}`}
                        className={selectClass}
                        disabled={isSaving}
                        value={task.assignee?.id ?? ''}
                        onChange={(event) =>
                          update.mutate({
                            id: task.id,
                            changes: {
                              assigneeId: event.target.value ? Number(event.target.value) : null,
                            },
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {developers.data
                          .filter((developer) => isEligible(developer, task))
                          .map((developer) => (
                            <option key={developer.id} value={developer.id}>
                              {developer.name}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

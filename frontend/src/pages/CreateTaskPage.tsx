import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask, getSkills } from '../api'
import TaskFormNode from '../components/TaskFormNode'
import { newTaskDraft, toNewTask, type TaskDraft } from '../taskDraft'

// subtasks at every level, for the save button's text
function countSubtasks(task: TaskDraft): number {
  return task.subtasks.reduce((total, subtask) => total + 1 + countSubtasks(subtask), 0)
}

// part 3 + 4.3: create a task and any number of nested subtasks
export default function CreateTaskPage() {
  // the whole form is one tree in state, TaskFormNode draws it
  const [task, setTask] = useState(newTaskDraft)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // for the skill checkboxes, usually already cached from the task list
  const skills = useQuery({ queryKey: ['skills'], queryFn: getSkills })

  const create = useMutation({
    mutationFn: createTask,
    onSuccess: async () => {
      // mark the list as old so it loads again with the new task, then go back to it
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      navigate('/')
    },
  })

  const subtaskCount = countSubtasks(task)

  function handleSubmit(event: FormEvent) {
    // stop the browser's normal submit, which would reload the page
    event.preventDefault()
    // one request for the whole tree
    create.mutate(toNewTask(task))
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Create Task(s)</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {create.isError && (
          <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
            {create.error.message}
          </p>
        )}
        {skills.isError && (
          <p role="alert" className="text-sm text-red-700">
            Could not load skills.
          </p>
        )}

        {/* the top task, its subtasks are drawn inside it */}
        <TaskFormNode task={task} number="1" skills={skills.data ?? []} onChange={setTask} />

        <div className="flex items-center justify-end gap-3">
          {subtaskCount > 0 && (
            <p className="text-sm text-slate-500">The task and all its subtasks are saved together.</p>
          )}
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {create.isPending
              ? 'Saving...'
              : subtaskCount > 0
                ? `Save task and ${subtaskCount} subtask${subtaskCount === 1 ? '' : 's'}`
                : 'Save task'}
          </button>
        </div>
      </form>
    </>
  )
}

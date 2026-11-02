import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTask, getSkills } from '../api'

// part 3 + 4.3: create a task and any number of nested subtasks
export default function CreateTaskPage() {
  const [title, setTitle] = useState('')
  const [skillIds, setSkillIds] = useState<number[]>([])
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

  function toggleSkill(id: number) {
    setSkillIds((current) =>
      current.includes(id) ? current.filter((skillId) => skillId !== id) : [...current, id],
    )
  }

  function handleSubmit(event: FormEvent) {
    // stop the browser's normal submit, which would reload the page
    event.preventDefault()
    create.mutate({ title, skillIds })
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Create Task</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-slate-200 bg-white p-5"
      >
        {create.isError && (
          <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">
            {create.error.message}
          </p>
        )}

        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <textarea
            id="title"
            required
            maxLength={1000}
            rows={3}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Required skills</legend>
          {skills.isError && (
            <p role="alert" className="text-sm text-red-700">
              Could not load skills.
            </p>
          )}
          <div className="flex flex-wrap gap-4">
            {skills.data?.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={skillIds.includes(skill.id)}
                  onChange={() => toggleSkill(skill.id)}
                />
                {skill.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {create.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </>
  )
}

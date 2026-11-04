import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { updateTask, type Skill, type Task, type TaskChanges } from '../api'
import { BUTTON_PRIMARY, BUTTON_SECONDARY } from '../lib/styles'
import DateField from './DateField'
import Modal from './Modal'
import { PriorityChoice } from './PriorityPicker'

interface EditTaskDialogProps {
  task: Task | null
  skills: Skill[]
  onClose: () => void
}

// edit form, opened from the ⋯ menu on a card
// key={task.id} below gives a fresh form each time, so it never shows the last task's values
export default function EditTaskDialog({ task, skills, onClose }: EditTaskDialogProps) {
  return (
    <Modal open={task !== null} onClose={onClose} labelledBy="edit-task-title">
      {task && <EditTaskForm key={task.id} task={task} skills={skills} onClose={onClose} />}
    </Modal>
  )
}

// same skills in any order
function sameSkills(a: number[], b: number[]) {
  return a.length === b.length && a.every((id) => b.includes(id))
}

function EditTaskForm({ task, skills, onClose }: { task: Task; skills: Skill[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const originalSkillIds = task.skills.map((skill) => skill.id)
  // a local copy to edit, nothing is saved until "save changes"
  const [title, setTitle] = useState(task.title)
  const [skillIds, setSkillIds] = useState(originalSkillIds)
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate)

  const save = useMutation({
    mutationFn: (changes: TaskChanges) => updateTask(task.id, changes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onClose()
    },
  })

  function toggleSkill(id: number) {
    setSkillIds((current) =>
      current.includes(id) ? current.filter((skillId) => skillId !== id) : [...current, id],
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // only send what changed
    // re-sending unchanged skills would mark them as picked by the user and remove the sparkle
    const changes: TaskChanges = {}
    if (title.trim() !== task.title) changes.title = title
    if (!sameSkills(skillIds, originalSkillIds)) changes.skillIds = skillIds
    if (priority !== task.priority) changes.priority = priority
    if (dueDate !== task.dueDate) changes.dueDate = dueDate

    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    save.mutate(changes)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 id="edit-task-title" className="text-lg font-semibold">
        Edit task
      </h2>

      {save.isError && (
        <p role="alert" className="rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-800">
          {save.error.message}
        </p>
      )}

      <div>
        <label htmlFor="edit-title" className="mb-1 block text-sm font-medium">
          Title
        </label>
        <textarea
          id="edit-title"
          required
          maxLength={1000}
          rows={3}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-violet-100 px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Required skills</legend>
        <div className="flex flex-wrap gap-4">
          {skills.map((skill) => (
            <label key={skill.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skillIds.includes(skill.id)}
                onChange={() => toggleSkill(skill.id)}
                className="accent-violet-500"
              />
              {skill.name}
            </label>
          ))}
        </div>
        {skillIds.length === 0 && (
          <p className="mt-1 text-xs text-rose-600">Choose at least one skill.</p>
        )}
      </fieldset>

      <div>
        <p className="mb-1 text-sm font-medium">Priority</p>
        <PriorityChoice value={priority} label="Priority" onChange={setPriority} />
      </div>

      <div>
        <label htmlFor="edit-due-date" className="mb-1 block text-sm font-medium">
          Due date
        </label>
        <DateField id="edit-due-date" value={dueDate} onChange={setDueDate} />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={save.isPending || skillIds.length === 0}
          className={BUTTON_PRIMARY}
        >
          {save.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}

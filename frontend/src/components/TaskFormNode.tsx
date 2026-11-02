import type { Skill } from '../api'
import { newTaskDraft, type TaskDraft } from '../taskDraft'

// same limit as the backend, so the button disappears before the api would say no
const MAX_DEPTH = 10

interface TaskFormNodeProps {
  task: TaskDraft
  number: string
  depth?: number
  skills: Skill[]
  onChange: (task: TaskDraft) => void
  onRemove?: () => void
}

// part 4.3: one task's form fields, then itself again for each subtask
// changes go up through onChange level by level, so the page at the top always has the whole tree
// nothing is changed in place, each level makes a new copy
export default function TaskFormNode({
  task,
  number,
  depth = 1,
  skills,
  onChange,
  onRemove,
}: TaskFormNodeProps) {
  function toggleSkill(id: number) {
    const skillIds = task.skillIds.includes(id)
      ? task.skillIds.filter((skillId) => skillId !== id)
      : [...task.skillIds, id]
    onChange({ ...task, skillIds })
  }

  // a subtask changed, put the new version in and pass this whole task up
  function replaceSubtask(key: number, next: TaskDraft) {
    onChange({
      ...task,
      subtasks: task.subtasks.map((subtask) => (subtask.key === key ? next : subtask)),
    })
  }

  // removes the subtask and everything under it, numbering redoes itself
  function removeSubtask(key: number) {
    onChange({ ...task, subtasks: task.subtasks.filter((subtask) => subtask.key !== key) })
  }

  // ids from the key so each label points at the right input
  const titleId = `task-title-${task.key}`

  return (
    <div>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label htmlFor={titleId} className="mb-1 block text-sm font-medium">
            Task {number} title
          </label>
          <textarea
            id={titleId}
            required
            maxLength={1000}
            rows={2}
            value={task.title}
            onChange={(event) => onChange({ ...task, title: event.target.value })}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Task {number} required skills</legend>
          <div className="flex flex-wrap gap-4">
            {skills.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.skillIds.includes(skill.id)}
                  onChange={() => toggleSkill(skill.id)}
                />
                {skill.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-md px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Remove
            </button>
          )}
          {depth < MAX_DEPTH && (
            <button
              type="button"
              onClick={() => onChange({ ...task, subtasks: [...task.subtasks, newTaskDraft()] })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Add Subtask
            </button>
          )}
        </div>
      </div>

      {task.subtasks.length > 0 && (
        <div className="mt-3 ml-3 space-y-3 sm:ml-6">
          {task.subtasks.map((subtask, index) => (
            <TaskFormNode
              key={subtask.key}
              task={subtask}
              number={`${number}.${index + 1}`}
              depth={depth + 1}
              skills={skills}
              onChange={(next) => replaceSubtask(subtask.key, next)}
              onRemove={() => removeSubtask(subtask.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

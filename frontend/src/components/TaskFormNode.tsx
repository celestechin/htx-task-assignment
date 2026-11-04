import type { Skill } from '../api'
import { newTaskDraft, type TaskDraft } from '../taskDraft'
import DateField from './DateField'
import { PriorityChoice } from './PriorityPicker'

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
  const dueDateId = `task-due-${task.key}`
  // number comes from the parent, e.g. "1.1" passes "1.1.2" to its second child
  const name = depth === 1 ? `Task ${number}` : `Subtask ${number}`
  const canAddSubtask = depth < MAX_DEPTH

  return (
    <div>
      <div className="space-y-4 rounded-2xl border border-white/80 bg-white/85 p-5 shadow-sm shadow-violet-100 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-violet-950">{name}</h2>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${name}`}
              className="rounded-full px-3 py-1 text-sm text-rose-600 hover:bg-rose-50"
            >
              Remove
            </button>
          )}
        </div>

        <div>
          <label htmlFor={titleId} className="mb-1 block text-sm font-medium">
            <span className="sr-only">{name} </span>Title
          </label>
          <textarea
            id={titleId}
            required
            maxLength={1000}
            rows={2}
            value={task.title}
            onChange={(event) => onChange({ ...task, title: event.target.value })}
            className="w-full rounded-xl border border-violet-100 px-3 py-2 text-sm focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium">
            <span className="sr-only">{name} </span>Required skills
          </legend>
          <p className="mb-1 text-xs text-slate-500">
            Leave these empty and AI will identify the skills from the title.
          </p>
          <div className="flex flex-wrap gap-4">
            {skills.map((skill) => (
              <label key={skill.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={task.skillIds.includes(skill.id)}
                  onChange={() => toggleSkill(skill.id)}
                  className="accent-violet-500"
                />
                {skill.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <div>
            <p className="mb-1 text-sm font-medium">Priority</p>
            <PriorityChoice
              value={task.priority}
              label={`${name} priority`}
              onChange={(priority) => onChange({ ...task, priority })}
            />
          </div>
          <div>
            <label htmlFor={dueDateId} className="mb-1 block text-sm font-medium">
              <span className="sr-only">{name} </span>Due date
            </label>
            <DateField
              id={dueDateId}
              value={task.dueDate}
              onChange={(dueDate) => onChange({ ...task, dueDate })}
            />
          </div>
        </div>
      </div>

      {/* subtasks sit under their parent, joined by a line
          the add button sits at the end of the list so it reads as "add one more here", not "save" */}
      {(task.subtasks.length > 0 || canAddSubtask) && (
        <div className="mt-3 ml-3 space-y-3 border-l-2 border-violet-200 pl-3 sm:ml-5 sm:pl-5">
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
          {canAddSubtask && (
            <button
              type="button"
              onClick={() => onChange({ ...task, subtasks: [...task.subtasks, newTaskDraft()] })}
              className="w-full rounded-2xl border-2 border-dashed border-violet-200 px-4 py-2 text-left text-sm font-medium text-violet-600 hover:border-violet-300 hover:bg-white/70"
            >
              <span aria-hidden="true">+ </span>Add subtask under {number}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

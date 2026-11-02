import { Sparkles } from 'lucide-react'
import { TASK_STATUSES, type Developer, type Task, type TaskChanges, type TaskStatus } from '../api'
import { PRIORITY_STYLES, STATUS_STYLES } from '../lib/styles'
import { subtaskProgress, type VisibleTask } from '../lib/taskFilters'
import AssigneePicker from './AssigneePicker'
import DuePill from './DuePill'
import PriorityPicker from './PriorityPicker'
import ProgressBar from './ProgressBar'
import SkillChips from './SkillChips'
import TaskMenu from './TaskMenu'

// what the page passes down to every card, cards report changes back up through these
export interface TaskCardActions {
  savingTaskId: number | null
  retryingTaskId: number | null
  developers: Developer[]
  today: string
  onUpdate: (task: Task, changes: TaskChanges) => void
  onRetrySkills: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
}

interface TaskCardProps extends TaskCardActions {
  item: VisibleTask
  depth?: number
}

// one task as a card, with its subtasks nested inside
// renders itself again for each subtask, so any depth works
export default function TaskCard({ item, depth = 0, ...actions }: TaskCardProps) {
  const { task, matches, subtasks } = item
  const saving = actions.savingTaskId === task.id
  // counted from the full task, so filters don't change the numbers
  const progress = subtaskProgress(task)

  return (
    <li>
      {/* left border colour = priority, faded = only shown because a subtask matched the filter */}
      <article
        aria-label={task.title}
        className={`rounded-2xl border border-l-4 border-white/80 bg-white/85 p-4 shadow-sm shadow-violet-100 backdrop-blur-sm ${
          PRIORITY_STYLES[task.priority].accent
        } ${matches ? '' : 'opacity-60'}`}
      >
        <div className="flex items-start gap-3">
          <PriorityPicker
            priority={task.priority}
            label={`Priority of ${task.title}`}
            disabled={saving}
            onChange={(priority) => actions.onUpdate(task, { priority })}
          />
          <h3 className={`flex-1 text-sm leading-6 ${depth === 0 ? 'font-semibold' : 'font-medium'}`}>
            {task.title}
          </h3>
          <TaskMenu
            title={task.title}
            onEdit={() => actions.onEdit(task)}
            onDelete={() => actions.onDelete(task)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SkillChips
            task={task}
            retrying={actions.retryingTaskId === task.id}
            onRetry={() => actions.onRetrySkills(task)}
          />
          <DuePill
            dueDate={task.dueDate}
            status={task.status}
            today={actions.today}
            label={`Due date of ${task.title}`}
            disabled={saving}
            onChange={(dueDate) => actions.onUpdate(task, { dueDate })}
          />

          <div className="ml-auto flex items-center gap-2">
            {/* value always comes from the server, so a refused change snaps back by itself */}
            <select
              aria-label={`Status of ${task.title}`}
              disabled={saving}
              value={task.status}
              onChange={(event) =>
                actions.onUpdate(task, { status: event.target.value as TaskStatus })
              }
              className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-50 ${STATUS_STYLES[task.status]}`}
            >
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {/* can't assign until we know the skills */}
            <AssigneePicker
              task={task}
              developers={actions.developers}
              disabled={saving || task.skillsPending}
              onChange={(assigneeId) => actions.onUpdate(task, { assigneeId })}
            />
          </div>
        </div>

        {progress.total > 0 && (
          <div className="mt-3">
            <ProgressBar
              done={progress.done}
              total={progress.total}
              label={`Subtask progress of ${task.title}`}
            />
          </div>
        )}

        {subtasks.length > 0 && (
          <ul className="mt-3 space-y-3 border-l-2 border-violet-100 pl-3 sm:pl-4">
            {/* same component again for each subtask, one level deeper */}
            {subtasks.map((subtask) => (
              <TaskCard key={subtask.task.id} item={subtask} depth={depth + 1} {...actions} />
            ))}
          </ul>
        )}
      </article>
    </li>
  )
}

// small key under the page title explaining the sparkle
export function AiLegend() {
  return (
    <p className="flex items-center gap-1 text-xs text-slate-500">
      <Sparkles size={12} className="text-fuchsia-400" aria-hidden="true" />
      Skills identified by Gemini
    </p>
  )
}

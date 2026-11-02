import { Check, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Developer, Task } from '../api'
import { usePopover } from '../lib/usePopover'
import Avatar, { DeveloperTooltip } from './Avatar'

interface AssigneePickerProps {
  task: Task
  developers: Developer[]
  disabled: boolean
  onChange: (assigneeId: number | null) => void
}

// a developer can take a task only if they have every skill it requires
// the backend checks this too, here it just hides people who'd be refused
function isEligible(developer: Developer, task: Task) {
  return task.skills.every((required) =>
    developer.skills.some((skill) => skill.id === required.id),
  )
}

export default function AssigneePicker({
  task,
  developers,
  disabled,
  onChange,
}: AssigneePickerProps) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>()
  const assignee = developers.find((developer) => developer.id === task.assignee?.id)
  const eligible = developers.filter((developer) => isEligible(developer, task))

  // close the menu, and skip the request if nothing actually changed
  function choose(assigneeId: number | null) {
    setOpen(false)
    if (assigneeId !== (task.assignee?.id ?? null)) onChange(assigneeId)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Assignee of ${task.title}: ${task.assignee?.name ?? 'Unassigned'}`}
        title={task.skillsPending ? 'Skills must be identified before assigning' : undefined}
        onClick={() => setOpen(!open)}
        className="group relative flex items-center rounded-full p-0.5 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {assignee ? (
          <>
            <Avatar id={assignee.id} name={assignee.name} />
            <DeveloperTooltip name={assignee.name} skills={assignee.skills} />
          </>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400">
            <UserPlus size={14} aria-hidden="true" />
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Choose assignee for ${task.title}`}
          className="absolute top-full right-0 z-20 mt-2 w-56 rounded-xl border border-violet-100 bg-white p-1 shadow-lg shadow-violet-200/50"
        >
          <MenuOption checked={!task.assignee} onSelect={() => choose(null)}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-slate-400">
              <UserPlus size={12} aria-hidden="true" />
            </span>
            Unassigned
          </MenuOption>
          {eligible.map((developer) => (
            <MenuOption
              key={developer.id}
              checked={developer.id === task.assignee?.id}
              onSelect={() => choose(developer.id)}
            >
              <Avatar id={developer.id} name={developer.name} size="sm" />
              <span>
                <span className="block">{developer.name}</span>
                <span className="block text-xs text-slate-500">
                  {developer.skills.map((skill) => skill.name).join(', ')}
                </span>
              </span>
            </MenuOption>
          ))}
          {eligible.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500">No developer has all the skills.</p>
          )}
        </div>
      )}
    </div>
  )
}

// one row in the menu, with a tick on the current choice
function MenuOption({
  checked,
  onSelect,
  children,
}: {
  checked: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-violet-50"
    >
      {children}
      {checked && <Check size={14} className="ml-auto text-violet-500" aria-hidden="true" />}
    </button>
  )
}

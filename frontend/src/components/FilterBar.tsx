import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { TASK_PRIORITIES, TASK_STATUSES } from '../api'
import { hasActiveFilters, NO_FILTERS, type TaskFilters } from '../lib/taskFilters'
import { PriorityIcon } from './PriorityPicker'

interface FilterBarProps {
  filters: TaskFilters
  shown: number
  total: number
  onChange: (filters: TaskFilters) => void
}

// add the value if it's missing, remove it if it's there
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

// search box + toggle chips above the task list
// it only holds the controls, the actual filtering is in lib/taskFilters.ts
export default function FilterBar({ filters, shown, total, onChange }: FilterBarProps) {
  const active = hasActiveFilters(filters)

  return (
    <section
      aria-label="Filters"
      className="mb-6 space-y-3 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm shadow-violet-100 backdrop-blur-sm"
    >
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-violet-400"
          aria-hidden="true"
        />
        <input
          type="search"
          aria-label="Search tasks"
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          className="w-full rounded-full border border-violet-100 bg-white py-2 pr-4 pl-9 text-sm placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TASK_STATUSES.map((status) => (
          <Chip
            key={status}
            pressed={filters.statuses.includes(status)}
            onClick={() => onChange({ ...filters, statuses: toggle(filters.statuses, status) })}
          >
            {status}
          </Chip>
        ))}
        <Divider />
        {TASK_PRIORITIES.map((priority) => (
          <Chip
            key={priority}
            pressed={filters.priorities.includes(priority)}
            onClick={() =>
              onChange({ ...filters, priorities: toggle(filters.priorities, priority) })
            }
          >
            <PriorityIcon priority={priority} />
            {priority}
          </Chip>
        ))}
        <Divider />
        <Chip
          pressed={filters.unassigned}
          onClick={() => onChange({ ...filters, unassigned: !filters.unassigned })}
        >
          Unassigned
        </Chip>
        <Chip
          pressed={filters.overdue}
          onClick={() => onChange({ ...filters, overdue: !filters.overdue })}
        >
          Overdue
        </Chip>
        <Chip
          pressed={filters.dueSoon}
          onClick={() => onChange({ ...filters, dueSoon: !filters.dueSoon })}
        >
          Due soon
        </Chip>
      </div>

      {active && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span aria-live="polite">
            Showing {shown} of {total} tasks
          </span>
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            className="inline-flex items-center gap-1 font-medium text-violet-600 hover:text-violet-800"
          >
            <X size={12} aria-hidden="true" />
            Clear filters
          </button>
        </div>
      )}
    </section>
  )
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        pressed
          ? 'border-violet-300 bg-violet-200 text-violet-900'
          : 'border-violet-100 bg-white text-slate-600 hover:bg-violet-50'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-violet-100 sm:block" />
}

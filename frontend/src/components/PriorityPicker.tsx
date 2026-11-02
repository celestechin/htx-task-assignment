import { Check, Flag } from 'lucide-react'
import { TASK_PRIORITIES, type TaskPriority } from '../api'
import { PRIORITY_STYLES } from '../lib/styles'
import { usePopover } from '../lib/usePopover'

// coloured flag, also used in the filter chips
export function PriorityIcon({ priority, size = 12 }: { priority: TaskPriority; size?: number }) {
  return <Flag size={size} className={PRIORITY_STYLES[priority].icon} aria-hidden="true" />
}

interface PriorityPickerProps {
  priority: TaskPriority
  label: string
  disabled?: boolean
  onChange: (priority: TaskPriority) => void
}

// coloured priority pill on a card, click it for a small menu
export default function PriorityPicker({
  priority,
  label,
  disabled = false,
  onChange,
}: PriorityPickerProps) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>()

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${priority}`}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold hover:brightness-95 disabled:opacity-50 ${PRIORITY_STYLES[priority].pill}`}
      >
        <PriorityIcon priority={priority} />
        {priority}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-full left-0 z-20 mt-2 w-36 rounded-xl border border-violet-100 bg-white p-1 shadow-lg shadow-violet-200/50"
        >
          {TASK_PRIORITIES.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === priority}
              onClick={() => {
                setOpen(false)
                if (option !== priority) onChange(option)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-violet-50"
            >
              <PriorityIcon priority={option} size={14} />
              {option}
              {option === priority && (
                <Check size={14} className="ml-auto text-violet-500" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// priority as three buttons side by side, for the forms where there's room
export function PriorityChoice({
  value,
  label,
  onChange,
}: {
  value: TaskPriority
  label: string
  onChange: (priority: TaskPriority) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {TASK_PRIORITIES.map((option) => {
        const selected = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${
              selected
                ? `${PRIORITY_STYLES[option].pill} ring-2 ring-violet-300`
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            <PriorityIcon priority={option} />
            {option}
          </button>
        )
      })}
    </div>
  )
}

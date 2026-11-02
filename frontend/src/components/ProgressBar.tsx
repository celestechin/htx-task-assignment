interface ProgressBarProps {
  done: number
  total: number
  label: string
}

// "2/3 subtasks done" bar, turns green at 100%
export default function ProgressBar({ done, total, label }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 flex-1 overflow-hidden rounded-full bg-violet-100"
      >
        <div
          className={`h-full rounded-full transition-all ${percent === 100 ? 'bg-emerald-300' : 'bg-violet-300'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-slate-500">
        {done}/{total} subtasks done
      </span>
    </div>
  )
}

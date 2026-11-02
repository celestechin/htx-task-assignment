import { Ellipsis, Pencil, Trash2 } from 'lucide-react'
import { usePopover } from '../lib/usePopover'

interface TaskMenuProps {
  title: string
  onEdit: () => void
  onDelete: () => void
}

// the ⋯ button in the corner of a card with edit and delete
// tucked away in a menu to keep the card less cluttered
export default function TaskMenu({ title, onEdit, onDelete }: TaskMenuProps) {
  const { open, setOpen, ref } = usePopover<HTMLDivElement>()

  function choose(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${title}`}
        onClick={() => setOpen(!open)}
        className="rounded-full p-1 text-slate-400 hover:bg-violet-100 hover:text-violet-700"
      >
        <Ellipsis size={18} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 w-32 rounded-xl border border-violet-100 bg-white p-1 shadow-lg shadow-violet-200/50"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onEdit)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-violet-50"
          >
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(onDelete)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

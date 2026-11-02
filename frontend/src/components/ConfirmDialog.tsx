import { BUTTON_SECONDARY } from '../lib/styles'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// asks the user to confirm before doing something that can't be undone
// cancel gets the focus so pressing enter by accident doesn't delete anything
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} labelledBy="confirm-title">
      <h2 id="confirm-title" className="mb-2 text-lg font-semibold">
        {title}
      </h2>
      <p className="mb-6 text-sm text-slate-600">{message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" autoFocus onClick={onCancel} className={BUTTON_SECONDARY}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-full bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-50"
        >
          {busy ? 'Deleting...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

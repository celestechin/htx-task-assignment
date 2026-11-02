import { useEffect, useRef } from 'react'

interface NoticeDialogProps {
  message: string | null
  onClose: () => void
}

// popup with a message and an ok button
// uses the browser's own <dialog>, which handles focus, esc and blocking the page behind
export default function NoticeDialog({ message, onClose }: NoticeDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (message && !dialog.current?.open) {
      dialog.current?.showModal()
    }
  }, [message])

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-full max-w-sm rounded-lg p-5 shadow-xl backdrop:bg-slate-900/40"
    >
      <p className="mb-4 text-sm">{message}</p>
      <div className="flex justify-end">
        <button
          type="button"
          autoFocus
          onClick={() => dialog.current?.close()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          OK
        </button>
      </div>
    </dialog>
  )
}

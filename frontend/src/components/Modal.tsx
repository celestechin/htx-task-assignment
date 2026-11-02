import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  labelledBy?: string
  children: ReactNode
}

// shared base for every popup
// uses the browser's own <dialog>, which already handles focus, escape and greying out the page
export default function Modal({ open, onClose, labelledBy, children }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)

  // keep the real dialog in sync with the open prop
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current?.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby={labelledBy}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-violet-100 bg-white p-6 text-slate-800 shadow-xl shadow-violet-200/50 backdrop:bg-violet-950/30 backdrop:backdrop-blur-[2px]"
    >
      {open && children}
    </dialog>
  )
}

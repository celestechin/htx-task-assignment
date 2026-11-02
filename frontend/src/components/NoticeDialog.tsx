import { BUTTON_PRIMARY } from '../lib/styles'
import Modal from './Modal'

interface NoticeDialogProps {
  message: string | null
  onClose: () => void
}

// a popup with a message and an OK button
// used for the "assign first" message and for errors from the server
export default function NoticeDialog({ message, onClose }: NoticeDialogProps) {
  return (
    <Modal open={message !== null} onClose={onClose}>
      <p className="mb-5 text-sm">{message}</p>
      <div className="flex justify-end">
        <button type="button" autoFocus onClick={onClose} className={BUTTON_PRIMARY}>
          OK
        </button>
      </div>
    </Modal>
  )
}

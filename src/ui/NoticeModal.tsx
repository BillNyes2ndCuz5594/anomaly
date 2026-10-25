import Modal from './Modal'

export default function NoticeModal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} testId="notice-modal">
      <p>{text}</p>
      <div className="actions">
        <button type="button" className="btn primary" data-autofocus onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}

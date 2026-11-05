import { useState } from 'react'
import Modal from './Modal'

interface Props {
  onCancel: () => void
  onConfirm: () => void
}

export default function AgentSwitchModal({ onCancel, onConfirm }: Props) {
  const [restoreFocus, setRestoreFocus] = useState(true)

  function handleConfirm() {
    setRestoreFocus(false)
    onConfirm()
  }

  return (
    <Modal
      title="Switch agent"
      onClose={onCancel}
      testId="agent-switch-modal"
      restoreFocus={restoreFocus}
    >
      <div className="form">
        <p className="muted" data-testid="agent-switch-desc">
          Use a different agent on this device? I will save this agent's science progress in its own slot. Each agent gets separate cases and rewards.
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel} data-testid="switch-cancel">
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleConfirm}
            data-testid="choose-agent"
            data-autofocus
          >
            Choose agent number
          </button>
        </div>
      </div>
    </Modal>
  )
}

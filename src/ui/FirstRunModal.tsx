import { useState } from 'react'
import { clampAgentNumber, generateCodename, MAX_AGENT, sanitizeClassCode } from '../lib/codename'
import Modal from './Modal'

interface Props {
  onConfirm: (agentNumber: number, classCode: string) => void
  onCancel: () => void
}

/** First run: optional class code (A-Z0-9, max 8) and agent number 1-40. No names, no free text. */
export default function FirstRunModal({ onConfirm, onCancel }: Props) {
  const [classCode, setClassCode] = useState('')
  const [agentText, setAgentText] = useState('1')
  const agent = clampAgentNumber(parseInt(agentText, 10))
  const codename = generateCodename(agent, classCode)

  function step(delta: number) {
    setAgentText(String(clampAgentNumber(agent + delta)))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    onConfirm(agent, classCode)
  }

  return (
    <Modal title="Agent check-in" onClose={onCancel} testId="firstrun-modal">
      <form onSubmit={submit} className="form">
        <p className="muted">Pick your roster number. No names needed.</p>

        <div className="field">
          <label htmlFor="class-code">Class code (optional)</label>
          <input
            id="class-code"
            data-testid="classcode-input"
            data-autofocus
            className="input mono"
            value={classCode}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="class-code-hint"
            onChange={(e) => setClassCode(sanitizeClassCode(e.target.value))}
          />
          <span id="class-code-hint" className="hint">
            Letters and numbers only, up to 8. Your teacher may give you one.
          </span>
        </div>

        <div className="field">
          <label htmlFor="agent-number">Agent number (1 to {MAX_AGENT})</label>
          <div className="stepper">
            <button type="button" className="btn square" aria-label="Lower agent number" onClick={() => step(-1)}>
              -
            </button>
            <input
              id="agent-number"
              data-testid="agent-input"
              className="input mono center"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_AGENT}
              value={agentText}
              onChange={(e) => setAgentText(e.target.value.slice(0, 2))}
              onBlur={() => setAgentText(String(agent))}
            />
            <button type="button" className="btn square" aria-label="Raise agent number" onClick={() => step(1)}>
              +
            </button>
          </div>
        </div>

        <div className="codename-preview" aria-live="polite">
          <span className="label mono">Your codename</span>
          <strong className="mono" data-testid="codename-preview">
            {codename}
          </strong>
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" data-testid="firstrun-confirm">
            Report for duty
          </button>
        </div>
      </form>
    </Modal>
  )
}

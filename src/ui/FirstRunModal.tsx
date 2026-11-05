import { useState } from 'react'
import { clampAgentNumber, generateCodename, MAX_AGENT, sanitizeClassCode } from '../lib/codename'
import Modal from './Modal'

interface Props {
  onConfirm: (agentNumber: number, classCode: string) => void
  onCancel: () => void
  playIntent?: boolean
  topic?: string
  /** Opened from New agent: the roster number starts empty and must be typed. */
  startEmpty?: boolean
}

/** First run: optional class code (A-Z0-9, max 8) and agent number 1-40. No names, no free text. */
export default function FirstRunModal({ onConfirm, onCancel, playIntent, topic, startEmpty }: Props) {
  const [classCode, setClassCode] = useState('')
  const [agentText, setAgentText] = useState(startEmpty ? '' : '1')
  const missing = !!startEmpty && agentText.trim() === ''
  const agent = clampAgentNumber(parseInt(agentText, 10))
  const codename = generateCodename(agent, classCode)

  function step(delta: number) {
    setAgentText(String(clampAgentNumber((missing ? 0 : agent) + delta)))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (missing) return
    onConfirm(agent, classCode)
  }

  return (
    <Modal title="Quick check-in" onClose={onCancel} testId="firstrun-modal">
      <form onSubmit={submit} className="form">
        <p className="muted">
          {startEmpty
            ? 'Type your roster number so your progress stays yours.'
            : 'Use your roster number. Practicing at home? You can keep 1 and leave the class code blank.'}
        </p>

        <div className="field">
          <label htmlFor="agent-number">{`Your roster number (1 to ${MAX_AGENT})`}</label>
          <div className="stepper">
            <button type="button" className="btn square" aria-label="Lower number" onClick={() => step(-1)}>
              -
            </button>
            <input
              id="agent-number"
              data-testid="agent-input"
              data-autofocus
              className="input mono center"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_AGENT}
              required={!!startEmpty}
              value={agentText}
              onChange={(e) => setAgentText(e.target.value.slice(0, 2))}
              onBlur={() => {
                if (!missing) setAgentText(String(agent))
              }}
            />
            <button type="button" className="btn square" aria-label="Raise number" onClick={() => step(1)}>
              +
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="class-code">Class code (optional)</label>
          <input
            id="class-code"
            data-testid="classcode-input"
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

        <div className="codename-preview" aria-live="polite">
          <span className="label mono">Your secret agent name</span>
          <strong className="mono" data-testid="codename-preview">
            {missing ? 'Type your number to see it' : codename}
          </strong>
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn primary" data-testid="firstrun-confirm">
            {playIntent && topic ? `Play ${topic}` : "Let's go"}
          </button>
        </div>
      </form>
    </Modal>
  )
}

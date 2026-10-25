import { useMemo, useState } from 'react'
import { clampAgentNumber, generateCodename, sanitizeClassCode } from '../lib/codename'
import { classHash, dayToISO, decodeReport } from '../lib/reportCode'
import { useGame } from '../state/store'
import { applyReport } from '../state/reportApply'
import Modal from './Modal'

/**
 * Resume with code. Merges a pasted report code into this device's progress.
 * It never wipes anything: if the code belongs to a different agent than the one on this device,
 * the student must confirm before the device switches to that agent.
 */
export default function ResumeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const profile = useGame((s) => s.profile)
  const [text, setText] = useState('')
  const [classCode, setClassCode] = useState(profile?.classCode ?? '')
  const [confirmSwitch, setConfirmSwitch] = useState(false)
  const [tried, setTried] = useState(false)

  const res = useMemo(() => (text.trim() ? decodeReport(text) : null), [text])
  const report = res?.ok ? res.report : null
  const hashOk = report ? classHash(classCode) === report.classHash : false
  const differs = !!report && !!profile && (profile.agentNumber !== report.agent || classHash(profile.classCode) !== report.classHash)

  let error: string | null = null
  if (tried && !text.trim()) error = 'Paste your report code first.'
  else if (res && !res.ok) error = res.error
  else if (report && !hashOk) error = 'That class code does not match this report code. Check the class code, or leave it as it was when the code was made.'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!report || !hashOk) return
    if (differs && !confirmSwitch) return
    applyReport(report, classCode, differs && confirmSwitch)
    onDone()
  }

  return (
    <Modal title="Resume with code" onClose={onClose} testId="resume-modal">
      <form onSubmit={submit} className="form">
        <p className="muted">Paste the report code you saved. Your progress is added to this device. Nothing is erased.</p>
        <div className="field">
          <label htmlFor="resume-code">Report code</label>
          <textarea
            id="resume-code"
            data-testid="resume-input"
            data-autofocus
            className="input mono"
            rows={3}
            value={text}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="resume-class">Class code (if you used one)</label>
          <input
            id="resume-class"
            data-testid="resume-class-input"
            className="input mono"
            value={classCode}
            maxLength={8}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => setClassCode(sanitizeClassCode(e.target.value))}
          />
        </div>

        {report && hashOk ? (
          <p className="resume-preview mono" data-testid="resume-preview">
            {generateCodename(clampAgentNumber(report.agent), classCode)} | {report.benchmarks.length} benchmarks | saved {dayToISO(report.day)}
          </p>
        ) : null}

        {differs && report && hashOk ? (
          <label className="resume-warn" data-testid="resume-warn">
            <input type="checkbox" checked={confirmSwitch} onChange={(e) => setConfirmSwitch(e.target.checked)} data-testid="resume-confirm" />
            <span>
              This device is signed in as <strong className="mono">{profile?.codename}</strong>, and this code belongs to a different agent.
              Switching clears the progress saved on this device first. Tick the box to switch.
            </span>
          </label>
        ) : null}

        <p className="form-error" role="alert" data-testid="resume-error">
          {error ?? ''}
        </p>

        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" data-testid="resume-confirm-btn" disabled={!!differs && !confirmSwitch}>
            Restore progress
          </button>
        </div>
      </form>
    </Modal>
  )
}

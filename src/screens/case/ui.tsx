import type { ReactNode } from 'react'
import { navigate } from '../../lib/router'
import { useReadAloud } from '../../lib/speech'
import { CASE_STEPS, type CaseStep } from '../../state/session'

export function StepBar({ step }: { step: CaseStep }) {
  const idx = CASE_STEPS.findIndex((s) => s.id === step)
  return (
    <ol className="stepbar" data-testid="step-indicator" aria-label="Case progress">
      {CASE_STEPS.map((s, i) => (
        <li
          key={s.id}
          className={i < idx ? 'done' : i === idx ? 'now' : ''}
          aria-current={i === idx ? 'step' : undefined}
          data-step={s.id}
        >
          <span className="step-mark" aria-hidden="true">
            {i < idx ? '\u2713' : i + 1}
          </span>
          <span>{s.label}</span>
          {i < idx ? <span className="sr-only"> (done)</span> : null}
        </li>
      ))}
    </ol>
  )
}

export function CaseTop({ step }: { step: CaseStep }) {
  return (
    <div className="topbar case-top">
      <button type="button" className="btn small" data-testid="back-to-hub-top" onClick={() => navigate('/hub')}>
        Hub
      </button>
      <StepBar step={step} />
      <span className="mono label case-tag">CASE 03-1 VITALS</span>
    </div>
  )
}

/** Verdict line: icon plus word, never color alone. */
export function Verdict({ ok, word, children, testId }: { ok: boolean; word: string; children?: ReactNode; testId?: string }) {
  return (
    <div className={ok ? 'verdict ok' : 'verdict bad'} role="status" data-testid={testId} data-ok={ok ? 'yes' : 'no'}>
      <span className="verdict-icon" aria-hidden="true">
        {ok ? '\u2714' : '\u2716'}
      </span>
      <div>
        <strong className="mono verdict-word">{word}</strong>
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  )
}

/** Small Read Aloud button for any block of text. Silent no-op with a notice when speech is unavailable. */
export function ReadAloudButton({ text, testId = 'read-aloud', label = 'Read aloud' }: { text: string; testId?: string; label?: string }) {
  const ra = useReadAloud(text)
  return (
    <span className="ra-wrap">
      <button
        type="button"
        className="btn small ra-btn"
        data-testid={testId}
        aria-pressed={ra.speaking}
        onClick={() => (ra.speaking ? ra.stop() : ra.start())}
      >
        <span aria-hidden="true">{ra.speaking ? '\u25A0' : '\u25B6'}</span> {ra.speaking ? 'Stop' : label}
      </button>
      {ra.unavailable ? (
        <span className="ra-note muted" role="status" data-testid="read-aloud-unavailable">
          Read aloud is not available on this device.
        </span>
      ) : null}
    </span>
  )
}

export function PanelHead({ code, title, sub }: { code: string; title: string; sub?: string }) {
  return (
    <header className="panel-head">
      <span className="mono label">{code}</span>
      <h2 className="mono panel-title">{title}</h2>
      {sub ? <p className="muted">{sub}</p> : null}
    </header>
  )
}

import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Modal from '../../ui/Modal'
import HelpLevelPicker from '../../ui/HelpLevelPicker'
import { useGame } from '../../state/store'
import { clampSoundVolume, TEXT_SIZE_LABELS, LINE_SPACING_LABELS, type TextSize, type LineSpacing } from '../../state/settings'
import '../../ui/caseOptions.css'
import { navigate } from '../../lib/router'
import { useReadAloud } from '../../lib/speech'
import { stepsFor, useSession, type CaseKind, type CaseStep } from '../../state/session'
import { content } from '../../content'
import type { CaseDef } from '../../content/schema'
import { useCaseDef } from './useCaseDef'
import { useAnnounce } from '../../ui/announceBus'

export function StepBar({ step, kind = 'case', caseDef = null }: { step: CaseStep; kind?: CaseKind; caseDef?: CaseDef | null }) {
  const steps = stepsFor(kind, caseDef)
  const idx = steps.findIndex((s) => s.id === step)
  return (
    <div className="stepwrap">
      <ol className="stepbar" data-testid="step-indicator" aria-label="Case progress">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={i < idx ? 'done' : i === idx ? 'now' : ''}
            aria-current={i === idx ? 'step' : undefined}
            data-step={s.id}
          >
            <span className="step-mark" aria-hidden="true">
              {i < idx ? '\u2713' : i + 1}
            </span>
            <span className="step-label">{s.label}</span>
            {i < idx ? <span className="sr-only"> (done)</span> : null}
          </li>
        ))}
      </ol>
      {/* Narrow and short screens show this single row instead of the seven step pills. */}
      <p className="step-compact" data-testid="step-compact" aria-hidden="true">
        <span className="mono step-compact-label">{steps[idx]?.label}</span>
        <span className="mono step-compact-count">
          {idx + 1}/{steps.length}
        </span>
        <span className="step-dots">
          {steps.map((s, i) => (
            <i key={s.id} className={i < idx ? 'done' : i === idx ? 'now' : ''} />
          ))}
        </span>
      </p>
    </div>
  )
}

function CaseOptions({ onClose }: { onClose: () => void }) {
  const settings = useGame((s) => s.settings)
  const set = useGame((s) => s.setSettings)
  return createPortal(
    <Modal title="Options" onClose={onClose} testId="case-options-dialog">
      <p>Help changes start with the next question. Your place in this lab stays right here.</p>
      <HelpLevelPicker />
      <div className="case-options-reading">
        <label>
          Text size
          <select className="input" data-testid="case-text-size" value={settings.textSize}
            onChange={(e) => set({ textSize: Number(e.target.value) as TextSize })}>
            {Object.entries(TEXT_SIZE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Line spacing
          <select className="input" data-testid="case-line-spacing" value={settings.lineSpacing}
            onChange={(e) => set({ lineSpacing: Number(e.target.value) as LineSpacing })}>
            {Object.entries(LINE_SPACING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="toggle">
        <input type="checkbox" data-testid="case-sound" checked={settings.sound}
          onChange={(e) => set({ sound: e.target.checked })} />
        <span className="toggle-box" aria-hidden="true" />
        <span>Sound <strong className="toggle-state">{settings.sound ? 'ON' : 'OFF'}</strong></span>
      </label>
      <label className="case-options-volume">
        Volume <strong>{Math.round(settings.soundVolume * 100)}%</strong>
        <input className="range" type="range" min={0} max={100} step={5}
          data-testid="case-volume" value={Math.round(settings.soundVolume * 100)}
          onChange={(e) => set({ soundVolume: clampSoundVolume(Number(e.target.value) / 100) })} />
      </label>
      <div className="actions">
        <button type="button" className="btn" data-autofocus data-testid="case-options-close" onClick={onClose}>Done</button>
      </div>
    </Modal>,
    document.body,
  )
}

export function CaseTop({ step }: { step: CaseStep }) {
  const kind = useSession((s) => s.kind)
  const def = useCaseDef()
  const [optionsOpen, setOptionsOpen] = useState(false)
  return (
    <div className="topbar case-top">
      <div className="case-top-controls">
        <button type="button" className="btn small ghost" data-testid="back-to-hub-top" onClick={() => navigate('/hub')}>
          Hub
        </button>
        <button type="button" className="btn small ghost" data-testid="case-options" aria-haspopup="dialog"
          aria-expanded={optionsOpen} onClick={() => setOptionsOpen(true)}>Options</button>
      </div>
      {optionsOpen ? <CaseOptions onClose={() => setOptionsOpen(false)} /> : null}
      <StepBar step={step} kind={kind} caseDef={kind === 'cold' ? null : def} />
      <span className="label case-tag">{kind === 'cold' ? `COLD CASE ${content.coldCase.codename}` : `CASE ${def.id} ${def.codename}`}</span>
    </div>
  )
}

/** Verdict line: icon plus word, never color alone. */
export function Verdict({ ok, word, children, testId }: { ok: boolean; word: string; children?: ReactNode; testId?: string }) {
  useAnnounce(`${word}. ${typeof children === 'string' ? children : ''}`)
  return (
    <div className={ok ? 'verdict ok' : 'verdict bad'} data-testid={testId} data-ok={ok ? 'yes' : 'no'}>
      <span className="verdict-icon" aria-hidden="true">
        {ok ? '\u2714' : '\u2716'}
      </span>
      <div>
        <strong className="verdict-word">{word}</strong>
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
          Read aloud is not available on this device right now.
        </span>
      ) : null}
    </span>
  )
}

export function PanelHead({ code, title, sub }: { code: string; title: string; sub?: string }) {
  return (
    <header className="panel-head">
      <span className="label">{code}</span>
      <h2 className="panel-title">{title}</h2>
      {sub ? <p className="muted">{sub}</p> : null}
    </header>
  )
}

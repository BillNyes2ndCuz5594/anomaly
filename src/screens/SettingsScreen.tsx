import { navigate } from '../lib/router'
import { QUALITY_SETTINGS, type QualitySetting } from '../state/quality'
import {
  clampSoundVolume,
  LINE_SPACING_LABELS,
  TEXT_SIZE_LABELS,
  type LineSpacing,
  type TextSize,
} from '../state/settings'
import { useGame } from '../state/store'
import './settings-sound.css'
import './settings.css'

const QUALITY_LABEL: Record<QualitySetting, string> = {
  auto: 'Auto (recommended)',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
}

function Segmented<T extends number>({
  legend,
  value,
  labels,
  onChange,
  testId,
}: {
  legend: string
  value: T
  labels: Record<T, string>
  onChange: (v: T) => void
  testId: string
}) {
  const keys = Object.keys(labels).map(Number) as T[]
  return (
    <fieldset className="field segmented" data-testid={testId}>
      <legend>{legend}</legend>
      <div className="seg-row">
        {keys.map((k) => (
          <label key={k} className={k === value ? 'seg on' : 'seg'}>
            <input type="radio" name={testId} checked={k === value} onChange={() => onChange(k)} />
            <span>{labels[k]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  testId,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  testId: string
}) {
  return (
    <div className="field toggle-row">
      <label className="toggle">
        <input type="checkbox" data-testid={testId} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-box" aria-hidden="true" />
        <span>
          {label}
          <strong className="toggle-state mono">{checked ? 'ON' : 'OFF'}</strong>
        </span>
      </label>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export default function SettingsScreen() {
  const settings = useGame((s) => s.settings)
  const set = useGame((s) => s.setSettings)
  const hasProfile = useGame((s) => s.profile !== null)

  return (
    <div className="screen settings-screen" data-testid="settings">
      <div className="topbar">
        <button type="button" className="btn small ghost" data-testid="settings-back" onClick={() => navigate(hasProfile ? '/hub' : '/')}>
          Back
        </button>
        <span className="label">SETTINGS</span>
      </div>

      <main className="panel brackets settings-panel">
        <h1 className="screen-title">Settings</h1>
        <div className="settings-scroll-area">
          <div className="settings-grid">
            <section className="settings-section">
              <h2 className="settings-section-title">Reading</h2>
              <div className="form">
                <Segmented<TextSize>
                  legend="Text size"
                  value={settings.textSize}
                  labels={TEXT_SIZE_LABELS}
                  onChange={(v) => set({ textSize: v })}
                  testId="setting-text-size"
                />
                <Segmented<LineSpacing>
                  legend="Line spacing"
                  value={settings.lineSpacing}
                  labels={LINE_SPACING_LABELS}
                  onChange={(v) => set({ lineSpacing: v })}
                  testId="setting-line-spacing"
                />
                <div className="field">
                  <label htmlFor="rate">
                    Read-aloud speed <strong className="mono">{settings.readAloudRate.toFixed(1)}x</strong>
                  </label>
                  <input
                    id="rate"
                    className="range"
                    type="range"
                    min={0.6}
                    max={1.4}
                    step={0.1}
                    data-testid="setting-rate"
                    value={settings.readAloudRate}
                    onChange={(e) => set({ readAloudRate: Math.round(parseFloat(e.target.value) * 10) / 10 })}
                  />
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h2 className="settings-section-title">Display</h2>
              <div className="form">
                <div className="field">
                  <label htmlFor="quality">Graphics quality</label>
                  <select
                    id="quality"
                    className="input"
                    style={{ minHeight: '44px' }}
                    data-testid="setting-quality"
                    value={settings.quality}
                    onChange={(e) => set({ quality: e.target.value as QualitySetting })}
                  >
                    {QUALITY_SETTINGS.map((q) => (
                      <option key={q} value={q}>
                        {QUALITY_LABEL[q]}
                      </option>
                    ))}
                  </select>
                  <span className="hint">Auto picks a tier from your frame rate. Lower it if the game feels slow.</span>
                </div>
                <Toggle
                  label="Reduced motion"
                  hint="No camera swoops or drifting. Starts from your device setting."
                  checked={settings.reducedMotion}
                  onChange={(v) => set({ reducedMotion: v })}
                  testId="setting-reduced-motion"
                />
                <Toggle
                  label="Show FPS"
                  hint="Shows frame rate, graphics backend, and tier."
                  checked={settings.showFps}
                  onChange={(v) => set({ showFps: v })}
                  testId="setting-show-fps"
                />
              </div>
            </section>

            <section className="settings-section">
              <h2 className="settings-section-title">Sound</h2>
              <div className="form">
                <div className="sound-block">
                  <Toggle
                    label="Sound"
                    hint="Lab cues and a soft hum on the hub and cases. Sound never carries the answer."
                    checked={settings.sound}
                    onChange={(v) => set({ sound: v })}
                    testId="setting-sound"
                  />
                  <div className="sound-volume">
                    <label className="sound-volume-label" htmlFor="sound-volume">
                      Volume
                      <strong className="mono">{Math.round(settings.soundVolume * 100)}%</strong>
                    </label>
                    <input
                      id="sound-volume"
                      className="range"
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      data-testid="setting-volume"
                      value={Math.round(settings.soundVolume * 100)}
                      onChange={(e) => set({ soundVolume: clampSoundVolume(parseFloat(e.target.value) / 100) })}
                    />
                    <span className="hint">Starts at a modest level. The switch above turns every cue off.</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        <p className="muted preview-text">
          Preview: DISPATCH reports a strange reading near the coast. Check the field kit before you go.
        </p>
      </main>
    </div>
  )
}

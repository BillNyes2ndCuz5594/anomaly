import { useId } from 'react'
import type { HelpLevel } from '../state/helpLevel'
import { useGame } from '../state/store'
import './helpLevel.css'

interface OptionDef {
  level: HelpLevel
  title: string
  sub: string
}

const OPTIONS: readonly OptionDef[] = [
  {
    level: 'extra',
    title: 'Extra help',
    sub: 'One wrong answer starts crossed out.',
  },
  {
    level: 'regular',
    title: 'Regular',
    sub: 'The usual game.',
  },
  {
    level: 'challenge',
    title: 'Challenge',
    sub: 'No crossing out. For case questions.',
  },
]

export default function HelpLevelPicker() {
  const groupName = useId()
  const helpLevel = useGame((s) => s.settings.helpLevel)
  const setSettings = useGame((s) => s.setSettings)

  return (
    <fieldset
      className="help-level-picker"
      role="radiogroup"
      aria-label="Help level"
      data-testid="help-level-picker"
    >
      <legend className="help-level-legend">How much help?</legend>
      <div className="help-level-options">
        {OPTIONS.map((opt) => {
          const isChecked = helpLevel === opt.level
          const optId = `${groupName}-${opt.level}`
          const descId = `${optId}-desc`
          return (
            <label
              key={opt.level}
              htmlFor={optId}
              className={isChecked ? 'help-level-option on' : 'help-level-option'}
            >
              <input
                type="radio"
                id={optId}
                name={groupName}
                value={opt.level}
                checked={isChecked}
                onChange={() => setSettings({ helpLevel: opt.level })}
                aria-describedby={descId}
                data-testid={`help-level-${opt.level}`}
                className="help-level-radio"
              />
              <span className="help-level-text">
                <span className="help-level-title">{opt.title}</span>
                <span id={descId} className="help-level-sub">
                  {opt.sub}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

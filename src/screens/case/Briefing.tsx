import { useMemo } from 'react'
import { content } from '../../content/schema'
import { useReadAloud, wordAt } from '../../lib/speech'
import { useSession } from '../../state/session'
import { CaseTop } from './ui'

export default function Briefing() {
  const next = useSession((s) => s.next)
  const c = content.case
  const text = c.briefing.join(' ')
  const ra = useReadAloud(text)

  // Word starts inside the joined text, so boundary charIndex maps to a word.
  const layout = useMemo(() => {
    const starts: number[] = []
    let offset = 0
    const lines = c.briefing.map((line) => {
      const words = line.split(' ').map((w, i, arr) => {
        const start = offset
        starts.push(start)
        offset += w.length + (i < arr.length - 1 ? 1 : 0)
        return { w, i: starts.length - 1 }
      })
      offset += 1
      return words
    })
    return { lines, starts }
  }, [c.briefing])
  const current = ra.speaking && ra.charIndex >= 0 ? wordAt(layout.starts, ra.charIndex) : -1

  return (
    <div className="screen case-screen" data-testid="briefing">
      <CaseTop step="briefing" />
      <aside className="panel brackets side-panel dispatch-card" aria-label="Dispatch briefing">
        <header className="dispatch-head">
          <span className="dispatch-dot" aria-hidden="true" />
          <span className="mono label amber">DISPATCH</span>
          <span className="mono signal" aria-hidden="true">
            <i /> <i /> <i /> <i />
          </span>
        </header>
        <h1 className="mono dispatch-title">CASE 03-1 VITALS</h1>
        <p className="dispatch-hook">{c.dispatchHook}</p>
        <div className="dispatch-lines" data-testid="briefing-text">
          {layout.lines.map((words, li) => (
            <p key={li}>
              {words.map(({ w, i }, k) => (
                <span key={i} className={i === current ? 'rw on' : 'rw'}>
                  {w}
                  {k < words.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          ))}
        </div>
        <div className="panel-actions col">
          <div className="row">
            <button
              type="button"
              className="btn"
              data-testid="read-aloud"
              aria-pressed={ra.speaking}
              onClick={() => (ra.speaking ? ra.stop() : ra.start())}
            >
              <span aria-hidden="true">{ra.speaking ? '\u25A0' : '\u25B6'}</span> {ra.speaking ? 'Stop' : 'Read aloud'}
            </button>
            {ra.unavailable ? (
              <span className="muted ra-note" role="status" data-testid="read-aloud-unavailable">
                Read aloud is not available on this device.
              </span>
            ) : null}
          </div>
          <button type="button" className="btn primary big" data-testid="briefing-continue" onClick={next}>
            Start field lab
          </button>
        </div>
      </aside>
    </div>
  )
}

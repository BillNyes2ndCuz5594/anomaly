import { useMemo } from 'react'
import { content } from '../../content/schema'
import { useReadAloud, wordAt } from '../../lib/speech'
import { useSession } from '../../state/session'
import { CaseTop } from './ui'

export default function Briefing({ kind = 'case' }: { kind?: 'case' | 'cold' }) {
  const next = useSession((s) => s.next)
  const cold = kind === 'cold'
  const c = cold ? content.coldCase : content.case
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
    <div className="screen case-screen" data-testid={cold ? 'cold-intro' : 'briefing'}>
      <CaseTop step="briefing" />
      <aside className="panel brackets side-panel dispatch-card" aria-label={cold ? 'Dispatch briefing, cold case' : 'Dispatch briefing'}>
        <header className="dispatch-head">
          <span className="dispatch-dot" aria-hidden="true" />
          <span className="label amber">DISPATCH</span>
          <span className="mono signal" aria-hidden="true">
            <i /> <i /> <i /> <i />
          </span>
        </header>
        <h1 className="dispatch-title">{cold ? `COLD CASE ${c.codename}` : `CASE ${content.case.id} ${c.codename}`}</h1>
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
              className="btn ghost"
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
          <button type="button" className="btn primary big" data-testid={cold ? 'cold-continue' : 'briefing-continue'} onClick={next}>
            {cold ? 'Open the evidence' : 'Start field lab'}
          </button>
        </div>
      </aside>
    </div>
  )
}

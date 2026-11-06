import { Fragment, useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { content } from '../../content'
import { useReadAloud, wordAt } from '../../lib/speech'
import { useRuntime } from '../../state/runtime'
import { useSession } from '../../state/session'
import BriefingFeed from '../../ui/BriefingFeed'
import { FrostCreep } from '../../ui/FrostOverlay'
import { useMotionMode } from '../../ui/useMotionMode'
import { CaseTop } from './ui'
import { useCaseDef } from './useCaseDef'
import { usePressed } from './usePressed'
import { useTapGuard } from '../../ui/useTapGuard'
import './briefing-labb.css'

const posters = import.meta.glob<string>([
  '../../assets/briefing/briefing-00-1.webp',
  '../../assets/briefing/briefing-02-1.webp',
  '../../assets/briefing/briefing-02-2.webp',
  '../../assets/briefing/briefing-03-1.webp',
  '../../assets/briefing/briefing-04-1.webp',
  '../../assets/briefing/briefing-05-1.webp',
  '../../assets/briefing/briefing-06-1.webp',
  '../../assets/briefing/briefing-07-1.webp',
  '../../assets/briefing/briefing-07-2.webp',
], { eager: true, query: '?url', import: 'default' })

export default function Briefing({ kind = 'case' }: { kind?: 'case' | 'cold' }) {
  const next = useSession((s) => s.next)
  const cold = kind === 'cold'
  const def = useCaseDef()
  const c = cold ? content.coldCase : def
  const poster = cold ? undefined : posters[`../../assets/briefing/briefing-${def.id}.webp`]
  const text = c.briefing.join(' ')
  const ra = useReadAloud(text)

  // Word starts inside the joined text, so boundary charIndex maps to a word.
  const layout = useMemo(() => {
    const starts: number[] = []
    let offset = 0
    const lines = []
    for (const line of c.briefing) {
      const words = line.split(' ').map((w, i, arr) => {
        const start = offset
        starts.push(start)
        offset += w.length + (i < arr.length - 1 ? 1 : 0)
        return { w, i: starts.length - 1 }
      })
      offset += 1
      lines.push(words)
    }
    return { lines, starts }
  }, [c.briefing])
  const current = ra.speaking && ra.charIndex >= 0 ? wordAt(layout.starts, ra.charIndex) : -1
  const press = usePressed()
  const storyRef = useRef<HTMLDivElement>(null)
  // Keep the word being read aloud inside the story scroller (auto, so it stays reduced motion safe).
  useEffect(() => {
    if (current < 0) return
    storyRef.current?.querySelector('.rw.on')?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [current])

  // B2: the hook types in word by word over 600 ms (CSS) and the longest word glitches amber. The full text stays in the DOM.
  const hookWords = useMemo(() => c.dispatchHook.split(' '), [c.dispatchHook])
  const glitchAt = useMemo(() => hookWords.reduce((best, w, i, a) => (w.length > a[best].length ? i : best), 0), [hookWords])

  // Cold case: "Open the evidence" pulls a canister first (500 ms in full motion), then the usual step change.
  const motion = useMotionMode()
  const admit = useTapGuard()
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const proceed = () => {
    // A tap burst must not skip the lab or the questions that follow it.
    if (!admit('step-exit', Infinity)) return
    if (!cold) return next()
    useRuntime.getState().pullCanister()
    const ms = motion === 'full' ? 500 : motion === 'fade' ? 250 : 0
    if (ms === 0) next()
    else timer.current = window.setTimeout(next, ms)
  }

  return (
    <div className="screen case-screen briefing-screen" data-testid={cold ? 'cold-intro' : 'briefing'}>
      <CaseTop step="briefing" />
      {cold ? <FrostCreep /> : null}
      <aside className="panel brackets side-panel dispatch-card" aria-label={cold ? 'Dispatch briefing, cold case' : 'Dispatch briefing'}>
        <header className="dispatch-head">
          <span className="dispatch-dot" aria-hidden="true" />
          <span className="label amber">DISPATCH</span>
          <span className="mono signal" aria-hidden="true">
            <i /> <i /> <i /> <i />
          </span>
        </header>
        <h1 className="dispatch-title">{cold ? `COLD CASE ${c.codename}` : `CASE ${def.id} ${c.codename}`}</h1>
        {cold ? null : def.id === '04-1' ? (
          <BriefingFeed variant="spill-04-1" />
        ) : poster ? (
          <div className="briefing-poster" data-testid="briefing-poster" aria-hidden="true">
            <img src={poster} alt="" />
          </div>
        ) : <BriefingFeed />}
        <p className="dispatch-hook" data-testid="dispatch-hook" style={{ '--wn': hookWords.length } as CSSProperties}>
          {hookWords.map((w, i) => (
            <Fragment key={i}>
              <span className={i === glitchAt ? 'hook-w hook-glitch' : 'hook-w'} style={{ '--wi': i } as CSSProperties}>
                {w}
              </span>
              {i < hookWords.length - 1 ? ' ' : null}
            </Fragment>
          ))}
        </p>
        {/* VITALS stages the body scan and the manatee; other cases preview their Field Lab dais instead. */}
        {cold || def.lab.kind !== 'vitals' ? null : (
          <ul className="dispatch-key" aria-label="On the table">
            <li>
              <span className="key-dot scan" aria-hidden="true" /> Body scan
            </li>
            <li>
              <span className="key-dot life" aria-hidden="true" /> Manatee
            </li>
          </ul>
        )}
        <div
          className="briefing-story"
          data-testid="briefing-story"
          ref={storyRef}
          tabIndex={0}
          role="region"
          aria-label="Case briefing story"
          onKeyDown={(e) => {
            const el = e.currentTarget
            if (e.key === 'ArrowDown') {
              el.scrollTop += 40
              e.preventDefault()
            } else if (e.key === 'ArrowUp') {
              el.scrollTop -= 40
              e.preventDefault()
            } else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) {
              el.scrollTop += el.clientHeight * 0.8
              e.preventDefault()
            } else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) {
              el.scrollTop -= el.clientHeight * 0.8
              e.preventDefault()
            } else if (e.key === 'Home') {
              el.scrollTop = 0
              e.preventDefault()
            } else if (e.key === 'End') {
              el.scrollTop = el.scrollHeight
              e.preventDefault()
            }
          }}
        >
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
        </div>
        <footer className="panel-actions col briefing-actions" data-testid="briefing-actions">
          <div className="row">
            <button
              type="button"
              className="btn ghost"
              data-testid="read-aloud"
              aria-pressed={ra.speaking}
              {...press('read')}
              onClick={() => (ra.speaking ? ra.stop() : ra.start())}
            >
              <span aria-hidden="true">{ra.speaking ? '\u25A0' : '\u25B6'}</span> {ra.speaking ? 'Stop' : 'Read aloud'}
            </button>
            {ra.unavailable ? (
              <span className="muted ra-note" role="status" data-testid="read-aloud-unavailable">
                Read aloud is not available on this device right now.
              </span>
            ) : null}
          </div>
          <button type="button" className="btn primary big" data-testid={cold ? 'cold-continue' : 'briefing-continue'} {...press('next')} onClick={proceed}>
            {cold ? 'Open the evidence' : 'Enter the Field Lab'}
          </button>
        </footer>
      </aside>
    </div>
  )
}

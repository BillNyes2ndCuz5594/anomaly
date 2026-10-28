import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { codexById, type Item } from '../../content/schema'
import { findKeyPhrases, tokenizeStem } from '../../lib/rkea'
import { wordAt, useReadAloud } from '../../lib/speech'
import { useSession, type AnswerRecord } from '../../state/session'
import { useGame } from '../../state/store'
import { useAnnounce } from '../../ui/announce'
import { CaseTop } from './ui'
import ItemVisual from './ItemVisual'
import { isStageVisual } from '../../three/paintHold'

const LETTERS = ['A', 'B', 'C', 'D']

/** Intel values. Accuracy and good process earn Intel, speed never does. */
export const INTEL = { keyWord: 2, eliminate: 1, correct: 5 }

/** Codex entries matched by an item's correct option, e.g. "heart" matches organ:heart. */
export function codexIdsFor(item: Item): string[] {
  const slug = item.options[item.key].toLowerCase().trim().replace(/\s+/g, '-')
  return [`organ:${slug}`, `specimen:${slug}`].filter((id) => codexById.has(id))
}

interface BodyProps {
  item: Item
  index: number
  total: number
  onLocked: (a: AnswerRecord) => void
  onNext: () => void
}

function ItemBody({ item, index, total, onLocked, onNext, sideEl }: BodyProps & { sideEl: HTMLElement }) {
  const tokens = useMemo(() => tokenizeStem(item.stem), [item.stem])
  const phrases = useMemo(() => findKeyPhrases(item.stem, item.keyWords), [item.stem, item.keyWords])
  const phraseOf = useMemo(() => {
    const m = new Map<number, number>()
    phrases.forEach((p, pi) => p.tokens.forEach((t) => m.set(t, pi)))
    return m
  }, [phrases])

  const [tagged, setTagged] = useState<Set<number>>(new Set())
  const [earnedPhrases, setEarned] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<number | null>(null)
  const [struck, setStruck] = useState<Set<number>>(new Set())
  const [elim, setElim] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [hints, setHints] = useState(0)
  const [struckEver, setStruckEver] = useState<Set<number>>(new Set())
  const [attemptedStrike, setAttempted] = useState(false)
  const [readUsed, setReadUsed] = useState(false)
  const [result, setResult] = useState<AnswerRecord | null>(null)
  const locked = result !== null
  useAnnounce(result ? `${result.correct ? 'Correct' : 'Not quite'}. ${result.correct ? 'Locked in.' : `The key was ${LETTERS[item.key]}.`} Intel earned: ${result.intel}` : '')

  // Read aloud: stem first, then the four options.
  const spoken = useMemo(() => {
    const stemText = tokens.join(' ')
    const stemStarts: number[] = []
    let off = 0
    tokens.forEach((t) => {
      stemStarts.push(off)
      off += t.length + 1
    })
    let text = stemText
    const optStarts: number[] = []
    item.options.forEach((o, i) => {
      text += ' '
      optStarts.push(text.length)
      text += `${LETTERS[i]}. ${o}.`
    })
    return { text, stemStarts, optStarts, stemLen: stemText.length }
  }, [tokens, item.options])
  const ra = useReadAloud(spoken.text, () => setReadUsed(true))
  const at = ra.speaking && ra.charIndex >= 0 ? ra.charIndex : -1
  const speakingWord = at >= 0 && at < spoken.stemLen + 1 ? wordAt(spoken.stemStarts, at) : -1
  const speakingOpt = at > spoken.stemLen ? wordAt(spoken.optStarts, at) : -1

  const toggleWord = useCallback(
    (t: number) => {
      if (locked) return
      const pi = phraseOf.get(t)
      setTagged((prev) => {
        const next = new Set(prev)
        if (pi === undefined) {
          if (next.has(t)) next.delete(t)
          else next.add(t)
          return next
        }
        const idxs = phrases[pi].tokens
        const all = idxs.every((i) => prev.has(i))
        idxs.forEach((i) => (all ? next.delete(i) : next.add(i)))
        return next
      })
      if (pi !== undefined && !phrases[pi].tokens.every((i) => tagged.has(i)) && !earnedPhrases.has(pi)) {
        setEarned((e) => new Set(e).add(pi))
        setToast(`Intel +${INTEL.keyWord}: key words found`)
      }
    },
    [locked, phraseOf, phrases, tagged, earnedPhrases],
  )

  const strike = useCallback(
    (i: number) => {
      if (locked) return
      setAttempted(true)
      if (i === item.key) {
        setHints((h) => h + 1)
        setMsg('Careful. Check that one again.')
        return
      }
      setMsg(null)
      setStruck((prev) => {
        const next = new Set(prev)
        if (next.has(i)) next.delete(i)
        else next.add(i)
        return next
      })
      if (!struckEver.has(i)) {
        setStruckEver((s) => new Set(s).add(i))
        setToast(`Intel +${INTEL.eliminate}: decoy ruled out`)
      }
      setSelected((s) => (s === i ? null : s))
    },
    [locked, item.key, struckEver],
  )

  const choose = useCallback(
    (i: number) => {
      if (locked) return
      if (elim) return strike(i)
      if (struck.has(i)) return
      setSelected(i)
      setMsg(null)
    },
    [locked, elim, strike, struck],
  )

  const lockIn = useCallback(() => {
    if (locked) return
    if (selected === null) {
      setMsg('Pick an answer first, then lock it in.')
      return
    }
    const correct = selected === item.key
    const keyTagged = phrases.filter((p) => p.tokens.every((t) => tagged.has(t))).length
    const intel = keyTagged * INTEL.keyWord + struckEver.size * INTEL.eliminate + (correct ? INTEL.correct : 0)
    const rec: AnswerRecord = { itemId: item.id, picked: selected, correct, keyTagged, eliminated: struckEver.size, hintsUsed: hints, intel }
    setResult(rec)
    ra.stop()
    onLocked(rec)
  }, [locked, selected, item, phrases, tagged, struckEver, hints, ra, onLocked])

  // Keyboard: 1-4 or A-D choose, X eliminate mode, Space read aloud, Enter lock in (or next after).
  const latest = useRef({ choose, lockIn, ra, onNext, selected, elim, locked })
  latest.current = { choose, lockIn, ra, onNext, selected, elim, locked }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const L = latest.current
      const el = e.target as HTMLElement | null
      const tag = el?.tagName ?? ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const tid = el?.dataset?.testid ?? ''
      const onOption = tid.startsWith('option-')
      const onButton = tag === 'BUTTON'
      if (L.locked) {
        if (e.key === 'Enter' && !onButton) {
          e.preventDefault()
          L.onNext()
        }
        return
      }
      const k = e.key.toLowerCase()
      const digit = '1234'.indexOf(k)
      const letter = 'abcd'.indexOf(k)
      const opt = k.length === 1 ? (digit >= 0 ? digit : letter) : -1
      if (opt >= 0) {
        e.preventDefault()
        L.choose(opt)
      } else if (k === 'x') {
        e.preventDefault()
        setElim((v) => !v)
      } else if (k === ' ' && (!onButton || onOption)) {
        e.preventDefault()
        if (L.ra.speaking) L.ra.stop()
        else L.ra.start()
      } else if (k === 'enter') {
        if (onOption) {
          e.preventDefault()
          const i = Number(tid.slice(7))
          if (L.selected === i) L.lockIn()
          else L.choose(i)
        } else if (!onButton) {
          e.preventDefault()
          L.lockIn()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Build the stem as segments so key phrases can wear a bracket around their words.
  const segments = useMemo(() => {
    const out: { phrase: number | null; idx: number[] }[] = []
    let i = 0
    while (i < tokens.length) {
      const pi = phraseOf.get(i)
      if (pi !== undefined && phrases[pi].tokens[0] === i) {
        out.push({ phrase: pi, idx: phrases[pi].tokens })
        i += phrases[pi].tokens.length
      } else {
        out.push({ phrase: null, idx: [i] })
        i++
      }
    }
    return out
  }, [tokens, phrases, phraseOf])

  const anyTagged = tagged.size > 0
  const chips = [
    { k: 'R', label: 'Read', on: readUsed },
    { k: 'K', label: 'Key words', on: anyTagged },
    { k: 'E', label: 'Eliminate', on: attemptedStrike },
    { k: 'A', label: 'Answer', on: selected !== null || locked },
  ]

  return (
    <>
        <div className="item-head">
          <span className="mono label amber" data-testid="item-count">
            EVIDENCE {index + 1} OF {total}
          </span>
          <span className="mono tiny muted">{item.benchmark}</span>
          <ol className="rkea" data-testid="rkea-chips" aria-label="RKEA steps">
            {chips.map((c) => (
              <li key={c.k} className={c.on ? 'chip-r lit' : 'chip-r'} data-testid={`rkea-${c.label.toLowerCase().replace(' ', '-')}`} data-lit={c.on ? 'yes' : 'no'}>
                <b className="mono">{c.k}</b> {c.label}
                {c.on ? <span aria-hidden="true"> {'\u2713'}</span> : null}
                <span className="sr-only">{c.on ? ' (used)' : ' (not used yet)'}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="panel brackets stem-panel">
          <p className="stem" data-testid="stem">
            {segments.map((seg, si) => {
              const words = seg.idx.map((t) => (
                <span key={t} className="word-wrap">
                  <button
                    type="button"
                    className={`word${tagged.has(t) ? ' tagged' : ''}${speakingWord === t ? ' speaking' : ''}`}
                    data-testid={`word-${t}`}
                    aria-pressed={tagged.has(t)}
                    disabled={locked}
                    onClick={() => toggleWord(t)}
                  >
                    {tokens[t]}
                  </button>{' '}
                </span>
              ))
              const found = seg.phrase !== null && seg.idx.every((t) => tagged.has(t))
              return found ? (
                <span key={si} className="kw-found" data-testid={`keyword-${seg.phrase}`} title="Key words">
                  {words}
                </span>
              ) : (
                <span key={si}>{words}</span>
              )
            })}
          </p>
          <div className="stem-foot">
            <span className="muted tiny">Tap words to tag key words. Real key words earn Intel.</span>
            {toast ? (
              <span className="intel-toast mono" role="status" data-testid="intel-toast">
                {toast}
              </span>
            ) : null}
          </div>
        </div>
      {createPortal(
        <div className="panel brackets options-panel">
          <div role="group" aria-label="Answer options" className="options">
            {item.options.map((o, i) => {
              const isStruck = struck.has(i)
              const isSel = selected === i
              const isKey = i === item.key
              const picked = result?.picked === i
              return (
                <div key={i} className={`opt${isStruck ? ' struck' : ''}${isSel ? ' sel' : ''}${speakingOpt === i ? ' speaking' : ''}${locked ? (isKey ? ' key' : picked ? ' wrong' : '') : ''}`}>
                  <button
                    type="button"
                    className="opt-btn"
                    data-testid={`option-${i}`}
                    aria-pressed={isSel}
                    aria-disabled={isStruck || locked}
                    aria-describedby={`why-${i}`}
                    onClick={() => choose(i)}
                  >
                    <span className="opt-letter mono" aria-hidden="true">
                      {LETTERS[i]}
                    </span>
                    <span className="opt-text">
                      <span className="sr-only">Option {LETTERS[i]}: </span>
                      {o}
                      {isStruck ? <span className="sr-only"> (ruled out)</span> : null}
                    </span>
                    {locked ? (
                      <span className="opt-mark mono" data-testid={`mark-${i}`}>
                        <span aria-hidden="true">{isKey ? '\u2714' : '\u2716'}</span> {isKey ? 'Correct' : picked ? 'Your pick' : 'Decoy'}
                        {isKey && picked ? ' (your pick)' : ''}
                      </span>
                    ) : isSel ? (
                      <span className="opt-mark mono">
                        <span aria-hidden="true">{'\u25C9'}</span> Selected
                      </span>
                    ) : null}
                  </button>
                  <div id={`why-${i}`} className="opt-why" data-testid={`why-${i}`} hidden={!(locked || isStruck)}>
                    {locked || isStruck ? item.why[i] : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="dispatch-line" role="status" aria-live="polite" data-testid="dispatch-msg">
            {msg ? (
              <>
                <span className="mono amber">DISPATCH:</span> {msg}
              </>
            ) : null}
          </div>

          {locked ? (
            <div className={`verdict ${result.correct ? 'ok' : 'bad'}`} data-testid="item-result" data-ok={result.correct ? 'yes' : 'no'}>
              <span className="verdict-icon" aria-hidden="true">
                {result.correct ? '\u2714' : '\u2716'}
              </span>
              <div>
                <strong className="mono verdict-word">{result.correct ? 'Correct' : 'Not quite'}</strong>
                <p className="muted">
                  {result.correct ? 'Locked in. ' : `The key was ${LETTERS[item.key]}. `}Intel earned: {result.intel}
                </p>
              </div>
            </div>
          ) : null}

          <div className="item-actions">
            {!locked ? (
              <>
                <button
                  type="button"
                  className={`btn${elim ? ' on' : ''}`}
                  data-testid="eliminate-toggle"
                  aria-pressed={elim}
                  onClick={() => setElim((v) => !v)}
                >
                  <span aria-hidden="true">{'\u2716'}</span> Eliminate {elim ? 'on' : 'off'}
                </button>
                <button type="button" className="btn" data-testid="read-aloud" aria-pressed={ra.speaking} onClick={() => (ra.speaking ? ra.stop() : ra.start())}>
                  <span aria-hidden="true">{ra.speaking ? '\u25A0' : '\u25B6'}</span> {ra.speaking ? 'Stop' : 'Read aloud'}
                </button>
                <button type="button" className="btn primary" data-testid="lock-in" disabled={selected === null} onClick={lockIn}>
                  Lock in
                </button>
              </>
            ) : (
              <button type="button" className="btn primary big" data-testid="next-item" onClick={onNext} autoFocus>
                {index + 1 >= total ? 'See debrief' : 'Next item'}
              </button>
            )}
          </div>
          {ra.unavailable ? (
            <p className="muted tiny" role="status" data-testid="read-aloud-unavailable">
              Read aloud is not available on this device.
            </p>
          ) : null}
          {!locked ? <p className="muted tiny kbd-hint">Keys: 1-4 or A-D choose, X eliminate, Space read aloud, Enter lock in.</p> : null}
        </div>,
        sideEl,
      )}
    </>
  )
}

export default function ItemPlayer() {
  const items = useSession((s) => s.items)
  const go = useSession((s) => s.go)
  const addAnswer = useSession((s) => s.addAnswer)
  const [idx, setIdx] = useState(0)
  const [seen, setSeen] = useState(0)
  const [dir, setDir] = useState<'forward' | 'back'>('forward')
  if (idx !== seen) {
    setDir(idx >= seen ? 'forward' : 'back')
    setSeen(idx)
  }
  const item = items[idx]

  const onLocked = useCallback(
    (a: AnswerRecord) => {
      const st = useGame.getState()
      const out = st.recordItem(item.benchmark, item.id, a.correct)
      if (a.intel) st.addIntel(a.intel)
      if (a.correct) st.unlockCodex(codexIdsFor(item))
      addAnswer(a, out.stageUp, out.paint)
    },
    [item, addAnswer],
  )
  const onNext = useCallback(() => {
    if (idx + 1 >= items.length) go('debrief')
    else setIdx(idx + 1)
  }, [idx, items.length, go])

  const [sideEl, setSideEl] = useState<HTMLElement | null>(null)
  if (!item) return null
  const stage3d = item.visual.kind === 'organ' || item.visual.kind === 'specimen' || item.visual.kind === 'plantanimal'
  const stageMany = item.visual.kind === 'specimen' && item.visual.ids.length > 2
  return (
    <div className="screen case-screen item-screen" data-testid="item-player">
      <CaseTop step="items" />
      {/* The 3D visual stays mounted across items. Keying it would rebuild the canvas, and fading the grid would blank that canvas mid-glide. */}
      <div className={`item-grid${stage3d ? ' stage-3d' : ''}${stageMany ? ' stage-many' : ''}`} data-dir={dir}>
        <section className="item-main">
          {sideEl ? <ItemBody key={item.id} sideEl={sideEl} item={item} index={idx} total={items.length} onLocked={onLocked} onNext={onNext} /> : null}
          <ItemVisual item={item} upcoming={items[idx + 1] && isStageVisual(items[idx + 1].visual) ? items[idx + 1].visual : null} />
        </section>
        <section className="item-side" ref={setSideEl} />
      </div>
    </div>
  )
}

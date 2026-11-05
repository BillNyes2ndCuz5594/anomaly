import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Item } from '../../content/schema'
import { useReadAloud } from '../../lib/speech'
import ItemVisual from '../../screens/case/ItemVisual'
import { cleanWhy } from '../../screens/case/resultsDebrief'
import { cleanFeedback, createQuickAnswer, keyToOptionIndex, toSentenceCase, type QuickAnswer } from './quickAnswer'
import './quick.css'

export interface QuickQuestionProps {
  item: Item
  onAnswer: (answer: QuickAnswer) => void
  ariaLive?: boolean
}

/** Keyed body resets timing, speech and feedback when the displayed item changes.
 * For another occurrence of the same item, the caller can key by question index.
 */
export default function QuickQuestion(props: QuickQuestionProps) {
  return <QuestionBody key={props.item.id} {...props} />
}

function QuestionBody({ item, onAnswer, ariaLive = true }: QuickQuestionProps) {
  const [submit] = useState(() => createQuickAnswer(item))
  const [result, setResult] = useState<QuickAnswer | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const stem = useRef<HTMLHeadingElement>(null)
  const ra = useReadAloud(`${item.stem} ${item.options.map((o, i) => `${'ABCD'[i]}. ${o}.`).join(' ')}`)
  useLayoutEffect(() => {
    stem.current?.focus()
  }, [])
  const choose = useCallback((choice: number) => {
    const answer = submit(choice)
    if (!answer) return
    setPicked(choice)
    setResult(answer)
    ra.stop()
    onAnswer(answer)
  }, [submit, ra, onAnswer])

  useEffect(() => {
    if (result !== null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || (active as HTMLElement).isContentEditable)) {
        return
      }
      const idx = keyToOptionIndex(e.key)
      if (idx !== null && idx >= 0 && idx < item.options.length) {
        e.preventDefault()
        choose(idx)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [result, item.options.length, choose])

  // Static feedback and controls respect reduced motion without animation or timers.
  return (
    <section className="panel quick-panel" aria-label="Quick question" style={{ animation: 'none', transition: 'none' }}>
      <h2 ref={stem} tabIndex={-1} className="stem">{item.stem}</h2>
      <div className="quick-visual-wrap" style={{ maxHeight: 'min(34vh, 260px)', display: 'flex', justifyContent: 'center', width: '100%' }}>
        <ItemVisual item={item} />
      </div>
      <button type="button" className="btn" aria-pressed={ra.speaking}
        onClick={() => ra.speaking ? ra.stop() : ra.start()} style={{ minHeight: 44, transition: 'none' }}>
        {ra.speaking ? 'Stop reading' : 'Read aloud'}
      </button>
      {ra.unavailable && <p role="status">Read aloud is not available on this device.</p>}
      <div role="group" aria-label="Answer choices" style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {item.options.map((option, i) => {
          const isAnswered = result !== null
          const isCorrect = isAnswered && i === item.key
          const isPicked = isAnswered && i === picked
          const isWrong = isPicked && !isCorrect
          const optText = toSentenceCase(option)
          const letter = 'ABCD'[i]
          let cls = 'btn quick-option'
          if (isCorrect) cls += ' correct quick-correct'
          if (isWrong) cls += ' picked-wrong quick-wrong'
          const ariaLabel = isCorrect
            ? `${letter}. ${optText} (Correct answer)`
            : isWrong
              ? `${letter}. ${optText} (Your pick, incorrect)`
              : undefined

          return (
            <button key={i} type="button" className={cls} disabled={isAnswered}
              aria-label={ariaLabel}
              aria-pressed={isPicked ? 'true' : undefined}
              onClick={() => choose(i)} style={{ minHeight: 56, whiteSpace: 'normal', transition: 'none' }}>
              {letter}. {optText}{isCorrect ? ' \u2713' : ''}
            </button>
          )
        })}
      </div>
      <p {...(ariaLive ? { role: 'status', 'aria-live': 'polite' } : { 'aria-live': 'off' })}>
        {result && cleanFeedback(result.correct
          ? `✓ Correct. ${cleanWhy(item.why[item.key])}`
          : `Good try, Agent! The right answer is ${'ABCD'[item.key]} (${toSentenceCase(item.options[item.key])}). ${cleanWhy(item.why[item.key])}`
        )}
      </p>
    </section>
  )
}

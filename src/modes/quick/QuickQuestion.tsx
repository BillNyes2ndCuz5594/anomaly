import { useLayoutEffect, useRef, useState } from 'react'
import type { Item } from '../../content/schema'
import { useReadAloud } from '../../lib/speech'
import ItemVisual from '../../screens/case/ItemVisual'
import { createQuickAnswer, type QuickAnswer } from './quickAnswer'
import './quick.css'

export interface QuickQuestionProps {
  item: Item
  onAnswer: (answer: QuickAnswer) => void
}

/** Keyed body resets timing, speech and feedback when the displayed item changes.
 * For another occurrence of the same item, the caller can key by question index.
 */
export default function QuickQuestion(props: QuickQuestionProps) {
  return <QuestionBody key={props.item.id} {...props} />
}

function QuestionBody({ item, onAnswer }: QuickQuestionProps) {
  const [submit] = useState(() => createQuickAnswer(item))
  const [result, setResult] = useState<QuickAnswer | null>(null)
  const stem = useRef<HTMLHeadingElement>(null)
  const ra = useReadAloud(`${item.stem} ${item.options.map((o, i) => `${'ABCD'[i]}. ${o}.`).join(' ')}`)
  useLayoutEffect(() => {
    stem.current?.focus()
  }, [])
  const choose = (picked: number) => {
    const answer = submit(picked)
    if (!answer) return
    setResult(answer)
    ra.stop()
    onAnswer(answer)
  }
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
        {item.options.map((option, i) => (
          <button key={i} type="button" className="btn" disabled={result !== null}
            onClick={() => choose(i)} style={{ minHeight: 56, textAlign: 'left', whiteSpace: 'normal', transition: 'none' }}>
            {'ABCD'[i]}. {option}
          </button>
        ))}
      </div>
      <p role="status" aria-live="polite">
        {result && <><strong>{result.correct ? '\u2713 Correct.' : '\u2717 Incorrect.'}</strong>{' '}
          Correct answer: {'ABCD'[item.key]}. {item.options[item.key]}. {item.why[item.key]}</>}
      </p>
    </section>
  )
}

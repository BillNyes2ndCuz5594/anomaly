import { useMemo, useState } from 'react'
import { caseById, content } from '../../content'
import { usePack } from '../../content/usePack'
import { navigate } from '../../lib/router'
import QuickQuestion from '../quick/QuickQuestion'
import { buildQuickPool } from '../quick/quickPool'
import { answerGold, cratesFor, nextGold, pickCrate, standings, startGold } from './goldRush'
import { useMotionMode } from '../../ui/useMotionMode'
import './gold.css'

export default function GoldRushScreen({ caseId }: { caseId: string }) {
  const id = caseById(caseId) ? caseId : '02-2'
  const ready = usePack(id)
  return ready ? <GoldGame key={id} caseId={id} /> : <main className="screen gold-screen"><p role="status">Opening the vault...</p></main>
}
function GoldGame({ caseId }: { caseId: string }) {
  const [game, setGame] = useState(() => startGold(String(Date.now())))
  const motion = useMotionMode()
  const [reveal, setReveal] = useState<{ index: number; contents: string; delta: number } | null>(null)
  const pool = useMemo(() => buildQuickPool(content.items, { caseId, count: 10, seed: game.seed }), [caseId, game.seed])
  const def = caseById(caseId)!
  const board = standings(game)
  const done = game.phase === 'done'
  return <main className="screen gold-screen" data-testid="gold-rush" data-motion={motion}>
    <div className="gold-body">
      <header><h1>Anomaly Gold Rush</h1><p>{def.codename} | {def.unitLabel}</p>
        <p>{done ? 'Expedition complete' : `Question ${game.question + 1}/10`} | <strong key={game.intel} className={reveal?.delta ? "gold-intel-changed" : undefined}>{game.intel} intel</strong></p></header>
      <aside className="panel" aria-label="Live standings"><ol className="gold-board">
        {board.map((rival) => <li key={rival.name}>{rival.name}: <strong>{rival.intel}</strong></li>)}
      </ol></aside>
      {done ? <section className="panel"><h2 tabIndex={-1}>You placed {board.findIndex((r) => r.name === 'You') + 1} of 4!</h2>
        <p>Science collected. Vaults explored. Ready for another expedition?</p>
        <button className="btn" onClick={() => { setReveal(null); setGame(startGold(String(Date.now()))) }}>Play again</button>
        <button className="btn" onClick={() => navigate('hub')}>Back to hub</button>
      </section> : <>
        <QuickQuestion key={`${game.seed}:${game.question}`} item={pool[game.question]}
          onAnswer={(answer) => setGame((s) => answerGold(s, answer.correct))} />
        <section className="panel" aria-label="Vault controls">
          <p role="status" key={`${game.question}:${game.phase}`} className={reveal ? 'gold-outcome' : undefined}>
            {game.outcome}{reveal && <strong className="gold-delta"> {reveal.delta >= 0 ? '+' : ''}{reveal.delta} intel</strong>}
          </p>
          {(game.phase === 'crate' || reveal) && <div className="gold-crates" role="group" aria-label="Choose one vault crate">
            {[0, 1, 2].map((i) => <button className={`btn${reveal?.index === i ? ' gold-revealed' : ''}`} key={i}
              disabled={game.phase !== 'crate'} onClick={() => {
                const next = pickCrate(game, i)
                setReveal({ index: i, contents: String(cratesFor(game)[i]), delta: next.intel - game.intel })
                setGame(next)
              }}>{reveal?.index === i ? `Crate ${i + 1}: ${reveal.contents}` : `Vault crate ${i + 1}`}</button>)}
          </div>}
          {game.phase === 'next' && <button className="btn" onClick={() => { setReveal(null); setGame((s) => nextGold(s)) }}>{game.question === 9 ? 'See standings' : 'Next'}</button>}
        </section>
      </>}
    </div>
  </main>
}

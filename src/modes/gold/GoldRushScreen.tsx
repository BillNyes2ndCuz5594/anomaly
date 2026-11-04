import { useMemo, useState } from 'react'
import { caseById, content } from '../../content'
import { usePack } from '../../content/usePack'
import { navigate } from '../../lib/router'
import QuickQuestion from '../quick/QuickQuestion'
import { buildQuickPool } from '../quick/quickPool'
import { answerGold, nextGold, pickCrate, standings, startGold } from './goldRush'
import './gold.css'

export default function GoldRushScreen({ caseId }: { caseId: string }) {
  const id = caseById(caseId) ? caseId : '02-2'
  const ready = usePack(id)
  return ready ? <GoldGame key={id} caseId={id} /> : <main className="screen gold-screen"><p role="status">Opening the vault...</p></main>
}
function GoldGame({ caseId }: { caseId: string }) {
  const [game, setGame] = useState(() => startGold(String(Date.now())))
  const pool = useMemo(() => buildQuickPool(content.items, { caseId, count: 10, seed: game.seed }), [caseId, game.seed])
  const def = caseById(caseId)!
  const board = standings(game)
  const done = game.phase === 'done'
  return <main className="screen gold-screen" data-testid="gold-rush">
    <div className="gold-body">
      <header><h1>Anomaly Gold Rush</h1><p>{def.codename} | {def.unitLabel}</p>
        <p>{done ? 'Expedition complete' : `Question ${game.question + 1}/10`} | <strong>{game.intel} intel</strong></p></header>
      <aside className="panel" aria-label="Live standings"><ol className="gold-board">
        {board.map((rival) => <li key={rival.name}>{rival.name}: <strong>{rival.intel}</strong></li>)}
      </ol></aside>
      {done ? <section className="panel"><h2 tabIndex={-1}>You placed {board.findIndex((r) => r.name === 'You') + 1} of 4!</h2>
        <p>Science collected. Vaults explored. Ready for another expedition?</p>
        <button className="btn" onClick={() => setGame(startGold(String(Date.now())))}>Play again</button>
        <button className="btn" onClick={() => navigate('hub')}>Back to hub</button>
      </section> : <>
        <QuickQuestion key={`${game.seed}:${game.question}`} item={pool[game.question]}
          onAnswer={(answer) => setGame((s) => answerGold(s, answer.correct))} />
        <section className="panel" aria-label="Vault controls">
          <p role="status">{game.outcome}</p>
          {game.phase === 'crate' && <div className="gold-crates" role="group" aria-label="Choose one vault crate">
            {[0, 1, 2].map((i) => <button className="btn" key={i} onClick={() => setGame((s) => pickCrate(s, i))}>Vault crate {i + 1}</button>)}
          </div>}
          {game.phase === 'next' && <button className="btn" onClick={() => setGame((s) => nextGold(s))}>{game.question === 9 ? 'See standings' : 'Next'}</button>}
        </section>
      </>}
    </div>
  </main>
}

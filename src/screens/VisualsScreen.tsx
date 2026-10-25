import { lazy, Suspense } from 'react'
import { content } from '../content/schema'
import { navigate } from '../lib/router'
import ItemVisual from './case/ItemVisual'
import type { Visual } from '../content/schema'

// QA page (#/visuals and #/visuals/models): every scene diagram the items use, and the specimen
// models that are easiest to get wrong. Used by the proof run for screenshots. Not linked from the UI.
const MiniCanvas = lazy(() => import('../three/ItemVisualCanvas'))

const MODEL_SETS: { ids: string[]; title: string }[] = [
  { ids: ['florida-panther', 'american-alligator'], title: 'Florida panther, American alligator' },
  { ids: ['largemouth-bass', 'garden-spider'], title: 'Largemouth bass, garden spider' },
]

export default function VisualsScreen({ view }: { view: 'scenes' | 'models' }) {
  const seen = new Set<string>()
  const scenes = content.items.filter((it) => {
    if (it.visual.kind !== 'scene') return false
    const key = `${it.visual.id}|${it.visual.labels.join('|')}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return (
    <div className="screen visuals-screen" data-testid="visuals">
      <div className="topbar">
        <button type="button" className="btn small" onClick={() => navigate('/')}>
          Title
        </button>
        <span className="mono label">ART CHECK // {view === 'scenes' ? 'SCENE DIAGRAMS' : 'SPECIMEN MODELS'}</span>
        <button type="button" className="btn small" onClick={() => navigate(view === 'scenes' ? '/visuals/models' : '/visuals')}>
          {view === 'scenes' ? 'Models' : 'Diagrams'}
        </button>
      </div>
      {view === 'scenes' ? (
        <div className="visuals-grid scenes" data-testid="visuals-scenes">
          {scenes.map((it) => (
            <div key={it.id} className="visuals-cell">
              <ItemVisual item={it} />
              <span className="mono tiny muted">
                {it.id} {it.visual.kind === 'scene' ? it.visual.id : ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="visuals-grid models" data-testid="visuals-models">
          {MODEL_SETS.map((s) => {
            const v: Visual = { kind: 'specimen', ids: s.ids, captions: s.ids.map(() => '') } as Visual
            return (
              <div key={s.title} className="visuals-cell models-cell">
                <figure className="panel brackets visual-panel kind-specimen" aria-label={s.title}>
                  <div className="visual-3d">
                    <Suspense fallback={<div className="visual-loading mono muted">Loading scan...</div>}>
                      <MiniCanvas visual={v} />
                    </Suspense>
                  </div>
                </figure>
                <span className="mono tiny muted">{s.title}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

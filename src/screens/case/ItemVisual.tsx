import { lazy, Suspense, type CSSProperties } from 'react'
import type { Item, Visual } from '../../content/schema'
import { isStageVisual } from '../../three/paintHold'
import SceneDiagram from './SceneDiagram'
import { pairRatios } from '../../three/models/specimenSizes'

// One small shared R3F canvas for organ, specimen and plantanimal art. Loaded on demand.
const MiniCanvas = lazy(() => import('../../three/ItemVisualCanvas'))

const NOTE_STYLE: CSSProperties = {
  position: 'absolute',
  right: 14,
  bottom: 6,
  margin: 0,
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.6,
  color: 'var(--muted)',
  pointerEvents: 'none',
}

export default function ItemVisual({ item, upcoming = null }: { item: Item; upcoming?: Visual | null }) {
  const v = item.visual
  // Animals far apart in real size are drawn closer than they are so the small one stays readable; say so quietly.
  const notToScale = v.kind === 'specimen' && pairRatios(v.ids).notToScale
  const is3D = isStageVisual(v)
  const next = upcoming && isStageVisual(upcoming) ? upcoming : null
  return (
    <figure
      className={`panel brackets visual-panel kind-${v.kind}`}
      role={v.kind === 'table' ? undefined : 'img'}
      aria-label={item.alt}
      data-testid="item-visual"
      data-kind={v.kind}
    >
      {is3D ? (
        <div className="visual-3d">
          <Suspense fallback={<div className="visual-loading mono muted">Loading scan...</div>}>
            <MiniCanvas visual={v} upcoming={next} />
          </Suspense>
          {notToScale ? (
            <p className="mono" data-testid="not-to-scale" aria-hidden="true" style={NOTE_STYLE}>
              Not to scale
            </p>
          ) : null}
        </div>
      ) : null}
      {v.kind === 'specimen' ? (
        <ul className="captions" style={{ gridTemplateColumns: `repeat(${v.ids.length}, 1fr)` }}>
          {v.captions.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      ) : null}
      {v.kind === 'plantanimal' ? (
        <ul className="part-chips" aria-hidden="true">
          {v.show.map((p) => (
            <li key={p} className="mono">
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      {v.kind === 'table' ? (
        <div className="table-wrap">
          <table className="data-table" data-testid="item-table">
            <caption className="mono">{v.title}</caption>
            <thead>
              <tr>
                {v.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {v.kind === 'scene' ? <SceneDiagram id={v.id} labels={v.labels} /> : null}
      <p className="sr-only" data-testid="visual-alt">
        {item.alt}
      </p>
    </figure>
  )
}

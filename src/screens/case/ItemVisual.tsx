import { lazy, Suspense } from 'react'
import type { Item } from '../../content/schema'
import SceneDiagram from './SceneDiagram'

// One small shared R3F canvas for organ, specimen and plantanimal art. Loaded on demand.
const MiniCanvas = lazy(() => import('../../three/ItemVisualCanvas'))

export default function ItemVisual({ item }: { item: Item }) {
  const v = item.visual
  const is3D = v.kind === 'organ' || v.kind === 'specimen' || v.kind === 'plantanimal'
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
            <MiniCanvas visual={v} />
          </Suspense>
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

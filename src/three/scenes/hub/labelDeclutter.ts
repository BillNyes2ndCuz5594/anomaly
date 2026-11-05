export interface LabelItem {
  id: string
  x: number
  y: number
  w: number
  h: number
  priority: number
}
type Placement = { visible: boolean, dy: number }

/** Reusable workspace for the frame loop. Sorting keeps input order for priority ties. */
export function createLabelDeclutter() {
  const ordered: LabelItem[] = []
  const accepted: LabelItem[] = []
  const result: Record<string, Placement> = Object.create(null)
  return (items: LabelItem[], pad = 20): Record<string, Placement> => {
    ordered.length = 0
    accepted.length = 0
    for (const item of items) {
      ordered.push(item)
      result[item.id] ??= { visible: false, dy: 0 }
    }
    ordered.sort((a, b) => b.priority - a.priority)
    for (const item of ordered) {
      const placement = result[item.id]
      placement.visible = false
      placement.dy = 0
      for (let slot = 0; slot < 3; slot++) {
        const dy = slot === 0 ? 0 : (item.h + pad) * (slot === 1 ? -1 : 1)
        let overlaps = false
        for (const other of accepted) {
          if (Math.abs(item.x - other.x) < (item.w + other.w) / 2 + pad &&
              Math.abs(item.y + dy - other.y - result[other.id].dy) < (item.h + other.h) / 2 + pad) {
            overlaps = true
            break
          }
        }
        if (!overlaps) {
          placement.visible = true
          placement.dy = dy
          accepted.push(item)
          break
        }
      }
    }
    return result
  }
}

/** Greedily place screen-space labels with a minimum padded gap. */
export function declutterLabels(items: LabelItem[], pad = 4): Record<string, Placement> {
  return createLabelDeclutter()(items, pad)
}

// Count up animation for result numbers. The final text is always readable by assistive tech and tests:
// the visible node is aria-hidden while it counts and carries the final text in data-count-final.

export const COUNT_MS = 700

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3)

/** Value shown `elapsed` ms into a count up to `target`. 0 before the start, exactly `target` at the end. */
export function countValue(target: number, elapsed: number, ms = COUNT_MS): number {
  const k = Math.max(0, Math.min(1, elapsed / ms))
  return k >= 1 ? target : Math.round(target * easeOutCubic(k))
}

/** Splits "3 OF 5 CORRECT" into the first whole number and the text around it. */
export function parseCountText(text: string): { before: string; n: number; after: string } | null {
  const m = /^(\D*)(\d+)(\D.*)?$/s.exec(text)
  if (!m) return null
  return { before: m[1], n: Number(m[2]), after: m[3] ?? '' }
}

/**
 * Counts the first number inside `el` up from 0 after `delayMs`. Returns a cleanup that restores the
 * final text immediately. Does nothing when there is no number to count.
 */
export function countUpElement(el: HTMLElement, delayMs = 280, ms = COUNT_MS): () => void {
  const final = el.textContent ?? ''
  const parsed = parseCountText(final)
  if (!parsed || parsed.n === 0) return () => {}
  const node = [...el.childNodes].find((c) => c.nodeType === Node.TEXT_NODE && /^\d+$/.test(c.nodeValue ?? '')) as Text | undefined
  if (!node) return () => {}
  el.dataset.countFinal = final
  const reader = document.createElement('span')
  reader.className = 'sr-only'
  reader.textContent = final
  el.after(reader)
  el.setAttribute('aria-hidden', 'true')
  node.nodeValue = '0'
  let raf = 0
  let done = false
  const finish = () => {
    if (done) return
    done = true
    cancelAnimationFrame(raf)
    node.nodeValue = String(parsed.n)
    el.removeAttribute('aria-hidden')
    reader.remove()
  }
  const t0 = performance.now() + delayMs
  const tick = (now: number) => {
    if (done) return
    node.nodeValue = String(countValue(parsed.n, now - t0, ms))
    if (now - t0 >= ms) finish()
    else raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
  return finish
}

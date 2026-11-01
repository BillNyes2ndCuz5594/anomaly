import { useEffect, useRef, type RefObject } from 'react'
import type { MotionMode } from './motionMode'

const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789<>/#'
export const DECODE_MS = 600

/**
 * Codename decode. The text node scrambles through glyphs and settles letter by letter over 600 ms.
 * Only the text node value changes, so React's own children and the final text are untouched.
 * full: scramble. fade: the element fades in (CSS, data-decode). still: nothing runs.
 */
export function useDecode(ref: RefObject<HTMLElement | null>, text: string, run: boolean, mode: MotionMode, onDone?: () => void) {
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    if (!run) return
    const node = ref.current?.firstChild
    if (mode !== 'full' || !node || node.nodeType !== Node.TEXT_NODE) {
      done.current?.()
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DECODE_MS)
      const settled = Math.floor(p * text.length)
      let out = ''
      for (let i = 0; i < text.length; i++) {
        const c = text[i]
        out += i < settled || c === ' ' || c === '-' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      }
      node.nodeValue = out
      if (p < 1) raf = requestAnimationFrame(tick)
      else {
        node.nodeValue = text
        done.current?.()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      node.nodeValue = text
    }
  }, [ref, text, run, mode])
}

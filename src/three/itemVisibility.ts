// Shared pause logic for the small item art canvas: stop drawing while it is scrolled off screen or the tab is hidden.

import { useEffect, useState } from 'react'

/** Draw only while the canvas is on screen and the tab is showing. */
export function shouldRender(onScreen: boolean, hidden: boolean): boolean {
  return onScreen && !hidden
}

/** Wake the canvas a little before it scrolls into view. */
export const WAKE_MARGIN = '120px'

/**
 * True while the element is on screen (with a margin so it wakes just before it scrolls in).
 * Starts true so the first paint is unchanged, and stays true when IntersectionObserver is missing.
 */
export function useOnScreen(ref: { current: Element | null }): boolean {
  const [onScreen, setOnScreen] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setOnScreen(entry.isIntersecting)
      },
      { threshold: 0, rootMargin: WAKE_MARGIN },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return onScreen
}

/** True while the tab is hidden, the same signal the main Stage uses. */
export function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return hidden
}
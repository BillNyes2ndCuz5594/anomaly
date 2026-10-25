import { useEffect, useRef } from 'react'

// One persistent polite live region for the whole app. Messages that appear inside freshly mounted
// elements (lab feedback, item results) are announced reliably only through a region that already exists.
let node: HTMLElement | null = null

export function announce(message: string): void {
  if (!node || !message) return
  node.textContent = ''
  // A short gap makes screen readers treat repeated identical messages as new.
  window.setTimeout(() => {
    if (node) node.textContent = message
  }, 40)
}

export function Announcer() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    node = ref.current
    return () => {
      node = null
    }
  }, [])
  return <div ref={ref} className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer" />
}

/** Announces `message` whenever it changes (and is non empty). */
export function useAnnounce(message: string): void {
  useEffect(() => {
    announce(message)
  }, [message])
}

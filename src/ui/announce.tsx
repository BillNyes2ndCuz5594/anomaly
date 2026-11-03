import { useEffect, useRef } from 'react'
import { setAnnounceNode } from './announceBus'

// One persistent polite live region for the whole app. Messages that appear inside freshly mounted
// elements (lab feedback, item results) are announced reliably only through a region that already exists.
export function Announcer() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setAnnounceNode(ref.current)
    return () => {
      setAnnounceNode(null)
    }
  }, [])
  return <div ref={ref} className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="announcer" />
}

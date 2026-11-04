import { useEffect, useState, type ReactNode } from 'react'
import { STILL } from '../lib/flags'
import { useGame } from '../state/store'

const EXIT_MS = 260

/**
 * Keeps a modal mounted long enough to play its exit.
 * Reduced motion and ?still=1 remove it on the same frame. A tap finishes the exit early.
 */
export default function Presence({ show, children }: { show: boolean; children: ReactNode }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const skip = reduced || STILL
  const [mounted, setMounted] = useState(show)
  const [previousShow, setPreviousShow] = useState(show)
  if (show !== previousShow) {
    setPreviousShow(show)
    if (show) setMounted(true)
    else if (skip) setMounted(false)
  }
  if (!show && skip && mounted) setMounted(false)
  const phase = show ? 'in' : 'out'

  useEffect(() => {
    if (show || !mounted) return
    if (skip) return
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', finish, true)
      setMounted(false)
    }
    const t = window.setTimeout(finish, EXIT_MS)
    window.addEventListener('pointerdown', finish, true)
    return () => {
      done = true
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', finish, true)
    }
  }, [show, skip, mounted])

  if (!mounted || (!show && skip)) return null
  return (
    <div className="presence" data-presence={phase}>
      {children}
    </div>
  )
}

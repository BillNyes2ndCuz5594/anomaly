import { useEffect, useState, type ReactNode } from 'react'
import { STILL } from '../lib/flags'
import { useGame } from '../state/store'

const EXIT_MS = 200

/**
 * Keeps a modal mounted long enough to play its exit.
 * Reduced motion and ?still=1 remove it on the same frame. A tap finishes the exit early.
 */
export default function Presence({ show, children }: { show: boolean; children: ReactNode }) {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const skip = reduced || STILL
  const [mounted, setMounted] = useState(show)
  const [phase, setPhase] = useState<'in' | 'out'>(show ? 'in' : 'out')

  useEffect(() => {
    if (show) {
      setMounted(true)
      setPhase('in')
      return
    }
    if (!mounted) return
    if (skip) {
      setMounted(false)
      return
    }
    setPhase('out')
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

  if (!mounted) return null
  return (
    <div className="presence" data-presence={phase}>
      {children}
    </div>
  )
}

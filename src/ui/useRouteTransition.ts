import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { STILL } from '../lib/flags'
import { parseHash, useHash } from '../lib/router'
import { stepsFor, type CaseKind, type CaseStep } from '../state/session'
import type { Tier } from '../state/quality'
import { noteWarpFly } from '../three/flyPose'
import { motionMode, RESULTS_MS, routeMs, stepDirection, veilDir, veilKind, type MotionMode, type VeilKind } from './motionMode'

export type Phase = 'idle' | 'cover' | 'reveal'

/**
 * Route veil. The outgoing screen is covered, the hash swaps underneath, then the veil opens.
 * Reduced motion and ?still=1 swap with no veil. A tap during the cover skips to the new screen.
 * Cover is the only moment input is held, and it stays well under 600 ms.
 */
export function useRouteTransition(reduced: boolean, tier: Tier): { hash: string; phase: Phase; kind: VeilKind; dir: 'forward' | 'back'; mode: MotionMode } {
  const target = useHash()
  const mode = motionMode({ reduced, still: STILL, tier })
  const [shown, setShown] = useState(target)
  const [phase, setPhase] = useState<Phase>('idle')
  const [kind, setKind] = useState<VeilKind>('scan')
  const [dir, setDir] = useState<'forward' | 'back'>('forward')
  const shownRef = useRef(shown)
  const phaseRef = useRef(phase)
  useLayoutEffect(() => {
    shownRef.current = shown
    phaseRef.current = phase
  })

  useEffect(() => {
    if (target === shownRef.current) return
    const from = parseHash(shownRef.current).name
    const to = parseHash(target).name
    const nextKind = veilKind(from, to)
    setKind(nextKind)
    setDir(veilDir(from, to))
    if (mode === 'still') {
      setShown(target)
      setPhase('idle')
      return
    }
    if (mode === 'full' && nextKind === 'warp' && (to === 'case' || to === 'cold')) noteWarpFly()
    const { cover, reveal } = routeMs(mode, nextKind)
    setPhase('cover')
    let swallow = true
    let t1 = 0
    let t2 = 0
    const finish = () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      swallow = false
      setShown(target)
      setPhase('idle')
    }
    t1 = window.setTimeout(() => {
      swallow = false
      setShown(target)
      setPhase('reveal')
    }, cover)
    t2 = window.setTimeout(() => setPhase('idle'), cover + reveal)
    const onPointer = (e: Event) => {
      if (swallow || phaseRef.current === 'cover') {
        e.preventDefault()
        e.stopPropagation()
        finish()
        return
      }
      if (phaseRef.current === 'reveal') finish()
    }
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [target, mode])

  return { hash: shown, phase, kind, dir, mode }
}

/**
 * Short scan between case steps. It does not cover the screen, so the labs stay clickable,
 * and a tap ends it early. Skipped while a route veil is already playing.
 */
export function useStepHandoff(step: CaseStep, kind: CaseKind, routeName: string, routePhase: Phase, mode: MotionMode): { phase: 'idle' | 'on'; dir: 'forward' | 'back'; kind: 'step' | 'results' } {
  const [phase, setPhase] = useState<'idle' | 'on'>('idle')
  const [dir, setDir] = useState<'forward' | 'back'>('forward')
  const prev = useRef(step)

  useEffect(() => {
    if (prev.current === step) return
    const from = prev.current
    prev.current = step
    const onCase = routeName === 'case' || routeName === 'cold'
    if (mode === 'still' || routePhase !== 'idle' || !onCase) return
    const steps = stepsFor(kind)
    const a = steps.findIndex((s) => s.id === from)
    const b = steps.findIndex((s) => s.id === step)
    setDir(stepDirection(a, b))
    setPhase('on')
    let t = 0
    const skip = () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', skip, true)
      setPhase('idle')
    }
    const ms = mode === 'fade' ? 200 : step === 'results' ? RESULTS_MS : 480
    t = window.setTimeout(skip, ms)
    window.addEventListener('pointerdown', skip, true)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('pointerdown', skip, true)
      setPhase('idle')
    }
  }, [step, kind, routeName, routePhase, mode])

  return { phase, dir, kind: step === 'results' ? 'results' : 'step' }
}

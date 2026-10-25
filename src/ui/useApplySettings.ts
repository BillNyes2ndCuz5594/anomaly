import { useEffect } from 'react'
import { LINE_HEIGHT, TEXT_SCALE } from '../state/settings'
import { useGame } from '../state/store'

/** Mirrors accessibility settings onto the document root as CSS variables and attributes. */
export function useApplySettings(): void {
  const { textSize, lineSpacing, reducedMotion } = useGame((s) => s.settings)
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--text-scale', String(TEXT_SCALE[textSize]))
    root.style.setProperty('--line-height', String(LINE_HEIGHT[lineSpacing]))
    root.dataset.reducedMotion = reducedMotion ? 'true' : 'false'
  }, [textSize, lineSpacing, reducedMotion])
}

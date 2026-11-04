import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * A short-lived reaction flag. fire(key) sets `blip` to that key and clears it after `ms`,
 * so CSS can hang a data attribute on it. Firing again restarts the timer.
 */
export function useBlip<T extends string>(ms: number): [T | null, (key: T) => void] {
  const [blip, setBlip] = useState<T | null>(null)
  const timer = useRef(0)
  const last = useRef<{ key: T; at: number } | null>(null)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const fire = useCallback(
    (key: T) => {
      const now = performance.now()
      if (last.current?.key === key && now - last.current.at < ms) return
      last.current = { key, at: now }
      window.clearTimeout(timer.current)
      setBlip(null)
      // Next frame so a repeat of the same key restarts the CSS animation.
      timer.current = window.setTimeout(() => {
        setBlip(key)
        timer.current = window.setTimeout(() => setBlip(null), ms)
      }, 16)
    },
    [ms],
  )
  return [blip, fire]
}

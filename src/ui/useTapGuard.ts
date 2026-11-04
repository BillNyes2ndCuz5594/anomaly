import { useCallback, useRef } from 'react'
import { createTapGuard } from './tapGuard'

export function useTapGuard() {
  const guard = useRef<ReturnType<typeof createTapGuard> | null>(null)
  return useCallback((key: string, ms: number) => {
    if (!guard.current) guard.current = createTapGuard()
    return guard.current(key, ms)
  }, [])
}

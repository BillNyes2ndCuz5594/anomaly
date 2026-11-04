import { useEffect, useState } from 'react'
import { loadAllPacks, loadPack, packLoaded, PACK_ORDER } from '.'

/** A blank screen holds the fixed screen host until its content is ready. */
export function usePack(id: string): boolean {
  const ready = () => id === 'all' ? PACK_ORDER.every(packLoaded) : packLoaded(id)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    let active = true
    const pending = id === 'all' ? loadAllPacks() : loadPack(id)
    pending.then(() => { if (active) setVersion((n) => n + 1) })
      .catch((reason: unknown) => { if (active) setError(reason) })
    return () => { active = false }
  }, [id])
  if (error) throw error
  void version
  return ready()
}

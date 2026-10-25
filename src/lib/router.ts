import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'title' }
  | { name: 'hub' }
  | { name: 'settings' }
  | { name: 'case'; id: string }
  | { name: 'cold'; id: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').split('?')[0]
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'title' }
  if (parts[0] === 'hub' && parts.length === 1) return { name: 'hub' }
  if (parts[0] === 'settings' && parts.length === 1) return { name: 'settings' }
  if (parts[0] === 'case' && parts.length === 2 && /^[A-Za-z0-9-]+$/.test(parts[1])) {
    return { name: 'case', id: parts[1] }
  }
  if (parts[0] === 'cold' && parts.length === 2 && /^[A-Za-z0-9-]+$/.test(parts[1])) {
    return { name: 'cold', id: parts[1] }
  }
  return { name: 'title' }
}

export function navigate(path: string): void {
  const target = path.startsWith('#') ? path : `#${path}`
  if (window.location.hash === target) return
  window.location.hash = target
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const snapshot = () => window.location.hash

/** Current hash string, re-rendering on change. Parsed with parseHash by the caller. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, snapshot, () => '')
}

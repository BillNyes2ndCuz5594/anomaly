function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v))
    },
    removeItem: (k: string) => {
      store.delete(k)
    },
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size
    },
  } as unknown as Storage
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createStorage()
}
if (typeof globalThis.sessionStorage === 'undefined') {
  globalThis.sessionStorage = createStorage()
}

// Test-only eager loading keeps schema and all-item checks exhaustive.
import { installPack, PACK_ORDER, packPath } from '.'
import type { CasePack } from './schema'
const files = import.meta.glob<CasePack>('./packs/*.json', { eager: true, import: 'default' })
export const packs = PACK_ORDER.map((id) => files[packPath(id)])
for (const pack of packs) installPack(pack)

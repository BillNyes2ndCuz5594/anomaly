// Test-only eager loading keeps schema and all-item checks exhaustive.
import { installPack, PACK_ORDER, packPath } from '.'
import type { CasePack } from './schema'
const files = import.meta.glob<CasePack>('./packs/*.json', { eager: true, import: 'default' })
export const packs = PACK_ORDER.map((id) => files[packPath(id)])
for (const pack of packs) installPack(pack)

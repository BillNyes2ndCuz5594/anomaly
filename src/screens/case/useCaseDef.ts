import { caseById, vitalsCase } from '../../content'
import type { CaseDef } from '../../content/schema'
import { useSession } from '../../state/session'

/** The case being played. Falls back to VITALS so a screen never renders without a case. */
export function useCaseDef(): CaseDef {
  const id = useSession((s) => s.caseId)
  return caseById(id) ?? vitalsCase
}

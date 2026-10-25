import type { CaseStep } from '../../state/session'

/** Width of the right HUD panel per step. The 3D scene is centered in the space left of it. */
export const CASE_PANEL_WIDTH = 420

export function caseInset(step: CaseStep): number {
  return step === 'briefing' || step === 'lab-a' || step === 'lab-b' || step === 'lab-c' ? CASE_PANEL_WIDTH : 0
}

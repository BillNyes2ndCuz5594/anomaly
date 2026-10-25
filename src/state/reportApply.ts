import type { ReportData } from '../lib/reportCode'
import { paintForPoints, totalPoints } from './mastery'
import { mergeReport } from './reportMerge'
import { makeProfile, useGame } from './store'

/**
 * Applies a decoded report to the live store. It always merges into what is already saved.
 * `replaceAgent` is passed only after the student confirmed a switch: then the old agent's
 * progress, Intel, codex and cases are cleared first and the agent in the code takes over.
 */
export function applyReport(report: ReportData, classCode: string, replaceAgent: boolean): void {
  const st = useGame.getState()
  const base = replaceAgent ? { progress: {}, itemHistory: [] } : { progress: st.progress, itemHistory: st.itemHistory }
  const merged = mergeReport(base, report)
  // Paints come from mastery points only, so rebuild the ones the restored progress has earned.
  const paints = new Set(replaceAgent ? [] : st.paints)
  for (let p = 1; p <= totalPoints(merged.progress); p++) {
    const paint = paintForPoints(p)
    if (paint) paints.add(paint)
  }
  useGame.setState({
    profile: replaceAgent || !st.profile ? makeProfile(report.agent, classCode) : st.profile,
    progress: merged.progress,
    mastery: merged.mastery,
    itemHistory: merged.itemHistory,
    paints: [...paints],
    ...(replaceAgent ? { codex: [], intel: 0, cases: {} } : {}),
  })
}

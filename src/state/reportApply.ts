import type { ReportData } from '../lib/reportCode'
import { saveCurrentAgent, switchToAgent } from './agentSlots'
import { paintForPoints, totalPoints } from './mastery'
import { mergeReport } from './reportMerge'
import { useGame } from './store'

/**
 * Applies a decoded report to the live store. It always merges into what is already saved.
 * When switching agents, the active agent is saved to their snapshot slot first, and
 * the target agent is loaded or created fresh before applying the report progress.
 */
export function applyReport(report: ReportData, classCode: string, replaceAgent: boolean): void {
  const st = useGame.getState()
  if (replaceAgent || !st.profile) {
    switchToAgent(report.agent, classCode)
  }
  const current = useGame.getState()
  const base = { progress: current.progress, itemHistory: current.itemHistory }
  const merged = mergeReport(base, report)
  // Paints come from mastery points only, so rebuild the ones the restored progress has earned.
  const paints = new Set(current.paints)
  for (let p = 1; p <= totalPoints(merged.progress); p++) {
    const paint = paintForPoints(p)
    if (paint) paints.add(paint)
  }
  useGame.setState({
    progress: merged.progress,
    mastery: merged.mastery,
    itemHistory: merged.itemHistory,
    paints: [...paints],
  })
  saveCurrentAgent()
}

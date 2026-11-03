import { useMemo } from 'react'
import { encodeReport } from '../lib/reportCode'
import { toISODate } from '../state/mastery'
import { buildReportData } from '../state/reportMerge'
import { useGame } from '../state/store'

/** Builds the current agent's report code from saved progress. Empty when there is no profile. */
export function useReportCode(): string {
  const profile = useGame((s) => s.profile)
  const progress = useGame((s) => s.progress)
  const itemHistory = useGame((s) => s.itemHistory)
  return useMemo(
    () => (profile ? encodeReport(buildReportData(profile, { progress, itemHistory }, toISODate())) : ''),
    [profile, progress, itemHistory],
  )
}

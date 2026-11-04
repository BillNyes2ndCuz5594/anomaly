import { navigate } from '../lib/router'
import { GOLD_CASES } from '../modes/gold/goldRush'

export default function GoldRushButton({ caseId }: { caseId: string }) {
  if (!GOLD_CASES.has(caseId)) return null
  return <button type="button" className="btn primary" data-testid="gold-rush-launch"
    onClick={() => navigate(`/gold/${caseId}`)}>Gold Rush</button>
}

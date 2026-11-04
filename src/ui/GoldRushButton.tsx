import { navigate } from '../lib/router'
import { GOLD_CASES } from '../modes/gold/goldRush'
import '../modes/gold/gold.css'

export default function GoldRushButton({ caseId }: { caseId: string }) {
  if (!GOLD_CASES.has(caseId)) return null
  return (
    <button
      type="button"
      className="btn primary gold-rush-btn"
      data-testid="gold-rush-launch"
      onClick={() => navigate(`/gold/${caseId}`)}
    >
      Gold Rush
    </button>
  )
}


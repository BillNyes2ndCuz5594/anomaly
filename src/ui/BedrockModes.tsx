import { navigate } from '../lib/router'
import GoldRushButton from './GoldRushButton'
import './bedrockModes.css'

let lastBedrockMode: 'containment' | 'reactor' | null = null

// oxlint-disable-next-line react/only-export-components
export function setLastBedrockMode(mode: 'containment' | 'reactor' | null): void {
  lastBedrockMode = mode
}

// oxlint-disable-next-line react/only-export-components
export function getLastBedrockMode(): 'containment' | 'reactor' | null {
  return lastBedrockMode
}

// oxlint-disable-next-line react/only-export-components
export function resolveBedrockReturnTarget(doc: Document = document): HTMLElement | null {
  const mode = lastBedrockMode
  if (!mode) return null
  return doc.querySelector<HTMLElement>(`[data-testid="${mode}-launch"]`) ?? doc.querySelector<HTMLElement>('[data-testid="case-marker-02-2"]')
}

export default function BedrockModes({ caseId }: { caseId: string }) {
  if (caseId !== '02-2') return null

  return (
    <section aria-label="More ways to practice">
      <h4>More ways to practice</h4>
      <div className="bedrock-modes-group" data-testid="bedrock-modes">
        <GoldRushButton caseId={caseId} />
        <button
          type="button"
          className="btn primary"
          style={{ display: 'inline-flex', flexDirection: 'column', justifyContent: 'center' }}
          data-testid="containment-launch"
          onClick={() => {
            setLastBedrockMode('containment')
            navigate(`/containment/${caseId}`)
          }}
        >
          <span>Containment Rush</span>
          <span className="small-print">Defenses last one wave.</span>
        </button>
        <button
          type="button"
          className="btn primary"
          style={{ display: 'inline-flex', flexDirection: 'column', justifyContent: 'center' }}
          data-testid="reactor-launch"
          onClick={() => {
            setLastBedrockMode('reactor')
            navigate(`/reactor/${caseId}`)
          }}
        >
          <span>Reactor Stabilizer</span>
          <span className="small-print">Correct answer lowers instability by 2.</span>
        </button>
      </div>
    </section>
  )
}

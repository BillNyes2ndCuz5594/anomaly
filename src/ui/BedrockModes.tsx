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
    <div className="bedrock-modes-group" data-testid="bedrock-modes">
      <GoldRushButton caseId={caseId} />
      <button
        type="button"
        className="btn primary"
        data-testid="containment-launch"
        onClick={() => {
          setLastBedrockMode('containment')
          navigate(`/containment/${caseId}`)
        }}
      >
        Containment Rush
      </button>
      <button
        type="button"
        className="btn primary"
        data-testid="reactor-launch"
        onClick={() => {
          setLastBedrockMode('reactor')
          navigate(`/reactor/${caseId}`)
        }}
      >
        Reactor Stabilizer
      </button>
    </div>
  )
}

import { lazy, Suspense } from 'react'
import { useSession } from '../../state/session'
import AmbientScene from './AmbientScene'

const BriefingScene = lazy(() => import('./case/BriefingScene'))
const LabAScene = lazy(() => import('./case/LabAScene'))
const LabBScene = lazy(() => import('./case/LabBScene'))
const ColdScene = lazy(() => import('./case/ColdScene'))
const LabCScene = lazy(() => import('./case/LabCScene'))
const EvidenceCore = lazy(() => import('./case/ColdScene').then((m) => ({ default: m.EvidenceCore })))

/** 3D backdrop for the active case step. Lab scenes load lazily, one chunk each. */
export default function CaseScene({ cold = false }: { cold?: boolean }) {
  const step = useSession((s) => s.step)
  const kind = useSession((s) => s.kind)
  if (cold) {
    if (kind === 'cold' && step === 'briefing') {
      return (
        <Suspense fallback={null}>
          <ColdScene />
        </Suspense>
      )
    }
    // Every other cold step keeps the frost loop. Evidence also carries the residue core, small, lower left.
    return (
      <>
        <AmbientScene frost />
        {kind === 'cold' && step === 'items' ? (
          <Suspense fallback={null}>
            <EvidenceCore />
          </Suspense>
        ) : null}
      </>
    )
  }
  if (kind === 'cold') return <AmbientScene />
  switch (step) {
    case 'briefing':
      return (
        <Suspense fallback={null}>
          <BriefingScene />
        </Suspense>
      )
    case 'lab-a':
      return (
        <Suspense fallback={null}>
          <LabAScene />
        </Suspense>
      )
    case 'lab-b':
      return (
        <Suspense fallback={null}>
          <LabBScene />
        </Suspense>
      )
    case 'lab-c':
      return (
        <Suspense fallback={null}>
          <LabCScene />
        </Suspense>
      )
    default:
      return <AmbientScene />
  }
}

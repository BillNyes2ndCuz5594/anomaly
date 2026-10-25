import { lazy, Suspense } from 'react'
import { useSession } from '../../state/session'
import AmbientScene from './AmbientScene'

const BriefingScene = lazy(() => import('./case/BriefingScene'))
const LabAScene = lazy(() => import('./case/LabAScene'))
const LabBScene = lazy(() => import('./case/LabBScene'))
const LabCScene = lazy(() => import('./case/LabCScene'))

/** 3D backdrop for the active case step. Lab scenes load lazily, one chunk each. */
export default function CaseScene() {
  const step = useSession((s) => s.step)
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

import { useFrame } from '@react-three/fiber'
import { resolveTier } from '../../state/quality'
import { useRuntime } from '../../state/runtime'
import { useGame } from '../../state/store'
import { Backdrop, ConsoleRing, DeckLights, DeckPlate, Dust, GridFloor } from './common'

/** Quiet backdrop for Settings and placeholder screens: dark deck, grid, dust, slow drift. */
export default function AmbientScene() {
  const reduced = useGame((s) => s.settings.reducedMotion)
  const quality = useGame((s) => s.settings.quality)
  const autoTier = useRuntime((s) => s.autoTier)
  const tier = resolveTier(quality, autoTier)

  useFrame((state) => {
    const t = reduced ? 0 : state.clock.elapsedTime
    state.camera.position.set(Math.sin(t * 0.05) * 3, 3.2, 12)
    state.camera.lookAt(0, 2, 0)
  })

  return (
    <>
      <fogExp2 attach="fog" args={['#070c17', 0.02]} />
      <DeckLights rim={0.6} />
      <Backdrop />
      <DeckPlate />
      <GridFloor fade={30} intensity={0.45} />
      <ConsoleRing radius={16} count={16} arc={Math.PI * 1.2} />
      <Dust tier={tier} spread={[30, 9, 30]} />
    </>
  )
}

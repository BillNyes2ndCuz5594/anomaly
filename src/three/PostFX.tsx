import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import {
  float,
  floor,
  hash,
  max,
  mix,
  oneMinus,
  pass,
  screenCoordinate,
  screenUV,
  smoothstep,
  time,
  vec3,
  vec4,
} from 'three/tsl'
import { TIER_CONFIG, type Tier } from '../state/quality'

/**
 * Node post processing for Medium and up: TSL bloom, then vignette and film grain on High+.
 * Renders at priority 1, which tells R3F not to render the scene itself (no double render).
 * Low tier never mounts this component.
 */
export default function PostFX({ tier, transparent = false }: { tier: Tier; transparent?: boolean }) {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const cfg = TIER_CONFIG[tier]

  const pipeline = useMemo(() => {
    const scenePass = pass(scene, camera)
    const sceneColor = scenePass.getTextureNode('output')
    let out = sceneColor.rgb
    let alpha = sceneColor.a

    if (cfg.bloom) {
      const glow = bloom(sceneColor, 0.5, 0.5, 0.75)
      out = out.add(glow.rgb)
      // Keep bloom around bright foreground geometry without painting an opaque sky.
      if (transparent) alpha = max(alpha, max(glow.r, max(glow.g, glow.b)))
    }
    if (cfg.vignette) {
      const d = screenUV.sub(0.5).length()
      const vig = oneMinus(smoothstep(0.28, 0.92, d))
      out = out.mul(mix(float(0.5), float(1), vig))
    }
    if (cfg.grain) {
      const seed = screenCoordinate.x
        .add(screenCoordinate.y.mul(1237))
        .add(floor(time.mul(24)).mul(7919))
      const noise = hash(seed).sub(0.5).mul(0.014)
      out = max(out.add(vec3(noise)), vec3(0))
    }

    const rp = new THREE.RenderPipeline(gl)
    rp.outputNode = vec4(out, transparent ? alpha : 1)
    return rp
  }, [gl, scene, camera, cfg.bloom, cfg.vignette, cfg.grain, transparent])

  useEffect(() => () => pipeline.dispose(), [pipeline])

  useFrame(() => {
    pipeline.render()
  }, 1)

  return null
}

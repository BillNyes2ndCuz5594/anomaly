import * as THREE from 'three/webgpu'
import type { Backend, Tier } from '../state/quality'
import { TIER_CONFIG } from '../state/quality'

export interface RendererInfo {
  renderer: THREE.WebGPURenderer
  backend: Backend
}

/** WebGPU when the browser has it, otherwise three falls back to its WebGL2 backend. */
export function detectBackend(renderer: THREE.WebGPURenderer): Backend {
  const backend = renderer.backend as unknown as { isWebGPUBackend?: boolean }
  return backend.isWebGPUBackend === true ? 'webgpu' : 'webgl2'
}

/**
 * Async factory used by R3F's `gl` prop. Creates the renderer, awaits init(), and reports
 * which backend won. R3F awaits the returned promise before it renders anything.
 */
export async function createRenderer(
  props: Record<string, unknown>,
  tier: Tier,
  onBackend: (b: Backend) => void,
): Promise<THREE.WebGPURenderer> {
  const renderer = new THREE.WebGPURenderer({
    ...props,
    canvas: props.canvas as HTMLCanvasElement,
    antialias: TIER_CONFIG[tier].antialias,
    alpha: false,
    powerPreference: 'high-performance',
  })
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = THREE.SRGBColorSpace
  await renderer.init()
  onBackend(detectBackend(renderer))
  return renderer
}

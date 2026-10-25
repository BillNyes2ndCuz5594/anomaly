import { create } from 'zustand'
import type { Backend, Tier } from './quality'

/** Non persisted renderer facts shared between the 3D layer and the HUD. */
interface RuntimeState {
  backend: Backend
  autoTier: Tier
  fps: number
  /** Hub marker highlighted by keyboard focus or hover on its HTML mirror. */
  focusedMarker: 'case' | 'cold' | null
  setFocusedMarker: (m: 'case' | 'cold' | null) => void
  setBackend: (b: Backend) => void
  setAutoTier: (t: Tier) => void
  setFps: (n: number) => void
}

export const useRuntime = create<RuntimeState>((set) => ({
  backend: 'none',
  autoTier: 'medium',
  fps: 0,
  focusedMarker: null,
  setFocusedMarker: (focusedMarker) => set({ focusedMarker }),
  setBackend: (backend) => set({ backend }),
  setAutoTier: (autoTier) => set({ autoTier }),
  setFps: (fps) => set({ fps }),
}))

import { create } from 'zustand'
import type { Backend, Tier } from './quality'

/** Non persisted renderer facts shared between the 3D layer and the HUD. */
interface RuntimeState {
  hubReady: boolean
  setHubReady: (ready: boolean) => void
  backend: Backend
  autoTier: Tier
  /** Auto resolution step, index into DPR_STEPS (0 is full resolution). */
  dprStep: number
  fps: number
  /** Hub marker highlighted by keyboard focus or hover on its HTML mirror. */
  focusedMarker: string | null
  setFocusedMarker: (m: string | null) => void
  /** Transient cold case events. Not persisted. `n` counts events, so a scene can tell a new one from an old one. */
  coreFx: { ok: boolean; n: number } | null
  /** Lock in on a cold evidence item: the residue core reacts (right or wrong). */
  fireCoreFx: (ok: boolean) => void
  /** Counts "Open the evidence" presses: the locker pulls a canister. */
  coldPull: number
  pullCanister: () => void
  setBackend: (b: Backend) => void
  setAutoTier: (t: Tier) => void
  setDprStep: (n: number) => void
  setFps: (n: number) => void
}

export const useRuntime = create<RuntimeState>((set) => ({
  hubReady: false,
  setHubReady: (hubReady) => set({ hubReady }),
  backend: 'none',
  autoTier: 'medium',
  dprStep: 0,
  fps: 0,
  focusedMarker: null,
  setFocusedMarker: (focusedMarker) => set({ focusedMarker }),
  coreFx: null,
  fireCoreFx: (ok) => set((s) => ({ coreFx: { ok, n: (s.coreFx?.n ?? 0) + 1 } })),
  coldPull: 0,
  pullCanister: () => set((s) => ({ coldPull: s.coldPull + 1 })),
  setBackend: (backend) => set({ backend }),
  setAutoTier: (autoTier) => set({ autoTier }),
  setDprStep: (dprStep) => set({ dprStep }),
  setFps: (fps) => set({ fps }),
}))

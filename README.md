# ANOMALY

A science response unit game for grade 5 science review. Vite + React 19 + TypeScript, React Three Fiber v9, three r186 `WebGPURenderer` (WebGL2 fallback), zustand, vite-plugin-pwa.

Read `docs/SPEC.md` (source of truth) and `docs/PLAN.md` (stages) first.

## Commands

- `npm run dev`: dev server.
- `npm run build`: type check and production build (main app plus `teacher.html`).
- `npm test`: unit tests (vitest).
- `node scripts/proof.mjs`: starts `vite preview`, walks the flow in headless Chrome, writes screenshots and `fps.json` to `/workspace/anomaly-proof/`. Run `npm run build` first.
- `npm run icons`: regenerates the PWA icons in `public/` (needs local Chrome).

Add `?debug=1` to the URL to force the FPS / backend / tier readout on.

## Layout

- `src/three/`: renderer, `Stage`, `PostFX`, `materials/hologram.ts`, `scenes/*`.
- `src/screens/`: HUD screens (title, hub, settings, case placeholder).
- `src/state/`: zustand store (`anomaly.v1`), quality tiers and Auto logic, runtime facts.
- `src/ui/`: shared HUD components.
- `src/teacher/`: Teacher HQ entry (must not import three).

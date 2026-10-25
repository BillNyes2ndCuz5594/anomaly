# ANOMALY

A science review game for grade 5 Florida SSA (Statewide Science Assessment). Students play field agents who run short hands-on 3D labs, then answer SSA-style questions using RKEA (Read, Key words, Eliminate, Answer).

No logins, no personal data. Progress travels as a short report code.

Built with Vite, React 19, TypeScript, React Three Fiber v9, three r186 `WebGPURenderer` (WebGL2 fallback), zustand and vite-plugin-pwa.

Read `docs/SPEC.md` (source of truth) and `docs/PLAN.md` (stages) first.

## Commands

- `npm run dev`: dev server.
- `npm run build`: type check and production build (main app plus `teacher.html`).
- `npm test`: unit tests (vitest).
- `node scripts/proof.mjs`: starts `vite preview` on a free port, walks the whole product in headless Chrome at 1366x768 and 1920x1080, and writes 18 numbered screenshots per size (all at `?tier=high`, so bloom and vignette show), `fps.json` (Auto tier, per backend: WebGPU and WebGL2, throttled and unthrottled) and `proof-summary.json` (also draw calls per scene and per tier, load bytes) to `/workspace/anomaly-proof/`. Exits non-zero on any console error. Run `npm run build` first.
- `node scripts/gen-catalog.mjs`: regenerates `src/lib/catalog.generated.ts` after content changes (append only, see below).
- `npm run icons`: regenerates the PWA icons in `public/` (needs local Chrome).

URL switches (query string, before the `#`):

- `?debug=1` forces the FPS / backend / tier readout on.
- `?tier=low|medium|high|ultra` pins the quality tier and turns Auto off.
- `?backend=webgl2` forces three's WebGL2 backend even when WebGPU exists.
- `#/visuals` and `#/visuals/models` are an unlisted art check page (every scene diagram, the specimen models).

`window.__anomaly` exposes `{ fps, tier, backend, frame, calls, triangles, geometries, textures }`. `calls` is the number of draw calls in the last frame, including post FX passes.

## Layout

- `src/three/`: renderer, `Stage`, `PostFX`, `materials/hologram.ts`, `scenes/*`.
- `src/screens/`: HUD screens (title, hub, settings, case placeholder).
- `src/state/`: zustand store (`anomaly.v1`), quality tiers and Auto logic, runtime facts.
- `src/ui/`: shared HUD components.
- `src/teacher/`: Teacher HQ entry (must not import three).

## Report codes and Teacher HQ

- `src/lib/reportCode.ts`: encode and decode (Crockford base32, groups of 4, 2 character checksum). Pure, shared with Teacher HQ.
- `src/lib/catalog.generated.ts`: the fixed, ordered benchmark list and item index list. Report codes store indexes into it, so it is APPEND ONLY. Never reorder or remove entries. After adding items or benchmarks to the content JSON, run `node scripts/gen-catalog.mjs`; `npm test` fails if the catalog and content disagree.
- `src/lib/scheduler.ts`: spaced review picker for the cold case (due items first, then unseen, spread across categories).
- `src/state/reportMerge.ts`: builds a report from progress and merges a decoded report back in (never lowers progress).
- `teacher.html` / `src/teacher/`: Teacher HQ. Imports only the pure modules above.

# ANOMALY art direction and asset pipeline

## Style bible

The game is a field lab at night: dark navy glass, cyan instrument light, and real Florida animals and plants that
look like museum specimens under that light. The goal is that nothing reads as generic AI art.

Palette
- Base: deep navy `#030814` to `#0b1a2e`. Panels are glass on top of it, never flat grey.
- Instrument cyan `#3ee6ff` for UI, holograms, rims and pedestal rings. Warm amber `#ffb347` only for alerts and
  progress, never as a fill.
- Specimens keep their real, natural colors (panther tawny, crab blue, gator olive black). No neon recoloring, no
  oversaturated "AI" skin, no glossy plastic look.

Light
- Soft key from upper front, cool sky fill from above, thin cyan rim from behind. Shadows stay soft and never pure
  black. The same rig lights scans and procedural models (`litHero` and `litSpecimen` in `src/three/materials/tinted.ts`).

Type
- UI keeps the existing mono display face for labels and the reading face for stems and answers (see `docs/FONTS.md`).
  No text is ever baked into generated art.

Rules for generated art
- Reference images are neutral studio photos (even light, plain light grey ground, whole subject in frame) so the 3D
  scan picks up true color, not a dramatic baked light.
- No watermarks, borders, logos, text, lens flares, bokeh glitter, or heavy depth of field.
- Every asset ships optimized: GLB with meshopt geometry and a 1024 WebP texture (about 200 to 350 KB each), images
  as WebP or AVIF, video as short WebM plus MP4 with a poster frame.
- Low tier phones always keep the lightweight procedural or static version.

Rules for video clips
- Loops must be seamless: matched first and last frames or a built in crossfade. No pops, black frames, or cuts.
- Clips are composited into the scene (soft masked edges, behind or within UI glass), never dropped in as boxes.
- Every clip has a poster frame that is shown until the first frame decodes, plays `autoplay muted playsinline loop`,
  and falls back to the poster on Low tier and under reduced motion.

## Pipeline

1. Reference image: `fal-ai/flux-pro/v1.1` (about $0.04 each), 2 variants per subject, pick the best.
2. Image to 3D: `fal-ai/hunyuan3d-v3/image-to-3d` with a 40k face budget (about $0.525 each).
3. Optimize: `gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024 --simplify true
   --simplify-ratio 0.45 --simplify-error 0.0008`.
4. Ship under `src/assets/specimens/<specimen-id>.glb` and register it in `src/three/models/heroSpecimens.ts`
   (yaw and tilt so the head points +x and the animal stands on y = 0). Medium tier and up show the scan; Low tier
   keeps the procedural model, which is also the fallback if a scan fails to load.
5. Every fal call is logged with its cost in `harness/fal-ledger.txt` (workspace side). Total fal cap: $40.

## Asset inventory (ranked: most "cheap or AI looking" times most visible first)

| Rank | Asset | Where it shows | Status |
| --- | --- | --- | --- |
| 1 | Florida panther | Evidence item, art check | Wave 1: scan shipped |
| 2 | Blue crab | Evidence items, Lab C | Wave 1: scan shipped |
| 3 | American alligator | Evidence item | Wave 1: scan shipped |
| 4 | Garden spider | Evidence item | Wave 1 scan, replaced in wave 2 by a top-down scan standing on its legs |
| 5 | Title and hub backdrop | First screen every session | Wave 3: shipped, swamp loop painted into the sky dome |
| 6 | Pelican, tortoise, frog, shark, bass, owl, grasshopper | Lab C, Briefing, items | Wave 2: scans shipped |
| 6b | Manatee | Lab C close-up, items | Scan made in wave 2, held until S14 (Lab C close-up rework) merges |
| 7 | Lab ambience (Briefing, Lab A, B, C backdrops) | Labs | Wave 3: shipped, swamp, cells, canopy and water loops |
| 8 | Plants and organ models | Lab A, Lab B | Wave 4 (after S13) |
| 9 | App icons and share art | Install, share | Wave 4 |

## Wave plan

- Wave 1: panther, crab, alligator, spider scans in the item player and art check.
- Wave 2: 7 more animals plus a new spider scan. Every scan is now sized to the procedural model's mean silhouette
  area, so it fills the pedestal ring the same way, capped at the procedural length, 1.05x its height and 1.4x its
  width so it never leaves the camera framing. Manatee waits for S14.
- Wave 3: four 4.2 s loops (swamp, cells, canopy, water), each animated from one still with matched first and last frames plus
  a 0.8 s crossfade at the seam, 960x540 VP9 WebM plus H.264 MP4, 17 to 83 KB. They are painted into the sky dome
  shader (`LoopSky`) as a soft window above the horizon, graded to the navy and cyan palette, never a box. The
  precached WebP poster shows first and the video crosses in after its first decoded frame. Low tier and reduced
  motion get the poster only. Videos are not precached, so offline play keeps the poster. Spend $1.84.
- Wave 4: plants, organs and icons once S14 lands (about $5).

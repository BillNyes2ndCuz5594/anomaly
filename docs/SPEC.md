# ANOMALY: build spec (MVP vertical slice)

Owner: E (Eric Trent), grade 5 science teacher, St. Lucie Public Schools, Florida.
Players: 10-11 year olds on modest school laptops (unknown OS and browser, NOT Chromebooks).
Test target: Grade 5 Florida Statewide Science Assessment (SSA), 2008 NGSSS benchmarks, grades 3-5.
Source design: E's "Science Review Game: Research and Design" page (summarized here; this file is the build source of truth).

## 1. Concept in one paragraph
Students are field agents in a near-future science response unit. Strange events ("anomalies") pop up across Florida and space. Each anomaly is a benchmark grouping in disguise. A shift is 10-15 minutes: Dispatch (pick a case) -> Briefing (3-4 short sentences, picture, read-aloud) -> Field Lab (1-3 min hands-on 3D sim) -> Evidence Check (3-5 SSA-style 4-option items solved with RKEA) -> Debrief (why each option is right or wrong) -> mastery update. Old benchmarks come back as Cold Cases on a spaced schedule (1, 3, 7, 14 school-day gaps). No speed points, no timers, no paywalls, no accounts, no PII.

## 2. Art direction (E's quality bar: "feels like it came from the people who made Halo, Call of Duty, Minecraft")
- Real-time 3D everywhere it helps: the Agent Hub, the Field Labs, and a 3D visual on most questions.
- Stylized, polished, game-studio look: think Fortnite / Minecraft Dungeons / Halo menus. Chunky readable shapes, bold silhouettes, rim lighting, emissive accents, soft bloom, subtle film grain or vignette, smooth camera moves with easing, parallax, particles (dust motes, scan sweeps).
- Palette: deep navy / slate base (#0b1220 to #15233b), hologram cyan (#3ee6ff), signal amber (#ffb547), Okabe-Ito safe accents for meaning (blue #0072B2, orange #E69F00, bluish green #009E73, vermillion #D55E00, sky #56B4E9, yellow #F0E442, reddish purple #CC79A7). Right/wrong ALWAYS shown by icon plus word, never color alone.
- HUD: crisp field-tech UI, thin lines, corner brackets, monospace labels for codes, Atkinson Hyperlegible (self-hosted woff2) for body text. Big tap targets (min 44 px).
- Tone: dry, confident, older-kid. The radio voice is DISPATCH, a dry, slightly sarcastic operator. NO mascots, NO "Great job superstar!", NO puns, NO kid slang from adults, no cartoon kids. The player customizes a field drone, not an avatar.
- Hologram anatomy and specimen models are built procedurally in code (no downloaded models, no CDN). The hologram style (fresnel rim glow, scanlines, additive cyan) makes simple procedural geometry look intentional and high-end.
- Sound: optional, OFF by default, never carries information. MVP may ship with no sound at all except an optional toggle stub.

## 3. Tech stack (decided)
- Vite 8 + TypeScript + React 19.
- three r186 with `WebGPURenderer` from `three/webgpu` (automatic WebGL2 backend fallback when WebGPU is not available), driven by React Three Fiber v9 (`<Canvas gl={async (props) => { const r = new WebGPURenderer({...props, antialias: true}); await r.init(); return r }}>`). Use TSL / node materials where custom shading is needed (hologram fresnel, scanlines). Post FX via three's node post-processing (check `node_modules/three` for the current class name, `PostProcessing` or `RenderPipeline`) with TSL bloom (`three/addons/tsl/display/BloomNode.js`). Do NOT use pmndrs `postprocessing` (WebGL only).
- `@react-three/drei` only for pieces that work with WebGPURenderer (e.g. PerformanceMonitor, AdaptiveDpr, Float, Html only if needed). Never use drei `Environment` presets (they fetch HDRs from a CDN); use `RoomEnvironment` + PMREM or simple lights.
- zustand for game state; progress saved to localStorage (versioned key `anomaly.v1`).
- vite-plugin-pwa (Workbox generateSW) for offline after first load; precache app shell, fonts, chunks.
- No analytics, no third-party scripts, no external network requests at runtime. All fonts and assets self-hosted.
- Hash routing (no server config needed on GitHub Pages): `#/` title, `#/hub`, `#/case/<id>`, `#/cold/<id>`, `#/settings`. Teacher HQ is a SEPARATE Vite entry `teacher.html` that does NOT import three (fast, tiny).
- `base: './'` in vite config so it works from any GitHub Pages subpath.

## 4. Performance and quality tiers (must stay smooth on modest laptops)
- Quality tiers: Low, Medium, High, Ultra. Default Auto.
  - Low: DPR cap 0.75-1.0, no post FX, no shadows, fewer particles.
  - Medium: DPR cap 1.25, bloom only, no shadows.
  - High: DPR cap 1.75, bloom + vignette/grain, soft contact shadow.
  - Ultra: DPR up to devicePixelRatio (lets 4K/8K displays render native), all effects.
- Auto mode: start at Medium on WebGL2 backend, High on WebGPU backend; sample FPS (rolling 2 s window); if under 45 fps for 3 s step down a tier; if over 58 fps for 8 s step up (max High in auto). Also `frameloop="demand"`-style idling when nothing animates is welcome but not required.
- A small optional FPS / backend / tier readout (toggle in Settings, and always on when URL has `?debug=1`). Expose `window.__anomaly = { fps, tier, backend }` for automated proof.
- Initial load target under 5 MB total transferred (aim far lower, under 1.5 MB gz). Code-split: 3D scenes lazy-loaded per screen; teacher entry separate.
- Respect `prefers-reduced-motion` and a Reduced Motion setting (no camera swoops, no shake).

## 5. Screens (MVP)
1. Title: 3D animated logo "ANOMALY" over a slow orbit of the Agent Hub, "Start shift" button. First run asks for Class code (letters/digits, optional) and Agent number (roster number 1-40). The game generates a codename from the number + class code (e.g. "AGENT KESTREL-14"). No names, no free text.
2. Agent Hub (3D): command deck with a holographic Florida/space map table. Active case markers float over the map (current unit case glows amber; cold case marker glows cyan when due). Side panel: agent rank, mastery stars per benchmark (Unseen, Rookie, Field-Ready, Expert, Ace), drone preview (simple procedural drone hovering, paint unlocks from mastery), Settings, Report Code button.
3. Briefing: DISPATCH card, 3-4 short sentences, a 3D vignette, Read Aloud button (Web Speech API, word highlighting via `boundary` events where supported, graceful if no voices).
4. Field Lab (3D, hands-on): see section 6.
5. Evidence Check (RKEA item player): see section 7.
6. Debrief: per item, what you picked, the key, and a one-line why for every option. CASE CLOSED stamp animation if 80%+ correct; otherwise "CASE STILL OPEN, returns as a cold case soon" (no shame language).
7. Results: mastery changes per benchmark (animated bars), Intel earned, drone part unlocked if any, Report Code panel.
8. Settings: text size (3 steps), line spacing, reduced motion, quality tier (Auto/Low/Medium/High/Ultra), read-aloud voice and rate, sound (off by default), show FPS.
9. Teacher HQ (`teacher.html`): see section 9.

## 6. Field Labs for the first playable case
Case 03-1 "VITALS" (current unit U03 Living Things). Benchmarks: SC.5.L.14.1 (human organs and functions), SC.5.L.14.2 (compare plant and animal structures, also assesses SC.3.L.15.1 animal classification). Three short lab phases, about 45-60 s each:
- Phase A "Organ Ops" (SC.5.L.14.1): a rotating hologram human figure with procedural organs (brain, heart, lungs, stomach, liver, pancreas, small and large intestines, kidneys, bladder, skin as the outer shell, muscles and skeleton shown as a toggle layer, eyes/ears/nose/tongue as sense organs). A scenario plays as task cards (from content JSON, e.g. "Pump blood to the legs", "Break down the sandwich"). Agent clicks/taps the organ (or picks from an accessible list) to route each task. Correct: organ pulses, line of light. Wrong: brief "Not that one" with a hint, retry. No reproductive organs in the MVP (E decides later).
- Phase B "Structure Match" (SC.5.L.14.2): a 3D animal (procedural dog-like mammal or human outline) and a 3D plant (tree/flower) side by side. Pair parts that do similar jobs: skeleton <-> stem (support), skin <-> bark/plant covering (protection). Plus one plant-only item (root: takes in water) as a contrast card. Items limited to the TIS list.
- Phase C "Specimen Sort" (SC.3.L.15.1): 6 stylized low-poly specimens on a turntable, each with a short description card (body covering, backbone yes/no, how young are born). Sort into bins: vertebrate vs invertebrate, then into mammal, bird, reptile, amphibian, fish, arthropod. Use common names only (no scientific names). Must show a picture plus description for vertebrate/invertebrate decisions (TIS rule).
Every lab interaction must be keyboard accessible (Tab to targets, Enter to choose) and have a non-3D list fallback.

Cold case mission "COLD CASE: RESIDUE" reviews earlier units (U00 Nature of Science, U01 Space, U02 Weather): a short 3D "evidence scan" intro, then 4 items pulled by the spaced-review scheduler.

## 7. RKEA item player (the "combat system")
Every item ends in the SSA format: one stem, 4 options A-D, one best answer.
- Read: Read Aloud button reads stem then options; current word highlighted where `boundary` events exist. A visual on every item (3D mini scene or crisp SVG diagram) with alt text.
- Key words: student taps words in the stem to tag them. Tagging a real key word (listed in content) earns Intel and marks it with a bracket highlight; tagging a non-key word just toggles a neutral underline (no penalty).
- Eliminate: strike an option (X button or key X then 1-4). If the option really is wrong, its decoy reason is revealed in a small line ("Decoy: confuses the heart with the lungs"). If the student tries to strike the KEY, it does not strike; DISPATCH says "Careful. Check that one again." and Intel is not lost (but it counts as a hint used).
- Answer: Lock in. Scoring rewards accuracy and correct eliminations, never speed. No timers anywhere.
- Keyboard: 1-4 or A-D select, X eliminate mode, Space read aloud, Enter lock in.
- After lock-in: show correct/incorrect with icon + word, the why line for every option.

## 8. Progression and spaced review
- Per benchmark record: attempts, correct, last seen date, streak across separate days, stage (Unseen -> Rookie -> Field-Ready -> Expert -> Ace). Mastery stage rises only with correct answers on separate days (cap one stage-up per benchmark per day).
- Cold-case scheduler: after a benchmark is seen, schedule reviews at 1, 3, 7, 14 school days (skip Sat/Sun). A miss resets to the 1-day gap. The hub shows the cold case marker when any review is due; for the MVP demo the cold case is always available too.
- Agent rank from total mastery so struggling kids still see progress. Drone paint unlocks from mastery only. Nothing for sale.

## 9. Report code and Teacher HQ (no PII)
- Report code: compact text code (Crockford base32, grouped in 4s with dashes, plus a 2-char checksum), encodes: format version, class code hash, agent number (1-40), date (days since 2026-08-01), per-benchmark (attempts, correct, stage) for benchmarks touched, and up to 20 recent item results (item index, correct). It doubles as a resume code (paste on title screen to restore progress on another laptop).
- Students copy it (Copy button) and paste it into a Canvas text assignment.
- Teacher HQ page: paste many codes (one per line) or drop a CSV/TXT export from Canvas (it extracts anything that looks like a code). Decodes locally in the browser, never uploads. Shows: benchmark x agent heatmap (colors from a color-blind-safe sequential scale plus the number in each cell), reporting-category bars (Nature of Science, Earth and Space, Physical, Life), weakest 5 benchmarks, most-missed items, and a CSV download. Agents appear as numbers/codenames only. Include a "Load sample class" button that generates 24 fake codes for demo.

## 10. Accessibility (required)
Read-aloud on every screen; text size and spacing controls; short sentences; a visual with alt text on every item; Okabe-Ito colors; right/wrong by icon + word; no timers; reduced motion; full keyboard play; focus outlines visible; a non-3D fallback list for every 3D interaction; works with sound off (sound is off by default).

## 11. Content rules (accuracy matters most)
- Content lives in `src/content/*.json`, validated by a TypeScript schema and a unit test (`npm test`): 4 options, exactly one key, key positions balanced, every item has benchmark + tested-as parent + visual + key words + why for every option + read-aloud text.
- Item TIS limits for this case: SC.5.L.14.1 items do not assess body systems, do not require parts of organs, do not require names of muscles or bones, muscles only general function, no reproductive organ diagrams. SC.5.L.14.2 organ/structure functions limited to brain, heart, lungs, gills, stomach, liver, intestines, pancreas, muscles, bones, exoskeleton, testes, ovaries, kidneys, bladder, skin or body covering, eyes, ears, nose, tongue; plant structures limited to cone, flower, fruit, leaf, root, stem, seed, spore; plant-animal comparisons limited to skin vs plant covering, skeleton vs stem, reproductive organs vs flower. Vertebrate classification only general characteristics of mammals, birds, reptiles, amphibians, fish; invertebrates not classified beyond the initial grouping except arthropods (SC.3.L.15.1 lists arthropods). Common names only.
- Never use the words "body system(s)", "net force", "decomposer" in items.
- UI and item text: short sentences, no em dashes or en dashes anywhere (use commas, colons, parentheses, or plain hyphens).

## 12. Proof required for every stage
`npm run build` clean (no TS errors), `npm test` green, zero console errors in headless Chrome. A proof script `scripts/proof.mjs` (puppeteer-core, Chrome at /usr/bin/google-chrome, args `--no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`) that starts `vite preview`, walks the flow, and saves screenshots to `/workspace/anomaly-proof/` at 1366x768 and 1920x1080: title, hub, lab phase A/B/C, an item with RKEA (key words tagged + one option eliminated), debrief, results with report code, teacher HQ with sample class, plus `fps.json` with the FPS reading under CPU throttling 4x (CDP `Emulation.setCPUThrottlingRate`). The game must expose stable `data-testid` attributes for these steps.

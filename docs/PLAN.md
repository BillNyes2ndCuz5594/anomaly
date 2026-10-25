# ANOMALY build plan (stages)

Each stage is one coding-agent session. Each ends with build + test + proof green and a local commit.

- S1 Foundation: renderer (WebGPURenderer with WebGL2 fallback), quality tiers + Auto, hologram TSL material, node post FX (bloom, vignette/grain), app shell + hash router, title screen 3D logo, Agent Hub 3D command deck, zustand store + localStorage, first-run class code + agent number + codename, settings screen, self-hosted font, PWA, `scripts/proof.mjs` skeleton (title, hub, settings, fps.json).
- S2 Case 03-1 VITALS: content loader + schema test, briefing with read-aloud, Field Lab phases A Organ Ops, B Structure Match, C Specimen Sort (3D + list fallback), RKEA item player with item visuals, debrief, results, mastery update.
- S3 Cold case RESIDUE + spaced scheduler, report code (encode/decode/checksum, resume), Teacher HQ (`teacher.html`, no three), full proof with all screenshots and fps.json.
- S4 Item visuals library (organ, plantanimal, specimen, table, scene) and accessibility pass.
- S5 Polish: camera moves, particles, transitions, typography, perf tuning.

- S4 as built: visual polish and accessibility pass (outline logo, hub drone, screen transitions, specimen models, scene diagrams, case closed burst, draw call merging, live regions, contrast tests, proof realism with `?tier=high`, per backend fps).

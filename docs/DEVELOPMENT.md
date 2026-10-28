# Development log

## Procedural sound

The game had a sound boolean, off by default, and no audio path. This pass adds a Web Audio layer under `src/audio/` with no audio files.

What this pass does:

- One `AudioContext`, created on the first allowed gesture. A lowpass at 2400 Hz, a master gain (full scale is about -12 dBFS), and a compressor after the master. Oscillators are one-shot. The noise buffer is built once. The hum is three sines that are stopped when you leave the hub or a case.
- `?still=1` and `?mute=1` never construct a context. Sound off and a hidden tab do not schedule cues. `prefers-reduced-motion` is not read here.
- Cues subscribe to state that already exists: session answers (evidence correct or wrong), the lab feedback node (`data-ok` on `lab-feedback`), specimen id (file pickup), case id (scan on briefing), and `cases` while the step is debrief (solved stinger, only when closed). Route whooshes use `hashchange`. UI ticks use document capture on pointer, click, and Enter or Space.
- Lock-in, organ, and sort buttons stay quiet so the verdict cue is the only sound. Option clicks are a pickup, unless Eliminate is on, in which case they tick as a toggle. The sound switch itself is played from the settings subscription so the off tick is not cut off.
- Teacher HQ installs a separate press-only listener and reads the saved blob. It does not import the game store or three.
- Default is on at 0.55 because this task asked for sound that makes the game feel finished. Older saves that stored `sound: false` stay off. A save with no volume gets 0.55.

No cue was skipped for a locked file. Lab correct and wrong come from the verdict element those screens already render. Item results come from `useSession.answers`.

Gates on this branch: `npm test` 288/288 (check-assets clean), `npm run build`, `npm run lint` with 0 errors. `AN_TAG=sfx PROOF_OUT=./proof-sfx node scripts/proof.mjs` passed 293/293 checks and 70 screenshots with 0 console errors. `AN_TAG=sfxm PROOF_OUT=./proof-sfxm node scripts/mobile.mjs` reported 0 problems and 0 console errors on s23 portrait, s23 landscape, tablet portrait, and tablet landscape. Settings showed Sound ON and Volume 55% at 1920x1080 and at 360x780.

## Flow transitions

The old route veil was a 140 ms fade and a 320 ms top-to-bottom wipe. Case steps remounted, and each lab camera eased in from a fixed offset that was not tied to the fit.

What this pass does:

- `motionMode` picks `full`, `fade`, or `still`. Still covers reduced motion and `?still=1`. Fade is the low tier: opacity only, no mask, no scan line, no extra shader pass.
- Route cover is 150 ms (90 ms on fade) and is the only time the screen is inert. A pointer event during the cover skips straight to the new screen. Reveal is click-through. Cover plus reveal stays at or under 560 ms.
- Deploy (title to hub, case, or cold) opens an iris. Scan (case routes) wipes with a moving line. Dissolve (settings, visuals) fades.
- Case steps play a directional glide on the full tier and a scan band across the view. The band does not take the pointer. A tap ends it.
- `flyStart` keeps the camera at least as far from the look target as the fitted pose, so the subject only gets smaller during the dolly. Low tier pushes back along that ray and does not orbit. `?still=1` and reduced motion snap to the fit. `FitCamera` and `data-fit` are unchanged.
- Shared-element carry slides the current step mark (up to 240 px) and the side panel or dock (up to 48 px). Larger jumps are dropped so a panel never crosses the 3D frame.
- Lab C buttons no longer inherit `overflow-wrap: anywhere` from `.panel`. Names use nowrap, normal word break, and a slightly tighter tracking so AMPHIBIAN and ARTHROPOD fit the three-column grid at 1920 px.

Proof frame strips (1920 only) scrub each new transition and composite four times into one image.

Gates on this branch: `npm test` 265/265, `npm run build`, `npm run lint` with 0 errors, `node scripts/proof.mjs` 293/293 checks and 70 screenshots with 0 console errors, `node scripts/mobile.mjs` 0 problems on s23 portrait, s23 landscape, tablet portrait, and tablet landscape. Lab C group names stayed on one line in the 1920 proof, and every mobile Lab C screen reported 0 layout problems with the model inside the canvas.

Draw calls did not grow a transition pass. Medium tier is 63 calls on the hub and 41 on Lab A. Low tier is 51 and 29. The proof machine uses a software GPU, so its fps readings (about 2 to 9 under CPU throttle) are not a phone measurement. The medium path is CSS plus one camera lerp, which is the budget aimed at 60 fps on a Galaxy S23.

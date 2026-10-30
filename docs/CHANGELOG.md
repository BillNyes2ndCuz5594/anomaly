# Changelog

## Panther rescan

- The Florida panther evidence model is rescanned (wave 11): a FLUX 3 reference into Hunyuan 3D v3.1 Pro, so it reads as a tawny furred cat with real shoulder and leg muscle and amber eyes instead of smooth salmon plastic. 18k triangles, 282 KB. Low tier keeps the procedural model.

## Backdrop loops v2

- Swamp (title and hub), cells (Lab A), canopy (Lab B) and water (Lab C) loops are regenerated: FLUX 3 stills animated with Veo 3.1 first and last frame, 960x540, in the navy and cyan palette. The cells loop no longer uses bokeh glitter.

## Briefing and Lab B

- Briefing stages the body scan and a lit manatee on a shared table, with a lip scan that stays off the figures.
- Lab B gives the deer a column stand and the live oak a low cap, and separates shell and structure by tint.
- Dispatch and match panels use 44px targets, press and hover feedback, and type that stays readable at 1920 and on a phone or tablet.
- Names stay in the panels. Reduced motion and `?still=1` still freeze the scan, the lamp, and the lab bob.

## Honest specimen pairs

- Evidence pairs keep real size ratios, with a floor so the smaller animal stays readable, and a quiet "Not to scale" tag when that floor is used.
- The camera frames the tallest specimen's scan headroom, so a tall head stays inside the canvas margin.

## Procedural sound

- Web Audio cues for hover, press, toggle, wrong, correct, scan, evidence pickup, route whoosh, and a 1.5 s case-solved stinger.
- A quiet hum fades in on the hub and case screens and fades out when you leave.
- Sound defaults on at 55% volume. Settings has a switch and a slider, saved with the rest of the game.
- `?mute=1` and `?still=1` play nothing. Reduced motion does not change sound. A hidden tab suspends the audio context.
- Teacher HQ plays button presses only.

## Signature transitions

- Title to hub opens with a 1.28 s iris (160 ms cover, 1120 ms reveal). Hub to case and case back to hub use a 1.26 s warp (180 ms cover, 1080 ms reveal). A tap skips either one. The cover is the only moment input is held.
- The cover is a holographic frame: cyan and amber glow, a perspective grid, scanlines, noise, twin sweeps, an edge, and the ANOMALY mark. Low tier fades that fill with opacity only and hides the extra layers.
- Case to results plays a 1.12 s scan. It does not take the pointer. Rows and rewards follow in sequence.
- Entering a case from the hub dollies the camera for 1.05 s, still never closer than the fit. Low tier keeps the short push.
- Evidence cards slide the question and answers only. The 3D panel stays mounted and fully opaque, so the canvas does not blank mid-glide.
- The evidence canvas keeps its last painted frame until the next specimen has compiled and drawn. The upcoming item is compiled before the advance, so a slow GPU does not flash an empty panel.
- On a phone portrait, a 3D evidence stage stays pinned at the top of the item scroller so a long stem or a scroll-into-view on an answer cannot push the model out of the first view.
- Reduced motion and `?still=1` still swap with no veil.

## Flow transitions

- Route changes use a scan wipe, an iris deploy, or a dissolve. Low tier is a short opacity fade. Reduced motion and `?still=1` swap with no veil.
- Case steps glide, and the camera dollies between them without starting closer than the fit.
- The current step mark, side panel, and dock carry across when the move is small.
- Modals play a short close. Evidence items slide, with a scan across the picture. Results rise and the mastery bars ease in.
- Lab C group names stay on one line at 1920 px wide.

# Changelog

## Procedural sound

- Web Audio cues for hover, press, toggle, wrong, correct, scan, evidence pickup, route whoosh, and a 1.5 s case-solved stinger.
- A quiet hum fades in on the hub and case screens and fades out when you leave.
- Sound defaults on at 55% volume. Settings has a switch and a slider, saved with the rest of the game.
- `?mute=1` and `?still=1` play nothing. Reduced motion does not change sound. A hidden tab suspends the audio context.
- Teacher HQ plays button presses only.

## Flow transitions

- Route changes use a scan wipe, an iris deploy, or a dissolve. Low tier is a short opacity fade. Reduced motion and `?still=1` swap with no veil.
- Case steps glide, and the camera dollies between them without starting closer than the fit.
- The current step mark, side panel, and dock carry across when the move is small.
- Modals play a short close. Evidence items slide, with a scan across the picture. Results rise and the mastery bars ease in.
- Lab C group names stay on one line at 1920 px wide.

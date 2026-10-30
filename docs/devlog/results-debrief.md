# Results and Debrief payoff

2026-10-28. Studio pass on the end of a case: the Debrief screen and the Results screen. Desktop 1920x1080, Galaxy S23 portrait and landscape, Galaxy Tab portrait and landscape. Copy is unchanged. No new art.

## Reveal order

Debrief now reads stamp, score, the line the case already used, then the evidence recap. Each card is the stem, the evidence the player picked, and "What this shows" from the existing key reason (`item.why[item.key]`). The A to D record stays under that.

Results leads with the same verdict, the score, that line, and Intel earned. Mastery bars come next. The shift file (paint, rank, report code, back to hub) is the last column on a wide screen and the last block on a phone.

The dispatch line stays sentence case at about 17px to 19px. It no longer inherits the large uppercase size on `.verdict-block p`.

## Stamp fit is not a timing bet

CASE CLOSED, CASE STILL OPEN, and RESIDUE CLEARED used to scale from a large start size down to 1. The mobile audit measures the transformed box. A stamp that fits once it has settled can still stick out of the panel while that scale is running. Phone portrait had about 19px of side room on CASE CLOSED. Tab portrait is 800px wide, so it never matched the 600px phone rule and kept the stamp on one nowrap row.

The stamp now keeps one transform for its whole life: `rotate(-3deg)`, set with `!important` so a keyframe scale cannot override it. The ink animation is opacity only. It is off for reduced motion, `data-motion=still`, and `?still=1`. The phrase may wrap. Font size is chosen from the measured panel width before paint (12px to 26px) and checked again against the real text box after fonts load. `src/screens/case/resultsDebrief.test.ts` locks the width math for every phrase from 240px to 1800px.

## Type, touch, motion

Score and verdict are the largest type. Body lines used by the proof type floor stay at least 16px. Labels stay at 12px.

Continue, copy, and back to hub are at least 48px tall (44px in compact landscape) and show a pressed state. The press move is skipped when motion is reduced or still.

Count-up on the results score and Intel, and on the cold debrief score, snaps to the final number when reduced motion or `?still=1` is on. The results Intel node keeps the final number first in the accessible text so a mid-count read still sees a number above zero. The debrief score still exposes a digits-only text node for the existing count-up.

## Screenshots

Taken with `?still=1&tier=low&mute=1` after animations finish. Script: `scripts/shots-results-debrief.mjs`.

Before:

- docs/devlog/shots/before-debrief-1920.png
- docs/devlog/shots/before-results-1920.png
- docs/devlog/shots/before-debrief-s23-portrait.png
- docs/devlog/shots/before-results-s23-portrait.png
- docs/devlog/shots/before-debrief-tab-portrait.png
- docs/devlog/shots/before-results-tab-portrait.png

After:

- docs/devlog/shots/after-debrief-1920.png
- docs/devlog/shots/after-results-1920.png
- docs/devlog/shots/after-debrief-s23-portrait.png
- docs/devlog/shots/after-results-s23-portrait.png
- docs/devlog/shots/after-debrief-tab-portrait.png
- docs/devlog/shots/after-results-tab-portrait.png

Cold debrief after (RESIDUE CLEARED, the longest stamp):

- docs/devlog/shots/after-cold-debrief-1920.png
- docs/devlog/shots/after-cold-debrief-s23-portrait.png
- docs/devlog/shots/after-cold-debrief-tab-portrait.png

## Gates

- `npm run build`: pass (the preview used by proof, mobile, and the after screenshots).
- `npm test`: 302 tests in 33 files, including `resultsDebrief.test.ts`. `scripts/check-assets.mjs` reported no orphan assets.
- `npm run lint`: 0 errors.
- `AN_TAG=rd PROOF_OUT=/tmp/proof-rd node scripts/proof.mjs`: 293/293 checks passed, 0 console errors, exit 0. Unit tests inside the proof: 302/302.
- `AN_TAG=rdm PROOF_OUT=/tmp/proof-rdm node scripts/mobile.mjs`: 4 profiles (s23 portrait, s23 landscape, tab portrait, tab landscape), 30 screens each, 0 problems, 0 console errors, exit 0. Debrief, results, cold debrief, and cold results were clean on every profile.

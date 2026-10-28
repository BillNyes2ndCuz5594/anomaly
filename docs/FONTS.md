# Fonts

Atkinson Hyperlegible (Regular 400 and Bold 700) is self-hosted as Latin subset woff2 files in `public/fonts/`. It is licensed under the SIL Open Font License 1.1 (Braille Institute of America). No font is loaded from the network.

`@font-face` rules live at the top of `src/index.css` and `src/teacher/teacher.css` with `font-display: swap`. The PWA glob already precaches `woff2`.

Codes and HUD labels use a system monospace stack: `ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Consolas, "Liberation Mono", monospace`.

To regenerate the subset from the TTFs: `pyftsubset <ttf> --unicodes="U+0020-007E,U+00A0-00FF,U+2018-201D,U+2022,U+2026,U+2190-2193,U+2713,U+2715,U+00D7" --layout-features='*' --flavor=woff2 --output-file=<out>.woff2`.

## Type scale (S18)

Tokens live at the top of `src/index.css` (`--fs-*`, `--track-*`, `--sp-*`). Atkinson Hyperlegible Bold carries every heading, label and button; the monospace stack is kept for codes and numbers only (benchmark ids, report code, case ids in 3D labels).

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| display | clamp(2rem, 1.2rem + 2.2vw, 3rem) | 700 | verdict and score lines on 1500+ wide screens |
| h1 | clamp(1.375rem, 1rem + 0.7vw, 2rem) | 700 | uppercase, 0.06em tracking, line height 1.15 |
| h2 | 1.375rem (1.5rem on 1500+) | 700 | panel titles |
| lead | 1.125rem (1.25rem on 1500+) | 400 or 700 | briefing text, debrief summary |
| body | 1rem minimum | 400 | line height 1.55, measure at most 66ch |
| caption | 0.875rem | 400 | totals, hints, status lines |
| label | 0.75rem minimum | 700 | uppercase, 0.16em tracking |

Rules: body text is never below 16 px on any device, labels never below 12 px (S8). Numbers that line up use `font-variant-numeric: tabular-nums`. Spacing is on a 4 and 8 px scale (`--sp-1` to `--sp-7`); panels use `--panel-pad` (24 px, 32 px on 1500+ wide). `scripts/proof.mjs` asserts the type floor on title, hub, briefing, debrief and results at 1920.

# Fonts

Atkinson Hyperlegible (Regular 400 and Bold 700) is self-hosted as Latin subset woff2 files in `public/fonts/`. It is licensed under the SIL Open Font License 1.1 (Braille Institute of America). No font is loaded from the network.

`@font-face` rules live at the top of `src/index.css` and `src/teacher/teacher.css` with `font-display: swap`. The PWA glob already precaches `woff2`.

Codes and HUD labels use a system monospace stack: `ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Consolas, "Liberation Mono", monospace`.

To regenerate the subset from the TTFs: `pyftsubset <ttf> --unicodes="U+0020-007E,U+00A0-00FF,U+2018-201D,U+2022,U+2026,U+2190-2193,U+2713,U+2715,U+00D7" --layout-features='*' --flavor=woff2 --output-file=<out>.woff2`.

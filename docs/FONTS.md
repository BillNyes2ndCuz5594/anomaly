# Fonts

TODO: add self-hosted Atkinson Hyperlegible (woff2). It was not available offline when S1 was built.

Current state: no network fonts. `src/index.css` uses this body stack, so the swap is automatic once the files exist:

    "Atkinson Hyperlegible", system-ui, "Segoe UI", Roboto, sans-serif

Codes and HUD labels use a monospace stack: `ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Consolas, "Liberation Mono", monospace`.

To add the font later:

1. Put `AtkinsonHyperlegible-Regular.woff2` and `AtkinsonHyperlegible-Bold.woff2` in `public/fonts/` (SIL OFL license text next to them).
2. Add two `@font-face` rules at the top of `src/index.css` and `src/teacher/teacher.css` with `font-display: swap` and relative `url(./fonts/...)` paths.
3. The PWA glob already precaches `woff2`.

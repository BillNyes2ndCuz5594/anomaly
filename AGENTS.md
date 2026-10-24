# AGENTS.md (rules for coding agents on ANOMALY)
- Read docs/SPEC.md first. It is the source of truth. docs/PLAN.md has the stage plan.
- Stack is fixed: Vite + TS + React 19 + R3F v9 + three r186 WebGPURenderer (WebGL2 fallback) + zustand + vite-plugin-pwa. Do not add other heavy deps without a reason in the PR.
- No runtime network requests, no CDNs, no analytics, no third-party scripts. Self-host fonts.
- No PII: no names, no free-text input except class code (A-Z0-9, max 8) and agent number (1-40).
- No em dashes or en dashes in any UI text, content, docs, or commit messages.
- Content accuracy: never edit item science content without keeping the schema test green; do not invent new items unless the stage says so.
- Never push, never touch git remotes. Commit locally on the current branch with clear messages. The human pushes.
- Before finishing: `npm run build` and `npm test` must pass and `node scripts/proof.mjs` must report zero console errors.

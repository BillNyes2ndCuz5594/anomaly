# S6: Case files (many cases, one engine)

Written 2026-11-01 by the PM. Stage goal: ANOMALY becomes a full-year review tool. Today the engine knows one case
(03-1 VITALS, three bespoke labs) and one cold case. After S6 the engine reads any number of cases from content, each
with a data-driven hands-on lab, and S7 fills in the content for every benchmark the Grade 5 SSA assesses.

Read `docs/SPEC.md` first. Nothing in this stage relaxes it: no PII, no network, no em or en dashes, Okabe-Ito colours,
icon plus word for right and wrong, keyboard play and a list fallback for every 3D interaction, `npm test` and
`npm run build` green, zero console errors in proof.

## 1. Content layout

- `src/content/anomaly-content.json` keeps what it has: the VITALS case (`case`), the cold case (`coldCase`), the
  VITALS and cold items, the codex. Its `case` object gains the new fields in section 2 (`category`, `unitLabel`,
  `evidencePlan`, `marker`, `lab: { kind: 'vitals' }`). Existing item ids and benchmark order never change.
- New cases live one per file in `src/content/packs/<caseId>.json`, shape `CasePack`:
  ```ts
  interface CasePack { case: CaseDef; items: Item[]; codex?: CodexEntry[] }
  ```
- `src/content/index.ts` (new) is the only module that reads JSON. It exports the same `content: Content` the app
  uses today, built as `{ cases: [vitals, ...packs in PACK_ORDER], coldCase, items: [...all], codex: [...all] }`.
  `PACK_ORDER` is an explicit array of case ids in `src/content/index.ts` (unit order). A pack file that is not
  listed is not loaded; `npm test` fails if a pack exists on disk but is not listed (checked by a small script test
  that reads the directory).
- `src/content/schema.ts` keeps the types and `validateContent`. `content.case` is removed; every reader uses
  `content.cases` and `caseById(id)`. `validateContent` runs over the merged content and additionally over each pack
  (so an id clash between packs is a named error).
- `scripts/gen-catalog.mjs` reads the merged content through the same pack list (duplicate the tiny loader in the
  script, no TypeScript import). Catalog stays APPEND ONLY.

## 2. Schema (exact; content writers code against this)

```ts
export type Category = 'nature' | 'earth' | 'physical' | 'life'

export interface SortLab {
  kind: 'sort'
  intro: string                                  // one or two sentences, read aloud
  bins: { id: string; name: string; hint: string }[]          // 2 to 4 bins
  cards: { id: string; name: string; card: string[]; bin: string; why: string }[]   // 4 to 8 cards, card = 1 to 3 short lines
}

export interface MatchLab {
  kind: 'match'
  intro: string
  left: { id: string; name: string; card?: string }[]         // 3 to 5
  right: { id: string; name: string; card?: string }[]        // same count as left
  pairs: { left: string; right: string; why: string }[]       // one pair per left id
}

export interface OrderLab {
  kind: 'order'
  intro: string
  prompt: string                                 // e.g. "Put the steps of the water cycle in order"
  steps: { id: string; name: string; card?: string }[]       // 3 to 6, listed in the correct order; the player sees them shuffled
  why: string
}

export type LabDef = { kind: 'vitals' } | SortLab | MatchLab | OrderLab

export interface CaseDef {
  id: string                      // "NN-N", e.g. "04-1"
  codename: string                // one word, upper case in the UI, e.g. "SOLVENT"
  unit: string                    // "U04 Matter"
  unitLabel: string               // "Unit 4: Matter"
  category: Category
  benchmarks: string[]            // top-level assessed benchmarks this case teaches
  evidencePlan: { benchmark: string; count: number }[]   // counts sum to 5; benchmarks from `benchmarks`
  marker: { lon: number; lat: number }                    // hub map position (Florida); space cases use Cape Canaveral 28.39, -80.60
  dispatchHook: string
  briefing: string[]              // 3 or 4 short sentences
  lab: LabDef
  debriefClosed: string
  debriefOpen: string
}
```

Items are unchanged (`Item` in schema.ts) with these conventions for new content:

- `id`: `<benchmark short>-NN`, e.g. `P8.1-03` for SC.5.P.8.1 item 3, `N1.1-02`, `E7.5-01`, `L17.1-04`.
- `benchmark`: the top-level assessed code; `testedAs`: the code the item really tests (often the same; a grade 3 or 4
  "also assesses" code when the item is at that level).
- `category`: `nature` | `earth` | `physical` | `life`. `complexity`: `low` | `moderate` | `high`.
- `pool`: per benchmark, write 6 items: 4 with `pool: 'case'` and 2 with `pool: 'cold'`. The cold pool is what
  the spaced review draws from all year.
- `visual`: one of the existing kinds (`table`, `scene`, `specimen`, `organ`, `plantanimal`). New `scene` ids are
  listed in section 5 and must exist in `SCENE_IDS` before the pack is merged.
- `keyWords`: 2 to 4 phrases copied verbatim from the stem (the test checks). `why`: 4 lines, one per option, each
  starting with the option letter is not needed; say why it is right or what decoy it is.
- `alt`: one sentence describing the visual for a screen reader.
- `tisCheck` and `misconceptions`: teacher metadata, required for new items (the reviewer reads these).

`validateContent` adds: lab shape checks per kind (bin ids referenced by cards exist, pairs reference existing ids,
same counts, order has 3 to 6 steps), `evidencePlan` sums to 5 and names only the case's benchmarks, `marker`
within Florida or the Cape, `category` valid, every new item has `tisCheck` and `misconceptions` (VITALS and the
cold items are exempt), key words verbatim, and the existing checks.

## 3. Steps

`CaseStep` gains `'lab'`. Steps:

- VITALS (`lab.kind === 'vitals'`): unchanged, `briefing, lab-a, lab-b, lab-c, items, debrief, results`.
- Any other case: `briefing, lab, items, debrief, results` (labels Briefing, Field Lab, Evidence, Debrief, Results).
- Cold case: unchanged.

`stepsFor(kind, caseDef)` replaces `stepsFor(kind)`. `useSession.start(caseId, kind)` looks the case up through
`caseById`, stores `caseDef`, and builds the evidence set with `pickEvidence(items, history, seed, caseDef.evidencePlan)`.
`EVIDENCE_PLAN` in rkea.ts goes away (VITALS's plan moves into its JSON).

## 4. The generic Field Lab (one screen, three mechanics)

`src/screens/case/LabGeneric.tsx` renders `SortLab`, `MatchLab` or `OrderLab` from `caseDef.lab`. It follows Lab C's
pattern (intro card, one current card, bins or targets as 44 px buttons, `Verdict` with icon plus word, `lab-next`
when everything is placed, read-aloud button, keyboard: Tab to targets, Enter to choose, list fallback is the same
DOM). Test ids: `lab-generic`, `lab-card`, `lab-card-<id>`, `lab-bin-<id>` (sort), `lab-left-<id>` and
`lab-right-<id>` (match), `lab-step-<id>` and `lab-slot-<n>` (order), `lab-feedback` (existing verdict id, keep
`data-ok` so sound cues fire). Correct: the card flies to its bin (`flyChip`, full motion only) and the 3D chip lights.
Wrong: "Not quite." plus the bin hint; no penalty. `unlockCodex` is called with `lab:<caseId>:<cardId>` ids only when
the pack lists codex entries with those ids.

3D: `src/three/scenes/case/LabGenericScene.tsx`, loaded lazily like the other lab scenes. A dais (reuse `labStage`
and `stageSet`), the current card as a hologram slab with the card's name as a sprite label is not needed (names
stay in the HUD panel, as Lab B learned), bins as three to four low hologram pedestals around the dais that glow
when hovered or when the matching HUD button is focused, and a correct placement spawns a short light trail from the
slab to the pedestal. Low tier: no trail, no motes. Reduced motion and `?still=1`: static. Draw calls on Medium must
stay under 70 on this scene (`window.__anomaly.calls`).

## 5. Scene diagrams for the new units

New `SCENE_IDS` (vector SVG in `SceneDiagram.tsx`, labels from `diagramLabels.ts`, same label floor rules the proof
checks). The list is final once S7's research lands; the diagram lane will receive it as a separate brief. Items
in a pack may reference only ids that exist when the pack is merged.

## 6. Hub

- The Dispatch list and the 3D markers come from `content.cases` (order = `PACK_ORDER`), plus the cold case. Each case
  button shows `CASE <id> <CODENAME>`, `unitLabel`, and a status word: `New`, `Open` (played, not closed), `Closed`
  (with the date). Test ids `case-marker-<id>` (keep `case-marker-03-1`).
- Markers: one per case at `marker.lon/lat`, amber; the cold marker stays cyan. Up to ten markers must not overlap
  the side panel; the marker component takes `side` as today.
- Benchmark mastery list: grouped under the four reporting categories (collapsible `details`, open by default on
  desktop, closed on a phone), each row as today. Replace `HUB_BENCHMARKS` with the union of all case benchmarks
  in category order (plus any benchmark in progress that is not in a case).
- Rank (`rankFor`) must be a function of the fraction of known benchmarks at each stage, not a raw count, so adding
  cases never demotes an agent. Keep the existing rank names and make the existing rank test pass with the new rule
  or update it with a comment saying why.

## 7. Report code v2

The v1 layout stores a benchmark index in 6 bits and an item index in 7 bits. With every assessed benchmark and
about 240 items that overflows. Add version 2: benchmark index 7 bits, item index 9 bits, everything else unchanged.
`encodeReport` emits v2. `decodeReport` reads v1 and v2 (the version field is the first 4 bits already). Teacher HQ
uses the same decoder. The v1 test vectors stay and still decode; add v2 vectors and a round trip over 120
benchmarks and 500 items. The code length grows by a few characters; `MAX_RECENT` stays 20.

## 8. Proof and mobile scripts

`scripts/proof.mjs` adds a short walk of the first non-VITALS pack: hub marker, briefing, the generic lab (place every
card through the HUD buttons), one evidence item, debrief, results. Screenshot numbers for the existing walk do not
change (append). `scripts/mobile.mjs` adds the generic lab screen to its profiles. If no pack exists yet (S6 lands
before S7), the walk is skipped with a logged note, not a failure. A fixture pack for tests lives in
`src/content/__fixtures__/pack-test.json` and is never listed in `PACK_ORDER`.

## 9. Acceptance

- `npm test`, `npm run build`, `npm run lint` with no new warnings.
- All 344 existing tests still pass, VITALS plays exactly as before (same test ids, same steps, same screenshots).
- A fixture pack with each lab kind plays through in a unit test of the lab reducer logic (pure functions in
  `src/screens/case/labGeneric.ts`, like `resultsDebrief.ts`).
- Report code v1 vectors decode, v2 round trip passes, Teacher HQ sample class still loads.
- The hub shows every case from content with status, and the mastery list is grouped.
- No `content.case` reference remains.

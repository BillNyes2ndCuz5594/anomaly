# Content review (teacher sign-off)

Every case pack under `src/content/packs/` was written by an AI content lane from the FDOE item specifications
summarised in `docs/research/ssa-grade5-benchmarks.md`. A pack is **not** student-ready until the teacher has
reviewed it. The review is the last gate before a pack is listed for students.

## How to review a pack

1. Print the sheet: `node scripts/review-sheet.mjs src/content/packs/<id>.json > /tmp/<id>.md` (or read it in the
   terminal). One row per item: id, benchmark, tested as, complexity, stem, the four options with the key marked,
   the why lines, the content limit applied (`tisCheck`) and the misconceptions the decoys target.
2. For each item decide: **keep**, **fix** (note the change), or **drop**.
3. Check the case text too: the briefing (3 or 4 sentences, DISPATCH's voice), the lab cards and bin hints, the
   two debrief lines, the codex entries.
4. Edit the JSON, then `npm test`. The schema test fails on anything structural (4 options, exactly one key, key
   words not in the stem, a dash, a banned word, key position over 40% in a pool).
5. Tick the pack below and commit.

## What to look for

- **Science is right.** The key is the only defensible answer; each decoy is wrong for the reason its why line says.
- **Inside the content limits.** The `tisCheck` line names the limit; confirm it against the research document and
  the FDOE specifications. Watch the never-used words (constellation, waning, waxing, gibbous, radiant, electrons,
  hypothesis, transpiration, infiltration, percolation, Mohs, rock cycle, parallel, series) and the project bans
  (body system, net force, decomposer).
- **Grade 5 reading level.** Short sentences, familiar words, the last sentence a question.
- **Florida examples** are real: species, places, weather.
- **Key balance** per pack looks even across A to D.
- **Visual fits the stem.** The diagram labels say what the item needs and nothing that gives the answer away.
- **Briefing** has no praise, no puns, no kid slang.

## Packs

| Pack | Case | Items | Reviewed by | Date | Notes |
|---|---|---|---|---|---|
| 00-1 | PROTOCOL (Nature of Science) | | | | |
| 01-1 | ORBIT (Space) | | | | |
| 02-1 | FRONT (Weather) | | | | |
| 02-2 | BEDROCK (Earth structures) | | | | |
| 04-1 | SOLVENT (Matter) | | | | |
| 05-1 | CURRENT (Energy) | | | | |
| 06-1 | TRACTION (Forces and motion) | | | | |
| 07-1 | CANOPY (Plants and life cycles) | | | | |
| 07-2 | HABITAT (Adaptations and food chains) | | | | |

The VITALS case and the original cold case items were reviewed during stages S2 and S3.

## Items the writers flagged

Each content lane listed the three items it was least sure about. Review these first.

(filled in when the packs land)

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

- **E5.1-06** (ORBIT, cold): "Why can stars not be seen at noon?" sits at the edge of the SC.5.E.5.1 limit (star brightness in relation to distance) and near the "Sun's effects on Earth" exclusion; the earth-day-night diagram is loosely tied. Swap for a plain "the Sun is a star that gives off its own light" item if judged out of scope.
- **E5.4-04** (ORBIT): names Orion as a star pattern seen in winter and not summer, explained by Earth travelling around the Sun. Confirm a real pattern name is acceptable and that the explanation does not read as "causes of seasons".
- **E6.2-03** (BEDROCK): pyrite looks gold but streaks greenish black; the item asks why streak beats color. Confirm this is not "identifying a mineral from its properties".
- **ORBIT sort lab**: card names are Sirius, Titan, Phobos, Vesta, Halley's Comet (chosen so no name gives its bin away); the card lines carry the facts. Rename if too obscure for 10-year-olds.
- **P13.1-08** (TRACTION): a manatee distance table where the distance grows 50 m each minute; close to the "no computation" limit.
- **P10.4-06** (CURRENT): two rubbed balloons repel; stays inside "framed as static electricity", but the static-balloon diagram shows a balloon on a wall, not two balloons.
- **P10.2-04** (CURRENT): the key is "heat from the Sun dries a wet towel" as a change rather than a motion; the limit is UNVERIFIED.
- **P8.3-01** (SOLVENT): the mixture-separation diagram shows a magnet over the tray, which hints at the answer.
- **L17.1-04** (HABITAT): flamingo colour from food (carotenoids in shrimp and algae); the table wording "Zoo food with color from shrimp added" may need more background.
- **L16.4-03** (CANOPY): lady beetle "stays still on a leaf while its body changes"; the dragonfly decoy and the local name "palmetto bug" are worth a look.
- **L17.3-02, L17.3-03** (HABITAT): labels for the food-web-estuary diagram were written before the diagram existed (Sea grass, Algae, Shrimp, Blue crab, Small fish, Brown pelican); check they land on the right pictures. Same for plant-parts (root, stem, leaf, flower, fruit).
- **SC.5.N.2.2 items and SC.4.E.6.4 items**: their limits are UNVERIFIED in the research document; written in the plainest form, said so in tisCheck.
- **02-2 unitLabel** is "Unit 2: Weather (Earth Structures)"; rename to match the real unit order.

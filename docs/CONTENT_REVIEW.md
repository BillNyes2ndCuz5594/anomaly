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
- **L17.3-02, L17.3-03** (HABITAT): the food-web-estuary labels were realigned to the drawn slots (Sea grass and algae, Shrimp, Blue crab, Small fish, Bass, Brown pelican); the PM checked every other guessed slot order against the drawings (plant-parts, weathering-erosion, mineral-streak, florida-resources, weather-instruments, cloud-types, light-path) and they match.
- **SC.5.N.2.2 items and SC.4.E.6.4 items**: their limits are UNVERIFIED in the research document; written in the plainest form, said so in tisCheck.
- **02-2 unitLabel** was "Unit 2: Weather (Earth Structures)"; renamed to "Unit 4: Earth's Processes and Resources" (unit "U04 Earth's Processes and Resources").

## Unit 4 BEDROCK items, reviewed-by-bot (2026-11-03)

The 24 items from PR #62 were checked against the CPALMS wording of SC.4.E.6.1, SC.4.E.6.2, SC.4.E.6.3 and SC.4.E.6.4 and the repo content limits, then fixed for facts, distractors, diagram labels and grade 5 reading level.

- **E6.1-01** (SC.4.E.6.1, case): reviewed-by-bot. diagram label moved to the glassy (igneous) sample; alt text matches the picture.
- **E6.1-02** (SC.4.E.6.1, case): reviewed-by-bot. diagram label moved to the layered sample; alt text matches.
- **E6.1-03** (SC.4.E.6.1, case): reviewed-by-bot. stem says "solid rock" instead of naming granite, so no rock cycle; label on the banded sample.
- **E6.1-04** (SC.4.E.6.1, case): reviewed-by-bot. stem no longer gives away the answer; "lava" and "magma" replaced with "melted rock" in options and feedback.
- **E6.1-05** (SC.4.E.6.1, case): reviewed-by-bot. two distractors made clearly wrong; "magma" replaced with "melted rock".
- **E6.1-06** (SC.4.E.6.1, case): reviewed-by-bot. diagram label on the layered sample; no wording change.
- **E6.1-07** (SC.4.E.6.1, case): reviewed-by-bot. "magma" and "squeezing" replaced with "melted rock" and "heat and pressure"; table rows match.
- **E6.1-08** (SC.4.E.6.1, case): reviewed-by-bot. stem no longer lists mineral makeup of granite (SSA limit); asks how the rock formed.
- **E6.1-09** (SC.4.E.6.1, cold): reviewed-by-bot. feedback uses "categories"; diagram labels describe the samples instead of giving the answer.
- **E6.1-10** (SC.4.E.6.1, cold): reviewed-by-bot. simpler wording ("flat layers", "shell bits"); feedback fixed ("heat and pressure", not "steam").
- **E6.1-11** (SC.4.E.6.1, cold): reviewed-by-bot. stem no longer names shale as the starting rock, so no rock cycle; feedback simplified.
- **E6.1-12** (SC.4.E.6.1, cold): reviewed-by-bot. descriptions use "melted rock" and "heat and pressure"; marble/limestone change removed (rock cycle).
- **E6.2-07** (SC.4.E.6.2, case): reviewed-by-bot. rewritten to ask what a fingernail scratch test shows (talc is softest of four), not to name a mineral from its properties (SSA limit).
- **E6.2-08** (SC.4.E.6.2, case): reviewed-by-bot. wording simplified ("show"); feedback and labels tidied. No Mohs numbers.
- **E6.2-09** (SC.4.E.6.2, case): reviewed-by-bot. rewritten: which note about calcite describes hardness. Vinegar fizz removed (chemical test, outside 6.2).
- **E6.2-10** (SC.4.E.6.2, case): reviewed-by-bot. rewritten: which property (cleavage) mica shows, instead of naming the mineral.
- **E6.2-11** (SC.4.E.6.2, cold): reviewed-by-bot. rewritten: which property (streak color) the tile test shows.
- **E6.2-12** (SC.4.E.6.2, cold): reviewed-by-bot. stem names pyrite and says "rough white tile"; asks for luster and streak.
- **E6.4-07** (SC.4.E.6.4, case): reviewed-by-bot. "pull ... deposit it offshore" simplified to "carry ... to a new place"; label on the stream slot.
- **E6.4-08** (SC.4.E.6.4, case): reviewed-by-bot. was chemical weathering (water dissolving limestone), outside SC.4.E.6.4 (physical only). Rewritten as erosion by gravity on a Florida sinkhole slope, with weathering and erosion reasons as options.
- **E6.4-09** (SC.4.E.6.4, case): reviewed-by-bot. options now name weathering or erosion with a reason; key is physical weathering by ice.
- **E6.4-10** (SC.4.E.6.4, case): reviewed-by-bot. key changed from a sidewalk (not rock) to roots cracking a limestone ledge.
- **E6.4-11** (SC.4.E.6.3, cold): reviewed-by-bot. retagged testedAs SC.4.E.6.3 (benchmark stays SC.4.E.6.4, which also assesses 6.3, same as E6.4-04); feedback simplified; four resource labels match the Florida map slots.
- **E6.4-12** (SC.4.E.6.4, cold): reviewed-by-bot. weak distractors ("freezing sand", "dissolving") replaced with a real weathering vs erosion mix-up.

### Benchmark labels

SC.4.E.6.1 "Three categories of rocks" and SC.4.E.6.2 "Minerals and rocks" match CPALMS (6.1 is the three rock categories, 6.2 is mineral properties and their role in forming rocks). They are not swapped. No change.

### Needs a teacher's judgment

- **E6.4-08**: rewritten from a dissolving sinkhole to soil sliding down a sinkhole slope. Confirm the sinkhole setting is fine without teaching dissolving.
- **E6.4-12**: the weathering-erosion diagram shows a cliff, a root and a stream, not dunes. Confirm the picture still helps, or drop the visual.
- **E6.2-07**: still tells students talc is the softest of the four minerals tested. Confirm this does not cross the "no identifying a specific mineral" limit.

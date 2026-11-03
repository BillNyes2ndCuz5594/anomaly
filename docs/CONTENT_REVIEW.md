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

## Pending teacher review (Unit 4 BEDROCK, Gemini build)

The following 24 items were added for Unit 4 (BEDROCK) and are pending teacher review:

- **E6.1-01** (SC.4.E.6.1, case): granite formed underground from cooled melted rock (igneous).
- **E6.1-02** (SC.4.E.6.1, case): coquina at Castillo de San Marcos from pressed shell layers (sedimentary).
- **E6.1-03** (SC.4.E.6.1, case): gneiss formed when heat and pressure squeeze granite (metamorphic).
- **E6.1-04** (SC.4.E.6.1, case): obsidian formed from quickly cooling volcanic lava (igneous).
- **E6.1-05** (SC.4.E.6.1, case): Florida limestone formed from ocean shell and skeleton layers (sedimentary).
- **E6.1-06** (SC.4.E.6.1, case): fossil fern imprints found in sedimentary rock layers.
- **E6.1-07** (SC.4.E.6.1, case): table matching Samples X, Y, and Z to igneous, sedimentary, and metamorphic categories.
- **E6.1-08** (SC.4.E.6.1, case): granite conditions requiring melted rock to cool and turn solid.
- **E6.1-09** (SC.4.E.6.1, cold): three main rock categories classified by formation (igneous, sedimentary, metamorphic).
- **E6.1-10** (SC.4.E.6.1, cold): rock near Florida spring showing sedimentary layers of pressed sand.
- **E6.1-11** (SC.4.E.6.1, cold): shale changed by intense heat and pressure into slate (metamorphic).
- **E6.1-12** (SC.4.E.6.1, cold): sorting table identifying igneous rock formed from slowly cooling magma.
- **E6.2-07** (SC.4.E.6.2, case): talc as softest mineral, easily scratched by a fingernail.
- **E6.2-08** (SC.4.E.6.2, case): quartz grains in Florida beach sand scratching glass (hardness test).
- **E6.2-09** (SC.4.E.6.2, case): calcite scratched by a penny and fizzing in vinegar.
- **E6.2-10** (SC.4.E.6.2, case): mica cleavage property peeling into thin, flexible sheets.
- **E6.2-11** (SC.4.E.6.2, cold): graphite dark grey streak, slippery feel, and use in pencil lead.
- **E6.2-12** (SC.4.E.6.2, cold): pyrite metallic luster and greenish black streak.
- **E6.4-07** (SC.4.E.6.4, case): hurricane waves pulling sand away from Florida beach as erosion.
- **E6.4-08** (SC.4.E.6.4, case): underground water dissolving limestone to form a Florida sinkhole (weathering).
- **E6.4-09** (SC.4.E.6.4, case): freezing water expanding in rock crack to break a boulder (physical weathering).
- **E6.4-10** (SC.4.E.6.4, case): tree roots cracking a sidewalk as weathering in place rather than erosion.
- **E6.4-11** (SC.4.E.6.4, cold): Florida phosphate rock as a nonrenewable mined natural resource.
- **E6.4-12** (SC.4.E.6.4, cold): winds moving beach sand to build dunes on a barrier island (erosion).


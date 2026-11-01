# S7: Content for every assessed benchmark

Written 2026-11-01 by the PM. Depends on S6 (`docs/tasks/S6-case-files.md`, the pack schema) and on
`docs/research/ssa-grade5-benchmarks.md` (the assessed benchmarks, their also-assesses groupings and content
limits). Read both before writing a single item. SPEC section 11 still rules: accuracy first.

Every item written in this stage is marked for teacher review. Nothing here ships to students until the teacher has
signed the review checklist (`docs/CONTENT_REVIEW.md`).

## 1. Case plan

Unit numbers after U03 are the PM's assumption about the year's order; the teacher renames `unit` and `unitLabel`
in the pack without touching ids. Case ids and benchmark groupings are final (report codes depend on nothing here,
but the hub order does).

| Case id | Codename | Unit | Category | Benchmarks (parent codes) | Evidence plan | Lab | Marker (lon, lat) |
|---|---|---|---|---|---|---|---|
| 00-1 | PROTOCOL | U00 Nature of Science | nature | SC.5.N.1.1, SC.5.N.2.1, SC.5.N.2.2 | 2, 2, 1 | sort: "Observation, opinion, or prediction?" (8 statement cards into 3 bins) | -82.46, 27.95 (Tampa) |
| 01-1 | ORBIT | U01 Space | earth | SC.5.E.5.1, SC.5.E.5.3, SC.4.E.5.4 | 1, 2, 2 | sort: solar system objects into Sun, planet, moon, asteroid or comet (8 cards, 4 bins: star, planet, moon, small body) | -80.60, 28.39 (Cape Canaveral) |
| 02-1 | FRONT | U02 Weather | earth | SC.5.E.7.1, SC.5.E.7.3 | 2, 3 | order: the water cycle from the ocean to rain (5 steps) | -80.19, 25.77 (Miami) |
| 02-2 | BEDROCK | U02 Weather (Earth structures) | earth | SC.4.E.6.2, SC.4.E.6.4 | 2, 3 | sort: weathering or erosion (8 event cards, 2 bins) | -84.28, 30.44 (Tallahassee) |
| 03-1 | VITALS | U03 Living Things | life | SC.5.L.14.1, SC.5.L.14.2 (existing, unchanged) | existing | vitals | existing |
| 04-1 | SOLVENT | U04 Matter | physical | SC.5.P.8.1, SC.5.P.8.3, SC.5.P.9.1 | 2, 2, 1 | match: a mixture to the way to separate it (5 pairs) | -81.38, 28.54 (Orlando) |
| 05-1 | CURRENT | U05 Energy | physical | SC.5.P.10.1, SC.5.P.10.2, SC.5.P.10.4 | 2, 1, 2 | match: a device to the energy change it makes (5 pairs, e.g. lamp: electrical to light and heat) | -81.66, 30.33 (Jacksonville) |
| 06-1 | TRACTION | U06 Forces and Motion | physical | SC.5.P.13.1 | 5 | sort: push, pull, gravity, friction or magnetic force (8 cards, 4 bins: push or pull, gravity, friction, magnetic) | -82.64, 27.77 (St. Petersburg) |
| 07-1 | CANOPY | U07 Plants and Life Cycles | life | SC.3.L.14.1, SC.4.L.16.4 | 3, 2 | order: the life cycle of a Florida butterfly (egg, caterpillar, chrysalis, adult) | -81.78, 26.64 (Fort Myers) |
| 07-2 | HABITAT | U07 Adaptations and Food Chains | life | SC.5.L.17.1, SC.4.L.17.3 | 3, 2 | order: energy from the Sun through a Florida food chain (Sun, sawgrass, grasshopper, frog, heron) | -80.80, 25.30 (Everglades) |

Per benchmark: 6 items, 4 in pool `case`, 2 in pool `cold`. SC.5.P.13.1 gets 8 (its grouping folds in speed and
unbalanced motion): 5 case, 3 cold. Total new items: 20 benchmarks x 6 plus 2 = 122.

Item id prefixes: `N1.1`, `N2.1`, `N2.2`, `E5.1`, `E5.3`, `E5.4`, `E6.2`, `E6.4`, `E7.1`, `E7.3`, `P8.1`, `P8.3`, `P9.1`,
`P10.1`, `P10.2`, `P10.4`, `P13.1`, `L14.1x` (plants: SC.3.L.14.1, the x avoids a clash with the human organs ids `L141-NN`),
`L16.4`, `L17.1`, `L17.3`. Format `<prefix>-NN` with NN from 01. Existing ids (`L141-01`, `E71-01`, `N14-01`...) never change.

## 2. Writing rules (all items)

- SSA format: one stem whose last sentence is a question, four options, one key, grade 5 reading level, short
  sentences, no em or en dashes, no "body system", "net force", "decomposer", and none of the words the research
  document lists as never used (constellation, waning, waxing, gibbous, radiant, electrons, hypothesis, transpiration,
  infiltration, percolation, Mohs, rock cycle, parallel, series, and the climate vs weather distinction).
- Stay inside the content limits for the benchmark. If a limit is UNVERIFIED in the research document, write the
  plainest, most conservative version of the item and say so in `tisCheck`.
- `benchmark` is the parent code from the case plan. `testedAs` is the code the item really measures: the parent, or
  one of its also-assesses codes when the item sits at grade 3 or 4 level.
- Key position per pool must stay under 40% at any position. Spread A, B, C, D evenly across each pack.
- Distractors are real misconceptions, named in `why`. The `why` for the key starts with "Correct:" and the
  others with "Decoy:". Each line is one sentence.
- `keyWords`: 2 to 4 phrases copied verbatim from the stem, the words a student should tag with RKEA.
- `alt`: what the visual shows, one sentence.
- `tisCheck`: the content limit you applied, one sentence. `misconceptions`: the misconception each decoy targets, one line.
- Temperatures as `37°C (99°F)`. Metric units.
- Common names only. Florida examples wherever natural (manatee, gopher tortoise, sawgrass, live oak, limestone,
  afternoon thunderstorms, the Gulf, the Atlantic).
- Visual: every item has one. Use `table` for data, `scene` with an id from section 4 for a picture, `specimen`
  with an existing specimen id (manatee, brown-pelican, gopher-tortoise, green-tree-frog, bull-shark, blue-crab,
  florida-panther, american-alligator, garden-spider, largemouth-bass, barred-owl, grasshopper, white-tailed-deer) for an
  animal, `organ` for a human organ, `plantanimal` for a plant vs animal structure. Reuse of the existing scene ids
  (`water-cycle`, `ocean-evaporation`, `solar-system`, `inner-outer-planets`, `comet-orbit`, `asteroid-belt`,
  `plant-pots`) is welcome.
- Briefing: 3 or 4 sentences in DISPATCH's dry voice (see the VITALS briefing), a concrete Florida scene, no puns,
  no praise. `dispatchHook` is one line. `debriefClosed` and `debriefOpen` are one sentence each, no shame language.
- Lab text: `intro` one or two sentences; bin `hint` is the one-line reason a card belongs there; card `why` is one
  sentence; `card` lines are facts the student can sort by (never the answer word itself).

## 3. Pack file

`src/content/packs/<caseId>.json`, shape `{ "case": CaseDef, "items": Item[], "codex": CodexEntry[] }` exactly as in
S6 section 2. Codex entries are optional (2 to 4 per pack: `id` `lab:<caseId>:<cardId>`, `title`, `line`). Run
`node scripts/check-pack.mjs src/content/packs/<caseId>.json` until it reports no problems. The S6 validator runs the
same rules through `npm test` once the pack is listed in `PACK_ORDER`.

## 4. Scene diagram ids for the new units

Each id is a vector SVG drawn in code (`SceneDiagram.tsx`) with its label slots in `diagramLabels.ts`. Labels are
filled from the item's `visual.labels` in the order given; an empty string hides a slot. Everything else about the
diagram (colours, Okabe-Ito accents, the 400x220 art space, the label floor) follows the existing seven.

| id | Shows | Label slots (in order) |
|---|---|---|
| `fair-test-plants` | Two identical pots and plants side by side; one on a sunny sill, one in shade; same water can beside each | left pot, right pot, what is the same |
| `bar-graph` | A bar chart with four bars of different heights on a grid, axis lines, no numbers | title, x axis, y axis, tallest bar |
| `lab-tools` | Ruler, balance, thermometer, graduated cylinder, hand lens laid on a bench | up to 5 tool names, left to right |
| `galaxy-spiral` | A spiral galaxy seen at an angle, a small arrow marking the Sun's place | galaxy, our Sun |
| `star-brightness-distance` | Two stars of the same drawn size, one near and bright, one far and faint, with a small Earth | near star, far star, Earth |
| `earth-day-night` | Earth with a lit half and a dark half, the Sun at the left, a rotation arrow | Sun, day side, night side |
| `moon-month` | Eight small Moon shapes in a row from new to full and back | first shape, middle shape, last shape |
| `sun-earth-moon` | Sun, Earth's orbit, Earth, the Moon's smaller orbit around Earth, with arrows | Sun, Earth, Moon |
| `weathering-erosion` | A cliff with a crack and a tree root splitting rock, and a stream carrying pebbles downhill | cracking rock, root, stream carrying rock |
| `mineral-streak` | A mineral sample dragged across a white tile leaving a coloured streak, a hand lens | mineral, streak plate, streak |
| `rock-types` | Three rock samples: layered (sedimentary), glassy with holes (igneous), banded and folded (metamorphic) | left, middle, right |
| `florida-resources` | A Florida outline with small icons: a well (water), a quarry (limestone and phosphate), a wind turbine, a solar panel | up to 4 icons |
| `weather-instruments` | Thermometer, barometer, wind vane with anemometer, rain gauge on a weather station post | up to 4 instruments |
| `climate-zones` | A globe with polar caps, temperate bands and a tropical belt | polar, temperate, tropical |
| `cloud-types` | Four cloud shapes at their heights: wispy high, puffy mid, flat grey low, a tall storm tower | up to 4 clouds |
| `florida-fronts` | A Florida outline with a cold front line and arrows coming from the northwest, a sun over the south | front, cooler air, warm air |
| `matter-three-states` | A block of ice, a glass of water, steam rising from a kettle | solid, liquid, gas |
| `mixture-separation` | A tray of mixed sand, iron filings and pebbles with a magnet above and a sieve beside | mixture, magnet, sieve |
| `dissolving-temperature` | Two glasses of water, one steaming and one with ice, a spoonful of sugar over each | warm water, cold water, sugar |
| `physical-chemical-change` | An ice cube melting on a plate next to a candle burning | melting ice, burning candle |
| `energy-forms` | Six small icons: a lamp, a flame, a speaker, a plug, a battery, a rolling ball | up to 6 forms |
| `light-path` | A flashlight beam hitting a mirror and bouncing, part passing into a glass of water and bending | flashlight, mirror, water |
| `circuit-open-closed` | Two circuits with a battery, wires and a bulb; one switch open (bulb dark), one closed (bulb lit) | open, closed, bulb |
| `conductor-insulator` | A circuit with a gap bridged by a metal spoon (bulb lit) and the same with a plastic spoon (bulb dark) | metal, plastic |
| `heat-flow` | A mug of hot cocoa with a metal spoon, arrows from the cocoa up the spoon to a hand | hot cocoa, spoon, hand |
| `static-balloon` | A balloon rubbed on hair, then stuck to a wall with small plus and minus marks | balloon, hair, wall |
| `forces-ramp` | A box on a ramp with a push arrow up the slope and a gravity arrow down, a rough patch marked | push, gravity, friction |
| `friction-surfaces` | The same toy car on a smooth tile track and on a carpet track, with a shorter travel on the carpet | smooth, rough |
| `falling-apple` | An apple falling from a tree with a downward arrow, a ball thrown up arcing back down | apple, ball, pull of gravity |
| `magnet-poles` | Two bar magnets facing N to S with attraction arrows, and two facing N to N pushing apart | attract, repel |
| `speed-graph` | A distance versus time line graph with two lines, a steep one and a shallow one | fast, slow, time |
| `plant-parts` | A flowering plant with roots, stem, leaves, flower and a fruit | up to 5 parts |
| `seed-to-plant` | A sequence: seed in soil, sprout, seedling, flowering plant, seed pod | up to 5 stages |
| `butterfly-cycle` | Egg on a leaf, caterpillar, chrysalis, adult butterfly, arranged in a ring with arrows | up to 4 stages |
| `grasshopper-cycle` | Egg, small nymph, larger nymph, adult grasshopper in a ring with arrows | up to 4 stages |
| `frog-cycle` | Eggs in water, tadpole, tadpole with legs, adult frog in a ring with arrows | up to 4 stages |
| `food-chain-florida` | Sun, sawgrass, grasshopper, frog, heron in a row with arrows | up to 5 links |
| `food-web-estuary` | A small web: sea grass and algae feeding a shrimp, a crab and a small fish, feeding a bass and a pelican | up to 6 names |
| `beak-shapes` | Three bird heads with a long thin beak, a hooked beak, a short cone beak, with the food each takes | up to 3 beaks |
| `seasons-florida-north` | Two trees: a live oak with leaves and a sun, a northern maple bare with snow | Florida, north |
| `environment-change` | A wetland half drained for a road, with birds on the wet side and a bulldozer on the dry side | wet side, dry side |
| `inherited-learned` | A dog with its puppy (same coat pattern) and the puppy learning to sit on command | coat, trick |

The diagram lane implements all of them on the art check page (`#/visuals`), and the proof's label checks apply.

## 5. Teacher review

Every new item is unreviewed until the teacher ticks it in `docs/CONTENT_REVIEW.md`. The review pass checks the
key, the decoy reasons, the content limit named in `tisCheck`, the reading level and the Florida examples. Items the
teacher rejects are fixed or dropped before the pack is listed in `PACK_ORDER` for students.

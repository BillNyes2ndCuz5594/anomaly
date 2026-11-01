# ANOMALY roadmap: a year of cases

Written 2026-11-01 by the PM with the owner. Where the game goes after S6 and S7 land: more cases per topic,
more kinds of lab, difficulty that climbs with the student, and reasons to come back every week until the SSA.
Each stage is sized for one agent session and ends with `npm test`, `npm run build`, proof green and a teacher
review of any new content. Stages are ordered by payoff for students, not by effort.

## Where we stand after S7

- 10 cases (one per unit, two for Earth and two for Life), 23 assessed benchmarks all covered, 157 items
  (35 original plus 122 new), 4 lab mechanics (VITALS's three bespoke labs plus sort, match, order), 49 scene
  diagrams, 13 specimen scans, a cold case drawing from a 46-item spaced-review pool.
- Not yet used by the game: the `complexity` field on every item. The pickers ignore it, so every student gets
  the same mix. That is the first lever below.

## What makes it fun and hard enough (the design rules for every stage)

1. **Nothing repeats within a week.** A student should not see the same item twice in five school days unless it
   is due for review. Pools per benchmark must stay above 12 items for that to hold with 5-item cases.
2. **Difficulty follows mastery, not the calendar.** Rookie gets low and moderate items; Field-Ready gets
   moderate; Expert and Ace get moderate and high, with at least one high item per case. Nobody is shown a high
   item on a benchmark they have never answered.
3. **Every case has hands.** No new case ships without a lab, and no unit uses the same lab mechanic twice in a
   row. The lab is the memory hook; the items are the test.
4. **Progress is visible and never lost.** Rank, mastery pips, drone paint, codex count, closed-case stamps. A
   miss schedules a review, it never takes anything away.
5. **The teacher sees everything first.** New items stay behind the review checklist. Teacher HQ shows which
   benchmarks the class has not touched, so the teacher can point students at them.

## Stages

### S8 Adaptive evidence (engine, S)
- `pickEvidence` and `pickReview` take the benchmark's mastery stage and pick by `complexity` per rule 2. A
  student's second case on a unit is harder than the first without a word changing.
- "Pressure item": once a benchmark is Expert, one item per case is drawn from the cold pool of another unit
  (interleaving), marked with a small "Cross-check" tag in the HUD.
- Results screen shows the mix ("3 moderate, 2 high") so students notice the climb.
- Tests: deterministic picks per stage from a fixture pool; no item twice in 5 school days when the pool allows.

### S9 Second case per unit (content, M, one lane per category)
Ten more cases, each with a different lab mechanic from its unit's first case, and 6 more items per benchmark
(so every parent benchmark holds 12 or more). Working titles, codenames and lab ideas:

| Case | Codename | Unit | Lab | Scenario seed |
|---|---|---|---|---|
| 00-2 | VERDICT | Nature of Science | match: a claim to the evidence that supports it | A hurricane-shutter test at a Port St. Lucie hardware store |
| 01-2 | ECLIPSE | Space | order: a day on Earth from sunrise to the next sunrise, then a month of Moon shapes | A night at the Kennedy Space Center visitor lot |
| 02-3 | SQUALL | Weather | sort: readings into "storm coming" and "fair weather" | The afternoon storm line over the Treasure Coast |
| 02-4 | SINKHOLE | Earth structures | match: a Florida resource to its use | A sinkhole opens near Ocala |
| 03-2 | PULSE | Living Things | sort: a job card to the organ that does it (second organ set: sense organs, kidneys, bladder, pancreas) | A triage tent at a Fort Pierce fun run |
| 04-2 | FREEZER | Matter | order: ice to steam, naming the state at each step | A cold-storage failure at a Vero Beach citrus packer |
| 05-2 | BLACKOUT | Energy | sort: energy change cards to "light, heat, sound, motion" | A storm blackout along the St. Johns River |
| 06-2 | LAUNCH | Forces and motion | match: a force to what it does to a moving cart | A soap-box derby in Lakeland |
| 07-3 | BLOOM | Plants and life cycles | match: a plant part to its job, then a second round for life cycle stages | Mangrove seedlings at Pepper Park |
| 07-4 | TIDEPOOL | Adaptations and food chains | sort: adaptations into body part, behavior, life cycle | A sea turtle nest count on Hutchinson Island |

Each lane writes to the S7 rules, runs `check-pack.mjs`, and lands behind the review checklist.

### S10 New lab mechanics (engine and 3D, M each, pick two per quarter)
- **Measure**: read a 3D instrument (thermometer, balance, graduated cylinder, rain gauge) and enter the value with
  a dial (no typing). Nature of Science, Matter, Weather.
- **Fair test**: set up two pots or two ramps, change exactly one thing, run it, read the result. Nature of
  Science, Forces.
- **Trace**: draw the arrows of a food web or a circuit by tapping nodes in order; wrong arrows snap back. Life,
  Energy.
- **Scan**: the cold case's evidence scan grows up: rotate a specimen or rock, tap the feature the card names.
  Earth structures, Living Things.
Each mechanic ships with a list fallback, keyboard play and a proof walk, and at least one case uses it the
quarter it lands.

### S11 The long game (engine, M)
- **Weekly dispatch**: the hub highlights two cases each school week (one new, one review), seeded from the
  class code so the whole class sees the same pair. Everything else stays open.
- **Case files**: a collection screen listing every closed case with its stamp date and the student's best
  score; re-running a closed case picks unseen items only.
- **Agent rank ladder**: today's rank from mastery fraction, plus named tiers with a short DISPATCH line on each
  promotion, and the drone gets a new part (not just a paint) at Field-Ready across half the benchmarks.
- **Mock SSA**: a 48-item cold case ("FULL SWEEP") that mirrors the real blueprint (17 / 29 / 29 / 25 percent),
  available from the hub once every benchmark is at least Rookie; the report code records it as a separate
  attempt so Teacher HQ can show it.

### S12 Teacher loop (Teacher HQ, S)
- Coverage view: benchmarks the class has not opened, by unit, with the case that teaches each.
- Class targets: the teacher pastes a short "target code" into the hub (no accounts): it sets the two weekly
  dispatch cases and an optional due date, shown on the hub as a DISPATCH note.
- Item report: per item, how many students missed it and which decoy they chose; the first pass at finding
  items that are wrong rather than hard.

### S13 Content refresh waves (content, ongoing)
A wave every unit: 3 or 4 new items per benchmark in the unit being taught, written against the misconceptions
the Teacher HQ item report surfaces. Old items never leave the catalog (report codes depend on it), but a wave
can retire an item from the pools by setting `pool: "retired"`.

## Order and cadence

| When | Stage | Why then |
|---|---|---|
| Now (S6, S7 landing) | 10 cases, every benchmark covered | Students can play every unit this year |
| Next session | S8 adaptive evidence | Biggest difficulty win for the least code |
| Before the next unit starts | S9 lanes for the units already taught (U00 to U03) | Review material for cold cases |
| Each new unit | S9 lane for that unit, one S10 mechanic, S13 wave | Fresh lab plus fresh items when the class reaches the unit |
| January | S11 weekly dispatch and case files | Keeps the hub alive in the long middle of the year |
| February | S11 mock SSA, S12 coverage view | Test prep window |
| March | S13 waves on the weakest benchmarks from Teacher HQ | Target what the class is actually missing |

## Numbers to keep an eye on

| Measure | Now | Target by March |
|---|---|---|
| Items per parent benchmark | 6 (VITALS 10, 7) | 15 or more |
| Lab mechanics | 6 (3 VITALS plus 3 generic) | 10 |
| Cases | 10 | 20 |
| Distinct scene diagrams | 49 | 70 |
| Share of high-complexity items | about 25% of new packs | 30% |
| Time to a full class read in Teacher HQ | one paste | one paste plus coverage view |

# ANOMALY teacher guide

ANOMALY is a browser game that reviews the Grade 5 Florida Statewide Science Assessment (SSA). Students play
field agents: a short briefing, a hands-on 3D lab, then three to five SSA-style questions answered with RKEA
(Read, Key words, Eliminate, Answer), a debrief that explains every option, and a mastery update. Benchmarks come
back as cold cases on a spaced schedule (1, 3, 7, 14 school days).

No accounts, no names, no network. Progress lives in the browser of the laptop a student used, and travels between
laptops as a short report code.

## 1. Addresses

- Game: the GitHub Pages address of this repository (`https://<owner>.github.io/anomaly/`). It installs as an app
  from the browser menu ("Install" or "Add to Home screen") and then works offline after the first load.
- Teacher HQ: the same address plus `teacher.html`. It never loads the 3D engine and never uploads anything.

The game runs in Chrome, Edge, Firefox and Safari released in the last two years. Old laptops fall back from WebGPU to
WebGL2 automatically; Settings has a Graphics quality switch (Auto picks a tier from the frame rate) and a Reduced
motion switch.

## 2. First day: check in

1. Student opens the game and presses **Start shift**.
2. The first-run card asks for a **class code** (letters and digits, up to 8, use your period or class name, the
   same for everyone in the class) and the student's **agent number** (their roster number, 1 to 40).
3. The game makes a codename from those two values (for example AGENT KESTREL-14). Nothing else is ever entered.

Write the class code on the board. A student who mistypes it gets a different codename; they can fix it by clearing
the browser's site data (or by resuming with a report code, section 5) and checking in again.

## 3. A shift (10 to 15 minutes)

Hub: the map shows one amber marker per case and a cyan cold case marker. The side panel lists Dispatch (the
cases, with New, Open or Closed), the report code button, and benchmark mastery grouped by reporting category.

A case runs: Briefing (read aloud button) -> Field Lab -> Evidence (the questions) -> Debrief -> Results.

RKEA in the Evidence step:

- **Read**: the read-aloud button reads the stem and the options. A picture or table comes with every question.
- **Key words**: students tap words in the stem. Real key words earn Intel and get a bracket mark; other words get a
  plain underline and no penalty.
- **Eliminate**: the X button (or the X key, then 1 to 4) strikes an option and shows the decoy reason. Striking the
  right answer is refused with "Careful. Check that one again." and counts as a hint used.
- **Answer**: Lock in. Keyboard: 1 to 4 or A to D select, Space reads aloud, Enter locks in.

Scoring rewards accuracy and correct eliminations. There are no timers and no speed points. Debrief shows every
option with its reason. 80% or better stamps CASE CLOSED; otherwise the case stays open and comes back as a cold
case. Mastery per benchmark rises only with correct answers on separate days, so one lucky run cannot reach Ace.

## 4. Cold cases

After a benchmark is seen, the game schedules it for review after 1, 3, 7 and 14 school days (weekends are
skipped). A miss resets to the 1-day gap. When anything is due the cold case marker glows and the Dispatch list
says "Review due". A cold case is four questions chosen from the due benchmarks first, then unseen ones, spread
across the reporting categories. It is always available, even with nothing due, so it works as a warm-up.

## 5. Report codes

The hub's report panel shows the student's **report code** (groups of four letters and digits with a checksum).
It encodes the class code, the agent number, the date, each benchmark's attempts, correct answers and mastery
stage, and the last 20 item results. It holds no name.

Classroom routine: at the end of the shift every student copies the code (Copy button) and pastes it into a Canvas
text assignment. You read the whole class in Teacher HQ (section 6).

Resume: the same code restores progress on another laptop. On the title screen press **Resume with code**, paste
the code, confirm. Progress merges and never goes down, so resuming twice is harmless. The code is a snapshot: tell
students to paste a fresh one after each shift.

## 6. Teacher HQ

Open `teacher.html`. Paste codes one per line, or drop the CSV or text export of the Canvas assignment on the page
(it extracts anything that looks like a code and ignores the rest). Then **Decode**. Everything happens in your
browser; nothing is sent anywhere.

You get:

- Students decoded, average mastery, how many need reteach.
- **Benchmark by agent** heat map (colour-blind safe scale plus the number in each cell), sortable, with a
  "Only reteach" filter. Copy as TSV or CSV for your gradebook, download CSV, or print.
- **Reporting categories** bars (Nature of Science, Earth and Space, Physical, Life).
- **Weakest 5 benchmarks** and **Most missed items** (with the item stem, so you know what to reteach).

**Load sample class** fills the page with 24 made-up agents to try it out.

Report codes from an older build still decode in a newer Teacher HQ. A code from a newer build than the HQ page
says so instead of guessing.

## 7. Settings students may change

Reading: text size (three steps), line spacing, read-aloud voice and rate. Display: graphics quality, reduced
motion, show FPS. Sound: on by default at a modest volume, with a switch and a slider. Sound never carries
information, so a muted lab is a complete lab.

URL switches you may use on a projector: `?mute=1` (no sound), `?tier=low` (fastest graphics), `?debug=1` (frame
rate readout).

## 8. Accessibility

Read-aloud on every screen, text size and spacing controls, a picture with alt text on every question, right and
wrong always shown by icon plus word (never colour alone), no timers, full keyboard play (Tab to targets, Enter to
choose), visible focus outlines, and a plain list version of every 3D interaction (the lab's buttons are the list).

## 9. Content review

New cases ship marked "teacher review pending" until you sign them off. `docs/CONTENT_REVIEW.md` is the
checklist, and `node scripts/review-sheet.mjs` prints every item of a pack as a table (stem, options, key, the
content limit applied, the misconceptions targeted) for a fast read. Fix text in the pack JSON under
`src/content/packs/`; `npm test` checks the schema, the key balance and the banned words.

## 10. If something goes wrong

- Blank or black 3D area: Settings -> Graphics quality -> Low, or add `?tier=low` to the address. Reload.
- The game feels slow: same switch; Auto also steps down on its own after a few seconds under 45 fps.
- A student lost progress: paste their last report code with Resume with code.
- The report code does not decode: check for a missing character; the two-character checksum catches typos and
  says so.
- Read aloud is silent: the laptop has no speech voices installed, or sound is muted at the OS level. The text is
  still on screen.

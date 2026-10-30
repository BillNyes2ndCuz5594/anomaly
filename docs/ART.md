# ANOMALY art direction and asset pipeline

## Style bible

The game is a field lab at night: dark navy glass, cyan instrument light, and real Florida animals and plants that
look like museum specimens under that light. The goal is that nothing reads as generic AI art.

Palette
- Base: deep navy `#030814` to `#0b1a2e`. Panels are glass on top of it, never flat grey.
- Instrument cyan `#3ee6ff` for UI, holograms, rims and pedestal rings. Warm amber `#ffb347` only for alerts and
  progress, never as a fill.
- Specimens keep their real, natural colors (panther tawny, crab blue, gator olive black). No neon recoloring, no
  oversaturated "AI" skin, no glossy plastic look.

Light
- Soft key from upper front, cool sky fill from above, thin cyan rim from behind. Shadows stay soft and never pure
  black. The same rig lights scans and procedural models (`litHero` and `litSpecimen` in `src/three/materials/tinted.ts`).

Type
- UI keeps the existing mono display face for labels and the reading face for stems and answers (see `docs/FONTS.md`).
  No text is ever baked into generated art.

Rules for generated art
- Reference images are neutral studio photos (even light, plain light grey ground, whole subject in frame) so the 3D
  scan picks up true color, not a dramatic baked light.
- No watermarks, borders, logos, text, lens flares, bokeh glitter, or heavy depth of field.
- Every asset ships optimized: GLB with meshopt geometry and a 1024 WebP texture (about 200 to 350 KB each), images
  as WebP or AVIF, video as short WebM plus MP4 with a poster frame.
- Low tier phones always keep the lightweight procedural or static version.

Rules for video clips
- Loops must be seamless: matched first and last frames or a built in crossfade. No pops, black frames, or cuts.
- Clips are composited into the scene (soft masked edges, behind or within UI glass), never dropped in as boxes.
- Every clip has a poster frame that is shown until the first frame decodes, plays `autoplay muted playsinline loop`,
  and falls back to the poster on Low tier and under reduced motion.

## Pipeline

1. Reference image: `fal-ai/flux-pro/v1.1` (about $0.04 each), 2 variants per subject, pick the best.
2. Image to 3D: `fal-ai/hunyuan3d-v3/image-to-3d` with a 40k face budget (about $0.525 each).
3. Optimize: `gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024 --simplify true
   --simplify-ratio 0.45 --simplify-error 0.0008`.
4. Ship under `src/assets/specimens/<specimen-id>.glb` and register it in `src/three/models/heroSpecimens.ts`
   (yaw and tilt so the head points +x and the animal stands on y = 0). Medium tier and up show the scan; Low tier
   keeps the procedural model, which is also the fallback if a scan fails to load.
5. Every fal call is logged with its cost in `harness/fal-ledger.txt` (workspace side). Total fal cap: $40.

## Asset inventory (ranked: most "cheap or AI looking" times most visible first)

| Rank | Asset | Where it shows | Status |
| --- | --- | --- | --- |
| 1 | Florida panther | Evidence item, art check | Wave 1 scan, replaced in wave 6 (plain tawny coat, tail hanging low) |
| 2 | Blue crab | Evidence items, Lab C | Wave 1: scan shipped; wave 8: rescanned from a low front photo |
| 3 | American alligator | Evidence item | Wave 1: scan shipped |
| 4 | Garden spider | Evidence item | Wave 1 scan, replaced in wave 2 by a top-down scan standing on its legs, and in wave 7 by a scan from a low front photo |
| 5 | Title and hub backdrop | First screen every session | Wave 3: shipped, swamp loop painted into the sky dome; wave 10: redone with Veo 3.1 at 960x540 |
| 6 | Pelican, tortoise, frog, shark, bass, owl, grasshopper | Lab C, Briefing, items | Wave 2 scans; wave 6 rescans the bass, pelican, frog, owl, tortoise and grasshopper |
| 6b | Manatee | Lab C close-up, items | Wave 5a: rescanned (wave 2 scan had a forked tail and an ear dot); wave 7: rescanned lying level, no tusk |
| 7 | Lab ambience (Briefing, Lab A, B, C backdrops) | Labs | Wave 3: shipped, swamp, cells, canopy and water loops; wave 10: all four redone |
| 8 | Plants and organ models | Lab A, Lab B | Wave 4b: organ scans (brain, heart, lungs, liver, stomach, pancreas, large intestine, kidneys) and live oak sprig and acorn scans shipped; wave 5a adds bladder, small intestine, eyes, ears, nose and tongue; wave 5c adds the scanned deer skin and oak trunk |
| 8b | Lab A human body | Lab A, Briefing | Wave 5a: scanned body shell and muscle layer replace the sculpted mannequin on Medium and up |
| 8c | Scene diagrams (water cycle, coast, planets, comet, plant pots) | Evidence items, art check | Wave 5b: NASA photos of the Sun and planets, a painted coast plate, cloud and seedling pot on Medium and up; Low keeps the vector art |
| 9 | App icons and share art | Install, share | Wave 4: shipped, rendered in house with no fal spend |

## Wave plan

- Wave 1: panther, crab, alligator, spider scans in the item player and art check.
- Wave 2: 7 more animals plus a new spider scan. Every scan is now sized to the procedural model's mean silhouette
  area, so it fills the pedestal ring the same way, capped at the procedural length, 1.05x its height and 1.4x its
  width so it never leaves the camera framing. Manatee waits for S14.
- Wave 3: four 4.2 s loops (swamp, cells, canopy, water), each animated from one still with matched first and last frames plus
  a 0.8 s crossfade at the seam, 960x540 VP9 WebM plus H.264 MP4, 17 to 83 KB. They are painted into the sky dome
  shader (`LoopSky`) as a soft window above the horizon, graded to the navy and cyan palette, never a box. The
  precached WebP poster shows first and the video crosses in after its first decoded frame. Low tier and reduced
  motion get the poster only. Videos are not precached, so offline play keeps the poster. Spend $1.84.
- Wave 4a: app icons, favicon and a 1200x630 share image. The icons are drawn by `scripts/gen-icons.mjs` in the
  title screen look (glass cyan letter, amber scan line, grid floor); the share image is a frame of the real title
  screen. No fal spend.
- Wave 4b: shipped. FLUX reference photos turned into Hunyuan3D scans, then baked offline to plain meshes with the scan light and dark kept as vertex shade (no textures). Each organ scan is fitted to the box of the procedural organ it replaces, so framing, picking and the highlight states stay put. The two kidneys come from one scan, mirrored. The Lab B oak wears scanned leaf sprigs on every leaf cluster and scanned acorns on the acorn spots. Low tier and any load failure keep the procedural parts. Packs: src/assets/scans/organ-scans.glb and oak-scans.glb (meshopt). Spend about $6.9.
- Wave 5a: the Lab A human. A scanned body (one FLUX front photo into Hunyuan3D, 16k triangles) is warped offline
  to the sculpted figure's landmarks (crotch, shoulders, neck, nose tip) and build, so every organ still sits inside
  it, then ships as `src/assets/scans/body-scan.glb` with a slightly inset copy without head and hands for the muscle
  layer. Eyes, ears, nose, tongue, bladder and small intestine are scanned and baked like wave 4b (eyes and ears as
  mirrored pairs; the ears sit on the scanned body's own ears). The manatee is rescanned. Low tier keeps the
  procedural hologram and face, which also has a straighter nose and a shaped tongue now. Spend about $5.85.
- Wave 5b: the scene diagrams. Medium tier and up paint real imagery under the live text labels (still laid out by
  diagramText.ts, so they scale and never overlap): NASA photos of the Sun and planets cut to discs and shaded from
  the Sun's side, one FLUX gouache coast plate (ocean, beach, lake, river, glacier) shared by the water cycle and
  evaporation scenes, a painted cumulus cloud and a painted seedling pot. No cartoon sun rays; the comet gets a soft
  coma with a curved dust tail and a straight blue ion tail; asteroids are lumpy rocks, not dots. The Low tier keeps
  the flat vector diagrams, and the vector shape sits under each photo so a failed image load still shows a planet.
  Also fixed: the nose uses the scanned face's own nose only while the scanned body is showing (on the sculpted face,
  for Low tier or when body-scan.glb fails to load, it is fitted to the sculpted nose), and the tongue sits just behind
  the lips of whichever face is showing instead of deep in the throat, so neither slides off the face as the figure
  turns. Spend $0.24 (six FLUX stills).
- Wave 5c: the Lab B deer and oak. A white-tailed deer and a live oak trunk, each one FLUX side photo into Hunyuan3D,
  baked offline to plain vertex-shaded meshes in labb-scans.glb (meshopt, 226 KB). The deer scan (18k triangles) is
  warped onto the procedural deer's landmarks (hooves, knees, hocks, spine, neck, head, tail) and eased outward
  wherever a bone came through, so the skeleton layer still sits inside the skin. The trunk scan (31k triangles) is
  cut below its fork, fitted to the bark trunk's height and radii with its root buttresses kept, and smoothed; the
  procedural limb sleeves grow out of its top so the bark still covers the stem and its branches. Picking, framing
  and the highlight states are unchanged. Low tier and any load failure keep the procedural skin and bark. Spend
  $1.29 (six FLUX references, two scans).
- Wave 6: rescans of the seven scans that still read as AI made. New references are FLUX 1.1 Ultra in raw mode (real
  camera look, no studio gloss), three per animal, and the best one went to Hunyuan3D at 40k faces with PBR. The panther
  reference is a nano-banana edit of the best FLUX still (plain tawny coat with no blotches, tail hanging low). The owl
  scan came with its perch, cut off offline. The frog scan's eyes had a cross shaped pupil, so its texture was repainted
  from 3D position (gold-bronze iris, dark horizontal pupil, UV gutters padded) and the eyeballs rounded. The bass, which
  faced left, is turned to face right, and the frog shows in profile. The tortoise now has scaly, clawed front legs. Same
  sizing and framing rules as wave 2; Low tier keeps the procedural models. Files are 196 to 544 KB (pelican, 23k
  triangles, is the largest). Spend $5.24 (21 FLUX Ultra references, two edits, seven scans).
- Wave 7: the manatee and the garden spider. The wave 5a manatee stood up on its flippers like a seal, so it is
  rescanned from a FLUX 1.1 Ultra raw photo of a manatee lying level; FLUX kept drawing walrus tusks and a pointed tail,
  so a nano-banana edit took the tusk out and gave it the round paddle tail. The spider was rescanned twice: a top-down
  photo scanned with its back legs in the air, so the shipped scan comes from a low front photo with every leg on the
  ground (black and yellow abdomen, banded legs) and no longer needs the tilt. Same sizing and framing rules; Low tier
  keeps the procedural models. Spend $2.80 (eight FLUX Ultra references, two edits, three scans).
- Wave 8: the blue crab. The wave 1 crab was saturated and toy-like, so it is rescanned from a FLUX 1.1 Ultra raw photo
  taken low from the front (olive carapace, blue legs, pale claws with orange tips) and turned 45 degrees so the claws and
  shell both show. A high-angle photo scanned with tall, spidery legs (the same failure as the top-down spider) and was
  dropped, and a nano-banana edit that painted the claws blue looked flat, so it was not scanned. Three bull shark
  references all drew pointed snouts, so the current shark stays. Low tier keeps the procedural crab. Spend $2.04 (six
  FLUX Ultra references, three high-angle references, one edit, two scans).
- Wave 9: the gopher tortoise and green tree frog. The wave 6 tortoise came out as a sulcata (spiky legs, tall pale
  shell) and the wave 6 frog looked like glossy plastic with no side stripe. Both are rescanned from nano-banana-pro
  references: a low, dark grey-brown tortoise with a domed carapace and scaly shovel forelegs, and a matte green frog
  with the cream stripe along its side and wide toe pads. FLUX Ultra references were also drawn for both and rejected
  (the tortoise was the wrong species again and the frog stripe was missing). Low tier keeps the procedural models.
  Spend $2.07 (four nano-banana-pro and two FLUX Ultra references, two scans).
- Wave 10: the four loops are redone at higher quality. The old cells loop was bokeh glitter with heavy depth of field,
  against the rules above. Each still is FLUX 3 (`blackforestlabs/flux-3/text-to-image`, 1.5k, 2048x1152, about
  $0.11) with an art directed prompt (navy #030814 to #0b1a2e, cyan rim light, low key, even focus, no bokeh, no
  text, brightest band in the middle third so the dome window reads). Each loop is Veo 3.1 first and last frame
  (`fal-ai/veo3.1/first-last-frame-to-video`, 4 s, 1080p, no audio, $0.80) with the same still as both frames and a
  locked camera prompt, so only fog, moss, membranes or caustics move. The encode trims to 3.2 s with a 0.8 s seam
  crossfade, light denoise and a per clip grade, 960x540 VP9 plus H.264, 100 to 480 KB, and a
  960x540 WebP poster from the first loop frame. Seams measure under 0.1 of 255 mean difference (water matches its
  own frame to frame caustic motion). A 1280x720 encode was tried first and dropped: decoding it slowed the next
  item's 3D compile enough to blank the evidence glide on SwiftShader. Spend $3.64.

### Photo credits (wave 5b, all public domain, NASA)

Files in `src/assets/diagrams/`, cut and graded from these Wikimedia Commons originals:

- sun.webp: SDO HMI continuum, 2024-08-10 (NASA SDO). https://commons.wikimedia.org/wiki/File:SDO_20240810_000000_4096_HMIIC_(HMI).jpg
- mercury.webp: Mercury in true color (NASA MESSENGER). https://commons.wikimedia.org/wiki/File:Mercury_in_true_color.jpg
- venus.webp: PIA23791, Mariner 10 reprocessed (NASA JPL). https://commons.wikimedia.org/wiki/File:PIA23791-Venus-NewlyProcessedView-20200608_(cropped).jpg
- earth.webp: The Earth seen from Apollo 17 (NASA). https://commons.wikimedia.org/wiki/File:The_Earth_seen_from_Apollo_17.jpg
- mars.webp: Valles Marineris (NASA Viking). https://commons.wikimedia.org/wiki/File:Mars_Valles_Marineris.jpeg
- jupiter.webp: Jupiter by Cassini-Huygens (NASA JPL). https://commons.wikimedia.org/wiki/File:Jupiter_by_Cassini-Huygens.jpg
- saturn.webp: Saturn from Cassini Orbiter, 2004-10-06 (NASA JPL). https://commons.wikimedia.org/wiki/File:Saturn_from_Cassini_Orbiter_(2004-10-06).jpg
- uranus.webp: Uranus2 (NASA Voyager 2). https://commons.wikimedia.org/wiki/File:Uranus2.jpg
- neptune.webp: Neptune Full (NASA Voyager 2). https://commons.wikimedia.org/wiki/File:Neptune_Full.jpg

coast.webp, cloud.webp and pot.webp are FLUX stills made for this project (wave 5b).

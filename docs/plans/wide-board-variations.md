# Variations for wide boards

Status: planned, nothing generated (as of 2026-10-09). Start with the pilot.

## Goal

Ambient scene variations (a lantern is lit, a small mechanism appears) play
during exercises on phone and tablet boards and not on wide boards, which is
what a laptop or desktop shows and where they are easiest to see. This work
generates a second set of variations drawn directly on each scene's **wide**
picture: about 950 in all, 50 per scene.

The phone and tablet set stays as it is. The wide picture, the compact picture
and the 950 existing variations do not change.

## Why a second set, and not the first one reused

Settled on 2026-10-09 after a visual check; do not reopen without new evidence.

- The wide picture of a scene is the same place, not the same pixels. The
  compact scene sits inside it at 0.59× to 0.91× of its own size, off-centre,
  and in about eight scenes rotated or recomposed.
- Cutting the existing variations out and placing them on the wide picture was
  tried on all 50 variations of Mode Lantern Grounds and Meridian Engine.
  Anton reviewed both at full size: almost all integrate badly.
- Cropping the wide picture for phones, so that one set could serve both, was
  reviewed for all 19 scenes and rejected: the framing is off.
- Showing the compact picture on wide boards was rejected earlier: the wide
  pictures were made precisely to avoid that.

## What exists

- **Pictures.** `assets/worlds/<world>/scenes/<scene>/wide/base.webp`, 19
  scenes. Fifteen are 2752×1536. Four older Moonroot scenes (Grammar Gate
  Court, Mode Lantern Grounds, Scribe's Spring, Wayfinder Crossroads) are
  1280×720. A lossless source for each is at
  `artifacts/world-generation/unit-scenes/<unit>/wide-source.png`; confirm it
  matches the shipped picture before using it as the edit input.
- **Scenes in use.** Seventeen scenes belong to units and Mosslight Landing is
  the reference board. Open Trail Overlook is a reserve that the app does not
  show; generate it last, or leave it out if Anton says so.
- **The runner.** `scripts/world-art/board_edits.py` stages candidates from a
  scene config (sites, bounds, one change per candidate), sends each to
  `gemini-3.1-flash-image` on Vertex with the board and a locator crop, keeps a
  ledger and an approval manifest, and stages replacement rounds. It is
  hard-wired to the compact picture: the prompt says 4:3, the request asks for
  `aspect_ratio="4:3"`, the output check expects 4:3, and its records live in
  `artifacts/world-generation/patch-reviews/<scene>/round-NN/`.
- **Patch extraction.** `extract_patch` in
  `scripts/world-art/integrate_board_edit_patches.py` turns a generated board
  into a transparent patch holding only what changed.
- **Existing ideas.** Every existing variation's change is in the
  `transformation` field of the approval manifests under
  `artifacts/world-generation/patch-reviews/`, and the idea lists are in
  `scripts/world-art/prepare_board_edit_inventories.py`,
  `scripts/world-art/prepare_board_edit_runs.py` and
  `scripts/world-art/patch-inventories/`.
- **Cost so far.** The ledgers record $0.0682 per request at 1K. The existing
  950 took 972 requests, $66.29.

## Two things the first set got wrong

Both are the reason this brief spends most of its length on sites and ideas.

1. **Places were not chosen by looking.** Ten scenes used the same grid of ten
   positions (`bounds()` in `prepare_board_edit_inventories.py`) with generic
   descriptions such as "the small supported feature on the upper-left
   terrace". Whatever happened to be there was replaced.
2. **Objects repeated.** The same list of 50 objects was used, in the same
   order, in all ten of those scenes: a "suspended glass astrolabe" at the
   first site of each, and so on. Five hundred variations came from fifty
   ideas.

## Choosing places

Do this per scene, looking at the wide picture itself. Do not carry the
compact bounds over; the old inventories say the same.

- **About ten sites per scene, five variations each.** Fewer sites with more
  variations, or more sites with fewer, is fine where a scene calls for it, as
  long as the scene ends near 50.
- **Use the whole width.** On a wide board the old sites bunch up where the
  compact scene sits: across Meridian Engine they span 20% to 60% of the
  width, across Mode Lantern Grounds 31% to 72%. Place sites in the outer
  thirds too, including the parts that exist only on the wide picture.
- **Stay visible.** On a 1280×900 desktop the editor covers a strip at the top
  centre of the board, about 31–69% across and 7–17% down
  (`artifacts/world-generation/layout-masks/metrics.json`, profile `wide`).
  Keep sites out of it, and out of where the guide character stands. Re-measure
  if the layout has changed since.
- **A site is a real thing in the picture.** Name the object or surface that
  is actually there and what supports the change: a ledge, a rail, a bank, a
  niche, a stretch of water. No floating objects.
- **Leave the scene's landmark alone.** Each scene has one authored landmark
  that carries the unit's idea (the mode lantern, the engine's junction). It
  is protected, as before.
- **Vary depth and size.** Mix foreground, middle distance and far background.
  A change must read when the whole board is about 1040 CSS pixels wide, so a
  site smaller than roughly 5% of the board's width is too small.
- **No two sites overlapping**, and none close enough that their glows or
  shadows would touch.

Write the sites to a per-scene config in the form `board_edits.py` reads, with
bounds normalized to the wide picture, and draw one sheet per scene showing the
numbered site boxes over the wide picture with the editor strip marked.

## Choosing what changes

One ledger covers the whole set: every idea, its scene, its site, and its
family (lantern, bell, clockwork, plant, water, glass, creature, weather, and
so on). Check each rule below against that ledger by script, not by eye.

- **No idea appears twice in the new set.** Not across scenes, not within one.
- **Variety inside a scene.** The five variations at one site are five
  different families. Across a scene no family supplies more than about six of
  the fifty.
- **Variety across scenes.** A scene's ideas come from its own place: what its
  world is made of (`docs/art-direction.md`) and what its unit teaches.
  Neighbouring scenes in the same world should not read as one prop list.
- **Old ideas are a source, not a template.** An idea from the existing set
  may be used again, in at most one scene of the new set and preferably not
  the scene it came from. Most of the new set should be new.
- **Not only "replace it with an object".** Mix kinds of change: something
  arrives, something is lit or goes dark, something opens or closes, something
  grows or blooms, water rises or stills, a mechanism turns to a new position.
  A change of state at a real object in the picture often integrates better
  than a new prop.
- **Small creatures are allowed, sparingly.** No people and no characters.
- **Overused in the first set; avoid:** dragon eyes beneath water, spirit fish
  or frogs, whirlpools and star-water vortices, carved animal-mouth fountains,
  open treasure luggage or mimic chests, leaf boats, floating root islands,
  crystal-sail boats, waterfall shrines, crystal hatchlings.

## Prohibited content

These hold for every idea and every generated picture, whether intended or
accidental. Check for them when writing ideas and again when reviewing output.

- **Hate and extremist symbols.** Nazi imagery of any kind, and anything that
  could be read as it. Watch rotating-arm mechanisms in particular: a spinner,
  valve or wheel with four bent arms can form a hooked cross by accident.
- **Religious imagery, of any faith.** No churches, crosses, crucifixes,
  altars, shrines, reliquaries, icons, halos, prayer objects or clergy. The
  first set has "shrine" and "reliquary" ideas; do not carry those over.
- **Other forbidden or charged symbols.** Political, national, military, gang
  and occult symbols; flags of real countries or movements.
- **Private human body parts, nudity, anything sexual.** Watch silhouettes: a
  tower, obelisk, mushroom or fountain must not read as one.
- **The standing rules.** No people or characters, no text, letters, numbers,
  code, UI, watermarks, pseudo-writing, gore or weapons.

If a picture is doubtful, reject it. A replacement costs seven cents.

## Generating

- **Extend the runner; do not fork it.** Give `board_edits.py` a profile
  setting so the same code edits the wide picture: the base it loads, the
  aspect it requests and checks (16:9), the wording of the prompt, and where
  its records go. Keep wide records apart from the compact ones, for example
  `artifacts/world-generation/patch-reviews/<scene>/wide/round-01/`. The
  compact behaviour must be unchanged.
- **Size.** Ask for 1K at 16:9. The existing set is 1K over 2400-pixel
  pictures, so this matches current practice. The pilot checks whether it is
  sharp enough on the 2752-pixel pictures; if not, 2K is the fallback at a
  higher price per image, to be confirmed before spending.
- **Prompt.** Keep the existing prompt's structure and its preservation
  section. Add the prohibited content to its "Avoid" line.
- **Money.** About $65–70 for 950 at 1K. Paid requests need Anton's go-ahead
  for a stated number of images and budget each time: once for the pilot, once
  for the rest. Use the runner's `--budget-usd` and its dry run first.
- **Pace.** The runner keeps 15 seconds between requests; 950 images is about
  five hours. It resumes where it stopped.

## Pilot

Two scenes, ten images each, about $1.40: Meridian Engine (2752×1536) and Mode
Lantern Grounds (1280×720). Pick all ten sites for each, write all 50 ideas for
each, and generate one idea per site so every site is tried.

The pilot has to answer:

1. Does the model return the whole 16:9 board with everything outside the site
   preserved as well as it does at 4:3? Compare the difference from the base
   away from the site with the existing runs.
2. Does `extract_patch` give one clean patch per image? It needs a canvas
   divisible by 16; a 1K 16:9 output should be 1376×768, which is. Confirm
   the real size.
3. Does a 1K patch look sharp on the wide picture at desktop size, or soft
   beside the art around it?
4. How large are the patches? The existing ones average 55–78 KB, which would
   put the whole set near 65 MB.
5. Do the site rules produce places Anton likes?

Hand Anton the two site sheets and a review page per scene. Stop there. The
rules above are adjusted from what the pilot shows before the rest is written.

## Full run

1. Sites and site sheets for the remaining scenes.
2. Ideas for the remaining scenes, into the one ledger, with the variety and
   prohibited-content checks passing.
3. Anton's go-ahead for the count and budget.
4. Generate, one scene at a time.
5. A first pass by the session before Anton sees anything: discard pictures
   that changed the board elsewhere, changed nothing visible, broke a
   prohibited-content rule, or repeat a neighbour too closely, and stage
   replacements for them.
6. A review page per scene for Anton: each variation at desktop size on the
   wide board, with a way to blink it on and off, grouped by site. Rejections
   go to a replacement round.

## After approval

Outlined here so the generation work leaves the right things behind; it is a
separate change with its own validation.

- **Patches.** Run the approved boards through `extract_patch` and store them
  as transparent WebP under the scene's `variants/` directory, in a `wide/`
  subdirectory. The path must keep a `variants` segment: the build and the
  media policy use it to keep variations out of the precache.
- **Manifest.** `remoteVariants` in `content/presentation.json` describes one
  set registered to one profile. It needs a second, wide-registered set with
  its own site ids.
- **Runtime.** `sceneProfileForPolicy` and `remoteVariantsAreEligible` in
  `src/world/presentation.js` switch variations off for wide exercise boards.
  They should play there when the scene has a wide set, drawn over the wide
  picture.
- **Tests.** `tests/content-data.test.mjs` asserts the shape of
  `remoteVariants`, and `tests/pwa-build.test.mjs` that variations are not
  precached.

## What to commit

- The runner change, the per-scene site configs and the idea ledger.
- A summary of the run beside `scripts/world-art/board-edit-patch-summary.json`:
  requests, cost, approvals and replacements per scene.
- Generated pictures, review pages and ledgers stay under `artifacts/`, which
  is ignored. Once a scene is approved, keep each variation's generated PNG
  and delete its rejected candidates and review output.

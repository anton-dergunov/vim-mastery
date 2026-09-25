# In-board landmark plates for Units 5–17

**Size:** L (art generation). **Depends on:** [asset and hosting budget](asset-and-hosting-budget.md).

## First, two things called "restoration"

They are different, and only one is missing. Read this before doing anything.

**Unit-ending restoration paintings — complete, nothing to do.** The
full-frame images at `assets/worlds/story/units/<unit>.webp`, shown when a unit
completes. All 17 exist, are promoted, and have distinct hashes.

**In-board landmark plates — missing for 13 of 17 scenes.**
`landmark-dormant.webp` and `landmark-restored.webp` inside
`<scene>/<profile>/`, registered to the board canvas. This plan is about those.

## Why

In the unit-completion transition, `story-transitions.js` sets
`data-restoration="dormant"` on the story surface, flips it to `"restored"`
420 ms later, and `styles.css` crossfades the two landmark layers and lights
the path. That only works where the plates exist. For the 13 scenes after
Moonroot, `landmarkPatches` is `{dormant: null, restored: null}`, so
`setLayerAsset` clears both layers, `has-light-path` is never added, and the
transition animates nothing. **A unit completion in Arc 1 shows a landmark
coming to life; every later unit does not.**

It degrades gracefully — a consistency and polish gap, not a defect.

### Not in scope: a lesson-progression layer

Moonroot scenes also register `phase-a/b/c` plates and a `phasePatches` map
from lesson phase to plate. **That layer is retired.** The files were local
brightness-and-tint proofs, and commit `06471e9` removed their renderer; the
board does not change as a lesson progresses in any unit. Do not author phase
plates for the other 13 scenes. The retired files are still registered, so
`media-policy.js` precaches all 36 of them (~2.3 MiB of core media nothing
draws), and `tests/content-data.test.mjs` requires them. Step 3 removes them.

## Scope

### 0. Decide, then write it down

Two acceptable outcomes. Record the answer in
[../design-decisions.md](../design-decisions.md) either way:

- **Landmarks only** — author dormant and restored plates for the 13 scenes:
  2 × 3 profiles × 13 = **78 assets**. The completion beat is what a learner
  notices, and it makes all 17 units consistent.
- **Remote variants are enough for these boards** — remove `landmarkPatches`
  from the 13 and skip the dormant/restored choreography for scenes with no
  plates, so the transition stops running an animation over nothing.

**Recommended: landmarks only.**

### 1. Author the plates

Follow [../art-direction.md](../art-direction.md#landmarks-story-and-characters)
and the per-unit landmark prompts in [../art-prompts.md](../art-prompts.md).
Match how the four Moonroot scenes are built — same naming, same three profiles
(`tall`, `compact`, `wide`), same seam handling:

- `scripts/world-art/generate_unit_scene_candidates.py`
- `scripts/world-art/approve_unit_scene.py`
- `scripts/world-art/derive_approved_unit_scenes.py`
- `scripts/world-art/integrate_future_scene_patches.py`

Each plate must register in `profiles[*].patches` for **every** profile, or
`presentation-data.js` rejects the scene.

### 2. Sequence

Starwater first — `starneedle-observatory`, `nested-garden`, `prism-crossing`
(Units 5–7) — because it follows the four that work and is where the seam is
most visible. Then Archive of Echoes, then Brass Meridian.

### 3. Retire the phase layer

Independent of the decision in step 0, and cheap:

- Remove `phase-a/b/c` from every scene's `patchRegions` and
  `profiles[*].patches`, and remove `phasePatches`, in
  `content/presentation.json` (the 13 declare phase regions with no files).
- Delete the 36 `phase-*.webp` files under `assets/worlds/moonroot-ruins/`.
- Drop the `phasePatches` validation in `presentation-data.js` if nothing else
  reads it.
- Update `tests/content-data.test.mjs`, which currently requires the phase
  regions and files for the four Moonroot units.

### 4. Guard it

Replace the Moonroot-only assertion in `tests/content-data.test.mjs` with one
over every scene the step-0 decision covers, requiring `landmark-dormant` and
`landmark-restored` in each profile, so the next scene cannot register with an
empty set. `tests/media-policy.test.mjs` picks new files up as
`registered-patch` core assets automatically.

## The budget gate

Landmark plates are `registered-patch`, which `media-policy.js` puts in the
**core** precache, not the optional tier. Today the four Moonroot scenes
contribute 60 such files — 24 landmark plates and the 36 retired phase plates
step 3 removes. Core sits far below its 300 MiB ceiling, so the precache has
room for 78 more.

The constraint is the total artifact, not the precache: `dist/` is 888 MB against
GitHub Pages' 1 GB limit. **That is why this session waits for the
[asset and hosting budget](asset-and-hosting-budget.md).** Do not
start generating until the hosting decision is made, and re-measure after
integrating.

## Out of scope

- **Veo video loops.** Session 23 left them optional and unstarted, with the
  shape recorded if anyone returns: same sites, locked camera, 5–8 s, one local
  subject, seamless loop, no character. Record that they are still unstarted; do
  not start them.
- **Character animation.** Not requested by session 23 and not requested here.
- **Regenerating any base board.** The boards are final. Session 23's rule
  stands: no replacement board unless phone-size review finds a concrete
  composition failure, and "it feels final" does not qualify.
- **`open-trail-overlook`.** The asset and hosting budget resolves it.

## Validation

- `npm run test:media` and `npm test`.
- `npm run test:pwa`. Normally CI-only; run it, because this session changes
  what ships.
- `npm run test:targeted -- tests/story-transitions.spec.js` if one exists for
  the affected surface, otherwise the smoke suite plus manual inspection.
- Complete a unit in each affected arc and watch the restoration beat: the
  dormant plate crossfades to the restored plate, the light path appears, and
  `prefers-reduced-motion: reduce` skips straight to restored without a flash.
- Inspect 360×740, 390×844, 412×915, 430×932 and 432×960. A plate that registers
  a pixel off is visible as a seam on the narrow phone before anywhere else.
- Re-measure `dist/` and confirm it still satisfies the ceiling the asset and
  hosting budget added.
- Confirm no workspace-owned Playwright or Vite process survives the run.

# The in-board patch layer for Units 5–17

**Size:** L (art generation). **Depends on:** [asset and hosting budget](asset-and-hosting-budget.md).

## First, two things called "restoration"

They are different, and only one is missing. Read this before doing anything.

**Unit-ending restoration paintings — complete, nothing to do.** The
`*-restoration-3x4` candidate sets under
`artifacts/world-generation/wp11/story-review-v2/unit-endings/`, promoted to
`assets/worlds/story/units/<unit>.webp`. These are the full-frame images shown
when a unit completes. **All 17 exist, are promoted, and have 17 distinct
hashes.** The selections for the three newest units landed in commits `182964f`,
`588b94f` and `19de812`: `viewport-control.webp`,
`real-code-workflow-capstones.webp` and `mastery-loops.webp`.

**In-board patch plates — missing for 13 of 17 scenes.** Transparent overlays
*inside a scene directory* that composite onto the gameplay board. This session
is about those.

## Why

Only the four Moonroot scenes have a patch layer. Compare
`content/presentation.json`:

```
modal-model / mode-lantern-grounds
  patches:        phase-a, phase-b, phase-c, landmark-dormant, landmark-restored
  phasePatches:   explain [] · demonstrate [phase-a] · isolate [phase-b]
                  mix [phase-a, phase-b] · challenge [phase-a, phase-b, phase-c]
                  summary [phase-a, phase-c]
  landmarkPatches: {dormant: "landmark-dormant", restored: "landmark-restored"}

precision-motions-search / starneedle-observatory   (and 12 more)
  patches:        {}
  phasePatches:   explain [] · demonstrate [] · isolate [] · mix []
                  challenge [] · summary []
  landmarkPatches: {dormant: null, restored: null}
```

Every one of the 13 declares `patchRegions: [phase-a, phase-b, phase-c]` and
then ships no patch for any of them. The audit that opened this directory
described the gap as missing landmark plates; that was too narrow. **The entire
progressive board layer exists only for Arc 1.**

Two user-visible consequences:

1. **The board does not progress with the lesson.** In Units 1–4 the board
   gains detail as the learner moves explain → demonstrate → isolate → mix →
   challenge → summary. In Units 5–17 it is a static base with the
   remote-variant ambient layer over it.
2. **The landmark never wakes up.** `story-transitions.js:439-465` sets
   `data-restoration="dormant"` and flips it to `"restored"` 420 ms later, and
   `styles.css:2109-2110` crossfades the two landmark layers and lights the
   path. With null patches, `setLayerAsset` removes the property
   (`story-transitions.js:428-434`), `has-light-path` is never added, and the
   transition animates nothing. So a unit completion in Arc 1 shows a landmark
   coming to life and every later unit does not.

Both degrade gracefully. This is a consistency and polish gap, not a defect —
which is exactly why it has survived three sessions unnoticed.

Session 23 deferred the landmark treatments explicitly: "dormant/restored
landmark treatments and full-frame story endings only after the related unit
content exists." The content now exists.

## Scope

### 0. Establish intent before generating anything

**Do not start by generating 195 assets.** First answer: were phase patches
*meant* for the newer boards, or were `remoteVariants` chosen as their
substitute?

The evidence is genuinely ambiguous. The 13 scenes carry `remoteVariants` with
10 site ids and 5 variants each — 900 files, the bulk of the optional media
tier — and session 23 registered them with `mode: "transparent-patch"`. That may
have been the intended replacement for a phase layer on boards of that style.
Meanwhile `patchRegions` is declared on all 17, and `presentation-data.js:132-140`
validates that any referenced patch id "must exist in every profile", so an
empty `phasePatches` array is the escape hatch that let those scenes register
without art.

Write the answer into [../design-decisions.md](../design-decisions.md) either way. Three outcomes
are all acceptable; leaving it undecided a fourth time is not:

- **Full parity** — author phase patches and landmark plates for all 13.
  5 plates × 3 profiles × 13 scenes = **195 assets**.
- **Landmarks only** — the completion beat is the emotional payoff and the
  cheaper half. 2 × 3 × 13 = **78 assets**. Then drop the unused
  `phase-a/b/c` entries from `patchRegions` on those scenes so the data stops
  describing art that does not exist.
- **Remote variants are the answer for these boards** — then remove
  `patchRegions` and `landmarkPatches` from the 13, and delete the dead
  `data-restoration` choreography for scenes with no plates.

**Recommended: landmarks only.** The completion beat is what a learner
notices, 78 assets is affordable where 195 may not be, and it makes the 13
scenes consistent with each other rather than half-converted.

### 1. Author the plates

Use the existing pipeline, and match how the four Moonroot scenes are built —
same naming (`landmark-dormant.webp`, `landmark-restored.webp` under
`<scene>/<profile>/`), same three profiles (`tall`, `compact`, `wide`), same
seam handling:

- `scripts/world-art/generate_unit_scene_candidates.py`
- `scripts/world-art/approve_unit_scene.py`
- `scripts/world-art/derive_approved_unit_scenes.py`
- `scripts/world-art/integrate_future_scene_patches.py`

Each plate must register in `profiles[*].patches` for **every** profile, or
`presentation-data.js` will reject the scene.

### 2. Sequence

Starwater first — `starneedle-observatory`, `nested-garden`, `prism-crossing`
(Units 5–7) — because that is the arc immediately after the four that work, and
it is where the seam is most visible. Then Archive of Echoes, then Brass
Meridian.

### 3. Guard it

`tests/content-data.test.mjs:294` already asserts every profile carries
`phase-a`, `phase-b`, `phase-c`, `landmark-dormant` and `landmark-restored` —
but only inside the loop over the four Moonroot units. Widen it to whatever
scope the item-0 decision makes true, so the next scene cannot register with an
empty patch set. `tests/media-policy.test.mjs` will pick the new files up as
`registered-patch` core assets automatically.

## The budget gate

`landmark-dormant`/`landmark-restored` are `registered-patch`, which
`media-policy.js:54` puts in the **core** precache — not the optional tier. The
four Moonroot scenes contribute all 60 `registered-patch` core assets today, and
core sits at 47.8 MiB of its 300 MiB ceiling, so the precache has room.

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
- Re-measure `dist/` and confirm it still satisfies the ceiling the asset and hosting budget added.
- Confirm no workspace-owned Playwright or Vite process survives the run.

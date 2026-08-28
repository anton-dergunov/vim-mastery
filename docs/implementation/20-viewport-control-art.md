# Session 20 — Viewport control art and story beat

**Depends on:** 07 · **Blocks:** nothing
**Touches:** `content/presentation.json`, `assets/worlds/`, `scripts/world-art/`,
`docs/story-scene-review.md`, `docs/wp11-nano-banana-prompt-pack.md`, `tests/`
**Size:** M

## Context

Session 07 split the old Unit 9 into Unit 9 Position memory and Unit 10 Viewport
control. Every other unit has its own world art, guide, landmark, and story beat;
these two share one set, deliberately and temporarily, because splitting the
content should not have waited on drawing a new landmark.

What Unit 10 borrows today:

- world `archive-of-echoes` and guide `luma`, both shared with Unit 9;
- the `far-beacons` scene, including all fifty remote board variants;
- Unit 9's story image, **copied** to `assets/worlds/story/units/viewport-control.webp`
  (and `.png`) because the presentation test requires the file name to match the
  unit id;
- a landmark id of its own, `beacon-glass`, pointing at Unit 9's `far-beacons`
  landmark assets — the id had to differ because a landmark belongs to exactly
  one unit, but the artwork behind it is the same.

Its story beat is authored and coherent — Luma clears the beacon glass, and the
chain into the Echo Clock still reads — but the picture does not match the words.

## Goal

Give Unit 10 art that belongs to it, and remove every trace of the temporary
sharing.

## Scope

1. **A landmark for `beacon-glass`** — dormant and restored, at
   `assets/worlds/landmarks/beacon-glass-{dormant,restored}.webp`. Note that the
   landmark assets declared in the manifest are not currently on disk for any
   unit; match whatever convention the pipeline settles on rather than inventing
   one here.
2. **A scene** — its own `sceneId` with `tall`, `compact`, and `wide` profiles,
   three patch regions, and the fifty approved complete-board variants every
   other unit ships. The scene should read as *the same world seen clearly*,
   which is the unit's subject: framing, not travel.
3. **A story image** at `assets/worlds/story/units/viewport-control.webp`,
   replacing the copy of Unit 9's. Check the core media budget after: the copy
   currently costs roughly 590 KB of precache that a distinct image will also
   cost, so the budget does not change, but confirm rather than assume.
4. **Consider whether the guide should differ.** Luma suits both halves, but two
   consecutive units with the same guide is a first for the curriculum.
5. **Refresh the art pipeline references.** `scripts/world-art/*.py`,
   `docs/story-scene-review.md`, and `docs/wp11-nano-banana-prompt-pack.md` still
   name `long-range-navigation`, which no longer exists as a unit id.
6. **Update the approved story table** in `tests/content-data.test.mjs` and the
   `unit-story-base` count in `tests/media-policy.test.mjs`, which is currently
   fourteen for fifteen units precisely because the two share a backdrop.

## Out of scope

- Any content, lesson, or exercise change in Units 9 or 10.
- Re-drawing Unit 9's art, which is fine as it is.

## Acceptance criteria

- Unit 10 has its own landmark, scene, variants, and story image.
- No asset is shared between Units 9 and 10.
- `scripts/world-art/` and the art docs name the current unit ids.
- The core media budget still passes with room to spare.

## Validation

```bash
npm test
npm run test:targeted -- tests/story-transitions.spec.js --workers=1
```

Walk Unit 9's completion into Unit 10's and confirm both reward scenes render
distinctly, on the full viewport matrix.

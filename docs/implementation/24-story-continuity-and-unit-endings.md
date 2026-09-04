# Session 24 — Story continuity and unit endings

**Depends on:** 07, 16, 23 · **Blocks:** 17 · **Related:** 20
**Touches:** `content/presentation.json`, `story-transitions.js`,
`assets/worlds/story/units/`, `scripts/world-art/generate_wp11_story_review_v2.py`,
`scripts/world-art/promote_wp11_story_endings.py`, `docs/wp11-nano-banana-prompt-pack.md`,
`docs/story-scene-review.md`, `tests/content-data.test.mjs`, `tests/story-transitions.spec.js`
**Size:** L

## Context

The story was authored for a fourteen-unit curriculum. Since then session 07
split old Unit 9 into **Position memory** and **Viewport control**, and session
16 added **Unit 16 — Real-code workflow capstones**. Unit 17 is next. The
narrative data was extended each time, but never re-read end to end, and the art
pipeline was never re-run at all.

Three consequences are visible today.

**Unit 10 has no story of its own.** Its beat was written during the split as an
epilogue of Unit 9's — *"One beacon is lit, but the window onto the Wilds is
still fogged"* — and its picture is not merely similar to Unit 9's but
byte-identical in both formats:

```
119789591d5c44a33c0c8f9fdaf3dc31  position-memory.png
119789591d5c44a33c0c8f9fdaf3dc31  viewport-control.png
33c7f5953cc2a8f60c7da5d7b5de62fa  position-memory.webp
33c7f5953cc2a8f60c7da5d7b5de62fa  viewport-control.webp
```

That is the only duplicate pair in `assets/worlds/story/`; every other hash is
unique. Session 20 already owns this item and remains the place its scene half
was resolved; what is left is the plate and the beat.

**Unit 16's plate is a stand-in.** `real-code-workflow-capstones.webp` is the
approved Menders' Confluence board copied into the story slot: 1856×2304 where
every other plate is 1792×2400, and a board rather than a restoration painting.
Its *words* are authored and correct; only the picture is provisional.

**Unit 15 still speaks as though it ends the game.** *"energy crosses all four
worlds … the Wilds answer again"* was written when it was the terminal unit. It
now hands off to a workshop, and two more units follow.

## Goal

Read the whole narrative chain against the curriculum as it now stands, repair
what the two insertions left behind, decide what Arc 4 and the finale mean once
the story continues past the restoration, and produce the two missing
unit-ending paintings through the existing pipeline.

## Scope

### 1. The narrative chain

`content/presentation.json` holds sixteen `completion` beats, each an `action`,
a `copy`, and a `nextHook`. Re-read them in order and repair:

- **Unit 10's beat**, which currently only explains why Unit 9 was not enough.
  Beacon Glass Gallery is its own location and deserves its own restoration.
- **Unit 15's completion**, which claims a finality it no longer has.
- **World crossings.** Units 4→5, 7→8 and 11→12 move between realms with the
  same one-sentence hook as a step inside a realm. Decide whether a crossing
  should read differently, and if so whether that is copy or a data field.
- **Repeated guides.** Cinder guides Units 4 and 12, Tock 11 and 14, Luma 9 and
  10, with no narrative reason given. Either give one or redistribute; `mello`
  and `fen` are unused, and `fen` reads as Unit 17's.

Constraint from [session 23](23-future-unit-boards-and-animation-seeds.md):
*"The story remains four-part. No fifth realm is added."* Part IV changes tone
after the Meridian Engine — Units 12–15 restore the great systems, Units 16–17
use and maintain them, so later scenes are *broader and more lived-in, not
larger or more explosive.* Do not introduce a new catastrophe.

### 2. Unit-ending paintings

The pipeline is already data-driven and needs almost nothing new. Candidates for
fourteen units live under
`artifacts/world-generation/wp11/story-review-v2/unit-endings/<unitId>-restoration-3x4/`;
`viewport-control` and `real-code-workflow-capstones` are the only two missing.

**a. Add the two absent landmark descriptions.** `LANDMARK_DESCRIPTIONS` in
`scripts/world-art/generate_wp11_story_review_v2.py` has fourteen entries and is
the only code gap. Drafted in the file's existing voice:

```python
    "beacon-glass": "a tall grounded archive-glass gallery whose cleared lens resolves a far shore across still water",
    "menders-bench": "a broad supported workshop bench where four differently shaped repairs settle into one tested service kit",
```

**b. Generate.** The prompt is built from each unit's own `completion.action`
and `completion.copy`, so it follows the narrative work in scope 1 — do that
first. Model is Gemini Nano Banana Pro (`gemini-3-pro-image`); five candidates
per unit across the three `RESTORATION_3X4_DIRECTIONS`.

```bash
export GOOGLE_CLOUD_PROJECT=…
python scripts/world-art/generate_wp11_story_review_v2.py \
  --restoration-3x4 --group viewport-control --execute
python scripts/world-art/generate_wp11_story_review_v2.py \
  --restoration-3x4 --group real-code-workflow-capstones --execute
```

Review at 360×740 in the real story surface, not in a file browser: the layout
contract is pinned by *"uses a full portrait frame with top narrative text for
unit-ending art"* in `tests/story-transitions.spec.js`, which requires roughly
the upper quarter to stay calm enough for the narrative text.

**c. Repair the promotion script.** `promote_wp11_story_endings.py` carries an
`APPROVALS` map of fourteen entries still keyed by the pre-split
`long-range-navigation`, and hard-fails unless the map covers every presentation
unit exactly once — so it cannot run against today's sixteen-unit manifest at
all. Rename that key to `position-memory` and add the two new units. Normalize
with the repository's recorded settings:
`cwebp -quiet -mt -m 6 -q 90 -metadata none in.png -o out.webp`.

**d. Correct the stale documents.** `docs/wp11-nano-banana-prompt-pack.md` is
numbered against the fourteen-unit curriculum — its "Unit 9" is Far Beacons and
its "Unit 14" is the Meridian Engine — and has no Beacon Glass or Menders'
Confluence section. `docs/story-scene-review.md` has the same problem in its
approved-endings table. Both should be renumbered and extended.

**e. Note, do not necessarily take.** `assets/worlds/landmarks/` is empty while
all sixteen units declare `-dormant.webp` and `-restored.webp` paths. Nothing
breaks — the media policy does not collect them — but the declaration is
currently fiction.

### 3. Arc 4 framing and the finale

The finale needs no code change to move: `story-transitions.js` chooses it purely
by there being no next unit, so Unit 17 will relocate it automatically. What does
need deciding:

- **The ending is hardcoded in JavaScript, not the manifest.** `renderEnding()`
  fixes the panel id `restored-wilds`, the `aria-label` *"The four restored Vim
  Wilds celebrating together"*, the progress line *"All four worlds restored"*
  and the title *"The Wilds are alive"*. Three of those four count the worlds.
  If Arc 4 is about using the restored Wilds rather than restoring them, decide
  whether the finale still says "restored" and whether these strings belong in
  `presentation.json` alongside every other piece of story copy.
- **Arc 4 has no introduction.** Arcs 1–3 are implicit in the world changes;
  Arc 4 — *Integration and lifelong practice* — begins mid-realm with no beat
  marking that the game's purpose has changed from restoration to craft.
- **The intro is pinned at exactly three panels** in both `showIntro()` and
  `presentation-data.js`. If Arc 4 needs framing, that framing cannot go there
  without lifting the constraint in two places.

## Out of scope

- Unit 17's curriculum content — that is [session 17](17-unit-16-mastery-and-cli.md).
- New realms, characters, or scene boards; session 23 settled the four-part
  structure and Keeper's Relay is already generated and held inactive.
- Landmark dormant/restored plates, unless scope 2e is deliberately taken.

## Acceptance criteria

- Every unit's beat reads as its own location's restoration, with no beat
  explaining a previous unit's shortfall.
- No two unit-ending images share a hash, and every plate is a 3:4 portrait
  restoration painting rather than a board.
- `promote_wp11_story_endings.py` runs against the current manifest without
  editing, and its approval map names every unit exactly once.
- The narrative chain reads continuously from Unit 1 to the finale, and no hook
  repeats the line the panel after it is about to say.
- The prompt pack and the scene review name units by their current numbers.
- Arc 4's framing and the finale's copy are a recorded decision, whether or not
  they change.

## Validation

```bash
node --check app.js && node --check presentation-data.js && git diff --check
npm test
npm run test:pwa
npm run test:targeted -- tests/story-transitions.spec.js
```

The story table in `tests/content-data.test.mjs` pins all sixteen beats as one
`deepEqual`, and `presentation manifest preserves the approved introduction and
ending` pins the intro and finale, so every copy change lands in exactly one
test. `tests/story-transitions.spec.js` additionally loads every plate in the
browser and asserts the narrative fits above the action row at 360×740 and four
larger phones — that is the test a longer rewritten beat will fail first.
Re-check the counts in `tests/media-policy.test.mjs` and
`tests/pwa-build.test.mjs` if any asset is added rather than replaced.

# Session 24 — Story continuity and unit endings

**Status:** complete, including owner selection, promotion, final regression,
and PWA validation.

## Final 17-unit narrative

The story remains a three-panel introduction, four worlds, 17 unit completion
beats, and the existing finale. No fifth realm or second catastrophe was added.
Recurring guides are intentional: their return gives related command families
continuity, while Fen owns the lifelong-practice chapter at Keeper’s Relay.

The repaired late-story chain is:

- Unit 9’s Far Beacons point into the fogged Beacon Glass Gallery.
- Unit 10 keeps its existing restoration meaning: Luma clears the view without
  moving the learner’s position.
- Unit 15 is the restoration climax, connecting the four restored systems
  without claiming the entire game has ended.
- Unit 16 turns those restored systems into dependable craft and points to Fen.
- Unit 17 closes on return, combination, maintenance, and deliberate choice.
- The existing finale copy follows Unit 17 unchanged.

The finale’s `id`, `title`, `progressLabel`, and `ariaLabel` now live beside its
asset, speaker, and copy in `content/presentation.json`; the renderer contains no
hardcoded finale identity or accessibility copy. Landmark metadata contains
only runtime identity and no longer declares nonexistent dormant/restored files.

## Unit 17 boundary

`mastery-loops` is Unit 17 in Arc 4, displayed over Keeper’s Relay with Fen as
guide. Its landing card opens the existing Mastery map. The first completed
mixed-review session shows the Unit 17 completion exactly once and hands off to
the finale. Incomplete, focused, tool-choice, and field-note sessions do not
advance the story. Afterward every Mastery feature remains indefinitely
reusable, does not change the saved lesson position, and does not replay
progression automatically. `window.VimWilds.masteryState()` exposes the chapter
unit and completion state for deterministic tests.

## Approved ending art

Units 10, 16, and 17 used their approved tall gameplay boards while selection
was pending. The owner approved Unit 10 candidate 4, Unit 16 candidate 2, and
Unit 17 candidate 5. Their semantic WebPs now live in
`assets/worlds/story/units/`, all pending markers are cleared, and all 17 ending
sources have distinct hashes.

The Nano Banana generator contains descriptions for Beacon Glass, Menders’
Bench, and Keeper’s Relay and builds five 1792×2400 restoration candidates per
unit from the approved tall board and finalized completion text. Candidates are
review-only and remain outside runtime packaging.

The completed promotion was run as:

```sh
python scripts/world-art/promote_wp11_story_endings.py \
  --approve viewport-control=4 \
  --approve real-code-workflow-capstones=2 \
  --approve mastery-loops=5
```

Promotion validated recorded hashes and dimensions, recorded approval and
rejections in all three manifests, converted with
`cwebp -quiet -mt -m 6 -q 90 -metadata none`, writes three semantic WebPs,
updated all three story paths, cleared their pending markers, and verified all
17 runtime endings are distinct and valid.

## Validation contract

The release gate covers syntax and diff checks, the complete quick suite, the
PWA audit, targeted Unit 10/16/17 and Reference animation cases, story
progression and restoration, reduced motion, offline/simple-background paths,
and the 360×740, 390×844, 412×915, 430×932, and 432×960 story surfaces.

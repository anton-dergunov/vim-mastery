# Session 24 — Story continuity and unit endings

**Status:** all application, story, pipeline, documentation, and test work is
complete through the owner-selection gate. Only candidate selection, prepared
promotion, and final regression remain.

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

## Art approval gate

Units 10, 16, and 17 temporarily use their own approved tall gameplay boards as
valid `storyImage` values and carry `storyArtStatus:
pending-bespoke-approval`. All other ending images remain approved. The 17
current ending sources have distinct hashes.

The Nano Banana generator contains descriptions for Beacon Glass, Menders’
Bench, and Keeper’s Relay and builds five 1792×2400 restoration candidates per
unit from the approved tall board and finalized completion text. Candidates are
review-only and remain outside runtime packaging.

After the owner chooses one candidate per unit, no source edit is needed:

```sh
python scripts/world-art/promote_wp11_story_endings.py \
  --approve viewport-control=3 \
  --approve real-code-workflow-capstones=1 \
  --approve mastery-loops=5
```

Promotion validates recorded hashes and dimensions, records approval and
rejections in all three manifests, converts with
`cwebp -quiet -mt -m 6 -q 90 -metadata none`, writes three semantic WebPs,
updates all three story paths, clears their pending markers, and refuses to
finish unless all 17 runtime endings are distinct and valid.

## Validation contract

The release gate covers syntax and diff checks, the complete quick suite, the
PWA audit, targeted Unit 10/16/17 and Reference animation cases, story
progression and restoration, reduced motion, offline/simple-background paths,
and the 360×740, 390×844, 412×915, 430×932, and 432×960 story surfaces.

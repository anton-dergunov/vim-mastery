# Media and story infrastructure

This document is the implementation contract for WP-05 and WP-10 and the
handoff boundary for WP-11. Generated scene review and art approval happen
outside this package.

## Runtime media policy

`media-policy.js` derives the deployment from runtime manifests rather than
walking production art directories:

- Core media: selected registered-scene bases and patches, the fourteen
  approved unit-story backdrops, non-null intro stills, character idle images,
  and declared reaction stills.
- Optional media: character animations and declared complete-board scene
  variants.
- Source masters, candidates, and review files are never discovered or emitted.

Every declared core or optional asset must exist. A production build fails with
the manifest category and path when one is missing. Core declarations cannot
point into a `variants/` directory. A story panel may use
`"asset": null` while its CSS placeholder is the approved runtime fallback.
WP-11 should replace `null` only after the corresponding reviewed file is in
the production asset tree.

Core media is precached. Optional media is emitted to the GitHub Pages artifact
but excluded from the service-worker precache. Production and fallback requests
use the Pages origin; local Vite development tries the local asset first.

The build prints the deterministic core file count and byte total for later
optimization work, but does not reject a package based on media size. The
service-worker cache name contains a digest of every precached file, so changing
generated media at a stable path creates a new cache even when the application
version is unchanged.

Character reaction stills can be declared in either of these compatible forms:

```json
{
  "reactions": {
    "attentive": "assets/characters/nix/reactions/attentive.webp",
    "encouraging": {
      "still": "assets/characters/nix/reactions/encouraging.webp"
    }
  }
}
```

Large motion belongs under `animations` and remains optional.

## Repeatable normalization

Keep original generation outputs outside `assets/`. Normalize an approved copy
into its final manifest path with pinned local tool versions. The following
commands strip metadata and use deterministic encoder settings:

```bash
cwebp -quiet -mt -m 6 -q 82 -metadata none input.png -o output.webp
pngquant --force --strip --speed 1 --quality 75-90 --output output.png input.png
```

Complete-board scene variants retain their coherent generated lighting. Encode
them with high-quality lossy WebP:

```bash
cwebp -quiet -mt -m 6 -q 95 -metadata none input.png -o output.webp
```

Record the installed `cwebp -version` or `pngquant --version` with the art batch.
Run `npm run test:pwa` after changing a manifest or normalized runtime asset.

## Story state and navigation

`story-transitions.js` owns the accessible modal surface, rendering, replay,
navigation interception, and persistence.

- Durable key: `vim-wilds.story.v1`
- Durable fields: `introSeen`, `completedUnitStoryIds`
- Refresh-safe transient key: `vim-wilds.story-transition.v1`
- Session and curriculum state remain independent.

The intro opens only on the default play route or an explicit Unit 1 route
without an activity. Direct activity links and later-unit links are never
blocked. A unit story opens only from that unit's final continuation boundary
and only once by default. Replays never mutate lesson or story completion.

The surface has stacked and two-column layouts, keeps Skip and Continue
immediately available, preserves its active descriptor through live shape
changes, and uses no document scrolling. Reduced motion disables story
transitions while keeping all states and controls.

## WP-11 handoff

Approved copy already comes from `content/presentation.json`; do not duplicate
or rewrite it in markup or JavaScript.

The complete Sol-authored Nano Banana production descriptions are in
`docs/wp11-nano-banana-prompt-pack.md`. Use that pack for candidate generation;
do not ask an implementation session to improvise a shorter landmark or intro
brief.

Intro integration is data-only once approved files exist:

1. Put each normalized still under `assets/worlds/story/`.
2. Replace that panel's `asset: null` with its local runtime path.
3. The story controller applies it to `.story-visual`; CSS placeholders remain
   behind it for missing/slow media.
4. The PWA policy automatically emits, inventories, validates, revisions, and
   precaches it.

Unit transition integration has stable hooks on `.story-surface`:

- `data-unit-id`
- `data-world-id`
- `data-scene-id`
- `data-landmark-id`
- `data-guide-id`
- `data-action-id`

The inert layer slots are `.story-board-base`, `.story-landmark-dormant`,
`.story-landmark-restored`, `.story-light-path`, and `.story-guide-action`.
WP-11 should fill these from the selected scene profile and its registered
landmark patches, keeping base and both landmark states on the identical cover
transform. Do not add free landmark coordinates.

`window.VimWilds.showUnitStory(unitId)` opens any of the 14 transitions as a
non-mutating replay for choreography checks. `getState().story` reports the
active descriptor and durable story state. These hooks allow Terra to validate
every mapping without manufacturing curriculum completion.

The WP-11 implementation should remain inside the story art/layer adapter,
manifest assets, and story-specific CSS. If it requires changing persistence,
navigation, the presentation data contract, or the PWA classifier, stop and
return that architectural change to a Sol package.

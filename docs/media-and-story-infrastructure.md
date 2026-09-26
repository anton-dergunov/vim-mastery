# Media and story infrastructure

How art gets from an approved file into the shipped app, and how the story
surface works at runtime. What the art should look like, and how it is
generated, is in [art-direction.md](art-direction.md) and
[art-prompts.md](art-prompts.md).

## Runtime media policy

`media-policy.js` derives what ships from the runtime manifests
(`content/presentation.json` and `assets/characters/manifest.json`) rather than
walking the art directories:

- **Core media** — precached by the service worker, available offline:
  scene bases, unit-ending backdrops and story images,
  intro stills, the finale, and character idle images.
- **Optional media** — emitted to the build but never precached, fetched only
  when shown: character reaction and action animations, and the complete-board
  remote scene variants.
- **Never shipped:** source masters, candidates, and review files. Paths under
  `candidates/`, `masters/`, `review/`, `reviews/`, or `sources/` are never
  discovered or emitted, and lossless PNG masters kept beside a runtime WebP are
  not declared, so they stay out of the build.

Every declared asset must exist; a production build fails with the manifest
category and path when one is missing. Core declarations may not point into a
`variants/` directory.

**Budget.** The build prints the core file count and size. It **fails above
300 MiB of core media** (`CORE_MEDIA_MAX_BYTES`), a ceiling meant to catch a
mistake, not to ration artwork; `tests/media-policy.test.mjs` asserts it too.
The PWA build audit (`npm run test:pwa`) also fails if the whole published
build, optional tier included, reaches GitHub Pages' 1 GiB; how close it is,
and what to do about it, is
[plans/asset-and-hosting-budget.md](plans/asset-and-hosting-budget.md).

**Origins.** Production and fallback requests use the GitHub Pages origin; local
Vite development tries the local asset first. The service-worker cache name
contains a digest of every precached file, so changing an image at a stable
path creates a new cache even when the app version is unchanged.

Each character's `reactions` in the manifest maps a state to one variant or a
list of variants, each `{ "src": path, … }`. Motion lives under `animations`, and
both stay optional.

## Repeatable normalization

Keep original generation outputs outside `assets/`. Normalize an approved copy
into its final manifest path with deterministic, metadata-free encoder settings:

```bash
# General runtime art
cwebp -quiet -mt -m 6 -q 82 -metadata none input.png -o output.webp
pngquant --force --strip --speed 1 --quality 75-90 --output output.png input.png

# Complete-board scene variants: keep their generated lighting
cwebp -quiet -mt -m 6 -q 95 -metadata none input.png -o output.webp

# Full-frame story stills
cwebp -quiet -mt -m 6 -q 90 -metadata none input.png -o output.webp
```

The 2026-08-01 story batch used `cwebp 1.6.0` and `libsharpyuv 0.4.2`. Record
`cwebp -version` or `pngquant --version` with each art batch, and run
`npm run test:pwa` after changing a manifest or a normalized runtime asset.

## Story state and navigation

`story-transitions.js` owns the story surface: rendering, replay, navigation
interception, and persistence.

- Durable key `vim-wilds.story.v1`, with `introSeen` and
  `completedUnitStoryIds`.
- Refresh-safe transient key `vim-wilds.story-transition.v1`.
- Session and curriculum progress stay independent: replaying or clearing
  story state never changes lesson progress.

The intro opens only on the default play route, or an explicit Unit 1 route
with no activity; direct activity links and later-unit links are never blocked.
A unit story opens only from that unit's final continuation, and only once by
default. Replays never mutate lesson or story completion.

The surface has stacked and two-column layouts, keeps Skip and Continue
available immediately, survives live shape changes, and never scrolls the
document. Reduced motion disables transitions but keeps every state and
control.

## Where story art comes from

All copy comes from `content/presentation.json`; never duplicate or rewrite it
in markup or JavaScript. Images are data too:

- **Intro panels** — each `story.intro[]` entry's `asset`, under
  `assets/worlds/story/intro/`. A panel may use `"asset": null`, in which case
  its CSS placeholder is the fallback.
- **Unit endings** — each unit's `completion.storyImage`, a full-frame portrait
  painting at `assets/worlds/story/units/<unit-id>.webp`, with its lossless PNG
  master beside it. `completion.storyBackdrop` is the scene base used when a
  painting is missing. Endings with a painting add no character overlay.
- **Finale** — `story.ending.asset`, under `assets/worlds/story/ending/`.

Once a file is declared, the media policy emits, inventories, validates,
revisions, and precaches it with no further wiring.

Without a painting, the unit transition shows the unit's board base in
`.story-board-base`, over the world's plain colour. `.story-surface` exposes `data-unit-id`, `data-world-id`, `data-scene-id`,
`data-landmark-id`, `data-guide-id`, and `data-action-id` for styling and tests.

For checks without faking progress, `window.VimWilds.showUnitStory(unitId)`
opens any of the 17 transitions as a non-mutating replay, and
`window.VimWilds.getState().story` reports the active descriptor and durable
story state.

## Previewing and replacing story art

The preview routes open one story scene in the real production dialog, with no
lesson completion or saved progress needed:

- A unit ending: `/play/?preview=story&story=unit-ending&unit=<unit-id>`
- An intro panel: `/play/?preview=story&story=intro&panel=<panel-id>`
  (`connected-wilds`, `interrupted-command`, `nix-at-the-threshold`)
- The finale: `/play/?preview=story&story=finale`

Review at 360×740 before approving. The approved lossless master sits next to
each runtime WebP in `assets/worlds/story/`, and
`python scripts/world-art/encode_runtime_images.py` confirms every WebP still
encodes from its master (`--write` re-encodes). The candidate batches the art
was chosen from have been deleted.

The scripts that generated and promoted the story art were removed once it was
approved; the prompts are in [art-prompts.md](art-prompts.md). To make new story
art, start from them in git history:

```sh
git show 66077c2:scripts/world-art/generate_story_candidates.py
git show 66077c2:scripts/world-art/promote_story_endings.py
```

They expect their review batches under the ignored
`artifacts/world-generation/wp11/story-review-v2/`, and the generator's
reference images need repointing at the masters in `assets/worlds/story/`.

The recorded approvals name `long-range-navigation` for the art that became
Unit 9, `position-memory`, after the unit split. Runtime paths always use
`position-memory`.

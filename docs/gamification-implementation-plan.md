# Living Wilds Gamification Implementation Plan

## Status

This document turns the selected gamification direction into independently assignable implementation work. It is an execution plan, not a general visual-design exploration.

### July 2026 composition correction

WP-01 through WP-03 proved that the generated art language is strong but the
original composition contract is not. A shared world backdrop plus isolated
structural props produces unsupported branches, lanterns, masonry, and stairs
when those assets are placed without scene understanding. It also wastes
portrait art because the real board is selected by its own bounds and is often
compact or wide even on a portrait phone.

The following decisions supersede every older reference in this document to
shared backdrops, free structural props, arbitrary `x`/`y`/`scale` placement,
central editor cavities, or one scene per region:

- Keep four regional identities, but author one distinct registered scene for
  each of the 14 units.
- Generate five meaningfully different 2K `4:3` candidates per unit and review
  them only inside real UI composites. At least two candidates must be led by
  the environment rather than a landmark.
- Treat the DOM-derived editor mask as occlusion measurement, not an instruction
  to draw an empty or black editor-shaped opening.
- Record an explicit candidate approval before generating derivatives. Scripts
  must fail when approval is pending or the approved source hash has changed.
- Derive `4:5` tall, `4:3` compact, and `16:9` wide profiles from the approved
  scene. Select them from actual board bounds at `<0.9`, `0.9–1.58`,
  `1.58–2.4`, and `>2.4` for shallow suppression.
- Add environmental variation only as exact-canvas registered patches authored
  against real surfaces in the approved scene. Runtime environmental art has no
  free placement coordinates.
- Keep characters as deliberate guide overlays during exercises, with a small
  rune plate/contact shadow. Reserve physically staged character actions for
  unit transitions.
- On first entry to a unit, permit a loaded backdrop-first reveal for 450–600ms.
  Any input cancels it; reduced motion, slow/missing media, resize, direct
  activity changes, and shallow layouts skip it.
- Pause WP-04A through WP-04C. Revise and personally approve the four-unit
  Moonroot proof before generating Starwater, Archive, or Meridian.

Current checkpoint: WP-01R through WP-03R are implemented and the four Moonroot
base scenes and responsive profiles are personally approved. Their current
`phase-a` through `phase-c` overlays are local brightness/tint proofs used to
validate registration and rendering; they are not approved environmental art.
The next authorized action is WP-03P-A, the authored-patch review batch, not
WP-04 generation.

### July 2026 patch-production correction

The registered renderer is retained, but crop-only generation did not preserve
the scene geometry at the crop boundary. This correction supersedes both the
first subtle proof patches and the later crop-and-paste review batch:

- Keep the approved Moonroot base scenes unchanged.
- Generate patch candidates only with Gemini Nano Banana through Vertex AI and
  application-default credentials. Do not use an OpenAI image generator.
- Author ten named environmental patch slots per scene. A slot is a semantic
  detail such as a particular pool edge, lantern, root shelf, crystal seam, or
  stone surface—not one normalized rectangle reused blindly across profiles.
- Calculate visibility atlases from real phone, tablet, landscape-phone, and
  desktop boards. Include the renderer's cover transform, editor occlusion,
  guide-character exclusion, hidden-backdrop states, and tall/compact/wide
  profile selection. Bounds describe the compact source only; never reuse them
  blindly for a responsive profile.
- Build a Gemini-oriented object inventory containing the target object's
  location, appearance, support surface, compact bounds, measured visibility,
  and five substantial site-specific transformation ideas.
- For each compact candidate, send the lossless complete board as Image 1 and a
  small boxed locator crop as Image 2. The locator is reference markup only.
  Ask Gemini for a complete-board edit that changes the named object
  substantially while preserving the remainder of the board.
- Do not crop, stretch, paste, mask, or extract patches during WP-03P-A. The
  complete Gemini output is the unmarked review source; create a separate boxed
  and labelled copy for selection.
- Run only decoding, dimension, aspect-ratio, hash, and missing-output checks.
  Preserve all mechanically readable candidates. A person performs all
  aesthetic, integration, and winner selection.
- The product owner selects any ten candidates explicitly; the winners do not
  need to be one per inventory site. Multiple useful states of one object may
  all become runtime variants.
- Only after selection, use the original and selected complete boards to derive
  conservative changed-pixel masks, inspect the extracted full-canvas RGBA
  patches, and recreate the same semantic changes against authored tall and
  wide profile locations.
- During ordinary activities, render exactly one approved environmental patch,
  selected from a shuffled per-unit bag when the activity is entered. Hold the
  selection stable throughout that activity visit. Do not redraw on editor
  updates, resize, reset, or profile switching.
- Avoid repetition until all eligible patches have been used. Tests inject a
  fixed seed; production uses a session seed. Landmark dormant/restored state
  remains independent and may render alongside the environmental patch.
- Retain reduced-motion, shallow-profile, missing-media, and CSS-fallback
  behavior. A patch that is not sufficiently visible in the active profile may
  be skipped without drawing another during the same activity.

The decisions recorded here are:

- Keep the editor, keyboard, task description, command tray, completion panel, and top row structurally intact.
- Replace the repetitive tile board with richer, generated worlds composed around the editor.
- Restore one landmark after completion of each unit.
- Add selective, exact Vim-action visualization where it clarifies ranges, capture, placement, selection, or repetition.
- Start character behavior with attentive and repeated-mistake reactions.
- Use larger character actions only at unit boundaries.
- Introduce a short continuous story on first launch and advance it after each unit.
- Do not add more story language to individual exercise instructions.
- Do not replace the existing exercise-completion panel or hide the final code.
- Generate graphics with Gemini Nano Banana models, then animate still assets with CSS, SVG, masks, and the existing character media system.
- Keep essential practice local, deterministic, responsive, and usable when decorative media is missing.

The implementation should be delivered in small work packages. A coding session should normally receive one work package, its prerequisites, and the repository `AGENTS.md`.

## Recommended starting point

Continue from the approved WP-03R Moonroot scenes:

1. Run WP-03P-A for one Moonroot scene only.
2. Measure cross-profile visibility and inventory ten compact-board objects or
   surfaces.
3. Generate five complete-board Gemini edits per site at 1K, using the lossless
   full board plus a boxed locator crop.
4. Export the 50 unmarked outputs and 50 boxed review copies, then stop for
   personal selection without automated ranking or patch extraction.
5. After ten winners are recorded explicitly, run WP-03P-B to recreate those
   changes for tall and wide, integrate session-stable per-activity selection,
   and validate the scene.
6. Repeat WP-03P-A and WP-03P-B for the other three Moonroot scenes one scene at
   a time.
7. Stop for personal review before any WP-04 expansion.

This is the best starting point because it is highly visible, has little risk to Vim correctness, and establishes the art bible needed by landmarks, story scenes, and character poses.

Do not begin by generating all 14 landmarks or all character reactions. A weak master world would make those batches expensive to redo.

## Product experience

The intended rhythm has three distinct timescales.

### During an exercise

- Real code remains the visual priority.
- A rich but quiet world is visible wherever space exists around the editor.
- Characters remain idle or attentive.
- Only semantically valuable Vim events receive an effect.
- Effects never delay input and normally finish within 120–280ms.
- Incorrect input uses the existing functional feedback first; character reaction appears only after repeated difficulty.

The same experience must survive live changes between tall, compact, wide, and
shallow boards. Registered scene assets may crop, simplify, or disappear;
editor and input behavior may not.

### After an exercise

- Preserve the current completed code and completion panel.
- Preserve the explanation of why the command worked.
- Preserve immediate continuation.
- Do not run a full-screen world transformation.
- The existing short character celebration may remain.

### After a unit

- Open a skippable illustrated transition.
- The unit guide performs one meaningful action.
- The unit landmark changes from dormant to restored.
- Show one or two short lines of story.
- Offer Continue immediately.
- Navigate to the next unit only after the user continues or skips.

## Non-goals

- No navigable overworld.
- No character movement controlled by Vim keys.
- No unique base board image for each exercise; there is one canonical scene
  per unit, with one session-stable approved detail patch selected per activity.
- No generated text, code, keyboard legends, or UI controls inside raster art.
- No full-screen takeover after ordinary exercises.
- No currencies, energy, loot, punitive streaks, or global leaderboard.
- No requirement for video.
- No new game engine.
- No runtime image generation.
- No visual effect for every key.
- No dependency of validation, cursor movement, or lesson progression on decorative animation.

## Current implementation facts

Implementation sessions must account for the following existing architecture:

- `app.js` fetches the unit catalog and active unit, derives activities, renders the board, and owns unit navigation.
- The current scene system is `presentationFor()`, `renderGround()`, `renderSprites()`, and `renderWorld()` in `app.js`.
- The current ground is a dynamically repeated 12 × 9 tile grid. It expands to more square tiles on wider screens.
- The editor and character already live in a stable 12 × 9 overlay grid.
- The four current theme IDs are `moonroot`, `ember`, `glass`, and `deepwater`.
- User theme preference should continue to control functional UI colors. World identity is selected by unit and must not be replaced by the theme preference.
- `VimEngine` already emits change, selection, mode, key, and command-complete events with editor snapshots.
- The activity scripts expose exact keys, command groups, checkpoints, and occasional authored `affectedRange` data.
- The app already tracks `consecutiveMistakes`, but only recall mistakes currently increment it.
- A final unit summary already renders a continuation action to the next unit.
- The production PWA currently emits unit JSON and idle character PNGs locally but deliberately excludes the large animated character WebPs from the precache.
- `window.VimWilds` must remain compatible.

The curriculum currently contains 14 units, 362 authored exercises, 116 demonstrations, and approximately 300 granular primary skill labels. The action-effect system must therefore classify reusable semantic events; it must not map one animation to every skill ID.

## Architecture target

### Presentation manifest

Add a declarative presentation file, recommended as:

`content/presentation.json`

It should contain:

```json
{
  "schemaVersion": 2,
  "worlds": {},
  "units": {},
  "story": {
    "intro": [],
    "ending": {}
  }
}
```

Each world entry defines:

- Stable world ID.
- Display name.
- Existing functional theme ID used when theme preference is `auto`.
- Ambient-effect vocabulary.
- Fallback gradient.

Each unit entry defines:

- Unit ID.
- World ID.
- Guide character ID.
- Landmark ID.
- Selected `sceneId` and a `scenes` map so more scene families can be added
  without changing the renderer. Ship exactly one selected scene per unit in
  this tranche.
- Tall, compact, and wide profiles. Each profile owns one base asset and the
  same ten semantic patch IDs as full-registration assets.
- Ten named environmental patch slots. Each slot has profile-specific bounds,
  eligibility/visibility metadata, and one explicitly approved asset per
  profile.
- Per-unit shuffled-bag selection metadata. One environmental patch is sampled
  on activity entry and remains stable for that activity visit; learning phase
  does not select environmental art.
- Dormant and restored landmark patch IDs registered to the same source canvas.
- Unit-completion action ID.
- Exact story copy.
- Next-location hook.

The presentation manifest should be validated by an explicit schema and content test. It should not be added to every unit JSON file: keeping it separate allows visual work to evolve without touching validated lesson content.

### New modules

Prefer extracting these modules instead of further expanding `app.js`:

- `world-presentation.js`
  - Loads and resolves the active world and unit presentation.
  - Measures the board container and selects tall, compact, wide, or shallow
    presentation.
  - Renders one base plus active exact-registration patches with one identical
    cover transform and focal position.
  - Provides a legacy/fallback presentation when media is absent.

- `vim-effects.js`
  - Classifies semantic events from before/after snapshots and accepted keys.
  - Owns transient CodeMirror decorations or effect overlays.
  - Implements reduced-motion equivalents.

- `character-reactions.js`
  - Owns reaction state, thresholds, pose selection, cancellation, and fallback.

- `story-transitions.js`
  - Owns first-launch intro, unit-completion transitions, replay, skip, and persistence.

Keep navigation, lesson validation, and Vim interpretation in their existing owners.

### State and persistence

Extend the existing local session state carefully. Recommended independent keys:

- `vim-wilds.story.v1`
  - `introSeen`
  - `completedUnitStoryIds`

- Existing `vim-wilds.session.v1`
  - Continue storing active unit/activity and user UI preferences.

Story state must never be evidence of curriculum completion. Replaying or clearing story state must not change exercise progress.

### Offline policy

Classify media into two tiers:

1. **Core local media**
   - Tall, compact, and wide base scenes for each approved unit.
   - Exact-registration phase and dormant/restored landmark patches.
   - Approved reaction stills.
   - Story light/mask assets if raster assets are required.
   - These are emitted by the Vite PWA plugin and available offline.

2. **Optional remote media**
   - Existing multi-megabyte animated character WebPs.
   - Any future cinematic media.
   - Story and landmark restoration must still work without these files.

Add a build test that reports and enforces the total core-media budget:

- Warn when shipped world and story media exceeds 30MB.
- Fail the production budget above 50MB.
- Apply no per-file limit until the complete visual direction has passed review
  and compression experiments.
- Keep generation artifacts, 2K sources, and rejected candidates outside the
  production asset tree with no artificial size limit.

These thresholds protect offline use without forcing premature visual
compromises. Review assets at rendered size before trimming.

## Story bible

### Premise

The Wilds were shaped by a precise command language. An unfinished command fractured that language: paths shifted, stored memories scattered, and mechanisms stopped mid-action. The language was not destroyed; its grammar remains embedded in the world. Learning Vim restores the capabilities required to reconnect it.

The story is about learning and restoration, not prophecy, combat, or saving helpless characters. The learner becomes capable because they understand the language.

### Tone

- Mysterious, warm, concise, and intelligent.
- Never mock the learner.
- Avoid excessive fantasy nouns in instructional UI.
- Story copy appears only in the intro, unit transitions, and optional replay gallery.
- Ordinary exercise titles and instructions remain code-first.
- No generated raster text. All copy is real HTML.

### Exact first-launch introduction

Use three panels. Each panel contains one illustration layer and one sentence.

1. **Panel 1**
   - Copy: “Long ago, the Wilds answered to a precise language. Every motion had a destination; every change knew its range.”
   - Visual: The four worlds connected by lines of amber and cyan light; landmarks active but distant.

2. **Panel 2**
   - Copy: “Then an unfinished command crossed the land. Paths shifted, memories scattered, and the great mechanisms fell silent.”
   - Visual: The same landscape with one incomplete current of light, dormant landmarks, and drifting fragments. Do not depict destruction or characters in danger.

3. **Panel 3**
   - Speaker: Nix.
   - Copy: “The language was not lost—only forgotten. Learn it with us, and the Wilds will remember.”
   - Visual: Nix at the Moonroot threshold holding the lantern toward the dormant Mode Lantern.

The intro is skippable from the first panel, replayable from the table of contents or settings, and shown only once by default.

### Exact unit story

| Unit | Guide | World | Landmark | Completion action | Exact completion copy | Next hook |
|---|---|---|---|---|---|---|
| 1. The modal model | Nix | Moonroot Ruins | Mode Lantern | Nix lifts the lantern; four nested rings settle into distinct colors | “The Mode Lantern wakes. One key can hold more than one meaning—and now the Wilds remember how to listen.” | “A path glimmers beyond camp.” |
| 2. Cursor movement | Vela | Moonroot Ruins | Wayfinder | Vela turns the central compass; four paths align | “Vela aligns the Wayfinder. North, south, east, and west settle back into place.” | “The path ends at a page of broken words.” |
| 3. Entering and changing text | Tatter | Moonroot Ruins | Scribe’s Spring | Tatter repairs a split channel; luminous ink begins to flow | “Tatter opens the Scribe’s Spring. The Wilds can accept new words and reshape old ones again.” | “A sealed gate waits for both an action and a range.” |
| 4. Operator grammar | Cinder | Moonroot Ruins | Grammar Gate | Cinder joins two halves of a mechanism; the gate opens | “Cinder joins action to range. The Grammar Gate opens, and the first road out of Moonroot is restored.” | “Starlight flickers beyond the gate.” |
| 5. Precision motions and search | Orin | Starwater Sanctuary | Starneedle Observatory | Orin focuses a floating lens; distant points illuminate | “Orin focuses the Starneedle. Distant signs and exact characters become visible across the dark.” | “The signal points inward, toward structures hidden in plain sight.” |
| 6. Text objects | Bramble | Starwater Sanctuary | Nested Garden | Bramble touches the outer arch; nested arches bloom from outside inward | “Bramble wakes the Nested Garden. Words, quotes, brackets, and blocks reveal the shapes they contain.” | “Three panes of light rise from the water.” |
| 7. Visual selection | Prism | Starwater Sanctuary | Prism Crossing | Prism aligns three glass panes: ribbon, row, and rectangle | “Prism aligns the three panes. Character, line, and block become distinct paths through the same code.” | “Behind the final pane, a sealed archive begins to glow.” |
| 8. Registers and putting | Mica | Archive of Echoes | Memory Archive | Mica places a captured crystal into a drawer; several drawers illuminate | “Mica reopens the Memory Archive. What is captured can be kept, chosen, and placed where it belongs.” | “One memory points to a beacon far beyond the shelves.” |
| 9. Long-range navigation | Luma | Archive of Echoes | Far Beacons | Luma sends a thread of light between two distant beacons | “Luma reconnects the Far Beacons. The Wilds can cross great distances—and return without losing their place.” | “Across the causeway, a stopped clock begins to tick.” |
| 10. Repeatable editing | Tock | Archive of Echoes | Echo Clock | Tock starts one wheel; its motion propagates through matching wheels | “Tock restarts the Echo Clock. A well-shaped change can now travel farther than a single moment.” | “The echo reaches a brass city beneath the ridge.” |
| 11. Command-line ranges and line operations | Cinder | Brass Meridian | Meridian Table | Cinder places two endpoints; a current follows the exact route between them | “Cinder sets the Meridian Table. Lines and ranges become routes that the command current can follow.” | “A broken loom is repeating the wrong pattern.” |
| 12. Substitution and practical regex | Puddle | Brass Meridian | Mirror Loom | Puddle retunes a lens; only matching threads transform | “Puddle retunes the Mirror Loom. Patterns can be found, tested, and transformed without touching what does not match.” | “The repaired thread leads into a silent foundry.” |
| 13. Macros | Tock | Brass Meridian | Echo Foundry | Tock records one movement into a cylinder; three mechanisms replay it | “Tock records the first true echo. The Foundry can repeat a complete sequence without forgetting a step.” | “Only the World Engine remains dark.” |
| 14. Global and Normal automation | Cairn | Brass Meridian | Meridian Engine | Cairn connects the restored systems; energy crosses all four worlds | “Cairn opens the Meridian Engine. Range, pattern, repetition, and judgment move together—and the Wilds answer again.” | Nix: “The language is alive. What you restore next is up to you.” |

The story copy is approved content. Implementation sessions should not rewrite it without an explicit copy-review task.

## World art bible

### Shared rendering language

- Polished original 2D pixel-art fantasy suitable for a premium mobile game.
- Painterly pixel clusters, crisp silhouettes, and restrained texture.
- Rich at large size but readable when cropped to a 390px-wide board.
- Deep navy and near-black foundations with controlled amber, turquoise, violet, and warm cream light.
- Slightly elevated side-on environmental perspective, not a top-down navigable game map.
- Atmospheric depth through three clear planes: background, middle ground, foreground.
- No copied characters, logos, maps, or compositions from another game.
- No UI, code, keyboard keys, letters, pseudo-writing, signs, captions, or generated text.
- No important object in the central editor-safe area.
- No high-frequency contrast behind where code or the completion panel may appear.

### Responsive composition contract

Responsiveness follows the **rendered board container**, not a device label. A
narrow laptop window may produce the same tall board as a tablet; a phone in
portrait with its keyboard visible may still produce a compact or wide board.

The renderer observes the board’s actual width and height and assigns one of
four profiles:

| Profile | Board width ÷ height | Scene asset |
|---|---:|---|
| `tall` | below 0.9 | Approved `4:5` derivative |
| `compact` | 0.9–1.58 | Approved canonical `4:3` scene |
| `wide` | 1.58–2.4 | Approved `16:9` derivative |
| `shallow` | above 2.4 | Wide profile with optional scenery suppression |

Use a `ResizeObserver` on `.world` or an equivalent container-owned mechanism.
Do not choose art from user-agent strings. Update the shape without a page
reload when the browser is resized or device orientation changes.

Every unit scene needs:

- One explicitly approved 2K `4:3` canonical composition.
- One 2K `4:5` tall derivative and one 2K `16:9` wide derivative from that
  approved source.
- Ten named semantic patch slots attached to real surfaces or environmental
  features.
- Profile-specific bounds and one full-registration asset per named patch and
  profile. The same patch ID represents the same kind of local event across
  profiles; it need not use the same normalized rectangle.
- Dormant/restored landmark patches at a fixed authored scene location.
- A fallback CSS gradient using the regional palette.

The DOM-derived occlusion mask tells the generator which detail may be covered.
It must never become a central-hole composition brief. The unoccluded base scene
must be coherent and attractive without editor, patches, character, or landmark.

Shallow layout:

- Reuse and crop the wide scene initially.
- Hide nonessential patches, ambient effects, and the character when needed,
  matching the existing landscape-phone behavior.
- Never shrink the editor, command tray, or keyboard merely to preserve art.
- A dedicated 4:1 shallow asset may be added only if viewport validation proves
  that the wide crop is consistently poor.

Across all variants:

- Registered patches and base use exactly the same cover transform and focal
  position.
- Environmental art has no arbitrary runtime `x`, `y`, or `scale`.
- Patch-site planning uses a visibility heatmap calculated from real cover
  transforms, DOM occlusion masks, character exclusion zones, and representative
  board bounds. Favor the lower third only where that evidence supports it.
- A semantic slot may be ineligible for a profile if no plausible,
  sufficiently visible surface exists. Runtime skips it instead of moving it
  freely.
- Characters remain a separate intentional guide overlay.
- Art may crop; functional UI may not.
- The same semantic scene must be recognizable in each variant.
- Switching variants must not visibly stretch an image or move the editor.

Unit location seeds:

| Units | Region | Suggested locations |
|---|---|---|
| 1–4 | Moonroot Ruins | Mode Lantern grounds; Wayfinder crossroads; Scribe’s Spring; Grammar Gate |
| 5–7 | Starwater Sanctuary | Starneedle terrace; Nested Garden; Prism Crossing |
| 8–10 | Archive of Echoes | Memory cabinet chamber; Far Beacon passage; Echo Clock gallery |
| 11–14 | Brass Meridian | Meridian route chamber; Mirror Loom hall; Echo Foundry; Meridian Engine convergence |

These are thematic seeds, not mandatory compositions. The five-candidate funnel
must still explore environment-led and asymmetric alternatives.

### World 1: Moonroot Ruins

Units: 1–4  
Functional theme in `auto`: `moonroot`

Visual identity:

- Ancient forest sanctuary at blue-green moonlit dusk.
- Mossy dark stone, enormous roots, shallow still water, small amber lanterns.
- Violet spores and turquoise mineral veins as restrained accents.
- Friendly and mysterious, never threatening.
- Landmarks feel handcrafted by a lost culture and partially reclaimed by plants.

Scene-detail vocabulary (integrate in context; never ship as free structural props):

- Root arch.
- Mossy broken pillar.
- Hanging amber lantern.
- Moonflower cluster.
- Turquoise mineral seam.
- Stone causeway edge.

### World 2: Starwater Sanctuary

Units: 5–7  
Functional theme in `auto`: `deepwater`

Visual identity:

- Nocturnal sanctuary built across dark reflective water.
- Glass observatory pieces, slim stone islands, star reflections, translucent reeds.
- Cyan and pale violet light with sparse warm gold navigation points.
- More precise and spacious than Moonroot.
- Structures suggest lenses, nesting, alignment, and reflection without literal command symbols.

Scene-detail vocabulary (integrate in context; never ship as free structural props):

- Floating star lens.
- Translucent reed cluster.
- Mirror-stone edge.
- Slim observatory pillar.
- Prism shard group.
- Small bridge of glass panes.

### World 3: Archive of Echoes

Units: 8–10  
Functional theme in `auto`: `glass`

Visual identity:

- Warm subterranean archive carved into dark stone.
- Crystal drawers, suspended shelves, distant beacons, quiet clockwork.
- Teal glass, muted brass, amber memory lights, violet shadows.
- Cozy and wondrous rather than dusty or academic.
- Repetition appears through rhythm and repeated forms, not copied text.

Scene-detail vocabulary (integrate in context; never ship as free structural props):

- Crystal drawer stack.
- Suspended shelf.
- Memory vial cluster.
- Brass beacon.
- Causeway railing.
- Clock wheel group.

### World 4: Brass Meridian

Units: 11–14  
Functional theme in `auto`: `ember`

Visual identity:

- Vast precision workshop and command observatory beneath a dark ridge.
- Brass rails, copper conduits, glass lenses, controlled ember light, cyan current.
- Powerful but not grim, industrial, smoky, or militaristic.
- Spatial motifs emphasize endpoints, routes, pattern matching, recording, and coordinated mechanisms.
- The final Meridian Engine visually incorporates subtle material echoes from all prior worlds.

Scene-detail vocabulary (integrate in context; never ship as free structural props):

- Copper conduit arch.
- Brass endpoint rail.
- Pattern lens.
- Recorder cylinder.
- Selector fork.
- Engine current junction.

## Exact asset inventory and naming

Runtime assets should use this structure:

```text
assets/worlds/
  moonroot-ruins/
    scenes/
      mode-lantern-grounds/
        tall/
          base.webp
          phase-a.webp
          phase-b.webp
          phase-c.webp
          landmark-dormant.webp
          landmark-restored.webp
        compact/...
        wide/...
      wayfinder-crossroads/...
      scribes-spring/...
      grammar-gate-court/...
  starwater-sanctuary/
    scenes/...
  archive-of-echoes/
    scenes/...
  brass-meridian/
    scenes/...
  story/
    intro-connected.webp
    intro-interrupted.webp
    intro-nix-threshold.webp
```

Reaction assets should use:

```text
assets/characters/<character-id>/reactions/
  attentive.webp
  puzzled.webp
  encouraging.webp
```

Required generated source outputs:

| Asset class | Source count | Runtime count | Notes |
|---|---:|---:|---|
| Unit `4:3` candidate compositions | 70 | 14 | Five materially different candidates per unit; one explicitly approved |
| Approved `4:5` tall profiles | 14 | 14 | Conversational responsive edits |
| Approved `16:9` wide profiles | 14 | 14 | Conversational responsive edits |
| Compact patch candidates | 700 | 0 | Ten slots × five candidates × 14 units; review artifacts only |
| Approved responsive patch derivatives | 280 | Up to 280 | Two derived profiles × ten approved slots × 14 units |
| Approved registered patch assets | — | Up to 420 | Ten approved slots × three profiles × 14 units |
| Dormant/restored landmark patches | 84 | Up to 84 | Two states × three profiles × 14 units |
| Intro story images | 3 | 3 | Shared first-launch story |
| Nix reaction poses | 3 | 3 | First reaction vertical slice |
| Remaining phase-one guide poses | 33 | Up to 33 | Eleven guides × three poses; generate only after Nix approval |

The initial Moonroot vertical slice therefore needs only:

- Four approved canonical scenes, one for each of Units 1–4.
- Tall, compact, and wide bases for those four scenes.
- Ten approved registered environmental detail patches per profile.
- Registered dormant/restored landmark patches per profile.
- Regional CSS ambient effects and fallback gradient.

Do not put prompt experiments, rejected candidates, or uncompressed 2K/4K
masters into the production asset tree. Keep scripts and approval metadata under
`scripts/world-art/`, generated review artifacts under
`artifacts/world-generation/`, and only approved derivatives under
`assets/worlds/`.

## Nano Banana production workflow

### Model selection

As of July 2026:

- Use **Nano Banana Pro / `gemini-3-pro-image`** for the first master composition of each world, the final intro key art, and difficult landmark designs. Google positions it for professional asset production, complex instructions, and precision control.
- Use **Nano Banana 2 / `gemini-3.1-flash-image`** for alternative compositions, controlled edits, responsive derivation, registered patches, dormant/restored variants, and character poses. Google positions it as the general workhorse with strong multiple-reference and consistency support.
- Do not build a new Imagen workflow. Google recommends Nano Banana for image generation and lists Imagen shutdown for August 17, 2026.
- Generate master art at 2K. Use 4K only when a selected image genuinely needs local cropping or cleanup; runtime files should be downscaled and compressed.

Official references:

- [Nano Banana image generation, editing, prompting, references, and model selection](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 3.1 Flash Image model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image)

Google’s current guidance supports multi-turn editing, detailed context-rich prompts, stepwise instructions, and multiple reference images. Nano Banana 2 supports high-fidelity object references and character consistency references. Use a conversational edit of the approved result for variants instead of regenerating each state from an unrelated prompt.

### Reference bundle

Before generating world assets, prepare:

1. `assets/enchanted-ruins.png` as the strongest existing mood reference.
2. `assets/world-kit.png` as the existing material and palette reference.
3. The previously approved regional scene, when consistency with an existing
   region is useful.
4. DOM-derived tall, compact, and wide masks from representative live board
   states.

For a world-generation request, attach the ruins, world kit, and layout mask. Do not attach more references merely because the model permits them.

For character poses, attach only the canonical idle PNG for that character plus one approved pose from the same production batch when available.

### Generation acceptance loop

For every unit scene:

1. Generate five materially different `4:3` candidates:
   landmark/destination; environmental vista; path/arrival; intimate
   architectural or habitat detail; experimental asymmetric composition.
2. Ensure at least two candidates are environment-led rather than landmark-led.
3. Reject candidates with pseudo-text, inconsistent perspective, noisy central regions, or recognizable borrowed imagery.
4. Composite every candidate into the live UI at representative real board
   bounds before reviewing it.
5. Record exactly one explicit approval with candidate ID, source hash, date,
   and review notes.
6. Generate aspect derivatives only when the scene approval gate succeeds.
   Generate responsive patch derivatives only when the corresponding compact
   patch candidate is explicitly approved.
7. Downscale to runtime dimensions with nearest-neighbor or a pixel-art-aware method.
8. Export WebP or AVIF for opaque scenes and PNG/WebP for transparency.
9. Inspect the alpha channel. “Transparent background” is a request, not a guarantee.
10. Test at actual phone size before accepting detail.
11. Record model ID, prompt, references, date, source dimensions, runtime dimensions, and approval state in the world manifest.

### Unit-scene candidate prompt

Use this structure with Nano Banana 2. Replace the unit location, landmark
vocabulary, conceptual feeling, and one of the five candidate directions.

```text
Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original [REGION] location for [UNIT].
Scene/backdrop: [UNIT LOCATION].
Landmark vocabulary: [LANDMARK], integrated into real terrain or architecture.
Conceptual feeling: [LEARNING CONCEPT EXPRESSED SPATIALLY].
Style/medium: polished original 2D pixel-art fantasy matching the attached world
references in rendering language, material vocabulary and regional palette.
Composition/framing: 4:3 landscape. [CANDIDATE DIRECTION]
UI occlusion reference: The attached mask records where live HTML may cover the
art. It is measurement data only. Do not reproduce its rectangle, hatching,
shape, color or emptiness. The scene must remain coherent without the editor.
Constraints: coherent background, middle ground and foreground; every object
supported by terrain or architecture; no characters.
Avoid: a generic central black hole; editor-shaped cavity; floating objects;
isolated prop-sheet elements; writing; symbols; code; UI; pseudo-text; watermark.
Output one 2K 4:3 image.
```

World substitutions:

**Moonroot Ruins**

```text
An ancient forest sanctuary at blue-green moonlit dusk: enormous roots framing
the sides, moss-covered dark stone, shallow still water, a few tiny amber
lanterns, restrained violet spores and narrow turquoise mineral veins. The mood
is warm, mysterious and safe. Handcrafted ruins are partially reclaimed by
plants. Avoid horror, dense jungle clutter, bright daylight and top-down map
perspective.
```

**Starwater Sanctuary**

```text
A nocturnal sanctuary built across dark reflective water: distant glass
observatory structures, slim stone islands, star reflections, translucent
reeds, pale cyan and violet light, and sparse warm-gold navigation points. The
space feels precise, open and contemplative. Suggest lenses, alignment and
reflection through architecture without symbols or writing. Avoid outer space,
modern science equipment and neon cyberpunk clutter.
```

**Archive of Echoes**

```text
A warm subterranean archive carved into dark stone: crystal drawers, suspended
shelves, distant beacons and quiet clockwork forms. Use teal glass, muted brass,
amber memory lights and violet shadows. The place is cozy, wondrous and ordered,
with repeated architectural rhythms. Avoid readable books, labels, dusty realism
and steampunk clutter.
```

**Brass Meridian**

```text
A vast precision workshop and command observatory beneath a dark ridge: brass
rails, copper conduits, glass lenses, controlled ember light and narrow cyan
currents. The space feels powerful, exact and welcoming. Use endpoints, routes,
pattern alignment and coordinated mechanisms as abstract spatial motifs. Avoid
smoke, weapons, factories, grim industrial decay and excessive gears.
```

### Portrait expansion prompt

Run this only after approval, as an edit of the approved `4:3` scene:

```text
Create the tall responsive profile of this explicitly approved scene. Recompose
and extend it vertically to 4:5 while preserving the location, landmark
identity, material logic, perspective and grounded attachments. Use the
attached DOM mask only as occlusion measurement; never draw its shape or a
central cavity. Preserve meaningful grounded foreground below the editor and
useful atmosphere above it. Add no characters, writing, UI or text. Output 2K.
```

### Wide expansion prompt

Run this as a separate edit of the same approved `4:3` scene:

```text
Create the wide responsive profile of this explicitly approved scene. Recompose
and extend it horizontally to 16:9 while preserving the location, landmark
identity, material logic, perspective and grounded attachments. Continue
coherent traversable scenery into both sides. Use the DOM mask only as
occlusion measurement and do not draw its shape or emptiness. Add no characters,
writing, UI or text. Output 2K.
```

For a shallow landscape-phone board, first test a deliberate centre crop of the
16:9 output. Only if that fails, make a further conversational 4:1 expansion
whose central identity and low-contrast editor region remain unchanged.

### Registered-patch method

Do not generate structural prop sheets. For each approved scene and profile:

1. Calculate a cross-profile visibility heatmap from the actual CSS cover
   transforms, DOM editor masks, guide-character exclusion zones,
   hidden-backdrop states, and representative phone/tablet/desktop bounds.
2. Inventory ten semantic compact-profile objects or surfaces. Record exact
   visual descriptions, support surfaces, bounds, measured visibility, and five
   substantial transformation ideas. Exclude the authored landmark.
3. Decode the shipped compact board once to a lossless PNG. For every
   candidate, send that complete PNG as the first Gemini image and a small
   contextual crop with a high-contrast locator box as the second image.
4. State explicitly that Image 1 is the exact edit target, Image 2 is
   measurement-only locator markup, the output must be a complete board, the
   target needs a new readable silhouette, and all other board geometry and
   content must remain as close to Image 1 as possible.
5. Generate five 1K complete-board edits for every inventory site. Keep all
   decodable results and export a separate boxed/labelled review copy for each.
   Do not locally paste a generated crop into the scene.
6. During WP-03P-A, run mechanical checks only and do not infer an aesthetic
   verdict from a computer-vision diff. Do not extract or promote patch pixels.
7. Stop for personal selection. Record exactly ten explicit winners, their
   hashes, model, prompts, source hashes, and date. Winners may share a site.
8. During WP-03P-B, compare each selected complete edit with the exact full
   board input, derive a conservative changed-pixel mask, discard low-level
   preservation noise, feather only where inspection supports it, and export a
   full-canvas RGBA compact patch for human review.
9. Locate a semantically corresponding supported site separately in tall and
   wide. Recreate the approved change by sending that complete profile board
   plus its own locator crop to Gemini; never reuse compact normalized bounds.
10. Repeat diff derivation, registration checks, and full-scene human review,
    then store every approved winner as a full-canvas transparent asset whose
    dimensions exactly match its profile base.

Perfect physical lighting is unnecessary; consistent attachment, perspective,
and local material logic are mandatory.

The existing Moonroot `phase-a`, `phase-b`, and `phase-c` assets were generated
locally with feathered brightness, saturation, contrast, and tint adjustments.
They prove exact registration and alpha compositing only. They must not be
promoted, renamed, or counted as approved patch art.

### Patch selection at runtime

- On activity entry, draw one eligible patch from a shuffled bag scoped to the
  unit and session.
- Keep that patch ID stable while the activity is rendered, reset, solved, or
  resized. Profile changes resolve the same semantic ID to another profile
  asset.
- Do not repeat a patch until the bag is exhausted; then reshuffle.
- A direct deep link initializes a bag and selection normally.
- Tests inject a fixed random seed and assert selection stability, no-repeat
  behavior, profile continuity, and safe handling of missing/ineligible media.
- Learning phase remains available as presentation metadata but does not drive
  patch selection.
- Dormant/restored landmark state remains controlled only by unit completion.

### Patch-generation cost envelope

Use 1K Nano Banana 2 outputs for complete-board edits; the boxed review copy is
assembled locally and costs no additional generation call. The additional
full-board and locator inputs add only image/text input tokens; 1K image output
still dominates the request cost. Current
Vertex AI standard pricing lists a 1K output at approximately `$0.067`, 2K at
`$0.101`, and Flex/Batch at roughly half those rates. Input-image and text
tokens add a small variable amount.

For one scene:

- 50 compact candidates: about `$3.35` standard at 1K.
- 20 tall/wide winner recreations: about `$1.34` standard at 1K.
- Total after ten approvals: about `$4.69`, plus input tokens and retries.

For all four Moonroot scenes, the same 280-output funnel is about `$18.76`
standard or `$9.52` with Flex/Batch, plus input and retries. Generating five
candidates independently for all three profiles would require 600 outputs and
is deliberately avoided.

Pricing reference:
[Vertex AI generative AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing).

### Landmark-generation method

Generate each dormant landmark with Nano Banana Pro or Nano Banana 2 using the approved world master as reference. Then create the restored state through a conversational edit of the approved dormant result.

Dormant prompt:

```text
Using the attached approved Vim Wilds world as the exact style, palette,
material, lighting and perspective reference, create one isolated production
landmark asset for compositing into that world.

Landmark: [DORMANT SPECIFICATION]

The landmark is dormant but intact enough to understand. Centre the complete
object in a square canvas with generous empty space around it. Use the same
slightly elevated side-on perspective as the reference world. Preserve a strong
silhouette at 96 CSS pixels. Use a single flat saturated magenta background
(#ff00ff), with no texture and no cast shadow touching it, for local background
removal. Include no characters, labels, letters, numbers, code, keyboard keys,
captions, pseudo-writing, logos or watermark. Output one 1K square image.
```

Restored conversational edit:

```text
Keep the landmark's exact geometry, silhouette, camera, scale, position,
materials and pixel-art rendering. Change only its state from dormant to fully
restored according to this specification:

[RESTORED SPECIFICATION]

Keep the same flat magenta background and identical canvas registration so the
dormant and restored images can crossfade without jumping. Add no text, symbols,
characters or new unrelated objects. Output one 1K square image.
```

### Exact landmark specifications

| ID | Dormant specification | Restored specification |
|---|---|---|
| `mode-lantern` | A waist-high ancient lantern with four nested glass rings around one dim amber core; rings misaligned and differently oriented; moss at the stone base | Four rings align concentrically but remain visually distinct through amber, cyan, violet, and warm-cream edge light; the central flame becomes steady |
| `wayfinder` | A circular stone-and-brass wayfinder with four disconnected path arms; central needle resting diagonally; thin roots across two arms | Four arms align into a clear cross of paths; the needle stands centred; restrained cyan light reaches each endpoint |
| `scribes-spring` | A small stone spring shaped around a suspended quill-like crystal; one channel split; liquid light stopped below the break | The channel joins cleanly; turquoise liquid light flows through it; the suspended crystal gains a soft amber edge |
| `grammar-gate` | A compact arch gate made of two visibly complementary halves with a gap at the centre; left half suggests stored force, right half a path-like channel | The halves lock together at the centre; one controlled line of light travels through the arch; the opening is clear and calm |
| `starneedle` | A floating observatory lens above a slim stone stand; lens tilted away; only two faint distant points visible | Lens faces forward; several precise star points come into focus; one narrow cyan beam connects the lens and stand |
| `nested-garden` | Three concentric botanical arches, outer arch dormant, inner forms closed and tangled | Outer, middle, and inner arches become clearly readable; restrained growth blooms from outside inward while preserving all boundaries |
| `prism-crossing` | Three separated translucent panes: a narrow ribbon, a horizontal row, and a rectangle; panes cloudy and misaligned | The three panes align into a traversable glass crossing while retaining their distinct shapes; crisp cyan-violet edges illuminate |
| `memory-archive` | A compact cabinet of crystal drawers; one captured crystal rests outside; most drawers dark | The crystal is seated in one drawer; several deliberately different drawers illuminate; no labels or writing appear |
| `far-beacons` | Two miniature distant beacons on separate stone bases with a broken dark span between them | A thin continuous thread of amber-cyan light connects the beacons; both lights become steady; bases remain unchanged |
| `echo-clock` | A compact clockwork assembly with one primary wheel and three matching secondary wheels; all stopped at different angles | The first wheel becomes active and the same phase propagates through the three matching wheels; add restrained repeated amber highlights |
| `meridian-table` | A brass cartographic table with two unlit endpoint pins and several disconnected route rails | Both endpoints illuminate and exactly one continuous cyan route connects them; unrelated rails stay dark |
| `mirror-loom` | A glass-and-brass loom with several threads passing through a tilted pattern lens; matching threads are dim and misrouted | The lens aligns; only a repeated subset of threads changes to amber while nonmatching threads remain cyan and untouched |
| `echo-foundry` | A compact recorder cylinder facing three silent mechanisms; the cylinder slot is empty | One luminous movement pattern is stored in the cylinder and replayed as the same three-stage light sequence across all mechanisms |
| `meridian-engine` | A large but compact engine core with four material quadrants—rooted stone, star glass, memory crystal, and brass conduit—disconnected around a dark centre | All four quadrants connect without losing their material identities; one controlled current circulates through the complete engine; centre becomes warm white |

### Intro key-art prompts

Generate Panel 1 with Nano Banana Pro using the four approved world masters as references:

```text
Create a cinematic but restrained 2D pixel-art story illustration for the
original Vim Wilds mobile learning game. Show a distant connected panorama of
four regions: Moonroot Ruins, Starwater Sanctuary, Archive of Echoes and Brass
Meridian, using the attached approved world images as exact references. Connect
their restored landmarks with thin amber and cyan currents. Compose for 16:9,
with broad dark negative space in the lower third for real HTML story copy.
Include no characters, text, letters, code, UI, symbols, captions or watermark.
This is a unified original landscape, not four screenshots and not a map.
Output at 2K.
```

Create Panel 2 as a conversational edit:

```text
Keep the exact panorama, camera, region geometry, palette and composition.
Change the world to its dormant state: one current ends before reaching its
destination, landmarks become dim, several light connections drift slightly
out of alignment, and the mechanisms are quiet. Depict interruption rather than
destruction. Preserve the broad dark lower-third space. Add no characters,
text, symbols, UI, disaster, fire or threatening imagery. Output at 2K 16:9.
```

Create Panel 3 with the approved Moonroot master and canonical Nix idle PNG:

```text
Create a cinematic 2D pixel-art story illustration for the original Vim Wilds
mobile learning game. Preserve the attached Moonroot Ruins world and the exact
canonical design, silhouette, colors, clothing, staff, wings, antennae and
rendering of Nix. Place Nix at the Moonroot threshold, small in the scene but
clearly readable, holding the lantern toward the dormant Mode Lantern. A narrow
warm light connects Nix and the landmark. Compose for 16:9 with broad dark
negative space in the lower third for real HTML story copy. Include no generated
text, code, UI, captions, logos, extra characters or watermark. Output at 2K.
```

### Character reaction-pose prompt

Start with Nix only. Once the pose language is approved, repeat for the selected unit guides. Use Nano Banana 2 with the character’s canonical idle PNG and the approved Nix pose as references.

Generate three poses per supported character:

```text
The first attached image is the canonical production reference for an original
Vim Wilds character. The second image, when supplied, is an approved pose-style
reference from the same game.

Create exactly the same character in a new [POSE] production pose. Preserve the
exact species, face, silhouette, proportions, costume, permanent props, number
of limbs, wings and antennae, pixel-art rendering, outline treatment, palette,
camera angle and scale. This is a pose change, not a redesign.

[POSE ACTION]

Keep the full body visible and centred in a 1:1 canvas with generous margins.
Make the silhouette readable at 96 CSS pixels. Use a single flat saturated
magenta background (#ff00ff) with no texture or cast shadow for local background
removal. Include one character only, with the canonical props attached. Include
no text, letters, code, UI, symbols, captions, watermark, scenery or additional
objects. Output one 1K square image.
```

Pose substitutions:

- `attentive`
  - “The character leans forward very slightly, gaze focused inward toward the editor, permanent prop held steady, alert and interested rather than excited.”

- `puzzled`
  - “The character makes a small thoughtful head tilt and one restrained questioning gesture. The emotion is curious and supportive, never disappointed, sad, mocking or alarmed.”

- `encouraging`
  - “The character settles into a calm open posture with a small approving gesture toward the learner. The emotion is patient confidence, not celebration.”

Phase-one supported cast:

- Nix
- Vela
- Tatter
- Cinder
- Orin
- Bramble
- Prism
- Mica
- Luma
- Tock
- Puddle
- Cairn

The remaining characters keep the idle-image fallback until a later batch. Do not block the reaction system on a complete 15-character pose library.

## Animation specification

All durations are targets and may be tuned after device testing. No animation may serialize behind input or block the next key.

### Board ambience

- Background drift: optional 2–4px transform over 12–18s, alternating, only on larger canvases.
- Fog or water overlay: opacity variation between 0.12 and 0.22 over 8–12s.
- Motes: no more than 8 visible particles; 6–10s lifetimes.
- Landmark dormant pulse: 3.2s opacity/glow cycle, no scale pumping.
- Foreground parallax: no more than 3px and disabled on coarse pointers by default.
- Character idle: retain the existing small 3px bob.

Reduced motion:

- No drift, particles, parallax, or spatial travel.
- Keep a static backdrop, static landmark, and state crossfades.

### Vim effects

- Operator-pending tension: editor edge glow appears in 90ms and remains static until resolution or cancellation.
- Range-resolution wave: 180–240ms across the exact changed range.
- Visual Character: existing selection plus a subtle continuous linear edge.
- Visual Line: existing selection plus a row-wide top/bottom edge.
- Visual Block: crisp rectangular perimeter; no bloom over code glyphs.
- Yank capture: 160–220ms contraction toward the register/status area; code remains unchanged.
- Put materialization: 180–260ms highlight of inserted range.
- Dot-repeat: reuse the previous change’s effect with 70% duration and 70% intensity.
- Macro replay: one small record pulse while recording; replay effects use the ordinary command effects at reduced intensity.
- Substitution/global: affected matches illuminate together for 100ms, then transformed ranges resolve within 260ms.

Reduced motion:

- Replace travel with a 100–160ms range-color crossfade.
- Preserve exact affected-range information.

### Character reactions

- First incorrect key: no character reaction.
- Second consecutive incorrect key: `puzzled` pose for 600ms.
- Third consecutive incorrect key: `encouraging` pose for 900ms and the existing hint affordance may become more visually available.
- Accepted progress: cancel the reaction immediately and return to attentive or idle.
- Operator-pending: attentive pose may remain while waiting.
- No reaction loops.
- Reactions never move the character over code.

Reduced motion:

- Instant pose swap with a 100ms opacity crossfade.

### Unit-completion transition

Normal choreography:

1. Transition surface fades in over 220ms; Continue and Skip are already available.
2. World backdrop drifts by at most 2% over the full scene.
3. Dormant landmark is visible immediately.
4. Guide action begins at 300ms.
5. A code-native light path reaches the landmark between 700 and 1,200ms.
6. Dormant and restored landmark states crossfade with a masked glow over 700–1,000ms.
7. Completion copy appears at 900ms.
8. Next hook appears with the Continue action at 1,400ms.
9. Scene settles by 4s.

Existing character animations may enhance step 4 when already downloaded. Required fallback:

- Idle or attentive still.
- One 4–8px CSS movement.
- Prop/hand glow.
- Landmark restoration proceeds without animated WebP.

Recommended existing action mapping:

- `magic-flourish`: Mode Lantern, Starneedle, Nested Garden, Prism Crossing.
- `project-reveal`: Wayfinder, Scribe’s Spring, Grammar Gate, Memory Archive, Meridian Table, Mirror Loom, Meridian Engine.
- `prop-trick`: Far Beacons, Echo Clock, Echo Foundry.

Reduced motion:

- 150ms surface fade.
- Immediate guide still.
- 200ms dormant/restored landmark crossfade.
- Copy visible immediately.

### Responsive story presentation

The three first-launch illustrations remain 16:9 media panels rather than
full-bleed backgrounds. This lets one approved image work consistently:

- Portrait phone/tablet: contained 16:9 image above HTML copy and actions.
- Square canvas: contained image above a compact copy block.
- Wide desktop/tablet: image and copy may use a balanced two-column layout.
- Shallow phone landscape: image on one side, copy/actions on the other; omit
  nonessential ambience and keep Skip/Continue visible without document scroll.

Unit-completion scenes use the active unit’s tall, compact, or wide base plus
its registered restored-landmark patch, so they follow the same board-profile
selection as exercises. Story text is always HTML and must never depend on a
particular crop.

## Selective Vim-action system

### Principle

Do not visualize commands because they exist. Visualize semantics that are difficult, invisible, or especially satisfying:

- The range consumed by an operator.
- The geometry of a selection.
- A yank that changes no text.
- The exact location and shape of a put.
- Reapplication through dot-repeat.
- Reapplication through a macro.
- Multiple matches transformed by substitution or global operations.

Simple `h`, `j`, `k`, `l`, literal Insert-mode typing, `Escape`, and most single-character edits require no additional effect.

### Event classification

Classify an event using:

- Snapshot before a command or command group.
- Snapshot after completion.
- Document change ranges.
- Selection shape before/after.
- Register deltas.
- Accepted keys in the active command group.
- Current and prior mode.

Recommended semantic event contract:

```js
{
  type: "range-change" | "selection" | "capture" | "materialize" |
        "repeat" | "matches" | "jump" | "rewind",
  operation: "delete" | "change" | "indent" | "format" | "case" |
             "yank" | "put" | "dot" | "macro" | "substitute" | null,
  ranges: [{ from: [line, column], to: [line, column] }],
  selectionKind: "character" | "line" | "block" | null,
  source: "lesson" | "demo" | "physical",
  reducedMotion: false
}
```

Do not require hand-authored effect metadata for all 478 demonstrations and exercises. Optional metadata may override classification for genuinely ambiguous advanced commands.

### First release coverage

Implement in this order:

1. Operator and text-object range changes.
2. Visual Character, Visual Line, and Visual Block geometry.
3. Yank capture.
4. Characterwise and linewise put materialization.
5. Dot-repeat echo.

Validate first against Units 4, 6, 7, 8, and 10.

Second release:

6. Search match activation.
7. Substitution/global multi-range resolution.
8. Macro recording and replay.
9. Marks and long-range jump trace.
10. Undo/redo crossfade.

Validate against Units 5, 9, 11, 12, 13, and 14.

## Work packages

### WP-01R — Registered-scene presentation contract revision

**Recommended model:** Sol  
**Dependencies:** None  
**Visible change:** None by itself
**Risk:** Medium

**Session brief**

Supersede free prop placement with unit-level registered scenes while preserving
story data and the legacy board for unconverted regions.

**Work**

- Bump the presentation schema to version 2.
- Keep regional identity, palette, ambient vocabulary, guide, landmark ID, and
  exact story copy.
- Add `sceneId`, a future-compatible `scenes` map, tall/compact/wide profiles,
  registered patch assets, activity-selection metadata, and landmark patch
  states.
- Require an explicitly approved source before derivative generation.
- Require one selected scene for every unit whose region is converted.
- Preserve current output when the manifest is missing, invalid, or the unit is
  still intentionally on the legacy board.

**Acceptance**

- Every unit maps to exactly one world, guide, landmark, and story beat.
- Every converted unit maps to exactly one selected scene with all three
  profiles and consistent patch IDs.
- No runtime environmental asset exposes `x`, `y`, or `scale`.
- No lesson JSON changes.
- Existing app looks and behaves exactly the same.
- Content and PWA tests pass.

**Human validation**

- Open `content/presentation.json`.
- Confirm that unit order, guide, landmark, completion copy, and next hook match the story table.
- Temporarily rename one world ID in a local copy and confirm the content test explains the broken reference clearly.

### WP-02R — Registered scene renderer revision

**Recommended model:** Sol  
**Dependencies:** WP-01R
**Visible change:** Fallback layers only  
**Risk:** Medium

**Session brief**

Replace the failed free-placement layer with exact-canvas scene registration
while keeping a legacy fallback and unchanged editor geometry.

**Work**

- Add `world-presentation.js`.
- Observe `.world` bounds and assign tall, compact, wide, or shallow profiles
  at the corrected thresholds.
- Update the layout live on browser resize and `orientationchange` without rebuilding lesson state.
- Render base, active full-registration patches, optional CSS ambience, editor,
  and character as separate layers.
- Apply one identical cover transform and focal position to base and patches.
- Resolve the active environmental patch through a replaceable selection
  policy. WP-03P-B replaces the initial phase-based proof policy with the
  session-stable activity shuffle bag.
- Add a rune plate/contact shadow under the existing guide overlay.
- Add a loaded, cancellable 450–600ms reveal on unit entry only.
- Keep decorative layers non-interactive and clipped.
- Preserve the existing 12 × 9 placement grid for editor and character.
- Stop rebuilding hundreds of ground cells when a layered world is available.
- Keep `renderGround()` and the tile system as a temporary fallback.
- Separate world identity from functional theme preference.
- Expose stable data attributes for world ID, unit ID, scene ID, landmark ID,
  board profile, learning phase, mode, and reduced-motion state.
- Add a CSS-only placeholder for each world so final generated images are not required to test the renderer.

**Acceptance**

- Editor, completion panel, keyboard, hints, and character placement do not shift.
- Missing images fall back to the CSS world and never show broken-image icons.
- Reveal cancellation, missing/slow media, shallow mode, and reduced motion work.
- Dragging a desktop browser through shape thresholds swaps composition without stretching art or resetting the activity.
- `window.VimWilds` remains compatible.
- No extra document scrolling or overflow.

**Human validation**

- Disable images in browser developer tools: the app must remain attractive and fully usable.
- Inspect Units 1, 5, 8, and 11 to confirm each resolves a different world.
- Change theme preference and confirm UI colors change without changing the unit’s world identity.
- Inspect 360×740, 390×844, 412×915, 430×932, 432×960, tablet, and desktop.

### WP-03R — Four-unit Moonroot registered-scene proof

**Recommended model:** Terra  
**Dependencies:** WP-01R, WP-02R, 20 generated candidates, and four explicit approvals
**Visible change:** High  
**Risk:** Medium

**Session brief**

Rebuild only Moonroot Ruins for Units 1–4 as distinct registered scenes. Stop
after validation for personal review. Do not begin another region, story
transition, or Vim effect.

**Work**

- Disable all six old Moonroot structural props.
- Capture real DOM occlusion masks.
- Generate five composition directions per Moonroot unit and review all 20 in
  live composites.
- Record one explicit approval per unit, then derive tall and wide profiles.
- Add temporary registered proof overlays and dormant/restored landmark patches
  per approved scene. The proof overlays validate only dimensions,
  registration, alpha compositing, and profile switching; WP-03P replaces them
  with authored scene changes.
- Use board-container profile selection without device detection.
- Ensure theory, demo, exercise, choice, summary, completion, and keyboard-hidden states remain readable.
- Remove tile sprites only for Moonroot units; other units retain the legacy board.

**Acceptance**

- Units 1–4 are visibly different locations while retaining Moonroot materials,
  palette, and atmosphere.
- On small phones, cropping is intentional even when very little world is visible.
- No structure, lantern, plant, landmark, or character reads as accidentally
  floating or unsupported.
- Base scenes are coherent without editor, patches, character, or landmark.
- Patch pixels are dimensionally registered and do not escape declared bounds.
- Code contrast does not depend on the image.
- Core Moonroot media fits its assigned budget.

**Human validation**

- Compare Unit 1 and Unit 5 side by side: Unit 1 should clearly show the new board while Unit 5 remains the legacy control.
- On every target phone size, solve an exercise and inspect the completed-code state.
- On desktop, confirm the outer scene adds meaningful detail rather than repeated wallpaper.
- Slowly resize the desktop window from wide through compact to tall without reloading.
- Rotate a phone and a tablet in both directions and confirm that the editor state is preserved.
- Toggle each theme preference.
- Test with slow network and offline mode.

**Status**

Implemented. The four Moonroot base scenes and responsive profiles are
personally approved. The local brightness/tint proof overlays are not approved
environmental art and are superseded by WP-03P.

### WP-03P-A — Moonroot patch candidates and personal approval gate

**Recommended model:** Terra

**Dependencies:** Personally approved WP-03R Moonroot base scenes

**Visible change:** None in production; review artifacts only

**Risk:** Low

**Session brief**

Work on exactly one Moonroot scene. Build the mechanical patch-site,
generation, validation, and review workflow; generate 50 complete compact-board
edits; then stop for personal selection. Use Gemini Nano Banana through Vertex
AI only. Do not change runtime selection, extract or promote patches, derive
responsive winners, or begin another scene.

**Work**

- Recalculate tall, compact, and wide visibility across the target phone sizes,
  a landscape phone, portrait and landscape tablets, and desktop using the real
  board cover transforms, hidden-backdrop states, DOM occlusion masks, and
  guide-character exclusion zones.
- Define ten semantic compact-board inventory sites. Exclude the landmark and
  record each object's exact location, current appearance, support surface,
  bounds, measured visibility, and five site-specific transformation ideas.
- Decode the approved shipped board to lossless PNG. Generate five 1K Nano
  Banana 2 candidates per site through Vertex AI using the complete board as
  the exact edit target and a separate boxed locator crop as reference.
- Require a visible content change attached to the scene. Brightness-only,
  tint-only, floating, or unsupported changes are prohibited by the prompt,
  but do not auto-reject readable Gemini outputs on aesthetic grounds.
- Preserve each complete Gemini result unchanged and create a separate review
  copy with the intended target box and stable ID. Do not composite a crop.
- Run decoding, aspect-ratio, dimension, missing-output, and hash validation
  only. Do not use Codex aesthetic ranking or automated diff-based rejection.
- Emit an approval manifest with all 50 entries pending and make every
  derivative/promote command fail until ten winners are explicitly recorded.

**Acceptance**

- There are exactly ten slots and five candidates per slot for one scene.
- Every unmarked output is a complete Gemini-edited board. Every review copy
  shows the complete output, intended target box, and unambiguous ID.
- Candidate images, full-board input, locator input, prompts, and hashes are
  reproducible from metadata.
- No output is written to the shipped PWA asset tree.
- No candidate is treated as approved automatically.

**Human gate**

The product owner selects exactly ten candidates in total. They may select
multiple different states for one site and no state for another. Record each
selection, notes, full-board source hash, locator hash, generated hash, model
ID, prompt, and date. Do not continue to WP-03P-B until ten winners are
explicitly approved, unless the product owner reduces the winner count.

### WP-03P-B — Responsive patch integration and activity variety

**Recommended model:** Terra

**Dependencies:** One scene's completed WP-03P-A approval manifest

**Visible change:** Medium

**Risk:** Medium

**Session brief**

For exactly one approved Moonroot scene, recreate its ten selected semantic
changes for tall and wide, integrate the registered winners, replace the
brightness/tint proof overlays, and add stable randomized activity selection.
Stop after validation and personal review.

**Work**

- Generate one tall and one wide recreation for each approved compact patch
  using a newly authored profile-specific locator and the complete approved
  profile base. Never reuse compact normalized bounds.
- Derive the compact registered patch from the selected complete-board edit
  only now, using conservative diff isolation followed by human inspection.
- Run dimension, alpha, bounds, outside-diff, visibility, and missing-media
  checks; export full-scene responsive review composites.
- Promote only explicitly approved compact, tall, and wide assets.
- Replace the three proof overlay entries with ten semantic patch IDs and their
  per-profile metadata.
- On activity entry, select one eligible patch from a session-seeded,
  no-repeat shuffled bag. Hold it stable through all renders and profile
  changes.
- Add a deterministic seed hook for tests without changing
  `window.VimWilds` compatibility.
- Keep landmark state, CSS ambience, unit reveal, editor geometry, lesson data,
  command behavior, keyboard behavior, and functional theme selection
  unchanged.

**Acceptance**

- One real content-changing patch is visible during an ordinary activity when
  its active profile is eligible.
- The selected patch cannot change because of typing, reset, solve, resize,
  completion rendering, or unrelated state updates.
- Re-entering or entering another activity advances the shuffled bag; no patch
  repeats before exhaustion.
- Switching tall/compact/wide preserves the semantic patch ID and uses the
  corresponding registered asset.
- Every patch matches its base dimensions and has no changed pixels outside its
  declared region.
- Missing media, shallow layouts, reduced motion, offline loading, and direct
  deep links remain safe.

Repeat WP-03P-A, its human gate, and WP-03P-B scene by scene for the remaining
Moonroot units. Do not batch all four scenes before the first integrated scene
has been personally reviewed.

### WP-04A — Starwater unit-scene expansion — PAUSED

**Recommended model:** Terra  
**Dependencies:** Personally approved WP-03P for all four Moonroot scenes and
Starwater candidate approvals
**Visible change:** High  
**Risk:** Low

Do not start until all Moonroot WP-03P work is personally approved. Then generate and integrate
one distinct registered scene for each of Units 5–7, one unit at a time, using
the five-candidate and explicit-approval funnel. Reuse the renderer unchanged.

Human validation focuses on search, text-object, and Visual Block exercises at every target viewport.

### WP-04B — Archive unit-scene expansion — PAUSED

**Recommended model:** Terra  
**Dependencies:** Personally approved WP-03P for all four Moonroot scenes and
Archive candidate approvals
**Visible change:** High  
**Risk:** Low

Do not start until all Moonroot WP-03P work is personally approved. Then generate and integrate
one distinct registered scene for each of Units 8–10, one unit at a time.

Human validation focuses on register indicators, long buffers, hidden keyboard layout, and dot-repeat exercises.

### WP-04C — Meridian unit-scene expansion — PAUSED

**Recommended model:** Terra  
**Dependencies:** Personally approved WP-03P for all four Moonroot scenes and
Meridian candidate approvals
**Visible change:** High  
**Risk:** Low

Do not start until all Moonroot WP-03P work is personally approved. Then generate and integrate
one distinct registered scene for each of Units 11–14, one unit at a time.

Human validation focuses on Command-line UI, confirmation prompts, macros, substitution, and the densest buffers.

### WP-05 — Core-media offline and budget policy

**Recommended model:** Sol  
**Dependencies:** WP-03R; may run before WP-04 expansions
**Visible change:** None  
**Risk:** Medium

**Work**

- Extend the Vite PWA plugin to emit approved world, landmark, story, and reaction stills.
- Keep large animation WebPs optional unless explicitly reclassified.
- Add deterministic media-budget tests.
- Verify update-cache versioning when generated assets change.
- Document compression commands or a repeatable asset-normalization script.
- Fail the build on missing manifest assets.
- Do not silently precache source masters.

**Human validation**

- Install the PWA, go offline, restart, and visit one unit in each implemented world.
- Confirm backdrops, dormant landmarks, intro/story fallback, and reaction stills load.
- Confirm an unavailable large animation degrades to a still without a broken element.
- Inspect installed-cache size.

### WP-06 — Vim semantic-effect event contract

**Recommended model:** Sol  
**Dependencies:** None; independent of board work  
**Visible change:** None  
**Risk:** High

**Session brief**

Add a tested semantic-effect event contract without rendering effects and without changing Vim behavior.

**Work**

- Capture stable before/after snapshots at command or command-group boundaries.
- Include document change ranges and register deltas.
- Classify selection shape and mode transitions.
- Use accepted lesson/demo keys to identify dot and macro replay.
- Avoid emitting one semantic effect for every Insert-mode character.
- Add unit tests for classification.
- Add browser assertions that emitted effects match exact ranges for representative canonical solutions.
- Keep the public `window.VimWilds` interface unchanged; an additional diagnostic getter may be added if useful.

**Acceptance**

- No change to editor results, cursor, mode, registers, checkpoints, or timing.
- Representative events classify correctly for `dw`, `di(`, `yy`, `p`, `Ctrl-v`, `.`, substitution, and macro replay.
- Event ranges use document coordinates, not guessed DOM rectangles.

**Human validation**

- Enable a temporary diagnostic log.
- Complete one representative exercise from Units 4, 6, 7, 8, 10, 12, and 13.
- Confirm event type and range in the log.
- Disable the diagnostic log before handoff.

### WP-07 — Core Vim effects

**Recommended model:** Sol  
**Dependencies:** WP-06  
**Visible change:** High  
**Risk:** High

**Work**

- Implement operator/text-object range resolution.
- Implement distinct Visual Character, Visual Line, and Visual Block geometry.
- Implement yank capture.
- Implement put materialization.
- Implement dot-repeat echo.
- Use CodeMirror decorations or a view-owned overlay, not absolute positions guessed by `app.js`.
- Implement cancellation and cleanup on reset, activity navigation, undo, help, and completion.
- Add reduced-motion forms.
- Keep all effects below the timing limits in this document.

**Acceptance**

- Effects never change selections or documents.
- Rapid canonical input is not delayed.
- Effects clip within the editor and do not obscure glyphs.
- Every canonical solution still reaches the exact target state.

**Human validation**

- Use Units 4, 6, 7, 8, and 10.
- Test characterwise, linewise, and blockwise cases.
- Enter commands rapidly instead of waiting for effects.
- Reset during an effect.
- Navigate away during an effect.
- Enable reduced motion and repeat.
- Decide whether the effect explains the range at a glance; reject effects that merely look decorative.

### WP-08 — Advanced Vim effects

**Recommended model:** Sol  
**Dependencies:** Approved WP-07  
**Visible change:** High  
**Risk:** High

**Work**

- Search-match activation.
- Substitution/global multi-range resolution.
- Macro record and replay vocabulary.
- Mark and jump trace.
- Undo/redo state crossfade.
- Preserve prompt and confirmation readability.

**Human validation**

- Use Units 5, 9, 11, 12, 13, and 14.
- Confirm nonmatching text never receives a substitution effect.
- Confirm macros reuse normal command effects rather than playing one opaque animation.
- Confirm `u` and `Ctrl-r` remain instant.

### WP-09 — Character reaction state machine

**Recommended model:** Terra  
**Dependencies:** Approved Nix reaction poses; independent of Vim effects  
**Visible change:** Medium  
**Risk:** Medium

**Work**

- Add `character-reactions.js`.
- Support idle, attentive, puzzled, encouraging, and celebrating states.
- First incorrect input remains functional-only.
- Second consecutive mistake triggers puzzled.
- Third triggers encouraging.
- Correct progress cancels the reaction.
- Operator-pending may trigger attentive.
- Apply to guided and recall practice without altering accepted-input rules.
- Fall back to idle image when a pose is missing.
- Keep existing success animations.
- Add reduced-motion crossfades.

**Acceptance**

- No reaction to a single ordinary mistake.
- No mockery, sadness, or punishment.
- Reaction timers cannot leak into another activity.
- Missing pose assets are harmless.
- Characters never cover code.

**Human validation**

- Make one mistake, then recover.
- Make two consecutive mistakes.
- Make three consecutive mistakes.
- Alternate correct and wrong keys.
- Open a hint and reset during a reaction.
- Repeat with touch and physical keyboard.
- Verify the reaction feels supportive after repeated use, not merely charming once.

### WP-10 — Story and unit-transition infrastructure

**Recommended model:** Sol  
**Dependencies:** WP-01; can use CSS placeholders  
**Visible change:** High  
**Risk:** High

**Session brief**

Implement first-launch story and unit-completion transitions with placeholder art. Do not integrate final generated imagery in this package.

**Work**

- Add an accessible story surface to `play/index.html`.
- Implement the exact three-panel intro.
- Persist `introSeen`.
- Add Replay Story entry to settings or the table of contents.
- Intercept the final unit continuation action and show the unit story before navigating.
- Persist completed unit-story IDs only to control default replay.
- Add replay for completed unit stories.
- Render real HTML copy over placeholder layers.
- Continue and Skip are available immediately.
- Implement portrait/stacked, square/stacked, wide/two-column, and shallow/two-column story layouts.
- Preserve the active story panel and unit navigation target through orientation changes.
- Handle deep links: a direct `?unit=` or `?activity=` link should not be blocked by first-launch story unless it targets Unit 1 without an activity.
- Add reduced-motion behavior.
- Do not infer educational completion from story state.

**Acceptance**

- Existing ordinary exercise completion is unchanged.
- Intro appears once and is replayable.
- Unit story appears at the final continuation boundary, not after every lesson or exercise.
- Skip and Continue navigate correctly.
- Refreshing during a transition is safe.
- Story remains usable offline with placeholders.

**Human validation**

- Clear storage and open the default play URL.
- Skip from each intro panel.
- Finish or jump to the final summary of a unit and continue.
- Refresh during the transition.
- Resize the desktop window through tall, compact, and wide while each story panel is open.
- Rotate phone and tablet during the intro and a unit transition.
- Deep-link to a later unit and to a specific activity.
- Replay the intro and a completed unit scene.
- Enable reduced motion and a screen reader.

### WP-11 — Landmark restoration and final story art

**Recommended model:** Terra  
**Dependencies:** WP-10 and the approved world/landmark assets for the units being integrated. Final intro art requires all four approved world masters.  
**Visible change:** Very high  
**Risk:** Medium

**Work**

- Add the three approved intro images.
- Add all approved dormant/restored landmarks.
- Implement the exact unit choreography.
- Map existing character animations to actions with still/CSS fallbacks.
- Add per-world light colors and masks.
- Add story copy and next hooks from the manifest.
- Ensure dormant/restored assets share registration and do not jump.
- Use the current board-profile base and registered landmark state for unit transitions.
- Do not change story copy.

**Human validation**

- Watch all three intro panels.
- Watch all 14 unit transitions using a test navigation helper.
- Check every landmark for crossfade registration.
- Test with animations available, blocked, slow, and offline.
- Confirm the character action supports the landmark rather than drawing attention away from the copy.
- Confirm every scene can be understood from still states.

### WP-12 — Final accessibility, performance, and regression audit

**Recommended model:** Sol  
**Dependencies:** All selected packages  
**Visible change:** Possible polish only  
**Risk:** High

**Work**

- Run all validation required by `AGENTS.md`.
- Add browser coverage for story state, world fallback, effects, reactions, reduced motion, and offline media.
- Audit focus, dialog semantics, announcements, and skip/continue controls.
- Measure load, decoding, memory, and animation frame stability on representative mobile emulation.
- Test live shape changes, not only fixed viewport screenshots.
- Verify asset budgets.
- Verify no leftover Playwright/Vite processes.
- Remove diagnostic flags.

**Human validation**

- Complete one full unit normally on a phone.
- Complete one unit with reduced motion.
- Complete one unit offline.
- Complete one unit using a physical keyboard with the virtual keyboard hidden.
- Decide whether the game remains calmer during thinking than during success.
- Confirm story and visual effects can be ignored without losing educational information.

## Dependency graph

```text
WP-01R Registered-scene data
 ├─ WP-02R Registered-scene renderer
 │   └─ WP-03R Moonroot proof + personal approval gate
 │       ├─ WP-03P-A one-scene patch candidates
 │       │   └─ Personal patch approval gate
 │       │       └─ WP-03P-B responsive patch integration
 │       │           ├─ repeat WP-03P-A/B for remaining Moonroot scenes
 │       │           ├─ WP-04A Starwater
 │       │           ├─ WP-04B Archive
 │       │           └─ WP-04C Meridian
 │       └─ WP-05 Offline/media policy
 └─ WP-10 Story infrastructure
     └─ WP-11 Story art + landmarks

WP-06 Semantic effect events
 └─ WP-07 Core Vim effects
     └─ WP-08 Advanced Vim effects

Approved reaction poses
 └─ WP-09 Character reactions

All selected packages
 └─ WP-12 Final audit
```

Parallelism guidance:

- WP-01R/WP-02R and Nano Banana Moonroot exploration can run in parallel, but
  derivatives cannot run before explicit candidate approvals.
- WP-06 can run independently of all board and story work.
- Reaction-pose generation can run independently after the Moonroot art direction is approved.
- Run WP-03P-A and WP-03P-B on one scene before starting the next; every
  WP-03P-A batch contains a blocking personal approval gate.
- WP-04A, WP-04B, and WP-04C are conceptually independent but all touch shared manifests/styles; run sequentially unless separate branches are used.
- WP-09 and WP-10 both touch `app.js`/UI state and should not be implemented concurrently in one working tree.

## Sol versus Terra routing

Use **Sol** when correctness depends on cross-cutting architecture, editor semantics, state transitions, PWA behavior, or extensive test design:

- WP-01R
- WP-02R
- WP-05
- WP-06
- WP-07
- WP-08
- WP-10
- WP-12

Use **Terra** when the architecture is already established and the work is bounded visual integration, declarative expansion, CSS tuning, or a small state machine:

- WP-03R
- WP-03P-A
- WP-03P-B
- WP-04A
- WP-04B
- WP-04C
- WP-09
- WP-11

If a Terra session discovers that it must change the data contract, Vim event semantics, navigation model, or PWA architecture, stop that package and move the architectural decision to a Sol session.

## Suggested execution order

### Milestone 1 — Prove the new board

1. WP-01R, WP-02R, and WP-03R are complete; retain their approved Moonroot
   scenes and profiles.
2. Run WP-03P-A with Terra for one Moonroot scene and generate its 50 review
   candidates.
3. Personally choose exactly ten winners; multiple winners may use one site.
4. Run WP-03P-B with Terra for that scene.
5. Validate patch visibility, registration, responsive continuity, and
   per-activity shuffled selection in the live game.
6. Repeat WP-03P-A and WP-03P-B one Moonroot scene at a time.
7. Stop for personal review before generating another region.

Exit question:

> Does Unit 1 feel like it inhabits a memorable world on desktop/tablet while remaining just as readable and fast on a 360×740 phone?

If no, revise the master composition or renderer before proceeding.

### Milestone 2 — Prove learning-enhancing motion

1. WP-06 with Sol.
2. WP-07 with Sol.
3. Test operators, text objects, Visual Block, yank/put, and dot-repeat personally.

Exit question:

> Does the effect make the exact Vim range or invisible operation easier to understand, or is it only decoration?

Remove any effect that fails this test.

### Milestone 3 — Prove character reactions

1. Generate Nix attentive, puzzled, and encouraging poses.
2. WP-09 with Terra using Nix and idle fallbacks for other characters.
3. Use the game repeatedly before generating the remaining cast.

Exit question:

> After ten deliberately difficult exercises, do the reactions still feel supportive rather than repetitive?

### Milestone 4 — Prove story cadence

1. WP-10 with Sol using placeholders.
2. Generate the first four Moonroot landmarks.
3. Run a limited WP-11 with Terra for Units 1–4 while keeping placeholder intro art.
4. Complete Unit 1 naturally and judge the interruption cost.

Exit question:

> Does the unit transition feel earned and memorable while letting the learner continue immediately?

### Milestone 5 — Expand

1. Generate and integrate Starwater one unit scene at a time.
2. Generate and integrate Archive one unit scene at a time.
3. Generate and integrate Meridian one unit scene at a time.
4. Generate the three intro images now that all four master worlds are approved.
5. Generate remaining landmarks and approved guide poses.
6. Complete WP-11 across all units.
7. Add advanced Vim effects.
8. Complete the final audit.

## Session invocation template

For a coding session, use:

```text
Implement WP-XX from docs/gamification-implementation-plan.md.
Read the whole work-package section, its dependencies, the shared architecture
target, and AGENTS.md before changing files. Keep the scope to this package.
Preserve unrelated user changes. Run every validation required by the package
and AGENTS.md. Do not commit.
```

For a Nano Banana asset session, use the exact prompt and references specified in this document, preserve the interaction ID for controlled edits, and record every accepted asset in the presentation manifest or accompanying generation metadata.

### Exact Terra continuation prompt for one Moonroot scene

Start a fresh Terra session only after the previous scene has either completed
WP-03P-B or is deliberately paused. Replace both bracketed values and use this
instruction verbatim:

```text
Proceed with WP-03P-A from docs/gamification-implementation-plan.md for exactly
one Moonroot scene: unit [UNIT_ID], scene [SCENE_ID].

Read AGENTS.md, the whole WP-03P-A section, the Registered-patch method, and the
existing Wayfinder round-03 scripts and manifests before changing files. Reuse
the established workflow, but author a new scene-specific object inventory and
do not copy Wayfinder coordinates or descriptions.

Use only Gemini Nano Banana 2 / gemini-3.1-flash-image through Google Vertex AI
with application-default credentials. Never use an OpenAI image generator.
Capture the real phone, landscape-phone, tablet, and desktop visibility atlas.
Inventory ten compact-board objects or supported surfaces outside the landmark.
For each site, define five substantially different, scene-specific magical
transformations. Send Gemini the complete lossless compact board as Image 1 and
the boxed locator crop as Image 2, and request a complete-board edit.

Run the dry plan, report the exact paid-call count and budget cap, then execute
exactly 50 1K candidates. Preserve every decodable full-board output, make a
separate boxed review copy, perform no aesthetic ranking and no patch
extraction, update generation metadata and this plan only if the reusable
contract changed, and stop for my review. Do not start WP-03P-B, another scene,
or WP-04. Do not commit.
```

After the owner supplies ten filenames, start a separate Terra session with:

```text
Proceed with WP-03P-B from docs/gamification-implementation-plan.md for exactly
unit [UNIT_ID], scene [SCENE_ID], using only the ten winners I list below.
Record those explicit approvals first. Derive and inspect compact registered
patches from the selected complete-board edits, author new tall and wide
locators per semantic change, recreate them with Gemini Nano Banana 2 through
Vertex AI using each complete profile board plus its locator, and integrate
session-seeded no-repeat activity selection. Preserve the semantic winner ID
across profiles and activity rerenders. Run all package and AGENTS.md
validation, stop for review, do not start another scene or WP-04, and do not
commit.

[PASTE EXACTLY TEN WINNER FILENAMES HERE]
```

## Final recommendation

The Moonroot base-scene direction is approved. The immediate move is:

> Run WP-03P-A with Terra for one Moonroot scene, review its 50 full-scene
> boxed patch candidates personally, and only then run WP-03P-B to integrate
> the ten winners.

Repeat this one scene at a time and stop before WP-04.

This provides the fastest trustworthy answer to the central visual question
while leaving the editor, curriculum, keyboard, character assignment logic, and
completion feedback untouched.

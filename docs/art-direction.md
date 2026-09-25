# Art direction

How The Vim Wilds looks, moves, and tells its story, and how its art is made.
Read this before generating, regenerating, or redesigning any world, landmark,
story, or character art.

Where the rest lives:

- **Live data.** `content/presentation.json` owns worlds, unit scenes, guides,
  landmarks, remote-variant sites and timing, and all story copy. Nothing here
  overrides it; approved story copy is changed only by an explicit copy review.
- **Prompts.** [art-prompts.md](art-prompts.md) holds the exact Nano Banana
  prompts for scenes, variants, landmarks, intro panels, and character poses.
- **Pipeline.** `scripts/world-art/` generates, reviews, approves, derives, and
  promotes scene art; `scripts/characters/character_catalogue.md` and `.json` hold each
  character's permanent invariants.
- **Runtime media policy.** [media-and-story-infrastructure.md](media-and-story-infrastructure.md).

## Experience principles

Spectacle is spent at three timescales, and only at the larger ones.

- **During an exercise.** Real code is the visual priority. A rich but quiet
  world shows wherever there is space around the editor. The guide stays idle
  or attentive. Only semantically valuable Vim events get an effect, effects
  never delay input, and a wrong key gets functional feedback before any
  character reaction.
- **After an exercise.** Keep the completed code, the completion panel, the
  explanation of why the command worked, and immediate continuation. No
  full-screen world transformation.
- **After a unit.** A skippable illustrated transition: the guide performs one
  meaningful action, the landmark goes from dormant to restored, one or two
  short story lines appear, and Continue is available immediately.

The same experience must survive live changes between tall, compact, wide, and
shallow boards. Art may crop, simplify, or disappear; editor and input
behavior may not. Missing decorative media never blocks practice.

**Non-goals.** No navigable overworld and no character moved by Vim keys. No
per-exercise base board. No generated text, code, keyboard legends, or UI in
raster art. No full-screen takeover after ordinary exercises. No currencies,
energy, loot, punitive streaks, or global leaderboard. No required video, new
game engine, or runtime image generation. No effect for every key, and nothing
in validation, cursor movement, or progression depends on animation.

## Story

**Premise.** The Wilds were shaped by a precise command language. An
unfinished command fractured it: paths shifted, stored memories scattered, and
mechanisms stopped mid-action. The language was not destroyed; its grammar is
still embedded in the world, and learning Vim restores the capabilities needed
to reconnect it. The story is about learning and restoration — not prophecy,
combat, or rescuing the helpless. The learner becomes capable because they
understand the language.

**Tone.** Mysterious, warm, concise, intelligent. Never mock the learner. Keep
fantasy nouns out of instructional UI. Story copy appears only in the intro,
unit transitions, and replay; exercise titles and instructions stay
code-first. All copy is real HTML — no generated raster text.

**Shape.** Three first-launch panels (the connected Wilds, the interruption,
Nix at the Moonroot threshold), one restoration beat per unit with a next-place
hook, and a finale. Skippable from the first panel, replayable from contents or
settings, shown once by default.

## Rendering language

- Polished original 2D pixel-art fantasy suitable for a premium mobile game.
- Painterly pixel clusters, crisp silhouettes, restrained texture.
- Rich at large size but readable when cropped to a 390px-wide board.
- Deep navy and near-black foundations with controlled amber, turquoise,
  violet, and warm cream light.
- Slightly elevated side-on environmental perspective — not a top-down map.
- Three clear depth planes: background, middle ground, foreground.
- Nothing copied from another game: no characters, logos, maps, compositions.
- No UI, code, keyboard keys, letters, pseudo-writing, signs, or captions.
- No important object and no high-frequency contrast where code or the
  completion panel may sit.

## Worlds and units

Each unit has one registered scene, one guide, and one landmark. World
identity is chosen by unit; the user's theme preference controls only
functional UI colors, and `auto` resolves to the world's theme.

| Units | World | `auto` theme | Scenes (landmark) |
| --- | --- | --- | --- |
| 1–4 | Moonroot Ruins | `moonroot` | Mode Lantern Grounds, Wayfinder Crossroads, Scribe's Spring, Grammar Gate Court |
| 5–7 | Starwater Sanctuary | `deepwater` | Starneedle Observatory, Nested Garden, Prism Crossing |
| 8–11 | Archive of Echoes | `glass` | Memory Archive, Far Beacons, Beacon Glass Gallery, Echo Clock |
| 12–17 | Brass Meridian | `ember` | Meridian Table, Mirror Loom, Echo Foundry, Meridian Engine, Menders' Confluence, Keeper's Relay |

**Moonroot Ruins.** Ancient forest sanctuary at blue-green moonlit dusk. Mossy
dark stone, enormous roots, shallow still water, small amber lanterns; violet
spores and turquoise mineral veins as restrained accents. Friendly and
mysterious, never threatening. Landmarks feel handcrafted by a lost culture
and partly reclaimed by plants. *Detail vocabulary:* root arch, mossy broken
pillar, hanging amber lantern, moonflower cluster, turquoise mineral seam,
stone causeway edge.

**Starwater Sanctuary.** Nocturnal sanctuary built across dark reflective
water. Glass observatory pieces, slim stone islands, star reflections,
translucent reeds. Cyan and pale violet light with sparse warm-gold navigation
points. More precise and spacious than Moonroot; structures suggest lenses,
nesting, alignment, and reflection without literal command symbols. *Detail
vocabulary:* floating star lens, translucent reeds, mirror-stone edge, slim
observatory pillar, prism shards, small bridge of glass panes.

**Archive of Echoes.** Warm subterranean archive carved into dark stone.
Crystal drawers, suspended shelves, distant beacons, quiet clockwork. Teal
glass, muted brass, amber memory lights, violet shadows. Cozy and wondrous, not
dusty or academic. Repetition appears through rhythm and repeated forms, never
copied text. *Detail vocabulary:* crystal drawer stack, suspended shelf, memory
vials, brass beacon, causeway railing, clock wheels.

**Brass Meridian.** Vast precision workshop and command observatory beneath a
dark ridge. Brass rails, copper conduits, glass lenses, controlled ember light,
cyan current. Powerful but not grim, smoky, or militaristic. Motifs emphasize
endpoints, routes, pattern matching, recording, and coordinated mechanisms.
The Meridian Engine carries subtle material echoes of all prior worlds.
*Detail vocabulary:* copper conduit arch, brass endpoint rail, pattern lens,
recorder cylinder, selector fork, engine current junction.

## Responsive profiles

Art follows the **rendered board container**, never a device label. The
renderer measures the board and picks a profile:

| Profile | Board width ÷ height | Scene asset |
| --- | ---: | --- |
| `tall` | below 0.9 | `4:5` derivative of the approved scene |
| `compact` | 0.9–1.58 | the approved canonical `4:3` scene |
| `wide` | 1.58–2.4 | `16:9` derivative of the approved scene |
| `shallow` | above 2.4 | wide crop, with nonessential scenery suppressed |

- The same scene must be recognizable in every profile, and switching profiles
  must never stretch an image or move the editor.
- Base and overlays share one cover transform and focal position. Environmental
  art has no free runtime `x`, `y`, or `scale`.
- The DOM-derived editor mask is occlusion measurement only. It is never a
  composition brief: no central hole, no editor-shaped cavity. The base scene
  must be coherent with nothing on top of it.
- Shallow layouts hide nonessential ambience and the character when needed, and
  never shrink the editor, tray, or keyboard to preserve art. A dedicated 4:1
  asset is added only if viewport review proves the wide crop consistently poor.
- Characters are a separate, deliberate guide overlay and never move over code.

## What ships

```text
assets/worlds/<world-id>/scenes/<scene-id>/
  tall/base.webp  compact/base.webp  wide/base.webp
  variants/<site-id>-c01…c05.webp        # optional remote tier
assets/worlds/story/intro/  story/units/<unit-id>.webp  story/ending/
assets/characters/<character-id>/idle.png  animations/<action-id>.webp
```

- **Base scenes** — three profiles per unit, local and precached. A board is
  its base image and nothing else; until it loads, or if it never does, the
  board shows the world's plain colour, never a drawn pattern.
- **Remote scene variants** — owner-approved complete-board edits, ten named
  sites × five variants per scene, compact profile only. They stream one at a
  time from the production media origin as an opaque layer beneath the editor,
  from a shuffled no-repeat bag, and are never precached. Offline, on fetch
  failure, in shallow layouts, or with reduced motion, only the base shows.
- **Story art** — intro panels, one restoration painting per unit, and the
  finale. Lossless masters sit beside the runtime WebP.
- **Characters** — an idle still and approved reaction/action animations.

Earlier overlay plates — lesson-phase plates (`phase-a/b/c`) and dormant and
restored landmark plates — were local brightness-and-tint proofs. They were
retired and removed: the board does not change during a lesson, and the payoff
at the end of a unit is its painting.

Prompt experiments, rejected candidates, and 2K/4K masters never enter
`assets/`. Scripts and approval metadata live under `scripts/world-art/`;
review artifacts under the ignored `artifacts/world-generation/` and
`artifacts/character-generation/`.

## Motion

Visualize semantics that are hard to see or especially satisfying — not
commands because they exist:

- the range an operator consumed;
- the geometry of a Visual Character, Line, or Block selection;
- a yank, which changes no text;
- the location and shape of a put;
- reapplication through dot-repeat or a macro;
- many matches transformed by substitution or `:global`.

`h j k l`, literal typing, Escape, and most single-character edits get no
effect. Effects are classified from before/after editor snapshots, change
ranges, register deltas, and mode — not hand-authored per exercise.

**Character reactions.** No reaction to a first wrong key. A second
consecutive wrong key earns a brief puzzled pose, a third an encouraging one.
Accepted progress cancels the reaction at once. No reaction loops.

**Reduced motion.** No drift, particles, parallax, or spatial travel. Travel
becomes a short range-color crossfade that keeps the exact affected-range
information; poses swap instantly; the landmark goes straight to restored.

## Production workflow

### Models

As of July 2026:

- **Nano Banana Pro** (`gemini-3-pro-image`) for first master compositions,
  intro key art, and landmarks whose silhouette won't stabilize under edits.
- **Nano Banana 2** (`gemini-3.1-flash-image`) for alternative compositions,
  controlled edits, responsive profiles, variants, landmark states, and
  character poses.
- No new Imagen workflow; Google scheduled Imagen's shutdown for 2026-08-17.
- Generate masters at 2K; use 4K only when a selected image needs local
  cropping. Runtime files are downscaled and compressed.
- Generate through Vertex AI with application-default credentials. Do not use
  an OpenAI image generator.

Re-check model names and pricing against Google's
[image-generation documentation](https://ai.google.dev/gemini-api/docs/image-generation)
and [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
before a new batch. In July 2026 a 1K output cost about $0.067 standard (2K
about $0.101), with Flex/Batch at roughly half; a 50-candidate variant batch
for one scene came to about $3.35.

### References

- The approved scene being edited is always **Image 1** and the authority for
  geometry, perspective, palette, lighting, materials, and pixel scale.
- A locator-box crop, when supplied, is measurement-only and must never appear
  in the output.
- For new world scenes, attach one approved scene from the same region when
  consistency matters, plus the DOM-derived masks. Don't attach references
  merely because the model allows them.
- For character poses, attach only the character's canonical `idle.png` and at
  most one approved pose from the same batch.

### Scene acceptance loop

1. Generate five materially different `4:3` candidates: landmark/destination,
   environmental vista, path/arrival, intimate architectural detail, and an
   experimental asymmetric composition. At least two must be environment-led.
2. Reject pseudo-text, inconsistent perspective, noisy central regions, and
   recognizable borrowed imagery.
3. Composite every candidate into the live UI at real board bounds before
   judging it, and look at it at phone size.
4. Record one explicit approval: candidate ID, source hash, date, notes.
   Scripts must fail while approval is pending or when the approved source
   hash changes.
5. Only then derive tall and wide profiles, as conversational edits of the
   approved scene.
6. Downscale with a pixel-art-aware method, export WebP, and inspect any alpha
   channel — "transparent background" is a request, not a guarantee.
7. Record model, prompt, references, date, dimensions, and approval state.

The board art is final. Replace a board only when phone-size review finds a
concrete composition failure; "it could be better" does not qualify.

### Remote-variant method

1. Measure visibility from real cover transforms, editor masks, guide
   exclusion zones, and representative phone, tablet, and desktop boards.
2. Inventory ten semantic sites on the compact scene — real objects or surfaces,
   never the landmark — each with a description, support surface, bounds,
   measured visibility, and five substantial transformation ideas.
3. Read `scripts/world-art/patch-inventories/moonroot-motif-ledger.json` first.
   Give the new scene underused motif families, record them in the ledger, and
   do a duplicate-idea pass: the five ideas at one site must be distinct object
   concepts, not five versions of the same bird or lamp.
4. For each candidate, send the lossless complete board as Image 1 and a boxed
   locator crop as Image 2, and ask for a complete-board edit of the named
   object only. Never paste a generated crop into the scene.
5. Run mechanical checks only — decoding, dimensions, aspect, hashes, missing
   outputs — and keep every readable candidate. A person makes every aesthetic
   call.
6. The owner approves any useful subset. To replace deleted candidates, approve
   the rest with `approve-present` and stage only the deleted IDs in a new
   numbered round; never overwrite or mix rounds.
7. Copy approved outputs into the scene's `variants/` and register the sites
   in `content/presentation.json`.

### Landmarks, story, and characters

- **Landmarks** are exact-registration state edits of the approved scene: the
  approved backdrop is normally the restored state, and the dormant state is a
  subtractive edit of it. Never ask for a floating transparent prop.
- **Story art** follows the candidate plan and selection record in
  [art-prompts.md](art-prompts.md).
- **Character poses** start with Nix; other guides follow only once the pose
  language is approved. Characters without poses keep their idle still.

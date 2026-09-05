# Session 23 — Five future unit boards and animation seeds

**Status:** generated, approved, extracted, and integrated · four scenes active · Open Trail Overlook reserve-only
· **Depends on:** 07 · **Related:** 16, 17, 20
**Implemented in:** `content/presentation.json`, `assets/worlds/`,
`scripts/world-art/`, and media-policy/PWA tests

## Goal

Five new exercise-board locations were prepared before all of their curriculum
units existed, so later content work does not have to borrow another unit's art.
This file preserves the generation handoff and the resulting integration and
packaging decisions.

This session is about the **exercise boards and their optional environmental
changes only**. It does not request character animation. Landmark restoration
plates and full-frame unit-ending story images should be authored from the
approved boards in their integration sessions.

## Current integration, packaging, and storage status

All five approved scenes have compact, tall, and wide bases plus fifty approved
transparent-difference WebP variants. Their lifecycle state is recorded in
`scripts/world-art/future-scene-patch-summary.json` and reproduced by
`scripts/world-art/integrate_future_scene_patches.py`.

| Scene | Lifecycle state | PWA behavior |
| --- | --- | --- |
| Beacon Glass Gallery | `runtime-active` | Registered to Unit 10 and emitted by the manifest-driven build |
| Menders' Confluence | `runtime-active` | Registered to Unit 16 and emitted by the manifest-driven build |
| Keeper's Relay | `runtime-active` | Registered to Unit 17 and emitted by the manifest-driven build |
| Mosslight Landing | `runtime-active` | Registered to the standalone Reference surface and emitted by the manifest-driven build |
| Open Trail Overlook | `reserve-only` | Kept in Git; omitted unless it receives a real unit assignment |

Vite emits only media reachable from the presentation and character manifests.
Open Trail Overlook therefore remains versioned and runtime-ready under
`assets/worlds/` without entering `dist`, the service worker, or the PWA media
policy. For every unit scene, portrait reading and choice surfaces use tall
static art, demonstrations and exercises use compact-registered animation on
tall or compact boards, and wide or shallow gameplay boards use wide static
art. Mosslight Landing remains the Reference deck's compact-registered animated
surface. Full-resolution candidates and Nano Banana source outputs remain under
the ignored `artifacts/world-generation/` tree; only approved runtime bases and
transparent patches are tracked.

Git LFS is intentionally deferred. The migration audit found roughly 1.3 GB
across 2,907 historical PNG/WebP objects and would require rewriting 134
commits, updating every CI/deployment checkout, and forcing collaborators to
reclone or realign rewritten history. GitHub Actions LFS downloads count against
the repository owner's bandwidth, and GitHub does not support Git LFS directly
for Pages sites. The current custom Pages artifact is about 871 MB; revisit the
hosting architecture before it reaches 950 MiB because published Pages sites
are limited to 1 GB. If substantial video media is introduced, prefer external
object/CDN hosting over adding it to either normal Git or the Pages artifact.
The repository currently tracks animated WebPs rather than MP4, WebM, or MOV
video files.

- [Git LFS billing](https://docs.github.com/en/billing/concepts/product-billing/git-lfs)
- [Git LFS and Pages limitation](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

## Audit result and numbering correction

The Unit 9 split and both later additions are complete. The live catalog contains
seventeen units:

- Unit 9 is `position-memory` and correctly owns the existing Far Beacons board.
- Unit 10 is `viewport-control` and now owns Beacon Glass Gallery, its three
  responsive bases, and fifty transparent-difference variants.
- Unit 10 temporarily uses its own tall board for completion art while its
  bespoke ending awaits selection; it no longer duplicates Unit 9.

The split also shifted the two unbuilt curriculum units. Documents written
before the split call them Units 15 and 16; their canonical numbers are now:

| Requested shorthand | Canonical target now | Content state | Art decision |
| --- | --- | --- | --- |
| New art for the split Unit 9 | **Unit 10 — Viewport control** | Built and integrated | Keep Far Beacons on Unit 9; use Beacon Glass Gallery for Unit 10 |
| Future Unit 15 | **Unit 16 — Real-code workflow capstones** | Built in session 16 (capstones 1, 2, 3, 6) | Menders' Confluence is registered and live |
| Future Unit 16 | **Unit 17 — Mastery loops** | Built as the reusable Mastery chapter | Keeper's Relay is registered and live |
| Early spare | Standalone Reference surface | Reference decks | Mosslight Landing is registered and live |
| Late spare | Unnumbered reserve | No content | Open Trail Overlook remains reserve-only |

Do not name a new asset `unit-09`, `unit-15`, or `unit-16` based only on the old
shorthand. Use semantic ids until the future content files exist.

## Story placement

The story remains four-part. No fifth realm is added.

| Story part | Existing locations | Addition from this pack |
| --- | --- | --- |
| I — Moonroot Ruins: the language begins to answer | Mode Lantern, Wayfinder, Scribe's Spring, Grammar Gate | Mosslight Landing as the standalone Reference board |
| II — Starwater Sanctuary: precision reveals structure | Starneedle, Nested Garden, Prism Crossing | None |
| III — Archive of Echoes: memory, distance, framing, repetition | Memory Archive, Far Beacons, Echo Clock | Beacon Glass Gallery between Far Beacons and Echo Clock |
| IV — Brass Meridian: commands coordinate the restored systems | Meridian Table, Mirror Loom, Echo Foundry, Meridian Engine | Menders' Confluence and Keeper's Relay after the Engine; Open Trail Overlook as a late reserve |

Part IV changes tone after the Meridian Engine. Units 12–15 restore the great
systems; Units 16–17 use and maintain them. Their scenes must therefore look
alive, safe, and operational. Do not introduce a new catastrophe, corruption,
villain, or world-ending machine.

With Units 16 and 17 implemented, the first completed Unit 17 mixed review
moves into Keeper’s Relay and then the existing Restored Wilds finale. The
current ending copy still fits: “The language is alive. What you restore next
is up to you.” Unit 15 points into Unit 16, Unit 16 points toward Fen and Unit
17, and Unit 17 hands off to that unchanged finale.

## Existing-board audit: topic and story

The complete set of approved compact boards was reviewed from two independent
perspectives:

1. **Topic fit:** can the visual idea explain the unit without its title?
2. **Story fit:** does the place feel like a plausible next location, and does
   its scale and state serve the journey at that point?

| Unit | Board and visible metaphor | Topic fit | Story-lineage fit | Decision |
| --- | --- | --- | --- | --- |
| 1 Modal model | Mode Lantern: one supported light held by nested mechanisms | Strong: one object can settle into distinct states | Strong opening landmark at the Moonroot camp | Keep |
| 2 Cursor movement | Wayfinder Crossroads: central bearing and four real paths | Strong: unambiguous directional movement | Natural departure from camp into branching ruins | Keep |
| 3 Entering and changing text | Scribe's Spring: suspended quill-like crystal and split/flowing channels | Strong: new material enters and existing flow is reshaped | The path reaches a place where the Wilds can receive language | Keep |
| 4 Operator grammar | Grammar Gate: two complementary halves meet across one seam | Very strong: action and range combine into one operation | Closes Moonroot with a literal but non-UI threshold to Starwater | Keep |
| 5 Precision motions and search | Starneedle: one lens focuses one exact distant reflection | Very strong: precision and finding a point are visible instantly | Establishes Starwater as open, optical, and exact | Keep |
| 6 Text objects | Nested Garden: three contained arches at different scales | Very strong: inner and outer boundaries are spatially countable | Moves from distant points to structure hidden inside structure | Keep |
| 7 Visual selection | Prism Crossing: ribbon, row, and rectangular pane crossings | Very strong: the three selection geometries are distinct | The last panes form a plausible bridge toward the Archive | Keep |
| 8 Registers and putting | Memory Archive: crystal drawers, storage, and one open placement surface | Very strong: capture, retain, choose, and place | Opens the Archive with stored memories as the governing idea | Keep |
| 9 Position memory | Far Beacons: two fixed sites separated by a ravine and joined by one returnable thread | **Very strong:** mark a place, travel far, and return without losing it | Strong continuation from stored memory into remembered position | Keep exclusively on Unit 9 |
| 10 Viewport control | Beacon Glass Gallery: a stable observation floor and supported lens frame reveal the same world at changing scales | Strong: the view and frame change while the observer remains anchored | Restores forward movement through the Archive between Far Beacons and Echo Clock | Integrated |
| 11 Repeatable editing | Echo Clock: one large wheel propagates motion through smaller related wheels | Very strong: one shaped action repeats through matching mechanisms | A cleared view revealing a stopped clock is a clean handoff from new Unit 10 | Keep |
| 12 Command-line ranges and line operations | Meridian Table: two grounded endpoints joined across a broad work surface | Very strong: addresses define a range and current follows it | Opens Brass Meridian by turning learned language into routed work | Keep |
| 13 Substitution and practical regex | Mirror Loom: selected threads pass through lenses and change while others remain | Very strong: match, inspect, and transform only qualifying material | Escalates naturally from one exact range to pattern-directed change | Keep |
| 14 Macros | Echo Foundry: one recorder drum feeds three replay mechanisms | Very strong: capture a multi-step sequence and reproduce it | Advances from transforming matches to replaying complete procedures | Keep |
| 15 Global and Normal automation | Meridian Engine: several routed currents converge in one coordinated system | **Very strong:** ranges, predicates, Normal commands, and prior mechanisms act together at system scale | **Very strong climax:** it is the final restoration room, and its convergence visually completes the four-world repair | Keep on Unit 15 |

### Why Far Beacons belongs to Unit 9, not Unit 10

Far Beacons is not merely “a long view.” Its dominant composition is two stable
places separated by substantial space, connected by a single recoverable line.
That maps directly to marks, the jump list, the change list, and the Unit 9
promise: leave a position, work elsewhere, and return. The learner's conceptual
subject moves through the file.

Viewport control is the opposite distinction: the cursor or observer stays
anchored while the visible window changes around it. A supported viewing lens,
adjustable frame, clear/fogged glass, and multiple scales of the same far shore
express that idea much more precisely. The existing board therefore stays with
Unit 9, and only Unit 10 receives a new board.

### Why the Meridian Engine stays on Unit 15

The Meridian Engine does look like a final room, but that is not a mismatch.
Unit 15 is the climax of the mechanism-teaching path: `:global` selects lines by
predicate, `:normal` applies a coordinated action to them, and the unit asks the
learner to choose among all prior automation tools. The image's many controlled
currents converging through one central engine is the clearest existing visual
metaphor for exactly that topic.

Moving the Engine to Unit 16 would weaken the capstone metaphor. Capstones are
irregular, human-scale jobs that require choosing and combining tools, which is
why a mender's workshop fits them better than one monumental system. Moving it
to Unit 17 would be weaker again: mastery is cyclic maintenance and outward
reuse, not a single final activation.

The narrative solution is **climax followed by denouement**, not a sixth
replacement board. Unit 15 keeps the grand indoor Engine and completes the
restoration. Unit 16 steps down to a tactile working annex where the restored
language is used on real jobs. Unit 17 opens onto the exterior relay where the
Wilds are maintained over time. The finale then looks back across the restored
whole. New scenes after Unit 15 should become broader and more lived-in, not
larger or more explosive than the Engine.

### Six-background contingency decision

Do not generate a sixth replacement in the first batch. The two apparent
contingencies are resolved:

- Far Beacons has an excellent home on Unit 9.
- Meridian Engine has an excellent home on Unit 15.

Only reopen the sixth-board budget if phone-size review reveals a concrete
composition failure unrelated to topic or story. “It feels final” is not such a
failure; it is intentional narrative climax.

## Production contract for all five boards

### Base candidates

Use the existing approval-gated Nano Banana / Vertex workflow represented by
`scripts/world-art/generate_unit_scene_candidates.py`.

- Model at the time of writing: `gemini-3.1-flash-image` (Nano Banana 2).
- Generate five candidates per scene before selecting one.
- Request one complete 2K 4:3 PNG per candidate.
- Use the compact editor-occlusion mask only as measurement input. Never draw
  the mask, an editor-shaped cavity, or an intentionally empty rectangle.
- After explicit human approval, derive or re-author `tall`, `compact`, and
  `wide` profiles through the existing approval and source-ledger process.
- A board must remain a coherent complete illustration when the HTML editor is
  absent. Irreplaceable focal detail must survive the phone layouts around it.
- Keep the current polished 2D pixel-art language, gently elevated side-on game
  perspective, crisp silhouettes, painterly pixel clusters, grounded objects,
  dark readable values, narrow cyan light, warm amber accents, and restrained
  violet shadow.
- No characters, readable writing, letters, numbers, code, keyboard keys,
  icons, signs, captions, UI, logos, pseudo-text, or watermark.
- No unsupported floating architecture, black portal, compulsory central hole,
  generic prop-sheet staging, photorealism, smooth 3D rendering, neon
  cyberpunk clutter, or recognizable franchise imagery.

Use the following five candidate directions for every scene. Append exactly one
direction to its scene prompt:

1. **Landmark destination:** make the protected landmark a believable place
   integrated into architecture or terrain; it may be off-centre, but it must
   stand on or attach to a real support.
2. **Environmental vista:** lead with a memorable regional vista; let the
   landmark support the composition rather than dominate it.
3. **Path and arrival:** compose around a path, bridge, stair, watercourse,
   rail, threshold, or line of light that leads through the scene without
   forming an empty central stage.
4. **Intimate place:** move closer to tactile stone, glass, roots, rails, water,
   shelves, or small lived-in details while preserving useful depth.
5. **Asymmetric experiment:** use a strong asymmetric composition and one
   surprising but coherent spatial idea; do not default to a central portal.

### Board changes called “animations” in this plan

The current runtime animation is a slow crossfade between approved
**complete-board edits**, not a video layer. Preserve that as the default:

- inspect the approved compact board first;
- choose ten visible, supported sites outside the protected landmark;
- author five substantially different candidates per site;
- send the full board plus a boxed locator to Gemini;
- explicitly approve fifty complete-board results;
- stream the WebP variants and crossfade with the established timing;
- never locally paste an AI crop or animate a character inside a board.

The ideas below are seeds, not normalized coordinates. Final site ids, bounds,
existing-object descriptions, and preservation anchors must come from the
selected board. Do not invent bounds before the pixels exist.

If a later session deliberately adds Veo video loops, use the same selected
sites and keep the camera locked. A loop should last 5–8 seconds, move only one
local environmental subject, return seamlessly to its first frame, contain no
character, and leave the editor-safe composition and board geometry unchanged.
Video remains optional; it is not required to satisfy this pack.

## Shared precise-edit prompt for Gemini board changes

Fill the bracketed fields only after selecting and inventorying a base board.

```text
Use case: precise-object-edit
Asset type: one complete 4:3 Vim Wilds environmental board candidate

INPUT ROLES
- Image 1 is the approved complete [SCENE TITLE] board and the exact edit target.
- Image 2 is a locator crop from Image 1. Its magenta rectangle and label are reference markup only. Never reproduce that rectangle, label, crop framing, or any other markup.

TARGET
- Location: [EXACT LOCATOR DESCRIPTION].
- Existing object/material: [EXACT EXISTING APPEARANCE].
- Support surface: [EXACT SUPPORT SURFACE].

PRIMARY EDIT
[ONE SCENE-SPECIFIC CHANGE SEED, REWRITTEN TO MATCH THE SELECTED PIXELS]

PRESERVATION IS THE MAIN REQUIREMENT
Return the complete board, not a crop. Keep the canvas, framing, locked camera, perspective, [SCENE PRESERVATION ANCHORS], every other prop, all edge content, palette, lighting, pixel-art rendering, and spatial relationships as close to Image 1 as possible. Change only the named target and the few immediately adjacent pixels needed for contact, shadow, reflection, or local magical glow. The replacement must be physically attached to or supported by the named surface. Preserve the whole generated board so its lighting changes remain coherent during the runtime crossfade.

The target itself must change substantially. It needs an unmistakably new silhouette and content that remains legible when the complete board is displayed small. Do not settle for a tint, brightness shift, tiny sparkles, or a nearly identical version of the existing object.

SERIES VARIETY
Do not reuse another candidate's object, creature, vessel, lamp, plant, lens, instrument, or mechanism. Invent the specifically requested replacement rather than substituting a generic magical prop.

Avoid: changes elsewhere; warped or redrawn board geometry; altered protected landmark or outer edges; relocated objects; extra unrelated magical effects; characters; text; letters; numbers; code; UI; locator markup; watermark; photorealism; smooth 3D rendering.

Output exactly one complete 1K 4:3 PNG image.
```

## Optional locked-camera Veo prompt shell

```text
Use the approved complete [SCENE TITLE] board as the exact first frame and visual reference. Create one seamless 5–8 second environmental loop with a completely locked camera. Animate only [ONE LOCAL SUBJECT AND MOTION]. Preserve every stair, bridge, wall, rail, shelf, landmark, prop, edge, pixel-art silhouette, material, palette, light source, and spatial relationship. The motion must remain subtle behind a live code editor, have no cut or camera move, and settle exactly back into the opening state. No character, text, symbol, code, UI, new object, disappearing object, geometry drift, morphing architecture, zoom, pan, tilt, rack focus, particles crossing the whole board, logo, or watermark.
```

---

## Board 1 — Beacon Glass Gallery

### Assignment

- Canonical unit: **Unit 10 — Viewport control**
- Unit id: `viewport-control`
- Proposed scene id: `beacon-glass-gallery`
- World: `archive-of-echoes`
- Protected landmark concept: `beacon-glass`
- Story position: after Unit 9 Far Beacons, before Unit 11 Echo Clock
- Conceptual meaning: the view can move, frame, and change scale while the
  observer keeps their place

Keep `far-beacons` and its variants on Unit 9. This is the one replacement board
needed because of the split.

### Reference order

1. The approved Far Beacons compact base, for regional continuity and the place
   this scene follows.
2. The approved Echo Clock compact base, for the architectural direction of the
   next scene.
3. The compact editor-occlusion mask, as measurement data only.

### Base-board prompt

```text
Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original Archive of Echoes location called the Beacon Glass Gallery. This is the clear interior viewing chamber reached immediately after the Far Beacons and immediately before the Echo Clock.

Build a long, physically believable archive balcony across a deep violet stone chamber. Anchor one large teal-glass viewing lens in a thick brass carriage on real floor rails or wall pivots, positioned off-centre and readable on a phone. The carriage may travel vertically or settle at upper, middle, and lower framing stops, but do not mark those stops with symbols. Through and around the lens, show layered archive depth: a far shore, one distant beacon glow, suspended shelves, supported causeways, and a corridor whose restrained circular brass rhythm quietly anticipates the Echo Clock. The same distant place should be visible at more than one scale through nested glass or adjacent apertures, expressing reframing without physical travel. Add localized haze or condensation only where it helps the lens read; the room itself remains clear and safe.

Regional art bible: a warm subterranean archive carved into dark plum and charcoal stone, with crystal drawers, suspended shelves, quiet mechanisms, teal glass, muted brass, amber memory lights, and violet shadows. It is cozy, wondrous, ordered, and deep. Match the attached Far Beacons and Echo Clock references in rendering language, material vocabulary, palette, architecture, and gently elevated side-on perspective without copying either composition.

Conceptual feeling: the observer can look far ahead, close at hand, or shift the window while remaining securely in one place. Communicate this through supported lens mechanics, repeated framing, depth, and a stable observation floor—not through camera UI, arrows, scrollbars, or diagrams.

Composition/framing: one complete 2K 4:3 landscape. [APPEND ONE SHARED CANDIDATE DIRECTION.] Image 3 is an editor-occlusion measurement only. Do not reproduce its rectangle, hatching, colours, shape, or emptiness. Let ordinary scenery continue naturally behind the covered area, while the lens silhouette, far-shore cue, entrance from the beacons, and exit toward the clock remain legible around it.

Constraints: coherent background, middle ground, and foreground; every lens, shelf, bridge, rail, and light physically supported; one unmistakable protected lens site that can later have dormant and restored states; readable outer scenery; no characters.

Avoid: reusing the paired Far Beacons as the main landmark; a giant clock as the main landmark; telescope cliché; camera viewfinder; picture frame; floating screen; editor-shaped cavity; central black portal; labels; writing; letters; numbers; code; keyboard keys; arrows; scrollbars; UI; logos; pseudo-text; watermark; floating architecture; photorealism; smooth 3D rendering; steampunk clutter.

Output one 2K 4:3 polished original 2D pixel-art image.
```

### Board-change and motion seeds

Inventory ten supported sites from the selected image, then adapt these ideas:

1. A small side lens folds from a vertical resting angle to a horizontal
   inspection angle, with its brass hinge and support unchanged.
2. Condensation retreats from one peripheral glass pane in branching rivulets,
   revealing a sharper miniature view of the far shore.
3. A counterweight rises while the connected lens carriage settles lower on
   the same visible rail.
4. A distant beacon sends one restrained amber pulse that returns as a narrow
   teal reflection on the gallery floor.
5. A suspended prism fan opens into three distinct glass planes and closes
   without changing its mounting bracket.
6. A bank of tiny crystal drawers illuminates from bottom to top, then rests
   dark again; no labels or glyphs appear.
7. A brass iris on a secondary aperture narrows, widens, and returns to its
   original diameter.
8. One shelf-mounted fog collector fills a supported vial with pale violet mist
   while neighbouring vessels remain unchanged.
9. A distant pendulum at the corridor edge makes one quiet swing, subtly
   foreshadowing the Echo Clock without becoming a second landmark.
10. A narrow reflected highlight travels across three floor inlays at different
    apparent depths, emphasizing framing rather than travel.

Candidate variety should include glass, brass, mist, reflection, shelving,
counterweight motion, distant signal, and quiet clockwork. Do not let all fifty
variants become lenses or glowing jars.

---

## Board 2 — Menders' Confluence

### Assignment

- Canonical future unit: **Unit 16 — Real-code workflow capstones**
- Provisional unit id: `real-code-workflow-capstones`
- Proposed scene id: `menders-confluence`
- World: `brass-meridian`
- Protected landmark concept: `menders-bench`
- Story position: after Unit 15 Meridian Engine, before Unit 17 Keeper's Relay
- Conceptual meaning: separate learned tools become dependable craft when they
  are chosen and combined for irregular real work

The apostrophe is part of the display title only; ids remain ASCII kebab-case.

### Reference order

1. The approved Meridian Engine compact base, for direct physical and story
   continuity.
2. The approved Restored Wilds finale, for restrained cross-world material
   echoes and the post-restoration mood.
3. The compact editor-occlusion mask, as measurement data only.

### Base-board prompt

```text
Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original Brass Meridian location called Menders' Confluence, an operational repair annex immediately beyond the restored Meridian Engine. It is where difficult, irregular work from across the four Wilds is brought together after the great systems have awakened.

Build a welcoming, smaller-scale multi-level workshop annex into the dark ridge, dominated by Brass Meridian stone, copper rails, glass conduits, controlled ember light, and narrow cyan current. It should feel physically downstream from the monumental Meridian Engine but deliberately more tactile and human in scale. Anchor a broad, physically supported mender's bench or assembly dais off-centre. Give it four materially distinct but harmonized work bays connected by real clamps, rails, and conduits: one moss-dark stone and root detail recalling Moonroot, one pale lens or water-glass detail recalling Starwater, one teal archive-glass drawer detail recalling the Archive of Echoes, and one brass current fixture native to the Meridian. These are transported materials inside one coherent workshop, not four biomes pasted together. Show several incomplete but safe repair tasks of different shapes and scales, with a clear inspection route between them and an outgoing service corridor toward the next location.

The scene should suggest judgment before action: some repairs suit a clamp, some a lens, some a repeated jig, and some careful hand inspection. Express choice and composition through distinct grounded mechanisms and routes, never through tool icons, labels, command symbols, or a literal coding desk. The workshop is busy in structure but calm in state; restoration is complete and ordinary craft has begun.

Regional art bible: a vast precision workshop and command observatory beneath a dark ridge, using charcoal stone, aged brass, copper conduits, thick supported glass, controlled ember light, and narrow cyan current. Powerful, exact, warm, and safe. Avoid smoke, weapons, factory grime, oppressive industry, or excessive gears.

Composition/framing: one complete 2K 4:3 landscape. [APPEND ONE SHARED CANDIDATE DIRECTION.] Image 3 is measurement data only. Do not reproduce its rectangle, hatching, colours, shape, or emptiness. Let ordinary workshop scenery continue behind the editor zone. Keep the mender's bench silhouette, at least two contrasting work bays, the incoming Engine current, and the outgoing service route readable around the covered area.

Constraints: coherent background, middle ground, and foreground; every bench, rail, conduit, shelf, hoist, lens, and part physically supported; one protected bench site suitable for later dormant/restored story treatment; no characters.

Avoid: four-way split-screen collage; miniature versions of the four existing landmarks; literal computer workstation; monitors; terminal window; tool icons; writing; letters; numbers; code; keyboard keys; signs; UI; logos; pseudo-text; watermark; giant central portal; floating tools; unsafe sparks; smoke; weapons; factory grime; steampunk clutter; photorealism; smooth 3D rendering.

Output one 2K 4:3 polished original 2D pixel-art image.
```

### Proposed completion beat for later story integration

The bench's four differently shaped jobs settle into one stable service kit;
one cyan current tests each assembly in turn rather than blasting through all at
once. Suggested copy: “At Menders' Confluence, every restored skill becomes
part of one dependable craft.” Suggested next hook: “Beyond the workshop, the
open routes still need keepers.”

### Board-change and motion seeds

1. A low brass turntable rotates one irregular component into a new supported
   inspection angle and returns.
2. Three bench clamps close in a deliberate uneven sequence around three
   differently shaped materials, then release.
3. A Starwater glass basin transfers a narrow ribbon of light into an Archive
   vial without spilling or floating.
4. A Moonroot cutting takes root across one cracked but stable stone seam,
   adding a small patch of fresh moss.
5. A drawer opens to reveal a completely different repair fixture—folded prism,
   nested spring, or small balance arm—while every other drawer stays fixed.
6. A ceiling hoist moves one harmless component between two real rails, with a
   visible chain or cable carrying the weight.
7. An inspection lens travels across an irregular row of parts and lights only
   the one whose shape differs.
8. A cyan test current chooses one of three conduits, reaches its grounded
   endpoint, and drains back before the loop resets.
9. A small recorder cylinder turns once while two bench jigs replay different
   phases of the same mechanical action.
10. A set of hanging material swatches—root fibre, glass strip, brass ribbon,
    crystal thread—moves gently at different amplitudes in workshop airflow.

Keep this series materially broad. No more than two approved candidates should
be generic gear motion, and no more than two should be simple light pulses.

---

## Board 3 — Keeper's Relay

### Assignment

- Canonical future unit: **Unit 17 — Mastery loops**
- Provisional unit id: `mastery-loops`
- Proposed scene id: `keepers-relay`
- World: `brass-meridian`
- Protected landmark concept: `keepers-relay`
- Story position: after Menders' Confluence, before the Restored Wilds finale
- Conceptual meaning: mastery is returning, mixing, maintaining, choosing, and
  safely sending tested work farther than one place

Session 17 currently proposes keeping its command-line field notes inside the
mastery layer rather than forcing them into a numbered practice unit. This board
still fits: the relay can host focused drills, mixed review, maintenance, and
the conceptual multi-destination field notes. Do not finalize its unit id in
the manifest until that content decision lands.

### Reference order

1. The approved Meridian Engine compact base, for the source of the restored
   current.
2. The approved Restored Wilds finale, for the four connected destinations and
   hopeful open horizon.
3. The approved Menders' Confluence candidate once one exists; omit this input
   during an earlier first pass rather than inventing it.
4. The compact editor-occlusion mask, as measurement data only.

### Base-board prompt

```text
Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original Brass Meridian location called Keeper's Relay, an open-air ridge station reached after Menders' Confluence and before the final view of the restored Wilds. It turns restored power into patient, repeated stewardship.

Build a high but welcoming rail-and-stone waystation on the exterior of the dark ridge. Anchor one broad circular relay mechanism into a real terrace or bridge junction, with several distinct supported route loops that leave, pass through small maintenance stations, and visibly return. Include one separate outward dispatch rail or glass conduit that continues toward distant safe lights. The loops must read as physical routes at different depths, not as a progress chart or diagram. Add a compact field-note alcove made from blank glass slips, unlabeled message capsules, or sealed drawers, suggesting knowledge that can be carried across many destinations without displaying writing.

Let the horizon quietly connect the four established regions through material and light rather than a theme-park panorama: moss-dark masonry at one near support, a pale Starwater reflection far below, teal Archive glass in relay housings, and Brass Meridian rails and amber lamps as the dominant structure. The station is already functioning. Some routes are ready for practice, some are cooling after use, and one path remains open beyond the frame. The emotional note is ongoing care, curiosity, and freedom—not graduation pomp or another emergency.

Regional art bible: Brass Meridian precision architecture opened to a calm blue-violet horizon, with charcoal ridge stone, aged brass, copper rails, supported glass conduits, narrow cyan current, restrained amber navigation lights, and subtle material echoes from the restored Wilds. Exact, expansive, safe, and lived in. Avoid smoke, factories, weapons, neon cyberpunk, or excessive gears.

Composition/framing: one complete 2K 4:3 landscape. [APPEND ONE SHARED CANDIDATE DIRECTION.] The final attached mask is measurement data only. Do not reproduce its rectangle, hatching, colours, shape, or emptiness. Continue routes naturally behind the editor zone while keeping the relay silhouette, one returning loop, one outward route, and the open horizon legible around it.

Constraints: coherent background, middle ground, and foreground; all rails, conduits, capsules, lenses, platforms, and lamps physically supported; one protected relay site suitable for a later story state; no characters.

Avoid: literal flowchart; progress rings; game level map; checklist; command prompt; terminal screen; readable field notes; arrows; labels; writing; letters; numbers; code; keyboard keys; signs; UI; logos; pseudo-text; watermark; fifth-world portal; graduation stage; trophy; giant central doorway; floating routes; unsafe height without rails; photorealism; smooth 3D rendering.

Output one 2K 4:3 polished original 2D pixel-art image.
```

### Proposed completion beat for later story integration

One test current completes every return loop, pauses at the relay, then divides
cleanly among several distant routes. Suggested copy: “The Keeper's Relay
remembers through use: return, combine, maintain, and choose again.” The next
action is the existing Restored Wilds finale, not another locked landmark.

### Board-change and motion seeds

1. A maintenance trolley completes one short loop on a supported rail and docks
   exactly where it began.
2. Four route lamps pulse at distinct intervals before settling into a quiet
   shared rhythm.
3. A sealed message capsule enters one distributor and leaves through three
   different conduits in succession, never duplicating in mid-air.
4. A relay bridge switches between two physically plausible track alignments
   using a visible brass pivot.
5. A blank glass field-note slip slides from a drawer into a protected viewing
   cradle, catches cyan light, and returns unreadable.
6. A wind-driven chime uses four different supported materials and produces four
   visibly different motions without musical symbols.
7. A distant Starwater reflection brightens when the corresponding relay lens
   turns toward it, then fades as the lens returns.
8. A small Archive capsule carousel indexes one position at a time, with no
   labels or glyphs.
9. Moss at a Moonroot-stone support briefly releases restrained violet spores
   that remain local and drift out of view.
10. One outward signal travels beyond the frame while the return loops remain
    calm, making continued practice feel open rather than compulsory.

The series should balance cyclical motion, dispatch, maintenance, weather, and
cross-world material response. Avoid making every variant a moving cyan light.

---

## Board 4 — Mosslight Landing (early reserve)

### Assignment

- Unit: unnumbered reserve; do not add it to the catalog now
- Proposed scene id: `mosslight-landing`
- World: `moonroot-ruins`
- Story position: between “Nix at the threshold” and Unit 1 Mode Lantern
- Protected scenic anchor: `first-trail-chime` if a later unit needs a landmark
- Conceptual meaning: the Wilds gives a small, safe response to the learner's
  first deliberate action

This is intentionally less command-specific than the numbered scenes. It can
support onboarding, a new foundational lesson, an input calibration exercise,
or another early addition without contradicting the story.

### Reference order

1. The approved Nix-at-the-threshold intro still, for the point of arrival.
2. The approved Mode Lantern Grounds compact base, for the destination and
   Moonroot material language.
3. The compact editor-occlusion mask, as measurement data only.

### Base-board prompt

```text
Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original Moonroot Ruins location called Mosslight Landing, a small safe foothold immediately inside the threshold and before the Mode Lantern Grounds.

Build an intimate root-sheltered landing of mossed dark stone beside shallow still water. A broad traversable path should arrive from a real threshold at one edge, cross a modest supported footbridge or stepping terrace, and continue toward a distant warm glow that plausibly leads to the Mode Lantern without showing a duplicate lantern landmark. Give the landing one quiet scenic anchor: a root-and-brass trail chime, a cluster of nested stone cups catching luminous water, or a low supported cairn with one dim amber core. Include cyan mushrooms, restrained violet spores, turquoise mineral seams, ferns, lily reflections, old arches, and tiny signs of a cared-for travel stop such as an unlabeled satchel niche or empty resting shelf.

The scene should feel like the first moment when the Wilds listens back: inviting, responsive, ancient, and safe. Keep the magic localized and modest. This is a beginning, not a grand gate, prophecy, shrine, classroom, or tutorial screen.

Regional art bible: Moonroot's blue-green dusk, enormous roots integrated with mossed charcoal stone, shallow reflective water, turquoise mineral light, small cyan and violet growths, and sparse warm amber guidance. Match the attached intro and Mode Lantern references in pixel-art language, proportions, material vocabulary, and gently elevated side-on perspective without copying either composition.

Composition/framing: one complete 2K 4:3 landscape. [APPEND ONE SHARED CANDIDATE DIRECTION.] Image 3 is measurement data only. Do not reproduce its rectangle, hatching, colours, shape, or emptiness. Let roots, path, water, and masonry continue naturally behind the editor zone. Keep the arrival edge, forward path, waterline, and quiet anchor legible around it.

Constraints: coherent background, middle ground, and foreground; all bridges, chimes, shelves, stones, and lights grounded or visibly supported; no characters.

Avoid: a second Mode Lantern; compass; writing spring; two-part gate; literal keyboard or keycaps; tutorial arrows; labels; writing; letters; numbers; code; signs; UI; logo; pseudo-text; watermark; central black portal; editor-shaped cavity; giant monument; throne; danger; monster; photorealism; smooth 3D rendering.

Output one 2K 4:3 polished original 2D pixel-art image.
```

### Board-change and motion seeds

1. Three trail-chime pieces sway at different speeds from one visible root
   bracket and settle without touching.
2. A ring of water expands from one falling droplet, nudges nearby lily pads,
   and disappears at the stone bank.
3. One cyan mushroom opens while a neighbouring violet cap folds closed, then
   both return to rest.
4. A turquoise mineral seam brightens beneath one stepping stone and passes its
   light to the next two stones.
5. A tiny root bridge lowers a handrail-like vine into a secure resting notch
   and raises it again.
6. A travel niche reveals a folded blank cloth, seed pod, or glass flask in
   different candidates without becoming an open treasure chest.
7. A fern slowly uncurls from a damp masonry joint and casts a small reflection.
8. Restrained violet spores rise from one moss patch, circle the scenic anchor,
   and fade locally.
9. A warm distant path glow briefly reflects across the water toward the
   landing, pointing onward without an arrow.
10. Two nested stone cups fill and tip in sequence, passing luminous water along
    a physically connected channel.

Keep this reserve scene organic and tactile. Avoid repeating the established
Moonroot batch's overused treasure luggage, spirit animals, whirlpools, boats,
waterfall shrines, and giant glowing portals.

---

## Board 5 — Open Trail Overlook (late reserve)

### Assignment

- Unit: unnumbered reserve; do not add it to the catalog now
- Proposed scene id: `open-trail-overlook`
- World: `brass-meridian`
- Story position: after Keeper's Relay and before the finale, or as a future
  post-curriculum practice location
- Protected scenic anchor: `horizon-relay` if a later unit needs a landmark
- Conceptual meaning: the restored language opens possibilities beyond the
  authored path; completion is a departure point, not a sealed ending

### Reference order

1. The approved Restored Wilds finale, for the connected horizon and emotional
   tone.
2. The approved Meridian Engine compact base, for dominant Part IV materials.
3. The approved Keeper's Relay candidate once one exists; omit rather than
   fabricate it during an earlier pass.
4. The compact editor-occlusion mask, as measurement data only.

### Base-board prompt

```text
Use case: stylized-concept
Asset type: responsive environmental backdrop for the live Vim Wilds exercise board
Primary request: Create a new original late-story location called Open Trail Overlook, a calm Brass Meridian terrace where the restored routes can be seen continuing beyond the authored journey.

Build a spacious but sheltered ridge overlook from charcoal stone, aged brass railings, thick supported glass, and narrow cyan conduits. Let a real path arrive from Keeper's Relay, pass a low horizon relay or viewing instrument fixed to a stone plinth, and continue safely out of frame toward a warm distant landscape. The view may contain subtle, geographically plausible echoes of all four restored regions—Moonroot's rooted ruins in a near valley, a pale Starwater reflection, distant amber Archive windows, and the Brass Meridian ridge beneath the terrace—but keep them atmospheric and unified rather than four labelled quadrants. Show several already-lit routes converging behind the traveller and one ordinary open trail ahead. Do not invent a fifth world, fifth energy colour, or mysterious portal.

The scene should feel earned, quiet, and expansive. It can support one more advanced unit, open practice, a maintenance epilogue, or the handoff into the existing finale. Its visual subject is possibility after mastery, not a trophy, finish line, royal overlook, or farewell cutscene.

Style/medium: polished original 2D pixel-art fantasy with crisp silhouettes and painterly pixel clusters. Let Brass Meridian's precise construction dominate while the distant restored lands retain their established palettes. Use controlled amber warmth, narrow cyan current, blue-violet atmospheric depth, and no celebratory rainbow wash.

Composition/framing: one complete 2K 4:3 landscape. [APPEND ONE SHARED CANDIDATE DIRECTION.] The final attached mask is measurement data only. Do not reproduce its rectangle, hatching, colours, shape, or emptiness. Continue the terrace and landscape naturally behind the editor zone. Keep the arriving path, horizon relay, outgoing trail, safe railing, and at least two distant regional cues readable around it.

Constraints: coherent background, middle ground, and foreground; every lens, rail, bridge, conduit, lantern, and path physically supported; no characters.

Avoid: literal world map; four labelled quadrants; fifth-world portal; finish line; trophy; crown; graduation stage; throne; fireworks; giant flag; triumphal statue; cliff danger; text; letters; numbers; code; keyboard keys; signs; arrows; UI; logo; pseudo-text; watermark; central black portal; editor-shaped cavity; floating architecture; photorealism; smooth 3D rendering.

Output one 2K 4:3 polished original 2D pixel-art image.
```

### Board-change and motion seeds

1. A low horizon lens rotates on a visible fork and briefly brings one distant
   regional light into sharper colour before returning.
2. The already-lit routes behind the terrace pulse one at a time from the four
   directions and settle together without creating a rainbow.
3. A small brass wind vane changes bearing while its stone base and counterweight
   remain fixed.
4. Clouds reveal and then softly veil the Starwater reflection far below,
   changing only atmospheric light.
5. A supported courier capsule arrives from Keeper's Relay, docks, and departs
   along the ordinary open trail conduit.
6. Moonroot moss grows over one near brass seam while a tiny maintenance brush
   mechanism clears a neighbouring joint.
7. Archive-glass prisms in the railing catch amber lights in a travelling but
   localized reflection.
8. A terrace lift rises from a lower service level carrying a harmless blank
   crate, pauses, and returns.
9. One distant bridge illuminates from near end to far end, making continued
   travel tangible without drawing an arrow.
10. An evening-to-dawn band of light moves only across the far horizon while
    the terrace exposure and foreground remain stable enough for the editor.

This reserve may be calmer than the other four. Variety should come from
weather, optics, transport, maintenance, plants, distant routes, and reflected
light—not spectacle.

## Completed generation sequence

This sequence was completed on 2026-09-01 and remains as the reproducible
production record.

1. Add these five semantic scene definitions to the unit-scene candidate
   generator without assigning the reserve boards unit numbers.
2. Capture or reuse the current compact occlusion mask.
3. Stage five candidates for each scene from the exact base prompt plus the five
   shared direction suffixes: twenty-five paid image requests in total.
4. Generate and build review sheets. Record model revision, prompt, input order,
   hashes, dimensions, timestamp, and cost in resumable manifests.
5. Review at full image size and at the representative phone board size. Reject
   candidates whose important subject disappears behind the editor, whose
   architecture floats, or whose story position is ambiguous.
6. Explicitly approve one compact source per scene. Do not let “best of five”
   become an automatic script decision.
7. Derive or re-author tall and wide profiles from the approved composition,
   then record every source and output hash in the scene ledger.
8. Integrate Unit 10 immediately. Keep Unit 9's Far Beacons untouched and
   remove Unit 10's shared scene and variant paths.
9. Store future and reserve scenes as approved artifacts until their content
   entries exist; do not add fake units to satisfy the presentation schema.
10. For each approved compact board, capture real layout visibility, protect the
    landmark, inventory ten supported sites, and rewrite the animation seeds to
    match the selected pixels.
11. Generate five precise full-board edit candidates per site, fifty per scene
    and 250 total if all five scenes receive the full variant set. Work one scene
    at a time with an explicit budget cap and resumable manifest.
12. Approve variants manually, re-author them for responsive profiles where the
    corresponding object moves, convert approved complete boards to WebP, and
    register the standard streaming crossfade timing.
13. Only after the related unit content exists, generate its dormant/restored
    landmark treatment and full-frame story ending from the approved board.

## Selection checklist

A base board is acceptable only if all answers are yes:

- Does it have an unmistakable place in the four-part journey?
- Does it express the unit idea spatially without text, symbols, or UI?
- Does it look like a location rather than a hero prop on an empty stage?
- Are all objects and routes physically supported?
- Does the complete world continue behind the editor-occlusion zone?
- Are the entrance, exit, protected landmark, and two secondary sites legible at
  phone board size?
- Is its palette continuous with adjacent locations while its silhouette is
  distinct from them?
- Can ten non-landmark sites support genuinely different board changes?
- Is it calm enough to remain behind code for several minutes?
- Would it still make sense with generated backdrops disabled and only the base
  profile visible?

## Current and future acceptance criteria

- Unit 9 alone retains Far Beacons; Unit 10 owns Beacon Glass Gallery and a
  non-shared variant root.
- Units 16 and 17 use their canonical post-split numbers wherever they become
  real catalog entries.
- Open Trail Overlook remains a semantic, approved reserve asset until content
  needs it; it does not create an empty unit.
- Every integrated unit owns distinct base profiles, a distinct variant root,
  and a distinct completion image source. Units 10, 16, and 17 temporarily use
  their tall boards until bespoke-ending approval.
- Each prepared scene exposes ten approved sites and fifty approved
  transparent-difference variants without touching its protected landmark.
- Reserve-only scenes remain absent from the PWA media policy, `dist`, and
  service worker until intentionally activated.
- No generated board or variant contains a character, readable text, UI,
  unsupported object, editor-shaped void, or geometry drift.
- Story progression remains one continuous chain and the Restored Wilds finale
  occurs only at the actual terminal boundary.
- Core and optional media budgets, offline fallbacks, reduced motion, and the
  full viewport matrix continue to pass.

## Validation for packaging and future activation

```bash
node --check app.js
node --check exercise-data.js
git diff --check
npm test
npm run test:pwa
npm run test:targeted -- tests/story-transitions.spec.js --workers=1
```

Also inspect the affected board, story, generated-backdrop, reduced-motion, and
offline states at 360×740, 390×844, 412×915, 430×932, and 432×960. Confirm no
clipping, document scrolling, horizontal overflow, unapproved remote asset, or
workspace-owned Vite/Playwright process remains after browser validation.

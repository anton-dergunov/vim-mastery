# WP-11 Nano Banana generation prompt pack

This is the Sol-authored production brief for generating WP-11 art. It is
deliberately more specific than the compact prompts in the implementation plan.
It does not approve art: generate 5–10 candidates, review them manually in the
real story surface, and record the selected interaction/output metadata.

Do not place generated files directly in `assets/`. Keep candidates under
`artifacts/world-generation/wp11/`; normalize and promote only approved
outputs.

## Model and reference discipline

- Model names and IDs were verified against Google's
  [Nano Banana image-generation documentation](https://ai.google.dev/gemini-api/docs/image-generation)
  on 2026-07-28.
- Use Nano Banana Pro (`gemini-3-pro-image`) for the three intro key-art
  compositions and for a landmark whose silhouette cannot be stabilized after
  controlled edits.
- Use Nano Banana 2 (`gemini-3.1-flash-image`) for registered scene edits,
  dormant/restored state edits, and tall/wide profile recreation.
- Do not mix unrelated style references. The approved scene being edited is
  always Image 1 and is the authority for geometry, perspective, palette,
  lighting, materials, pixel scale, and rendering.
- A locator-box image, when supplied, is measurement-only. The box must never
  appear in the result.
- Treat the owner-approved backdrop as the canonical restored composition and
  registration target. Generate the dormant state as a subtractive edit of
  that backdrop. If the approved backdrop already communicates the exact
  completion beat, do not regenerate it merely to create another file.
- When one small restored cue genuinely needs refinement, edit the approved
  backdrop conversationally and keep the approved backdrop attached throughout.
  Never regenerate a restored state from text alone.
- Generate opaque complete-board review masters. After approval, derive the
  registered landmark patch through the existing exact-canvas asset pipeline;
  do not ask Gemini for a floating transparent prop.

## Approved backdrop reference set

These fourteen compact backdrops are the owner-approved geometry and restored
composition references. For a unit transition, attach that unit's exact file as
Image 1. Do not substitute a candidate from `variants/` or a scene-generation
artifact. For an intro panorama, use one representative approved backdrop per
region as a material and architecture reference, while following the fixed
regional reference order below.

- Moonroot: `mode-lantern-grounds/compact/base.webp`,
  `wayfinder-crossroads/compact/base.webp`, `scribes-spring/compact/base.webp`,
  and `grammar-gate-court/compact/base.webp` under
  `assets/worlds/moonroot-ruins/scenes/`
- Starwater: `starneedle-observatory/compact/base.png`,
  `nested-garden/compact/base.png`, and `prism-crossing/compact/base.png` under
  `assets/worlds/starwater-sanctuary/scenes/`
- Archive: `memory-archive/compact/base.png`,
  `far-beacons/compact/base.png`, and `echo-clock/compact/base.png` under
  `assets/worlds/archive-of-echoes/scenes/`
- Brass Meridian: `meridian-table/compact/base.png`,
  `mirror-loom/compact/base.png`, `echo-foundry/compact/base.png`, and
  `meridian-engine/compact/base.png` under
  `assets/worlds/brass-meridian/scenes/`

The approved files are strong enough for production continuation. Preserve
their landmark silhouette and surrounding negative space. Several are already
visually dense at phone scale, so prefer subtraction, selective dimming, and
one localized activation path over adding machinery, particles, or secondary
props.

## Candidate plan

For each initial image, make eight runs before choosing:

1. literal and restrained;
2. strongest small-size silhouette;
3. more environment-integrated;
4. more asymmetric but at the identical authored site;
5. clearer material separation;
6. quieter light and contrast behind UI;
7. stronger crop resilience at phone size;
8. one elegant interpretive variation that preserves every semantic invariant.

Use runs 9–10 only to repair a specific weakness found in composite review.
Do not ask for random novelty. Keep the prompt fixed within a comparison batch
except for one named variation axis, and record that axis beside the output.

Review candidates at 360×740, 390×844, 430×932, a square tablet, and a wide
desktop story surface. Reject pseudo-writing, invented UI, broken supports,
changed scene geometry, noisy editor zones, landmarks that read as generic
fantasy props, and restored states that communicate only “brighter.”

## Shared registered-landmark request

Prepend this block to one unit-specific dormant description below.

```text
Use case: production edit for an original mobile learning game
Asset type: exact-registration dormant landmark state inside an approved complete scene

REFERENCE ORDER
Image 1 is the approved complete Vim Wilds scene and the exact edit target.
Image 2, when present, is a crop of Image 1 with a locator box around the
authored landmark site. Image 2 is measurement markup only: do not reproduce
the box, its colour, its line, or the crop boundary. Additional images, when
present, are regional material references only and must not replace Image 1's
camera or geometry.

PRIMARY INSTRUCTION
Return the complete scene at exactly the same dimensions, aspect ratio, camera,
crop, perspective, pixel density, palette, lighting direction, waterline,
terrain, architecture, and object registration as Image 1. The landmark already
exists in Image 1 and is integral to its composition. Identify that exact
structure from the backdrop-specific anchor and edit its state in place. Do not
replace it, move it, resize it, reinterpret it as a different prop, or introduce
a second landmark. This is a precise subtractive state edit of one existing
location, not a new scene and not a prop sheet.

Make the existing landmark dormant, interrupted, or incomplete, but intact and inviting.
Its function must be inferable from shape and material relationships alone.
It must have a clean silhouette at roughly 96 CSS pixels without becoming
oversized. Preserve the scene's background, middle ground, foreground,
atmosphere, environmental details, and negative space everywhere outside the
landmark site as closely as possible.

STYLE
Polished original 2D pixel-art fantasy with painterly pixel clusters, crisp
silhouettes, restrained texture, deep navy and near-black foundations, and the
approved region's controlled accent lights. Use the same slightly elevated
side-on environmental perspective and the same apparent pixel scale as Image 1.
The object must feel designed for this exact culture and place, not pasted in.

HARD CONSTRAINTS
No characters. No letters, numbers, runes, glyphs, arrows, compass labels,
readable diagrams, code, keyboard keys, captions, signs, logos, watermark, UI,
or pseudo-writing. No extra landmark. No freestanding object without a support.
No central black opening, editor-shaped cavity, vignette frame, inventory
presentation, or magenta background. Do not brighten the whole scene. Do not
move or redesign unrelated scene content. Output one complete 2K scene image.
```

The owner-approved backdrop is normally the restored target. If a local
restored refinement is required, start from that backdrop—not from the dormant
candidate—and use this shared restored-state edit followed by the unit-specific
restored description.

```text
This is a controlled state edit of the approved dormant complete scene.
Preserve the exact canvas, camera, crop, perspective, pixel density, landmark
geometry, silhouette, scale, position, supports, materials, background,
architecture, terrain, and every unrelated object. The dormant and restored
results must crossfade with no visible jump.

Change only the functional state described below. The restoration should read
through alignment, connection, flow, focus, selective activation, or coordinated
motion implied in a still image—not through a global brightness increase. Keep
highlights restrained and protect dark quiet space behind the live HTML.

Add no characters, text, symbols, labels, code, UI, unrelated objects, extra
mechanisms, sparks filling the scene, giant aura, explosion, portal, or beam
aimed at the viewer. Return the complete scene at the exact original dimensions.
```

For tall and wide versions, attach the approved tall or wide base as Image 1,
the approved compact dormant/restored pair as identity references, and use:

```text
Recreate the approved landmark state at the corresponding authored site in
Image 1. Image 1's responsive scene geometry, camera, crop, support surface,
lighting, and profile composition are authoritative. The compact references
define landmark identity and state only; do not paste their pixels or copy
their surrounding crop. Preserve the landmark's material identity, proportions,
silhouette, and state while adapting its apparent perspective and occlusion to
Image 1. Return the complete board at Image 1's exact dimensions.
```

## Unit 1 — Mode Lantern

Runtime hook: `modal-model` / `mode-lantern-grounds` / `mode-lantern`.

Approved backdrop anchor: edit the cylindrical lantern already occupying the
lower-left foreground terrace. Preserve its round stone plinth, the adjacent
small arch, the terrace edge, surrounding pools, and stair geometry.

Dormant description:

```text
At the existing supported lantern terrace, build a waist-high ritual lantern
whose weight clearly rests on a squat, moss-softened dark-stone plinth. The
silhouette is a grounded tapering base, a narrow central stem, and four nested
open glass rings surrounding one small amber core. The rings are four distinct
mechanical frames, not a single orb: each has a different diameter and is
misaligned on a plausible brass pivot, so their planes disagree without
colliding. The core is alive but dim and steady enough to feel safe. Fine roots
and moss reclaim only the lowest stone seam. Use aged charcoal stone, dark
verdigris brass, smoke-clear glass, and one muted amber point. It should suggest
four available states whose relationships have not yet settled, without using
icons, colour labels, or writing. Keep the upper silhouette open and legible;
avoid a streetlamp, chandelier, astrolabe, atom symbol, or magical cage.
```

Restored description:

```text
Rotate the same four pivoted rings into a stable concentric alignment around
the unchanged core. Keep each ring individually readable by giving its rim one
restrained material edge: amber, cyan, violet, and warm cream, with no rainbow
wash and no coloured text-like segments. The central flame becomes calm, warm,
and vertically steady. A narrow reflected glimmer may touch the supporting
terrace, but the moss, plinth, scene exposure, and ring geometry remain
unchanged. The result should communicate distinct modes held in one coherent
instrument.
```

Candidate emphasis: compare ring readability, support credibility, and whether
all four rings survive phone-size rendering without becoming a generic glowing
ball.

## Unit 2 — Wayfinder

Runtime hook: `cursor-movement` / `wayfinder-crossroads` / `wayfinder`.

Approved backdrop anchor: edit the large circular compass mechanism already
built into the lower-centre round stone platform. Preserve the gold ring, the
single diagonal needle, the three nearby lanterns, and every crossing behind it.

Dormant description:

```text
Integrate a low circular stone-and-brass wayfinder into the existing crossroads
platform so it is part of the paving rather than a separate compass prop. Four
broad path arms leave the circular hub toward the platform's real routes, but
each arm stops a short distance before joining the hub. The gaps are obvious
through masonry joints, not black voids. A thick, unlabeled brass needle rests
diagonally off-centre, held by a believable central pin. Two thin living roots
cross different inactive arms without covering the whole device. Use carved
stone bands and four endpoint caps, but absolutely no cardinal letters, arrows,
map marks, compass rose, dial numbers, or runes. The dormant shape must read as
a disconnected four-direction routing mechanism, not navigation UI.
```

Restored description:

```text
Join the same four path arms precisely into the circular hub, forming one clear
cross of traversable routes that agrees with the existing crossroads geometry.
Lift the same brass needle to a calm centred bearing without adding markings.
Let one thin cyan current travel from the hub to each of the four existing
endpoint caps; keep the stone dominant and the light narrow. The two roots may
relax into paving seams but must not vanish as if the scene were replaced.
Preserve every path width, platform edge, water reflection, and surrounding
object.
```

Candidate emphasis: reject compass clichés; favour a grounded crossroads whose
four directions remain clear when partially occluded by story text.

## Unit 3 — Scribe's Spring

Runtime hook: `entering-changing-text` / `scribes-spring` / `scribes-spring`.

Approved backdrop anchor: edit the large suspended teal-violet quill crystal
already hanging from chains above the upper-right aqueduct, together with the
paired luminous channels that flow from left and right into the central pool.
Preserve all bridges, chains, falls, arches, and the central walkway.

Dormant description:

```text
At the existing paired water-channel site, form a small handcrafted spring from
two mossed stone cheeks around a suspended quill-like mineral crystal. The
crystal is an abstract tapered shard with a split natural vein, not a feather,
pen, nib, letter, or writing symbol. A narrow carved channel carries turquoise
liquid light toward the centre, but one clearly visible stone segment is split
and displaced by only a few pixels; the luminous flow stops immediately below
that break and the downstream bed is dark. The suspension uses believable root
fibres or a tiny brass cradle attached to existing architecture. Keep ordinary
water, luminous flow, and crystal material visually distinct. The spring should
feel repairable and intimate, not monumental or magical plumbing.
```

Restored description:

```text
Seat the displaced channel segment back into the exact break with a fine
visible repair seam. Continue the same narrow turquoise liquid light through
the joined channel and into the existing downstream pool, creating only a small
local reflection. Add a soft warm-amber rim to the unchanged suspended crystal,
as if the resumed current energises it. Do not turn the crystal into a glowing
pen, add written pages, or flood the scene. Preserve the channel width, stone
cheeks, moss, suspension, and all water geometry.
```

Candidate emphasis: the stopped-versus-flowing state must be legible without
making the dormant spring look broken beyond repair.

## Unit 4 — Grammar Gate

Runtime hook: `operator-grammar` / `grammar-gate-court` / `grammar-gate`.

Approved backdrop anchor: edit the two-leaf gate already centred in the court:
the left leaf is a pale circular stone mechanism and the right leaf is a
root-bound crystal structure. Preserve their contrasting materials, the exact
centre seam, the flanking ruin arches, star vista, luggage, and water foreground.

Dormant description:

```text
Use the existing gate court supports to create a compact arch mechanism made of
two complementary structural halves. The left half is heavier, with a contained
amber reservoir or tensioned stone-brass chamber that suggests stored action.
The right half contains one clean recessed route channel that follows the arch
toward the opening. The halves face each other across a narrow intentional
centre joint but do not meet; their mating edges visibly correspond like two
parts of one grammar. Both halves must be anchored into the existing court
walls or plinth. Keep the opening shallow, calm, and visibly part of the court,
not a black portal. Use no operator marks, motion arrows, brackets, equations,
letters, or carved pseudo-language.
```

Restored description:

```text
Slide or rotate the same complementary halves into exact contact at the centre
joint. Show one restrained current leaving the unchanged amber reservoir,
crossing the locked joint, and following the right-hand route channel through
the arch. The gate opening becomes visibly clear through lifted mechanical
rests or aligned stone edges, not through a supernatural void. Preserve each
half's identity so the image still reads as action joined to range. Do not add
new doors, symbols, giant light rays, or scene-wide illumination.
```

Candidate emphasis: prefer complementary construction over symmetry; the
semantic relationship should read before ornamental detail.

## Unit 5 — Starneedle

Runtime hook: `precision-motions-search` / `starneedle-observatory` /
`starneedle`.

Approved backdrop anchor: edit the towering lens instrument already rising from
the centre-left island. Preserve its tall stone pier, crescent supports, large
glass sphere/lens, the diagonal reflected light line, bridges, domes, and mirror
water. The current approved backdrop is the restored optical target.

Dormant description:

```text
At the observatory terrace, mount a slim pale-dark stone stand into the real
terrace edge and suspend one substantial glass lens above it on two delicate
but believable crescent supports. The lens is tilted a few degrees away from
its intended sightline, so its ellipse and reflections are visibly off-axis.
Only two faint, isolated star points are resolved in or beyond the glass; the
remaining reflected sky stays soft. Add a narrow inactive cyan conduit between
stand and lens but leave a tiny alignment gap. The silhouette must be elegant,
precise, and spacious. Avoid telescopes, modern instruments, crosshairs,
constellation diagrams, compass marks, planets, outer-space scenery, or an eye
symbol.
```

Restored description:

```text
Rotate the same lens to face the scene's established distant sightline and seat
the crescent supports into a visibly balanced alignment. Resolve several small,
precise star points at different distances without drawing a constellation or
symbol. Join the existing stand and lens with one hairline cyan beam or current,
kept narrow enough that the glass and stone remain dominant. Preserve the lens
shape, terrace attachment, reflections, and all distant architecture.
```

Candidate emphasis: compare optical clarity and silhouette, not number of stars;
reject anything that resembles modern astronomy equipment or an eye logo.

## Unit 6 — Nested Garden

Runtime hook: `text-objects` / `nested-garden` / `nested-garden`.

Approved backdrop anchor: edit the three enormous concentric arches already
occupying the left foreground circular terrace: outer dark masonry, middle
carved stone, and inner clear glass. Preserve their exact nesting, circular
support terrace, foreground tools and rugs, water reflections, and distant
glass pavilions.

Dormant description:

```text
Build three materially nested botanical arches into three existing shallow
water terraces: a broad outer stone-and-glass arch, a smaller living middle
arch, and a compact translucent inner arch. They occupy the same visual axis
but remain separate supported structures with clearly readable boundaries.
The outer arch is dormant and sparse; the middle and inner forms are closed by
restrained tangled stems that follow their own frames. Growth is sleeping, not
dead. Use translucent reeds, pale violet buds, dark stone roots, and a few cyan
edges consistent with Starwater. Do not make a tunnel, portal, Russian doll
objects, literal brackets, parentheses, text containers, or a symmetrical
wedding arbor.
```

Restored description:

```text
Open the existing growth in an outside-to-inside progression: the outer arch
gains the first restrained living edge, the middle arch becomes fully readable,
and the inner arch opens last around a calm light centre. Preserve clear empty
separation between all three boundaries; no vine may merge them into one shape.
Use only a few pale violet blooms and thin cyan glass edges. Keep terraces,
reflections, arch geometry, and plant species identical. The still image should
show nested containment through ordered activation, not a scene-wide bloom.
```

Candidate emphasis: the three scopes must remain countable at 96 CSS pixels.

## Unit 7 — Prism Crossing

Runtime hook: `visual-selection` / `prism-crossing` / `prism-crossing`.

Approved backdrop anchor: edit the three separate supported crossing forms
already spanning the lower middle: the rectangular glass block wall on the left,
the row of upright panes in the centre, and the ribbon-like curved glass bridge
on the right. Preserve all three stone piers, shoreline platforms, lanterns,
and reflections.

Dormant description:

```text
On the existing supported crossing piers, show three separate translucent glass
panes with unmistakably different silhouettes: one narrow ribbon-like vertical
span, one broad shallow horizontal row, and one compact rectangular block. Each
pane is attached to a real stone-and-brass hinge. The panes are cloudy, slightly
misaligned, and stop short of forming a safe crossing, but none is shattered.
Keep their forms architectural rather than diagrammatic. Use deep-water
reflections and subtle violet internal refraction. No selection highlight,
dashed border, cursor, grid, spreadsheet, letters, icons, or floating panes.
```

Restored description:

```text
Pivot the same three hinged panes into one coherent traversable crossing while
preserving their ribbon, row, and block identities. Their edges meet or overlap
only where structurally necessary. Give each edge a crisp restrained cyan-
violet refraction and allow one narrow reflected line in the water. Clear the
cloudiness enough to show alignment, but retain glass texture and regional
darkness. Do not merge the panes into a single bridge slab or add people,
railings, symbols, or scene-wide prism flares.
```

Candidate emphasis: insist on three distinct selection geometries that also
make physical sense as one bridge.

## Unit 8 — Memory Archive

Runtime hook: `registers-putting` / `memory-archive` / `memory-archive`.

Approved backdrop anchor: edit the monumental teal-glass drawer cabinet already
filling the lower-left chamber. Preserve its open central drawer, brass frame,
faceted drawer pulls, left glass side, suspended crystal shelves above, all
bridges, and the archive hall. Treat the existing amber object in the open
drawer as the captured memory's temporary vessel; refine it into a crystal only
if review requires that exact story cue.

Dormant description:

```text
Use the existing cabinet chamber architecture to form a built-in array of
deliberately varied crystal drawers: some shallow, some tall, some paired, all
supported by muted brass runners in dark carved stone. One palm-sized captured
memory crystal rests just outside a single open drawer on a real receiving
tray. It is a faceted teal-amber object, not a bottle with a label and not a
written document. Most drawers are dark; one or two may hold faint residual
light so the cabinet does not read as dead. Drawer faces use material insets
only—no handles shaped like letters, index tabs, numbers, labels, books, or
pseudo-writing.
```

Restored description:

```text
Seat the exact loose crystal into the exact open drawer and close or settle the
receiving tray without changing cabinet geometry. Illuminate a deliberately
nonuniform set of drawers in restrained teal, amber, and violet, making it clear
that distinct stored contents can be chosen independently. Keep many drawers
dark. Use internal material glow rather than text labels or identical status
lights. Preserve every drawer size, runner, stone support, shelf, and chamber
shadow.
```

Candidate emphasis: cabinet variety and the capture/place relationship should
read without turning the archive into office furniture.

## Unit 9 — Far Beacons

Runtime hook: `long-range-navigation` / `far-beacons` / `far-beacons`.

Approved backdrop anchor: edit the two matching domed teal-glass beacon towers
already standing on separate mid-right ravine platforms. Preserve both towers,
their bases, the existing sagging amber connector, the foreground causeway, and
all archive walls. The approved connector is the restored target.

Dormant description:

```text
At the existing ravine passage, make two related but distant miniature beacons
part of separate stone-and-brass bases already anchored on opposite sides. Each
beacon has one small hooded amber-teal lamp and a narrow receiving fork. Between
them, a supported route or causeway remains visible, but the intended light
span is broken: two short dim thread ends stop well before meeting over the
distance. The bases must share design language while remaining spatially
separate. Avoid lighthouse towers, radio antennas, arrows, dotted map routes,
teleporters, floating orbs, or signs.
```

Restored description:

```text
Join the same two dim thread ends into one continuous hairline amber-cyan
connection following the scene's established distance and perspective. Both
hooded lamps become steady at equal restrained intensity. Keep the stone bases,
receiving forks, causeway, ravine darkness, and all intervening architecture
unchanged. The thread may sag or bend subtly according to the support logic; it
must not become a laser, lightning bolt, bridge replacement, or glowing arrow.
```

Candidate emphasis: the distance should feel substantial and returnable while
the connector remains quiet enough for code-first presentation.

## Unit 10 — Echo Clock

Runtime hook: `repeatable-editing` / `echo-clock` / `echo-clock`.

Approved backdrop anchor: edit the giant wheel already cropped into the left
foreground and its descending train of three related wheels toward the centre.
Preserve the structural frame, tooth contacts, teal insets, display cases,
archive corridor, shelves, and every support.

Dormant description:

```text
Integrate a compact clockwork assembly into the gallery's existing wall or
plinth: one primary muted-brass wheel and three smaller related secondary wheels
connected by believable axles, belts, or tooth contacts. All four wheels are
stopped at visibly different phases. Their spoke counts and housings are
consistent enough to imply one family but not identical decorative gears. A
small teal-glass timing reservoir may sit beside the primary wheel. Keep the
mechanism sparse, maintained, and wondrous. Avoid clock faces, hands, numerals,
pendulum clichés, gear clutter, steampunk machinery, or floating cogs.
```

Restored description:

```text
Preserve all wheel geometry and show the primary wheel active through one
restrained amber contact highlight and a subtle repeated phase cue. Propagate
that exact phase through the three secondary wheels in spatial order, using
matching small amber highlights at the corresponding tooth or axle position.
The still must imply coordinated repetition without motion blur or duplicated
ghost wheels. Keep housings, belts, reservoir, gallery light, and surrounding
archive unchanged.
```

Candidate emphasis: it must communicate one operation propagating, not merely
“many gears are glowing.”

## Unit 11 — Meridian Table

Runtime hook: `command-line-ranges-line-operations` / `meridian-table` /
`meridian-table`.

Approved backdrop anchor: edit the broad raised route table already dominating
the right foreground. Preserve its two circular cyan endpoint housings, the
straight recessed cyan route between them, gridless brown surface, heavy legs,
water channels, railings, and twin observation lenses behind it.

Dormant description:

```text
Build the route table into the existing brass chamber as a broad, low,
physically supported cartographic mechanism with dark glass or oxidised metal
insets. Two materially identical endpoint pins stand at different real
positions on the table, both unlit. Several recessed route rails connect
plausible junctions, but every rail has at least one small inactive break, so no
complete path exists between the pins. The rails are abstract engineering
channels, not a readable map. Keep the table edge, legs or wall brackets
credible and use sparse copper and teal accents. No coordinates, grid labels,
arrows, map text, rulers, command marks, or glowing UI.
```

Restored description:

```text
Light the two unchanged endpoint pins and activate exactly one continuous cyan
route between them, following existing recessed rails and junctions. Every
unrelated rail stays dark and materially unchanged. Use tiny amber contact
points only where the selected path turns or transfers. Do not light all routes,
add a map overlay, or invent a new line above the table. Preserve table
supports, route geometry, chamber rails, and ambient exposure.
```

Candidate emphasis: exact endpoints and one selected range must be instantly
legible; reject busy transit-map imagery.

## Unit 12 — Mirror Loom

Runtime hook: `substitution-practical-regex` / `mirror-loom` / `mirror-loom`.

Approved backdrop anchor: edit the loom already filling the right half of the
hall: four hanging oval lenses, copper thread bundles entering from the left,
violet/cyan thread bundles leaving to the right, and the large copper arch
support. Preserve the luminous root display on the left, floor currents,
lanterns, consoles, and all masonry.

Dormant description:

```text
At the existing loom hall supports, construct a restrained glass-and-brass loom
with a tilted pattern lens held in a real gimbal. A set of cyan and dim neutral
threads passes through copper guides; a repeated subset shares one subtle
material trait such as the same bead spacing or refraction, but those matching
threads are currently misrouted through the tilted lens. The remaining threads
are orderly and untouched. Keep all threads thick enough for pixel-art
readability and physically attached to spools or rails. No fabric text, regex
symbols, check marks, search highlights, binary pattern, letters, or abacus
labels.
```

Restored description:

```text
Align the same lens in its gimbal and reroute only the repeated matching subset
through the correct guides. Change only those matching threads from cyan/dim to
restrained warm amber, preserving their thickness and endpoints. Every
nonmatching thread remains exactly cyan and in the same path. Avoid a global
colour grade or changing all threads. Preserve lens shape, guides, spools,
supports, hall architecture, and shadows.
```

Candidate emphasis: manual review must be able to identify unchanged
nonmatches; reject results where “restored” means the entire loom changes.

## Unit 13 — Echo Foundry

Runtime hook: `macros` / `echo-foundry` / `echo-foundry`.

Approved backdrop anchor: edit the horizontal brass recorder cylinder already
mounted in the upper-left, together with the exactly three small linked
mechanisms beneath it. Preserve their copper pipe network, the monumental living
tree, the lower-left lens bank, cyan water channels, walkways, rails, and cavern
opening.

Dormant description:

```text
Integrate one substantial recorder cylinder into the foundry's supported brass
and root-bound architecture. The cylinder faces three distinct but related
mechanisms connected by real copper conduits. Its receiving slot is visibly
empty, and the three mechanisms are silent with their small stage windows dark.
Each mechanism should represent a successive physical action—receive, transfer,
finish—without pictograms. Use glass caps, muted brass, and narrow cyan
conduits; preserve a compact readable silhouette. Avoid factory smoke,
industrial danger, phonographs, music notation, tape-recorder buttons, letters,
numbered steps, cloned machines, or excessive gears.
```

Restored description:

```text
Place one abstract luminous movement pattern into the unchanged recorder
cylinder as three unequal but rhythmically related amber-cyan bands, not
letters or waveform UI. Show that exact three-stage sequence replayed across
the connected mechanisms: the first mechanism displays stage one, the second
stage two, and the third stage three, with matching band shapes and restrained
contact lights. Keep conduits, machine geometry, root supports, and foundry
exposure unchanged. Do not duplicate the entire cylinder, add motion trails
through the room, or illuminate unrelated equipment.
```

Candidate emphasis: the recorded sequence must be recognizable across all
three stages without resembling musical or computer playback controls.

## Unit 14 — Meridian Engine

Runtime hook: `global-normal-automation` / `meridian-engine` /
`meridian-engine`.

Approved backdrop anchor: edit the monumental vertical glass-and-brass current
tower already occupying the right-centre and the four major cyan routes that
converge through its lower housing. Preserve the left horizontal glass conduit,
all catwalks, rails, lower archive chamber, hanging lamps, consoles, mountain
windows, and every existing current channel. Do not replace this composition
with a new four-quadrant engine.

Dormant description:

```text
Edit the existing tall current tower in place. Keep its glass cylinder, brass
ribs, upper cap, lower convergence housing, support legs, and exact silhouette.
Inside the glass, reduce the cyan current to a faint suspended thread that stops
well above the lower housing. At the four existing major cyan routes, interrupt
the flow immediately before each route enters the housing: retain the physical
glass or conduit, but make each terminal visibly unenergized with one narrow
dark separation and no broken debris. The lower core remains intact and
readable as deep teal glass with only a safe ember-sized pilot light. Preserve
the horizontal conduit from the left and every catwalk crossing in front of or
behind the tower. The result is one coherent machine awaiting reconnection, not
four new modules. Avoid quadrant divisions, elemental materials, four-colour
logos, compass symbols, a world map, throne, weapon, reactor danger, smoke, or
gear overload.
```

Restored description:

```text
Reconnect the four existing cyan routes to the unchanged lower housing and
carry one continuous, controlled cyan-white current upward through the existing
vertical glass cylinder. The flow should be legible as four incoming paths
becoming one steady rising current, with no extra branches and no change to the
tower geometry. Let the lower core settle into a small warm-white centre with a
defined edge; add only thin cyan contact lights at the four existing junctions
and restrained reflections on the nearest brass ribs and platform edges.
Preserve the darker archive chamber, mountain windows, lamps, consoles, and
unrelated machinery. Do not create an explosion, giant beam, portal, rainbow,
halo filling the room, or uniform brightness across all machinery.
```

Candidate emphasis: select for coordinated wholeness and material continuity,
not spectacle. Reject any output that turns the chosen vertical tower into four
quadrants or changes its registered silhouette. The final engine must feel
welcoming, precise, and earned.

## Intro Panel 1 — The connected Wilds

References: approved compact or cinematic master for each of the four regions.
Keep a fixed reference order: Moonroot, Starwater, Archive, Brass Meridian.

```text
Use case: cinematic key art for an original mobile learning game
Asset type: first panel of a three-panel story introduction
Output: one 2K 16:9 polished 2D pixel-art illustration

Create one continuous distant panorama of the Vim Wilds at a calm remembered
height of harmony. This is a single believable landscape with atmospheric
depth—not four screenshots, four framed quadrants, a collage, a board-game map,
or an infographic.

Compose the regions as a left-to-right environmental journey with natural
overlaps and depth transitions. Moonroot Ruins begins in a blue-green moonlit
forest sanctuary of enormous roots, mossed dark stone, still water, tiny amber
lanterns, violet spores, and turquoise mineral veins. It opens toward Starwater
Sanctuary: spacious dark reflective water, slim stone islands, translucent
reeds, glass observatory forms, pale cyan and violet reflections, and sparse
warm navigation lights. The water and stone descend naturally into the Archive
of Echoes, glimpsed through a deep welcoming carved chamber with suspended
shelves, teal crystal drawers, distant brass beacons, amber memory lights, and
violet shadow. Archive rails and light channels rise toward Brass Meridian
beneath a dark ridge: precise brass routes, copper conduits, glass lenses,
controlled ember light, and narrow cyan current.

Show small, distant restored landmark silhouettes embedded in their regions,
not enlarged hero props. Connect the four regions with two or three extremely
thin amber and cyan currents that follow real terrain, water, arches, rails,
and conduits. The connections should guide the eye in one gentle sweep and make
the world feel linguistically coordinated, not electrically powered.

Use three depth planes, a restrained luminous focal rhythm, painterly pixel
clusters, crisp silhouettes, deep navy foundations, and consistent slightly
elevated side-on perspective. Leave broad calm dark negative space across much
of the lower third so responsive HTML copy remains readable, but keep that
space as real water, stone shadow, or atmospheric terrain—not a blank rectangle.

No characters. No text, letters, runes, code, UI, borders, region labels,
icons, arrows, maps, compass rose, generated signage, pseudo-writing, logo, or
watermark. Avoid a four-biome strip, equal quadrants, fantasy world map,
daylight, catastrophe, high-saturation neon, or copied game composition.
```

Candidate axes for 8–10 runs: region transition topology; current path; degree
of Archive depth; relative prominence of water versus ridge; landmark subtlety.
Never change the left-to-right narrative or lower-third readability.

## Intro Panel 2 — The interrupted command

Generate only as a conversational edit of the approved Panel 1 result.

```text
Create the second story panel as an exact-state edit of the approved connected
panorama. Preserve the exact 16:9 canvas, camera, horizon, crop, region
positions, terrain, architecture, waterline, palette, pixel density,
atmospheric depth, and lower-third negative space. A crossfade between Panels 1
and 2 should reveal a change in state, not a different painting.

Change harmony into a quiet interruption. One important amber-cyan current
should stop a short distance before its receiving landmark, ending in a soft,
stable unfinished thread rather than a spark. Two other connections may drift
slightly out of alignment with their existing channels. Restored landmark
lights become low dormant embers; one observatory lens rests off-axis; distant
archive beacons no longer share a connecting thread; selected Meridian
mechanisms pause at visibly different phases. Add only a few suspended mineral
or glass fragments where existing structures plausibly contain them. Paths
remain traversable, water remains calm, architecture remains intact, and every
region is safe.

Communicate “an unfinished instruction left relationships incomplete,” not
war, destruction, corruption, death, danger, or an evil force. Keep the image
warm enough to invite restoration. Do not add characters, villain, storm,
lightning, explosion, fire, smoke, ruins collapsing, red alarm light, weapons,
cracks across the whole world, black portal, text, symbols, code, UI, captions,
logo, or watermark. Output one 2K 16:9 complete image.
```

Candidate axes: which single connection is unfinished; exact dormant-light
balance; subtle fragment placement. Prefer the least melodramatic candidate
that makes the state change unmistakable.

## Intro Panel 3 — Nix at the Moonroot threshold

References: approved Moonroot scene/master first; canonical Nix idle image
second; approved dormant Mode Lantern state third if available.

```text
Use case: cinematic key art for an original mobile learning game
Asset type: third panel of a three-panel story introduction
Output: one 2K 16:9 polished 2D pixel-art illustration

Create an intimate arrival at the threshold of Moonroot Ruins. Preserve the
approved Moonroot rendering language, blue-green dusk palette, enormous rooted
architecture, mossed dark stone, shallow still water, tiny amber lights,
restrained violet spores, turquoise mineral seams, and slightly elevated
side-on perspective. The place is ancient, warm, mysterious, and safe.

Place canonical Nix on a real stone or root-supported threshold in the lower
middle distance, small enough that the environment remains the protagonist but
large enough for the silhouette to read on a phone. Preserve Nix exactly:
compact teal-hooded firefly mage; shadowed face with exactly two amber eyes;
exactly two antennae; exactly two translucent cream wings; dark teal embroidered
hood with warm gold trim; compact brown travel clothes; teal boots; dark wooden
square-hook lantern staff. Keep every permanent prop attached and use the same
pixel-art proportions and camera angle as the canonical reference.

Nix stands in a calm, capable posture and lifts or angles the lantern staff
toward the dormant Mode Lantern at its physically supported terrace. The
landmark shows four misaligned nested glass rings around one dim amber core. A
single narrow warm light travels from Nix's lantern toward the landmark but
stops as a gentle invitation at the outer ring; it does not restore the
landmark yet. Let one faint reflection connect the two across real stone or
water. The staging should communicate recognition, companionship, and an
invitation to learn—not prophecy or rescue.

Reserve broad calm dark environmental space across the lower third for HTML
copy without drawing a blank panel. Maintain clear silhouettes around Nix and
the landmark; keep high-frequency detail away from the copy zone.

No extra character, duplicate Nix, changed costume, extra limbs, extra wings,
missing staff, giant character close-up, heroic battle pose, chosen-one motif,
danger, monster, text, speech bubble, runes, letters, code, UI, caption, logo,
or watermark.
```

Candidate axes: Nix-to-landmark distance; threshold framing by roots; reflection
path; degree of environmental intimacy. Reject any candidate that redesigns
Nix or makes the character more important than the world and landmark.

## Selection record

For every selected output, record:

- prompt pack section and candidate axis;
- model and model revision;
- interaction/conversation ID;
- reference filenames and SHA-256 hashes;
- output timestamp, dimensions, and SHA-256;
- reviewer notes at phone, square, wide, shallow, reduced-motion, and offline
  fallback states;
- selected runtime unit, scene, profile, landmark state, and final path.

The approved intro runtime paths are:

```text
assets/worlds/story/intro-connected.webp
assets/worlds/story/intro-interrupted.webp
assets/worlds/story/intro-nix-threshold.webp
```

The approved landmark runtime paths are profile-local:

```text
assets/worlds/<world-id>/scenes/<scene-id>/<profile>/landmark-dormant.webp
assets/worlds/<world-id>/scenes/<scene-id>/<profile>/landmark-restored.webp
```

After promotion, replace the corresponding `asset: null` intro entries, add or
verify selected scene profile paths, run `npm run test:pwa`, then use
`window.VimWilds.showUnitStory(unitId)` to inspect all 14 transitions without
changing curriculum completion.

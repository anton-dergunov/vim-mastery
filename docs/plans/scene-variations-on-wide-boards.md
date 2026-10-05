# Scene variations on wide boards

Status: options laid out, none chosen (as of 2026-10-05). The next step is a
visual check, described at the end. Nothing here has been built.

## The problem

Ambient scene variations (a market stall appears, a lantern is lit) play during
exercises on phone and near-square boards, and not on wide boards. Wide is what
a laptop or desktop shows, and it is where a variation is easiest to see.

Anton's view, which sets the priority: on a phone the board is mostly covered
by the editor, so variations add little there. They matter on tablets and
desktops. A solution may therefore give up some fidelity on phones to get
variations on wide boards.

## How it works today

- Each scene has three pictures: `tall` (4:5), `compact` (4:3) and `wide`
  (16:9). `compact` is the scene Anton approved. `tall` and `wide` were derived
  from it by the image model.
- Each scene has 50 variations, all drawn pixel for pixel over the **compact**
  picture. Fourteen scenes store each variation as a full board (about 290 KB
  each, 11–19 MB per scene); five store it as a transparent patch (about 68 KB
  each, about 3 MB per scene). Variations total 216 MB and are fetched on
  demand, never precached. Base boards total 26 MB.
- During an exercise, tall and compact boards both show the compact picture,
  so variations line up. Wide and shallow boards show the wide picture and
  variations are switched off (`sceneProfileForPolicy` and
  `remoteVariantsAreEligible` in `src/world/presentation.js`; the policy is set
  in `src/lesson/board.js`). Reading and choice screens are static everywhere.
- Why wide exercises were made static has not been traced. Commit `2e8d1bd`
  had variations on wide boards using the compact picture.

## What was measured

Every compact board was aligned onto its wide board (feature matching, one
shift-scale-rotate for the whole picture).

- **The wide picture is the same scene, not the same pixels.** The compact
  scene lands at a different size and place in each wide board, and is not
  centred.
- **About ten scenes are a clean extension.** The compact scene fills the wide
  picture's full height and most objects line up: Echo Foundry, Keeper's Relay,
  Grammar Gate Court, Mode Lantern Grounds are the best (80% or more of pixels
  agree).
- **About eight are zoomed out or recomposed.** Nested Garden shows the scene
  at about 60% of its compact size; Meridian Engine is shifted left; Echo
  Clock, Far Beacons, Memory Archive and Open Trail Overlook are rotated one to
  two degrees or have objects moved. Overlaid whole, these ghost visibly.
  **Anton looked at the overlays and found the objects poorly aligned**, which
  matches the numbers: a whole-picture overlay is not usable.
- **Aligning one variation at a time does better.** A variation is a small
  local change. Matching only the area around it against the wide board found
  a plausible spot for seven of seven variations tried: three on Mode Lantern
  Grounds (clean) and four on Meridian Engine, the worst-aligned scene (three
  clean, one with a faint haze from a crude cut-out).
- **This is thin evidence.** Seven of 950 variations, judged from reduced
  sheets, with a rough cut-out. Whether placement is good enough at full size
  is exactly what the visual check has to answer.

## Options

### 1. Show the compact picture on wide boards

A one-line policy change. No new art, no extra download. The 4:3 picture is
cropped to a 16:9 board, losing about a quarter of its height, and looks
pixellated at desktop size. **Rejected by Anton**: the wide boards were just
regenerated precisely to avoid using compact pictures on wide layouts.

### 2. Generate a second set of variations for each wide picture

950 generations and their review. Variations sit at native resolution on the
wide art. About 60 MB more as patches, about 250 MB as full boards; hosting can
absorb either, since they are fetched on demand. The cost is generation and
review time, and two variation sets to maintain.

### 3. Rebuild the wide pictures as extensions of the compact one

Regenerate the 19 wide boards as outpaints, pasting the compact scene back
pixel-exact in the middle so only the side strips are new.

- Every existing variation applies to wide boards at a fixed offset. None are
  regenerated.
- The 14 full-board scenes need their variations converted to patches so no
  seam shows at the strips (`scripts/world-art/patch_extraction.py` exists; no
  generation).
- Phone art and all 950 variations stay exactly as approved.
- The current wide art is discarded, including the four boards chosen on
  2026-10-05. Nothing ever changes in the side strips.

### 4. Transplant the existing variations onto the current wide pictures

Cut each variation out, align it locally to the wide board, write a
wide-registered transparent patch. Skip those that align weakly; Anton rejects
the rest from a review sheet.

- No base pictures change. No generation, except optionally for rejects.
- About 3 MB per scene more, about 60 MB in total.
- Transplanted pieces are enlarged up to about 1.4× on the large boards, so
  they may read softer than the art around them.
- Two variation sets exist afterwards (compact and wide).

### 5. Use only the wide picture; crop it at runtime for other layouts

One picture and one variation set per scene, registered to wide. Phone and
compact boards show a declared crop.

- Variations: transplanted as in option 4, or regenerated as in option 2.
- A moderate refactor: compact is the reference picture in the manifest
  schema, the tests, thumbnails and story backdrops.
- Phones download the whole wide picture and need to skip variations outside
  their crop.
- Phone framing changes in every scene (see "Phone framing" below).

### 6. Replace the compact pictures with baked crops of the wide ones

As option 5, but the crop is cut once and shipped as the compact file.

- The runtime keeps its three files per scene; little board code changes.
- Because compact is then an exact, known rectangle of wide, one variation set
  serves both: a variation registered to the crop is drawn on the wide board at
  a fixed offset.
- No base pictures are generated. All 950 variations still have to be
  transplanted, because they were drawn over the old compact art.
- The approved compact art is replaced by crops of pictures that were only
  reviewed as desktop derivatives.

### Phone framing under options 5 and 6

A phone board shows about a third of the wide picture's width, close to the
slice of the scene phones show today. In the ten clean-extension scenes a crop
is 2048×1536 against today's 2400×1792, which is negligible. In the eight
zoomed-out scenes a crop matching today's framing is much smaller (Nested
Garden about 1400×1060) and would be upscaled about 1.7× on a phone; the
alternative is a full-height crop that stays sharp and shows the scene smaller.
Given that the editor covers most of a phone board, this may matter little.

## Comparison

| | Base pictures generated | Variations | Phone art | Desktop art |
|---|---|---|---|---|
| 2. Second variation set | none | 950 generated | unchanged | unchanged |
| 3. Extend wide from compact | 19 wide | all reused exactly | unchanged | replaced |
| 4. Transplant to wide | none | 950 transplanted, some rejects | unchanged | unchanged |
| 5. Wide only, runtime crop | none | 950 transplanted or generated | changes | unchanged |
| 6. Compact baked from wide | none | 950 transplanted | changes | unchanged |

Options 4, 5 and 6 all depend on the same thing: whether a transplanted
variation looks right on the wide picture. Options 5 and 6 depend on a second
thing: whether a crop of the wide picture is acceptable on a phone.

## Next step: a visual check

No option is committed. Two sheets answer the open questions, with no
generation and no change to the app.

1. **Transplant, one whole scene.** All 50 variations of one scene transplanted
   onto its wide board with the proper patch cut-out, shown at full size beside
   the compact original, with the alignment score for each. Do this for one
   clean-extension scene and one recomposed scene (Mode Lantern Grounds and
   Meridian Engine were the two tried). It gives the real reject rate and shows
   whether placement and softness are acceptable.
2. **Phone crop, all 19 scenes.** Today's phone exercise view beside the crop
   of the wide picture at 390×844, and the same for a tablet-sized compact
   board. Only needed if options 5 or 6 are still in play after the first
   sheet.

How the result steers the choice:

- Transplants look right, phone crops acceptable → option 6 (one variation
  set, simplest runtime).
- Transplants look right, phone crops not acceptable → option 4.
- Transplants do not look right → option 3 (extend wide from compact) or
  option 2 (generate a wide set), depending on whether the current wide art or
  the generation cost matters more.

The throwaway scripts used for the measurements were not kept. The method is
SIFT features with a RANSAC similarity fit (`cv2.estimateAffinePartial2D`),
over the whole picture for the alignment table and over a window around each
variation for the transplant.

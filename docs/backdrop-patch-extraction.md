# Backdrop patch extraction

The game has 700 optional backdrop variants: 50 variants for each of 14 unit
scenes. Nano Banana produced every variant as a complete 1200×896 image, even
though the intended addition usually occupies a small part of the canvas.

The repository deliberately keeps two runtime representations:

- `variants/` contains full-canvas transparent patches. RGB is lossy WebP at
  quality 95; alpha is lossless.
- `variants-full/` contains the original complete opaque frames converted to
  quality-95 WebP. These are the fidelity fallback.

The active representation is selected only in
[`scene-variant-config.js`](../scene-variant-config.js). Both families are
intentional repository assets. Do not delete the inactive family or remove the
switch merely because one mode is currently selected.

The current 700-image export is 40.74 MiB for transparent patches and
197.56 MiB for complete boards. Patches are therefore 79.38% smaller, or an
average 2.91 MiB instead of 14.11 MiB per unit. Keeping both representations
costs 238.30 MiB.

## Why target bounds are not used

The authored target bounds from the generation prompts are not reliable
extraction inputs. Nano Banana frequently placed the requested object outside
those bounds. Extraction therefore compares every pixel of the complete
generated image against its complete generation base. Target names and bounds
play no part in the mask.

The production implementation is
[`scripts/world-art/extract_production_scene_patches.py`](../scripts/world-art/extract_production_scene_patches.py).
It performs the following steps for every approved source.

1. Resize the exact compact generation base to the generated image dimensions
   and calculate per-pixel CIE76 delta-E.
2. Divide the whole canvas into 16×16 cells. Score each cell with clipped
   delta-E, estimate background noise with the median and MAD, add linearly
   distance-weighted spatial support, and use Otsu thresholding to find strong
   coherent components.
3. Retain connected change islands according to their energy relative to the
   strongest island. Grow plausible low-contrast edges and add a one-cell
   localization margin.
4. Treat that cell mask only as a coarse region of interest. It is never the
   final alpha mask.
5. Inside the coarse ROI, seed pixel-level hysteresis from pixels above the
   high threshold (outside-ROI p95 delta-E, minimum 8.0). Allow connected weak
   pixels above the low threshold (outside-ROI p75, minimum 2.3) to propagate
   up to 96 pixels beyond the coarse ROI. Strong seeds remain restricted to the
   original ROI, so unrelated remote noise cannot start a new object.
6. Apply 8-neighbour propagation, a two-pixel close, hole filling, and a
   two-pixel safety dilation. Convert the result to alpha with a four-pixel
   inward linear distance ramp.
7. Preserve the original 1200×896 canvas. Set fully transparent RGB to zero,
   encode visible RGB as quality-95 lossy WebP, and preserve alpha losslessly.
   Decode the result and require its alpha plane to match exactly before
   replacing the checked-in asset.
8. Independently encode the original generated frame as the complete-board
   fallback.

The full canvas avoids crop offsets and lets the browser apply exactly the same
`background-size: cover`, focal position, and responsive transform to the base
and its patch.

## Why the first cell-mask version produced bright rectangles

The first production version copied every generated pixel in each retained
16×16 cell and in a one-cell safety ring. Nano Banana had often made small
lighting or colour changes to background pixels near the requested object.
Copying whole cells therefore copied a rectangular region of relit background.
The object detector had found the correct area, but a localization mask was
incorrectly used as the final matte.

The earlier pixel-exact proof only established that a decoded patch reproduced
the *filtered reference*—generated pixels inside the chosen cells and base
pixels outside. It did not test whether those two regions met continuously.
Pixel equality to a flawed filtered reference could therefore pass while the
result still had an obvious visual seam.

## Regression checks

Run the production export:

```bash
python3 scripts/world-art/extract_production_scene_patches.py
```

The exporter writes hashes, sizes, mask coverage, thresholds, and per-scene
totals to
[`scripts/world-art/production-scene-patch-summary.json`](../scripts/world-art/production-scene-patch-summary.json).

Then run the boundary-continuity audit:

```bash
python3 scripts/world-art/audit_production_scene_patch_seams.py \
  --fail-on-visible-seams
```

The audit does not mistake every natural object silhouette for a bad seam. At
each alpha crossing it asks whether:

- the rendered change immediately inside the mask is clearly visible
  (at least 5 delta-E);
- the Nano Banana change continues immediately outside the mask
  (at least 2.3 delta-E); and
- the outside source change is at least half as strong as the inside source
  change.

More than 5% such arbitrary visible cuts makes a patch fail. The report is
written to
[`scripts/world-art/production-scene-patch-seam-report.json`](../scripts/world-art/production-scene-patch-seam-report.json).
This check requires the local generation sources under
`artifacts/world-generation/patch-reviews/`.

The current report passes all 700 patches. The same metric identified 627 of
700 patches as visibly seamed before pixel-level refinement.

For reproducible visual review, generate the fixed 20-image random sample:

```bash
python3 scripts/world-art/prove_seam_safe_patch_sample.py
```

Or regenerate selected one-based sample indices:

```bash
python3 scripts/world-art/prove_seam_safe_patch_sample.py --indices 5 19 20
```

Proof artifacts are written below
`artifacts/world-generation/seam-safe-patch-random-sample/` and are not runtime
assets.

The Python art tools require Pillow, NumPy, and SciPy.

## Responsive registration

All 700 variants were generated from compact scene bases. Independently
generated tall and wide bases do not have pixel-identical geometry, so placing
compact patches over them causes misplaced objects and seams.

Animated tall, compact, and wide boards therefore register both the base and
variant to the scene's compact profile. CSS still cover-scales that shared
canvas to the actual board bounds. The extremely shallow profile does not run
variants and retains its registered wide base. This is why the implementation
can animate every unit on normal desktop displays without pretending that a
compact patch aligns to independently generated wide artwork.

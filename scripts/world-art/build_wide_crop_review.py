#!/usr/bin/env python3
"""Show what a phone or tablet board would look like if it were cropped from
the wide picture instead of using the compact one.

A visual check for an option since rejected (see
``docs/plans/wide-board-variations.md``). Nothing under ``assets/`` is written. The compact picture's
footprint inside the wide picture comes from the whole-picture fit; two crops
are drawn for each scene, one matching today's framing and one using the wide
picture's full height.
"""

from __future__ import annotations

import html
import json
from pathlib import Path

import numpy as np
from PIL import Image

from build_unit_scene_review_sheets import add_editor_preview, cover
from transplant_variants_to_wide import ARTIFACT_ROOT, OUTPUT, ROOT, apply, global_fit, load_rgb, scale_of


METRICS = ARTIFACT_ROOT / "layout-masks/metrics.json"
PAGE_PATH = OUTPUT / "phone-crops.html"
IMAGES = OUTPUT / "phone-crops"
# Drawn at twice the measured CSS size so the page shows a phone's detail.
PHONE_PIXEL_RATIO = 2
TABLET_BOARD = (960, 720)
COMPACT_ASPECT = 4 / 3


def phone_layout() -> tuple[tuple[int, int], tuple[int, int, int, int]]:
    """The measured 390x844 exercise board and the editor's box on it."""
    profile = next(
        item
        for item in json.loads(METRICS.read_text())["profiles"]
        if item["id"] == "tall"
    )
    size = (
        round(profile["world"]["width"] * PHONE_PIXEL_RATIO),
        round(profile["world"]["height"] * PHONE_PIXEL_RATIO),
    )
    editor = profile["editor"]
    box = (
        round(editor["x"] * size[0]),
        round(editor["y"] * size[1]),
        round((editor["x"] + editor["width"]) * size[0]),
        round((editor["y"] + editor["height"]) * size[1]),
    )
    return size, box


def clamped_box(
    centre: tuple[float, float],
    width: float,
    height: float,
    limit: tuple[int, int],
) -> tuple[int, int, int, int]:
    """A box of the given size around ``centre``, shrunk at the same aspect
    and shifted as needed to lie inside the picture."""
    factor = min(1.0, limit[0] / width, limit[1] / height)
    width, height = width * factor, height * factor
    left = min(max(centre[0] - width / 2, 0), limit[0] - width)
    top = min(max(centre[1] - height / 2, 0), limit[1] - height)
    return round(left), round(top), round(left + width), round(top + height)


def main() -> int:
    phone_size, editor_box = phone_layout()
    IMAGES.mkdir(parents=True, exist_ok=True)
    sections = []
    for directory in sorted((ROOT / "assets/worlds").glob("*/scenes/*/")):
        scene_id = directory.name
        compact = load_rgb(directory / "compact/base.webp")
        wide = load_rgb(directory / "wide/base.webp")
        wide_size = (wide.shape[1], wide.shape[0])
        fit, _ = global_fit(compact, wide)
        scale = scale_of(fit)
        centre = apply(fit, np.array([[compact.shape[1] / 2, compact.shape[0] / 2]]))[0]
        footprint = (compact.shape[1] * scale, compact.shape[0] * scale)
        crops = {
            "same framing": clamped_box(tuple(centre), *footprint, wide_size),
            "full height": clamped_box(
                tuple(centre),
                wide_size[1] * COMPACT_ASPECT,
                wide_size[1],
                wide_size,
            ),
        }
        pictures = {"today": Image.fromarray(compact)}
        captions = {"today": f"Today: compact picture, {compact.shape[1]}×{compact.shape[0]}"}
        for name, box in crops.items():
            pictures[name] = Image.fromarray(wide).crop(box)
            width, height = box[2] - box[0], box[3] - box[1]
            share = 100 * min(width / footprint[0], 1.0) * min(height / footprint[1], 1.0)
            captions[name] = (
                f"Crop of wide, {name}: {width}×{height}, "
                f"{width / compact.shape[1]:.2f}× today's pixels across"
                + (f", keeps {share:.0f}% of today's scene" if name == "same framing" and share < 99 else "")
            )
        figures = {"phone": [], "tablet": []}
        for name, picture in pictures.items():
            phone = cover(picture, phone_size)
            add_editor_preview(phone, editor_box)
            tablet = cover(picture, TABLET_BOARD)
            slug = name.replace(" ", "-")
            for kind, image in (("phone", phone), ("tablet", tablet)):
                file = f"{scene_id}-{kind}-{slug}.webp"
                image.save(IMAGES / file, "WEBP", quality=92, method=4)
                figures[kind].append(
                    f'<figure><figcaption>{html.escape(captions[name])}</figcaption>'
                    f'<img loading="lazy" src="phone-crops/{file}" '
                    f'width="{image.width // PHONE_PIXEL_RATIO if kind == "phone" else image.width // 2}">'
                    f'</figure>'
                )
        sections.append(
            f'<section><h2>{html.escape(scene_id)}</h2>'
            f'<div class="meta">The compact scene sits in the wide picture at {scale:.2f}× '
            f'its own pixels, {footprint[0]:.0f}×{footprint[1]:.0f} of {wide_size[0]}×{wide_size[1]}.</div>'
            f'<h3>Phone exercise board, 390×844, with the editor over it</h3>'
            f'<div class="row">{"".join(figures["phone"])}</div>'
            f'<h3>Tablet-sized compact board</h3>'
            f'<div class="row">{"".join(figures["tablet"])}</div></section>'
        )
        print(f"{scene_id}: scale {scale:.3f}, crops {crops}", flush=True)

    PAGE_PATH.write_text(f"""<!doctype html>
<meta charset="utf-8">
<title>Phone and tablet boards cropped from the wide picture</title>
<style>
  body {{ margin: 0; padding: 20px; background: #15181b; color: #dfe5e2; font: 14px/1.45 system-ui, sans-serif; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  h2 {{ font-size: 16px; margin: 0 0 2px; }}
  h3 {{ font-size: 13px; margin: 14px 0 0; color: #9fb0a8; font-weight: 600; }}
  p {{ margin: 4px 0; max-width: 78ch; }}
  section {{ border-top: 1px solid #333b41; padding: 18px 0; }}
  .meta, figcaption {{ color: #9fb0a8; font-size: 12px; }}
  .row {{ display: flex; gap: 14px; overflow-x: auto; margin-top: 6px; align-items: flex-start; }}
  figure {{ margin: 0; flex: none; }}
  figcaption {{ margin-bottom: 4px; max-width: 46ch; }}
  img {{ display: block; height: auto; }}
</style>
<h1>Phone and tablet boards cropped from the wide picture</h1>
<p>For each scene: today's board, then the same board cut from the wide picture two ways. "Same framing" takes the part of the wide picture that the compact scene occupies, so it has fewer pixels where the wide picture shows the scene smaller. "Full height" keeps every pixel of the wide picture's height and shows the scene smaller instead. The dark panel is where the editor sits during an exercise.</p>
{chr(10).join(sections)}
""")
    print(f"{len(sections)} scenes -> {PAGE_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

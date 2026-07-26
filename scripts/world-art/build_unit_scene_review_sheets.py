#!/usr/bin/env python3
"""Render Moonroot candidate contact sheets with the measured editor occlusion."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
SCENE_ROOT = ROOT / "artifacts" / "world-generation" / "unit-scenes"
METRICS = ROOT / "artifacts" / "world-generation" / "layout-masks" / "metrics.json"
OUTPUT_ROOT = SCENE_ROOT / "review-sheets"
FRAME = (640, 480)
GAP = 22
LABEL_HEIGHT = 44


def editor_box() -> tuple[int, int, int, int]:
    metrics = json.loads(METRICS.read_text())
    profile = next(item for item in metrics["profiles"] if item["id"] == "compact")
    editor = profile["editor"]
    return (
        round(editor["x"] * FRAME[0]),
        round(editor["y"] * FRAME[1]),
        round((editor["x"] + editor["width"]) * FRAME[0]),
        round((editor["y"] + editor["height"]) * FRAME[1]),
    )


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    scale = max(size[0] / image.width, size[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - size[0]) // 2
    top = (resized.height - size[1]) // 2
    return resized.crop((left, top, left + size[0], top + size[1]))


def add_editor_preview(image: Image.Image, box: tuple[int, int, int, int]) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    radius = 12
    draw.rounded_rectangle(box, radius=radius, fill=(3, 15, 14, 244), outline=(216, 182, 91, 210), width=2)
    line_y = box[1] + 30
    for width, color in ((210, (209, 224, 216, 235)), (140, (129, 165, 148, 175)), (180, (209, 224, 216, 210))):
        draw.rounded_rectangle(
            (box[0] + 34, line_y, min(box[2] - 28, box[0] + 34 + width), line_y + 9),
            radius=4,
            fill=color,
        )
        line_y += 25


def main() -> int:
    box = editor_box()
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    font = ImageFont.load_default(size=18)
    for directory in sorted(path for path in SCENE_ROOT.iterdir() if path.is_dir() and (path / "manifest.json").exists()):
        manifest = json.loads((directory / "manifest.json").read_text())
        candidates = manifest["candidates"]
        columns, rows = 2, 3
        width = columns * FRAME[0] + (columns + 1) * GAP
        height = rows * (FRAME[1] + LABEL_HEIGHT) + (rows + 1) * GAP
        sheet = Image.new("RGB", (width, height), "#07110f")
        draw = ImageDraw.Draw(sheet)
        for index, candidate in enumerate(candidates):
            source = Image.open(directory / candidate["path"]).convert("RGB")
            frame = cover(source, FRAME)
            add_editor_preview(frame, box)
            column, row = index % columns, index // columns
            x = GAP + column * (FRAME[0] + GAP)
            y = GAP + row * (FRAME[1] + LABEL_HEIGHT + GAP)
            sheet.paste(frame, (x, y))
            label = f'{candidate["id"]} · {candidate["directionId"]}'
            draw.text((x + 4, y + FRAME[1] + 10), label, fill="#e8f3ec", font=font)
        output = OUTPUT_ROOT / f'{manifest["unitId"]}.jpg'
        sheet.save(output, quality=90, optimize=True)
        print(f"Wrote {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

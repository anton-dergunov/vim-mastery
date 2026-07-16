from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import convert_veo_animation as converter


BACKGROUND = (25, 31, 28)


def anchor_sprite() -> Image.Image:
    image = Image.new("RGBA", (128, 128))
    ImageDraw.Draw(image).ellipse((40, 28, 88, 108), fill=(20, 110, 108, 255))
    return image


def source_frame(offset: int = 0, spark: bool = True) -> Image.Image:
    image = Image.new("RGB", (160, 220), BACKGROUND)
    draw = ImageDraw.Draw(image)
    draw.ellipse((54 + offset, 52, 112 + offset, 166), fill=(20, 110, 108))
    draw.rectangle((48 + offset, 72, 58 + offset, 164), fill=(104, 67, 32))
    if spark:
        draw.ellipse((122 + offset, 62, 127 + offset, 67), fill=(255, 204, 72))
    return image


class VeoConversionTests(unittest.TestCase):
    def test_background_matte_keeps_character_and_nearby_spark(self) -> None:
        frame = source_frame()
        alpha = converter.soft_background_alpha(frame, np.array(BACKGROUND, dtype=np.float32), 7, 16)
        cleaned = converter.keep_character_and_effects(alpha)
        values = np.asarray(cleaned)
        self.assertEqual(values[0, 0], 0)
        self.assertGreater(values[100, 80], 240)
        self.assertGreater(values[64, 124], 240)

    def test_placement_matches_anchor_and_never_clips_motion(self) -> None:
        frames = []
        for offset in (-8, 0, 13):
            frame = source_frame(offset)
            alpha = converter.keep_character_and_effects(
                converter.soft_background_alpha(frame, np.array(BACKGROUND, dtype=np.float32), 7, 16)
            )
            frames.append(converter.decontaminate_edges(frame, alpha))
        placement = converter.fit_placement(frames, anchor_sprite(), 128, 4)
        output = converter.render_aligned_frames(frames, placement, 128)
        anchor_box = anchor_sprite().getchannel("A").getbbox()
        first_body = converter.largest_component_bbox(output[0].getchannel("A"))
        self.assertGreaterEqual(placement.canvas_size, 128)
        self.assertAlmostEqual(
            (first_body[0] + first_body[2]) / 2,
            (anchor_box[0] + anchor_box[2]) / 2 + placement.inset,
            delta=2,
        )
        self.assertAlmostEqual(first_body[3], anchor_box[3] + placement.inset, delta=2)
        self.assertAlmostEqual(first_body[2] - first_body[0], anchor_box[2] - anchor_box[0], delta=2)
        for frame in output:
            alpha = np.asarray(frame.getchannel("A"))
            self.assertFalse(alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any())

    def test_lossless_webp_keeps_alpha_and_one_play_metadata(self) -> None:
        frames = [Image.new("RGBA", (64, 64)), Image.new("RGBA", (64, 64))]
        ImageDraw.Draw(frames[1]).ellipse((12, 12, 52, 52), fill=(255, 190, 64, 180))
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "animation.webp"
            converter.save_webp(frames, output, fps=12, loop=1)
            with Image.open(output) as result:
                self.assertEqual(result.n_frames, 2)
                self.assertEqual(result.info.get("loop"), 1)
                result.seek(1)
                self.assertEqual(result.convert("RGBA").getchannel("A").getextrema()[1], 180)
            self.assertEqual(
                converter.inspect_webp_animation(output),
                {"frames": 2, "duration_ms": round(2 * 1000 / 12), "loop": 1},
            )


if __name__ == "__main__":
    unittest.main()

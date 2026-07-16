from __future__ import annotations

import json
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import animate_character as animation


def synthetic_character(size: int = 128) -> Image.Image:
    image = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(image)
    draw.ellipse((35, 28, 94, 96), fill=(16, 104, 105, 255))
    draw.ellipse((52, 43, 62, 55), fill=(255, 174, 24, 255))
    draw.ellipse((70, 43, 80, 55), fill=(255, 174, 24, 255))
    draw.polygon([(40, 55), (14, 37), (19, 70)], fill=(235, 210, 164, 240))
    draw.polygon([(89, 55), (116, 36), (110, 72)], fill=(235, 210, 164, 240))
    return image


class AnimationTests(unittest.TestCase):
    def test_curve_has_eased_midpoint_and_endpoints(self) -> None:
        points = [[0, 0], [0.5, 10], [1, 0]]
        self.assertEqual(animation.curve(points, 0), 0)
        self.assertEqual(animation.curve(points, 0.5), 10)
        self.assertEqual(animation.curve(points, 1), 0)
        self.assertGreater(animation.curve(points, 0.25), 0)

    def test_affine_rotation_preserves_canvas_and_alpha(self) -> None:
        image = synthetic_character()
        transformed = animation.affine_layer(image, (64, 64), angle_degrees=8, translation=(0, -5))
        self.assertEqual(transformed.size, image.size)
        self.assertIsNotNone(transformed.getchannel("A").getbbox())

    def test_renderer_is_deterministic_and_returns_to_start(self) -> None:
        source = synthetic_character(128)
        _, mapping = animation.normalize_image(source, 128)
        config = {"parts": [], "effects_origin": [0.5, 0.35]}
        first = animation.render_frames(source, [], config, mapping, seed=17)
        second = animation.render_frames(source, [], config, mapping, seed=17)
        self.assertEqual(len(first), 18)
        self.assertTrue(np.array_equal(np.asarray(first[0]), np.asarray(second[0])))
        self.assertTrue(np.array_equal(np.asarray(first[9]), np.asarray(second[9])))
        self.assertTrue(np.array_equal(np.asarray(first[-1]), np.asarray(second[-1])))
        self.assertFalse(np.array_equal(np.asarray(first[0]), np.asarray(first[9])))

    def test_lossless_webp_metadata_and_alpha(self) -> None:
        source = synthetic_character(96)
        _, mapping = animation.normalize_image(source, 96)
        frames = animation.render_frames(source, [], {"parts": []}, mapping, seed=2)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "character.webp"
            animation.save_webp(frames, output, fps=12, loop=1)
            result = Image.open(output)
            self.assertEqual(result.n_frames, 18)
            self.assertEqual(result.info.get("loop"), 1)
            self.assertEqual(result.size, (96, 96))
            result.seek(0)
            first = np.asarray(result.convert("RGBA"))
            result.seek(17)
            last = np.asarray(result.convert("RGBA"))
            self.assertTrue(np.array_equal(first, last))
            result.seek(8)
            self.assertEqual(result.convert("RGBA").mode, "RGBA")

    def test_config_validation_rejects_bad_points(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad.json"
            path.write_text(json.dumps({"parts": [{"id": "wing", "pivot": [2, 0]}]}))
            with self.assertRaises(animation.AnimationError):
                animation.read_config(path)

    def test_zero_config_cli_needs_no_models_for_rgba_input(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.png"
            output = root / "result.webp"
            synthetic_character().save(source)
            args = Namespace(
                input=source,
                config=None,
                output=output,
                loop=1,
                seed=0,
                size=96,
                debug_dir=None,
                cache_dir=root / "cache",
                device="cpu",
            )
            animation.animate(args)
            self.assertTrue(output.exists())
            with Image.open(output) as rendered:
                self.assertEqual(rendered.n_frames, 18)


if __name__ == "__main__":
    unittest.main()

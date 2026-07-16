from __future__ import annotations

import os
from pathlib import Path

from google import genai
from google.genai import types


PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "YOUR_PROJECT_ID")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

INPUT_IMAGE = Path("nix.png")
OUTPUT_IMAGE = Path("nix_happy.png")

client = genai.Client(
    vertexai=True,
    project=PROJECT_ID,
    location=LOCATION,
)

reference_bytes = INPUT_IMAGE.read_bytes()

prompt = """
The attached image is the canonical reference for an original mobile-game
mascot named Nix.

Create a new image of exactly the same character:
- preserve the hood shape, glowing eyes, antennae, wings, staff, clothing,
  proportions, colour palette, pixel-art rendering and outline style
- show Nix celebrating after the player completes a difficult Vim exercise
- one foot lifted, wings fluttering, staff raised, small golden magic sparks
- joyful and energetic, but still readable at small mobile UI size
- full body, centred
- transparent background
- no text, no border, no UI elements
- do not add extra limbs, wings, fingers, accessories, or characters

Treat this as a production game sprite, not as a reinterpretation.
"""

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=[
        types.Part.from_text(text=prompt),
        types.Part.from_bytes(
            data=reference_bytes,
            mime_type="image/png",
        ),
    ],
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
    ),
)

saved = False

for candidate in response.candidates or []:
    for part in candidate.content.parts or []:
        if part.inline_data and part.inline_data.data:
            OUTPUT_IMAGE.write_bytes(part.inline_data.data)
            saved = True
            print(f"Saved: {OUTPUT_IMAGE}")
            break
    if saved:
        break

if not saved:
    raise RuntimeError(
        "The model did not return an image. "
        f"Response: {response}"
    )


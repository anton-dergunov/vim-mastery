# The Vim Wilds Character Catalogue

> Generated from `character_catalogue.json`. Edit the JSON and rerun the `catalogue` command.

## Art bible

Tiny magical specialists repair an enchanted lost forest through precise command magic.

- Rendering: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
- Composition: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
- Palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
- Image model: `gemini-3.1-flash-image`
- Video model: `veo-3.1-lite-generate-001`; 4 seconds; silent; 24 fps source / 12 fps runtime
- Minimum generation plan: 42 stills × $0.067 + 149 videos × $0.12 = $20.69
- Hard cap: $25.00; minimum plan leaves $4.31, enough for 35 additional Veo Lite attempts

Shared rules:

- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.

## Staged workflow

All paid commands are dry runs unless `--execute` is present. The append-only ledger and raw generations live under the ignored `artifacts/character-generation/` directory.

```bash
python scripts/generate_character_assets.py catalogue --check
python scripts/generate_character_assets.py approve --catalogue
python scripts/generate_character_assets.py stills --candidates 3 --execute --budget-usd 25
python scripts/generate_character_assets.py approve --character vela --candidate 2
python scripts/generate_character_assets.py videos --execute --resume --budget-usd 25 --max-concurrency 2
python scripts/generate_character_assets.py convert --resume
python scripts/generate_character_assets.py approve --character vela --animation joyful-hop --attempt 1
```

Approving the catalogue records its SHA-256, so editing the machine-readable source closes the paid-generation gate again. Exactly one static candidate per character must be approved before any Veo request can be submitted. Converted videos remain local review candidates until their individual animation approval command copies them into `assets/characters/`.

## Cast and production prompts

### 1. Nix (`nix`)

**Role:** guide  
**Species:** firefly mage  
**Canonical description:** A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.

Permanent invariants:

- dark teal embroidered hood with warm gold trim
- exactly two amber eyes and two antennae
- exactly two translucent cream wings
- dark wooden square-hook lantern staff
- teal boots and compact brown travel clothes

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Nix, an original firefly mage and guide for The Vim Wilds.
Subject: A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- dark teal embroidered hood with warm gold trim
- exactly two amber eyes and two antennae
- exactly two translucent cream wings
- dark wooden square-hook lantern staff
- teal boots and compact brown travel clothes
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Nix makes one buoyant success hop using a small body bounce, quick two-wing flutter and light boot movement, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix makes one buoyant success hop using a small body bounce, quick two-wing flutter and light boot movement, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `victory-dance`

Nix performs a short rhythmic victory dance using a small body bounce, quick two-wing flutter and light boot movement; the square-hook lantern staff bobs without changing shape; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix performs a short rhythmic victory dance using a small body bounce, quick two-wing flutter and light boot movement; the square-hook lantern staff bobs without changing shape; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `magic-flourish`

Nix performs controlled signature magic: the lantern releases an asymmetric orbit of three amber fireflies and scattered turquoise motes; the eyes and lantern brighten, with no text, glyph, emblem or geometric symbol; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix performs controlled signature magic: the lantern releases an asymmetric orbit of three amber fireflies and scattered turquoise motes; the eyes and lantern brighten, with no text, glyph, emblem or geometric symbol; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `project-reveal`

Nix completes a repaired miniature forest terminal lantern, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix completes a repaired miniature forest terminal lantern, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `prop-trick`

Nix performs a playful expert trick: the lantern floats once around the staff hook and clicks safely back into place; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix performs a playful expert trick: the lantern floats once around the staff hook and clicks safely back into place; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `high-jump`

Nix performs a larger anatomy-appropriate celebratory leap using a small body bounce, quick two-wing flutter and light boot movement. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Nix lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix performs a larger anatomy-appropriate celebratory leap using a small body bounce, quick two-wing flutter and light boot movement. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Nix lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `celebratory-spin`

Nix makes one clear celebratory turn with a small body bounce, quick two-wing flutter and light boot movement; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix makes one clear celebratory turn with a small body bounce, quick two-wing flutter and light boot movement; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `sparkle-applause`

Nix gives an anatomy-appropriate round of applause and the square-hook lantern staff bobs without changing shape, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix gives an anatomy-appropriate round of applause and the square-hook lantern staff bobs without changing shape, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `illusion-surprise`

Nix conjures a small harmless surprise: three tiny fireflies form a check mark above the lantern; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix conjures a small harmless surprise: three tiny fireflies form a check mark above the lantern; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

#### `signature-finale`

Nix's signature finale: the lantern releases a loose asymmetric constellation of warm light points around Nix, with no writing or symbol; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Nix, A teal-hooded firefly mage and lantern-bearing guide with a shadowed face, two amber eyes, two antennae and two translucent cream wings.
Action over exactly four seconds: Nix's signature finale: the lantern releases a loose asymmetric constellation of warm light points around Nix, with no writing or symbol; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: dark teal embroidered hood with warm gold trim; exactly two amber eyes and two antennae; exactly two translucent cream wings; dark wooden square-hook lantern staff; teal boots and compact brown travel clothes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Nix
```
</details>

### 2. Vela (`vela`)

**Role:** movement teacher  
**Species:** swift fox courier  
**Canonical description:** A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.

Permanent invariants:

- rust-red fur with cream muzzle, chest and single tail tip
- exactly two fox ears, two arms, two legs and one tail
- teal scarf
- one brown compass satchel
- amber eyes

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Vela, an original swift fox courier and movement teacher for The Vim Wilds.
Subject: A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- rust-red fur with cream muzzle, chest and single tail tip
- exactly two fox ears, two arms, two legs and one tail
- teal scarf
- one brown compass satchel
- amber eyes
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Vela makes one buoyant success hop using light-footed steps, one tail sweep and a scarf flutter, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela makes one buoyant success hop using light-footed steps, one tail sweep and a scarf flutter, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `victory-dance`

Vela performs a short rhythmic victory dance using light-footed steps, one tail sweep and a scarf flutter; the compass satchel swings naturally and remains closed; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela performs a short rhythmic victory dance using light-footed steps, one tail sweep and a scarf flutter; the compass satchel swings naturally and remains closed; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `magic-flourish`

Vela performs controlled signature magic: the compass projects a turquoise route rune that snaps to its destination; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela performs controlled signature magic: the compass projects a turquoise route rune that snaps to its destination; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `project-reveal`

Vela completes a glowing route map connecting two forest gates, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela completes a glowing route map connecting two forest gates, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `prop-trick`

Vela performs a playful expert trick: the compass flips from one paw to the other and points home; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela performs a playful expert trick: the compass flips from one paw to the other and points home; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `high-jump`

Vela performs a larger anatomy-appropriate celebratory leap using light-footed steps, one tail sweep and a scarf flutter. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Vela lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela performs a larger anatomy-appropriate celebratory leap using light-footed steps, one tail sweep and a scarf flutter. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Vela lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `celebratory-spin`

Vela makes one clear celebratory turn with light-footed steps, one tail sweep and a scarf flutter; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela makes one clear celebratory turn with light-footed steps, one tail sweep and a scarf flutter; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `sparkle-applause`

Vela gives an anatomy-appropriate round of applause and the compass satchel swings naturally and remains closed, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela gives an anatomy-appropriate round of applause and the compass satchel swings naturally and remains closed, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `illusion-surprise`

Vela conjures a small harmless surprise: a tiny amber trail races in a circle and becomes a check mark; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela conjures a small harmless surprise: a tiny amber trail races in a circle and becomes a check mark; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

#### `signature-finale`

Vela's signature finale: Vela dashes one tight loop and leaves a glowing speed ribbon shaped like a Vim motion; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Vela, A quick rust-red fox courier with cream muzzle and tail tip, teal scarf, small compass satchel and alert amber eyes.
Action over exactly four seconds: Vela's signature finale: Vela dashes one tight loop and leaves a glowing speed ribbon shaped like a Vim motion; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: rust-red fur with cream muzzle, chest and single tail tip; exactly two fox ears, two arms, two legs and one tail; teal scarf; one brown compass satchel; amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Vela
```
</details>

### 3. Tatter (`tatter`)

**Role:** editing teacher  
**Species:** threadweaver spider tailor  
**Canonical description:** An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.

Permanent invariants:

- exactly four arms and two walking legs
- indigo body with warm cream face
- two amber eyes
- one golden needle
- one teal thread spool

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Tatter, an original threadweaver spider tailor and editing teacher for The Vim Wilds.
Subject: An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- exactly four arms and two walking legs
- indigo body with warm cream face
- two amber eyes
- one golden needle
- one teal thread spool
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Tatter makes one buoyant success hop using coordinated four-hand gestures and two-leg bouncing without adding limbs, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter makes one buoyant success hop using coordinated four-hand gestures and two-leg bouncing without adding limbs, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `victory-dance`

Tatter performs a short rhythmic victory dance using coordinated four-hand gestures and two-leg bouncing without adding limbs; the needle and spool exchange between existing hands only; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter performs a short rhythmic victory dance using coordinated four-hand gestures and two-leg bouncing without adding limbs; the needle and spool exchange between existing hands only; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `magic-flourish`

Tatter performs controlled signature magic: teal thread stitches an amber edit rune in the air; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter performs controlled signature magic: teal thread stitches an amber edit rune in the air; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `project-reveal`

Tatter completes a neatly repaired enchanted command banner, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter completes a neatly repaired enchanted command banner, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `prop-trick`

Tatter performs a playful expert trick: the needle loops thread through all four hands and returns beside the spool; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter performs a playful expert trick: the needle loops thread through all four hands and returns beside the spool; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `high-jump`

Tatter performs a larger anatomy-appropriate celebratory leap using coordinated four-hand gestures and two-leg bouncing without adding limbs. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Tatter lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter performs a larger anatomy-appropriate celebratory leap using coordinated four-hand gestures and two-leg bouncing without adding limbs. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Tatter lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `celebratory-spin`

Tatter makes one clear celebratory turn with coordinated four-hand gestures and two-leg bouncing without adding limbs; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter makes one clear celebratory turn with coordinated four-hand gestures and two-leg bouncing without adding limbs; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `sparkle-applause`

Tatter gives an anatomy-appropriate round of applause and the needle and spool exchange between existing hands only, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter gives an anatomy-appropriate round of applause and the needle and spool exchange between existing hands only, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `illusion-surprise`

Tatter conjures a small harmless surprise: a torn ribbon appears, repairs itself, and dissolves; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter conjures a small harmless surprise: a torn ribbon appears, repairs itself, and dissolves; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

#### `signature-finale`

Tatter's signature finale: Tatter rapidly repairs a split banner and presents its perfect glowing seam; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tatter, An indigo fantasy spider tailor with exactly four arms and two walking legs, warm cream face, golden needle and teal thread spool.
Action over exactly four seconds: Tatter's signature finale: Tatter rapidly repairs a split banner and presents its perfect glowing seam; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: exactly four arms and two walking legs; indigo body with warm cream face; two amber eyes; one golden needle; one teal thread spool.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tatter
```
</details>

### 4. Orin (`orin`)

**Role:** search teacher  
**Species:** owl archivist  
**Canonical description:** A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.

Permanent invariants:

- navy plumage with cream brow and chest
- exactly two wing-arms and two taloned feet
- two amber eyes
- one turquoise monocular lens
- one rolled scroll

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Orin, an original owl archivist and search teacher for The Vim Wilds.
Subject: A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- navy plumage with cream brow and chest
- exactly two wing-arms and two taloned feet
- two amber eyes
- one turquoise monocular lens
- one rolled scroll
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Orin makes one buoyant success hop using small hops, careful wing gestures and a dignified feather ruffle, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin makes one buoyant success hop using small hops, careful wing gestures and a dignified feather ruffle, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `victory-dance`

Orin performs a short rhythmic victory dance using small hops, careful wing gestures and a dignified feather ruffle; the lens glints and the scroll remains in one wing; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin performs a short rhythmic victory dance using small hops, careful wing gestures and a dignified feather ruffle; the lens glints and the scroll remains in one wing; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `magic-flourish`

Orin performs controlled signature magic: the lens reveals a hidden violet rune and frames it in amber light; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin performs controlled signature magic: the lens reveals a hidden violet rune and frames it in amber light; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `project-reveal`

Orin completes a correctly indexed enchanted archive scroll, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin completes a correctly indexed enchanted archive scroll, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `prop-trick`

Orin performs a playful expert trick: the scroll rolls across one wing and stops precisely beneath the lens; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin performs a playful expert trick: the scroll rolls across one wing and stops precisely beneath the lens; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `high-jump`

Orin performs a larger anatomy-appropriate celebratory leap using small hops, careful wing gestures and a dignified feather ruffle. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Orin lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin performs a larger anatomy-appropriate celebratory leap using small hops, careful wing gestures and a dignified feather ruffle. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Orin lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `celebratory-spin`

Orin makes one clear celebratory turn with small hops, careful wing gestures and a dignified feather ruffle; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin makes one clear celebratory turn with small hops, careful wing gestures and a dignified feather ruffle; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `sparkle-applause`

Orin gives an anatomy-appropriate round of applause and the lens glints and the scroll remains in one wing, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin gives an anatomy-appropriate round of applause and the lens glints and the scroll remains in one wing, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `illusion-surprise`

Orin conjures a small harmless surprise: a hidden rune peeks out from behind the scroll and waves; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin conjures a small harmless surprise: a hidden rune peeks out from behind the scroll and waves; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

#### `signature-finale`

Orin's signature finale: Orin discovers a lost glowing rune, magnifies it, and stamps it found; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Orin, A round navy-and-cream owl archivist with two wing-arms, two taloned feet, one glowing monocular lens and one rolled scroll.
Action over exactly four seconds: Orin's signature finale: Orin discovers a lost glowing rune, magnifies it, and stamps it found; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: navy plumage with cream brow and chest; exactly two wing-arms and two taloned feet; two amber eyes; one turquoise monocular lens; one rolled scroll.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Orin
```
</details>

### 5. Cinder (`cinder`)

**Role:** command teacher  
**Species:** salamander spellcaster  
**Canonical description:** An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.

Permanent invariants:

- ember-orange skin
- exactly two arms, two legs and one long tail
- dark teal robe with gold belt
- two amber eyes
- one compact dark rune wand

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Cinder, an original salamander spellcaster and command teacher for The Vim Wilds.
Subject: An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- ember-orange skin
- exactly two arms, two legs and one long tail
- dark teal robe with gold belt
- two amber eyes
- one compact dark rune wand
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Cinder makes one buoyant success hop using springy steps, one tail curl and precise wand gestures, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder makes one buoyant success hop using springy steps, one tail curl and precise wand gestures, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `victory-dance`

Cinder performs a short rhythmic victory dance using springy steps, one tail curl and precise wand gestures; the rune wand turns once without leaving the hand; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder performs a short rhythmic victory dance using springy steps, one tail curl and precise wand gestures; the rune wand turns once without leaving the hand; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `magic-flourish`

Cinder performs controlled signature magic: the wand writes a clean amber command glyph inside a turquoise ring; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder performs controlled signature magic: the wand writes a clean amber command glyph inside a turquoise ring; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `project-reveal`

Cinder completes a stable chain of connected command glyphs, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder completes a stable chain of connected command glyphs, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `prop-trick`

Cinder performs a playful expert trick: the wand rolls across the fingers and ends pointing upward; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder performs a playful expert trick: the wand rolls across the fingers and ends pointing upward; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `high-jump`

Cinder performs a larger anatomy-appropriate celebratory leap using springy steps, one tail curl and precise wand gestures. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Cinder lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder performs a larger anatomy-appropriate celebratory leap using springy steps, one tail curl and precise wand gestures. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Cinder lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `celebratory-spin`

Cinder makes one clear celebratory turn with springy steps, one tail curl and precise wand gestures; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder makes one clear celebratory turn with springy steps, one tail curl and precise wand gestures; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `sparkle-applause`

Cinder gives an anatomy-appropriate round of applause and the rune wand turns once without leaving the hand, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder gives an anatomy-appropriate round of applause and the rune wand turns once without leaving the hand, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `illusion-surprise`

Cinder conjures a small harmless surprise: a tiny friendly flame salamander copies one bow and disappears; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder conjures a small harmless surprise: a tiny friendly flame salamander copies one bow and disappears; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

#### `signature-finale`

Cinder's signature finale: Cinder coils a controlled flame glyph around the tail and resolves it into a check mark; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cinder, An ember-orange salamander spellcaster with dark teal robe, gold belt, long single tail and compact rune wand.
Action over exactly four seconds: Cinder's signature finale: Cinder coils a controlled flame glyph around the tail and resolves it into a check mark; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: ember-orange skin; exactly two arms, two legs and one long tail; dark teal robe with gold belt; two amber eyes; one compact dark rune wand.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cinder
```
</details>

### 6. Prism (`prism`)

**Role:** visual-mode teacher  
**Species:** crystal beetle  
**Canonical description:** A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.

Permanent invariants:

- faceted violet and cyan shell
- exactly two cream under-wings
- exactly two arms and two legs
- two amber eyes
- one fixed chest prism

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Prism, an original crystal beetle and visual-mode teacher for The Vim Wilds.
Subject: A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- faceted violet and cyan shell
- exactly two cream under-wings
- exactly two arms and two legs
- two amber eyes
- one fixed chest prism
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Prism makes one buoyant success hop using precise four-limb posing, shell tilt and two-wing shimmer, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism makes one buoyant success hop using precise four-limb posing, shell tilt and two-wing shimmer, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `victory-dance`

Prism performs a short rhythmic victory dance using precise four-limb posing, shell tilt and two-wing shimmer; the fixed chest prism rotates its light but never detaches; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism performs a short rhythmic victory dance using precise four-limb posing, shell tilt and two-wing shimmer; the fixed chest prism rotates its light but never detaches; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `magic-flourish`

Prism performs controlled signature magic: the chest prism projects a rectangular violet selection field; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism performs controlled signature magic: the chest prism projects a rectangular violet selection field; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `project-reveal`

Prism completes a perfectly aligned crystal selection mosaic, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism completes a perfectly aligned crystal selection mosaic, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `prop-trick`

Prism performs a playful expert trick: a beam passes through the chest prism and splits into three restrained colours; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism performs a playful expert trick: a beam passes through the chest prism and splits into three restrained colours; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `high-jump`

Prism performs a larger anatomy-appropriate celebratory leap using precise four-limb posing, shell tilt and two-wing shimmer. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Prism lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism performs a larger anatomy-appropriate celebratory leap using precise four-limb posing, shell tilt and two-wing shimmer. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Prism lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `celebratory-spin`

Prism makes one clear celebratory turn with precise four-limb posing, shell tilt and two-wing shimmer; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism makes one clear celebratory turn with precise four-limb posing, shell tilt and two-wing shimmer; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `sparkle-applause`

Prism gives an anatomy-appropriate round of applause and the fixed chest prism rotates its light but never detaches, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism gives an anatomy-appropriate round of applause and the fixed chest prism rotates its light but never detaches, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `illusion-surprise`

Prism conjures a small harmless surprise: a tiny transparent selection box catches one sparkle and releases it; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism conjures a small harmless surprise: a tiny transparent selection box catches one sparkle and releases it; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

#### `signature-finale`

Prism's signature finale: Prism refracts one bright beam into a compact rainbow fan and folds it back into the chest prism; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Prism, A violet-cyan crystal beetle with faceted shell, exactly two cream under-wings, four small limbs and a prism focus on the chest.
Action over exactly four seconds: Prism's signature finale: Prism refracts one bright beam into a compact rainbow fan and folds it back into the chest prism; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: faceted violet and cyan shell; exactly two cream under-wings; exactly two arms and two legs; two amber eyes; one fixed chest prism.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Prism
```
</details>

### 7. Tock (`tock`)

**Role:** repetition teacher  
**Species:** clockwork woodpecker  
**Canonical description:** A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.

Permanent invariants:

- brass plates with teal enamel
- exactly two wings and two feet
- one pointed woodpecker beak
- one wind-up key on the back
- one metronome tail

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Tock, an original clockwork woodpecker and repetition teacher for The Vim Wilds.
Subject: A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- brass plates with teal enamel
- exactly two wings and two feet
- one pointed woodpecker beak
- one wind-up key on the back
- one metronome tail
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Tock makes one buoyant success hop using clockwork hops, two-wing ticks and rhythmic tail beats, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock makes one buoyant success hop using clockwork hops, two-wing ticks and rhythmic tail beats, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `victory-dance`

Tock performs a short rhythmic victory dance using clockwork hops, two-wing ticks and rhythmic tail beats; the wind-up key turns once and the metronome tail keeps steady time; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock performs a short rhythmic victory dance using clockwork hops, two-wing ticks and rhythmic tail beats; the wind-up key turns once and the metronome tail keeps steady time; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `magic-flourish`

Tock performs controlled signature magic: three identical amber beats repeat along a turquoise timing line; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock performs controlled signature magic: three identical amber beats repeat along a turquoise timing line; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `project-reveal`

Tock completes a perfectly repeating clockwork command mechanism, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock completes a perfectly repeating clockwork command mechanism, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `prop-trick`

Tock performs a playful expert trick: the beak taps three floating lights in an exact repeating pattern; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock performs a playful expert trick: the beak taps three floating lights in an exact repeating pattern; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `high-jump`

Tock performs a larger anatomy-appropriate celebratory leap using clockwork hops, two-wing ticks and rhythmic tail beats. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Tock lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock performs a larger anatomy-appropriate celebratory leap using clockwork hops, two-wing ticks and rhythmic tail beats. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Tock lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `celebratory-spin`

Tock makes one clear celebratory turn with clockwork hops, two-wing ticks and rhythmic tail beats; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock makes one clear celebratory turn with clockwork hops, two-wing ticks and rhythmic tail beats; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `sparkle-applause`

Tock gives an anatomy-appropriate round of applause and the wind-up key turns once and the metronome tail keeps steady time, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock gives an anatomy-appropriate round of applause and the wind-up key turns once and the metronome tail keeps steady time, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `illusion-surprise`

Tock conjures a small harmless surprise: one tiny clockwork echo repeats Tock's nod and vanishes; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock conjures a small harmless surprise: one tiny clockwork echo repeats Tock's nod and vanishes; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

#### `signature-finale`

Tock's signature finale: Tock performs a perfect repeated rhythm that builds a glowing check mark; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Tock, A brass-and-teal clockwork woodpecker with two wings, two feet, pointed beak, one wind-up key and metronome tail.
Action over exactly four seconds: Tock's signature finale: Tock performs a perfect repeated rhythm that builds a glowing check mark; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: brass plates with teal enamel; exactly two wings and two feet; one pointed woodpecker beak; one wind-up key on the back; one metronome tail.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Tock
```
</details>

### 8. Brikk (`brikk`)

**Role:** debugging teacher  
**Species:** goblin mechanic  
**Canonical description:** A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.

Permanent invariants:

- moss-green skin
- exactly two arms, two legs and two pointed ears
- two oversized amber goggles
- patched teal apron
- one dark metal rune wrench

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Brikk, an original goblin mechanic and debugging teacher for The Vim Wilds.
Subject: A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- moss-green skin
- exactly two arms, two legs and two pointed ears
- two oversized amber goggles
- patched teal apron
- one dark metal rune wrench
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Brikk makes one buoyant success hop using sturdy hops, quick two-hand gestures and a delighted goggle tilt, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk makes one buoyant success hop using sturdy hops, quick two-hand gestures and a delighted goggle tilt, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `victory-dance`

Brikk performs a short rhythmic victory dance using sturdy hops, quick two-hand gestures and a delighted goggle tilt; the rune wrench spins once and remains in the same hand; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk performs a short rhythmic victory dance using sturdy hops, quick two-hand gestures and a delighted goggle tilt; the rune wrench spins once and remains in the same hand; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `magic-flourish`

Brikk performs controlled signature magic: the wrench tightens a loose violet rune until it glows turquoise; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk performs controlled signature magic: the wrench tightens a loose violet rune until it glows turquoise; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `project-reveal`

Brikk completes a repaired miniature forest terminal mechanism, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk completes a repaired miniature forest terminal mechanism, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `prop-trick`

Brikk performs a playful expert trick: the wrench spins around one finger and catches a falling rune bolt; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk performs a playful expert trick: the wrench spins around one finger and catches a falling rune bolt; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `high-jump`

Brikk performs a larger anatomy-appropriate celebratory leap using sturdy hops, quick two-hand gestures and a delighted goggle tilt. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Brikk lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk performs a larger anatomy-appropriate celebratory leap using sturdy hops, quick two-hand gestures and a delighted goggle tilt. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Brikk lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `celebratory-spin`

Brikk makes one clear celebratory turn with sturdy hops, quick two-hand gestures and a delighted goggle tilt; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk makes one clear celebratory turn with sturdy hops, quick two-hand gestures and a delighted goggle tilt; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `sparkle-applause`

Brikk gives an anatomy-appropriate round of applause and the rune wrench spins once and remains in the same hand, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk gives an anatomy-appropriate round of applause and the rune wrench spins once and remains in the same hand, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `illusion-surprise`

Brikk conjures a small harmless surprise: a harmless loose cog scurries back into its socket; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk conjures a small harmless surprise: a harmless loose cog scurries back into its socket; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

#### `signature-finale`

Brikk's signature finale: Brikk repairs a sputtering device that bursts into safe celebratory sparks; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Brikk, A compact moss-green goblin mechanic with two oversized amber goggles, patched teal apron and one rune wrench.
Action over exactly four seconds: Brikk's signature finale: Brikk repairs a sputtering device that bursts into safe celebratory sparks; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: moss-green skin; exactly two arms, two legs and two pointed ears; two oversized amber goggles; patched teal apron; one dark metal rune wrench.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Brikk
```
</details>

### 9. Cairn (`cairn`)

**Role:** challenge host  
**Species:** stone terminal guardian  
**Canonical description:** A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.

Permanent invariants:

- squat weathered stone body
- exactly two blocky arms and two blocky legs
- one cyan rune face
- moss on both shoulders
- one inset amber command-key slab

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Cairn, an original stone terminal guardian and challenge host for The Vim Wilds.
Subject: A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- squat weathered stone body
- exactly two blocky arms and two blocky legs
- one cyan rune face
- moss on both shoulders
- one inset amber command-key slab
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Cairn makes one buoyant success hop using weighty body lifts, small stone stomps and controlled arm raises, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn makes one buoyant success hop using weighty body lifts, small stone stomps and controlled arm raises, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `victory-dance`

Cairn performs a short rhythmic victory dance using weighty body lifts, small stone stomps and controlled arm raises; the inset command-key slab lights up but never detaches; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn performs a short rhythmic victory dance using weighty body lifts, small stone stomps and controlled arm raises; the inset command-key slab lights up but never detaches; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `magic-flourish`

Cairn performs controlled signature magic: cyan runes awaken across the stone body in a symmetrical sequence; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn performs controlled signature magic: cyan runes awaken across the stone body in a symmetrical sequence; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `project-reveal`

Cairn completes a restored miniature rune gate, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn completes a restored miniature rune gate, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `prop-trick`

Cairn performs a playful expert trick: three pebble fragments orbit one hand and lock back into the forearm; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn performs a playful expert trick: three pebble fragments orbit one hand and lock back into the forearm; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `high-jump`

Cairn performs a larger anatomy-appropriate celebratory leap using weighty body lifts, small stone stomps and controlled arm raises. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Cairn lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn performs a larger anatomy-appropriate celebratory leap using weighty body lifts, small stone stomps and controlled arm raises. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Cairn lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `celebratory-spin`

Cairn makes one clear celebratory turn with weighty body lifts, small stone stomps and controlled arm raises; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn makes one clear celebratory turn with weighty body lifts, small stone stomps and controlled arm raises; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `sparkle-applause`

Cairn gives an anatomy-appropriate round of applause and the inset command-key slab lights up but never detaches, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn gives an anatomy-appropriate round of applause and the inset command-key slab lights up but never detaches, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `illusion-surprise`

Cairn conjures a small harmless surprise: a tiny stone arch rises, salutes, and sinks away; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn conjures a small harmless surprise: a tiny stone arch rises, salutes, and sinks away; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

#### `signature-finale`

Cairn's signature finale: Cairn opens a glowing rune gate, bows proudly, and closes it safely; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Cairn, A squat ancient stone guardian with blocky arms and legs, cyan rune face, moss shoulders and one inset command-key slab.
Action over exactly four seconds: Cairn's signature finale: Cairn opens a glowing rune gate, bows proudly, and closes it safely; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: squat weathered stone body; exactly two blocky arms and two blocky legs; one cyan rune face; moss on both shoulders; one inset amber command-key slab.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Cairn
```
</details>

### 10. Mello (`mello`)

**Role:** encouragement character  
**Species:** mushroom bard  
**Canonical description:** A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.

Permanent invariants:

- cream stem body
- amber mushroom cap with teal spots
- exactly two arms and two legs
- two amber eyes
- one small leaf lute

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Mello, an original mushroom bard and encouragement character for The Vim Wilds.
Subject: A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- cream stem body
- amber mushroom cap with teal spots
- exactly two arms and two legs
- two amber eyes
- one small leaf lute
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Mello makes one buoyant success hop using springy cap bounces, two-foot steps and cheerful lute strums, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello makes one buoyant success hop using springy cap bounces, two-foot steps and cheerful lute strums, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `victory-dance`

Mello performs a short rhythmic victory dance using springy cap bounces, two-foot steps and cheerful lute strums; the leaf lute remains held and produces small visible rhythm sparks; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello performs a short rhythmic victory dance using springy cap bounces, two-foot steps and cheerful lute strums; the leaf lute remains held and produces small visible rhythm sparks; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `magic-flourish`

Mello performs controlled signature magic: three warm notes grow into amber flowers and fade; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello performs controlled signature magic: three warm notes grow into amber flowers and fade; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `project-reveal`

Mello completes a completed four-note forest victory phrase, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello completes a completed four-note forest victory phrase, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `prop-trick`

Mello performs a playful expert trick: the leaf lute turns once in the hands and lands ready to play; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello performs a playful expert trick: the leaf lute turns once in the hands and lands ready to play; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `high-jump`

Mello performs a larger anatomy-appropriate celebratory leap using springy cap bounces, two-foot steps and cheerful lute strums. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Mello lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello performs a larger anatomy-appropriate celebratory leap using springy cap bounces, two-foot steps and cheerful lute strums. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Mello lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `celebratory-spin`

Mello makes one clear celebratory turn with springy cap bounces, two-foot steps and cheerful lute strums; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello makes one clear celebratory turn with springy cap bounces, two-foot steps and cheerful lute strums; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `sparkle-applause`

Mello gives an anatomy-appropriate round of applause and the leaf lute remains held and produces small visible rhythm sparks, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello gives an anatomy-appropriate round of applause and the leaf lute remains held and produces small visible rhythm sparks, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `illusion-surprise`

Mello conjures a small harmless surprise: three tiny note-shaped fireflies dance above the cap; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello conjures a small harmless surprise: three tiny note-shaped fireflies dance above the cap; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

#### `signature-finale`

Mello's signature finale: Mello plays a victory phrase that makes a ring of tiny mushrooms bow; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mello, A tiny cream-stemmed mushroom bard with amber cap, teal spots, two simple arms and legs, and one leaf lute.
Action over exactly four seconds: Mello's signature finale: Mello plays a victory phrase that makes a ring of tiny mushrooms bow; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream stem body; amber mushroom cap with teal spots; exactly two arms and two legs; two amber eyes; one small leaf lute.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mello
```
</details>

### 11. Puddle (`puddle`)

**Role:** transformation teacher  
**Species:** frog alchemist  
**Canonical description:** A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.

Permanent invariants:

- jade skin with pale throat
- exactly two arms and two powerful legs
- two amber goggles over two eyes
- one teal potion satchel
- one short stirring rod

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Puddle, an original frog alchemist and transformation teacher for The Vim Wilds.
Subject: A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- jade skin with pale throat
- exactly two arms and two powerful legs
- two amber goggles over two eyes
- one teal potion satchel
- one short stirring rod
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Puddle makes one buoyant success hop using frog-like crouches, buoyant leg springs and careful two-hand gestures, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle makes one buoyant success hop using frog-like crouches, buoyant leg springs and careful two-hand gestures, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `victory-dance`

Puddle performs a short rhythmic victory dance using frog-like crouches, buoyant leg springs and careful two-hand gestures; the stirring rod and closed potion satchel remain secure; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle performs a short rhythmic victory dance using frog-like crouches, buoyant leg springs and careful two-hand gestures; the stirring rod and closed potion satchel remain secure; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `magic-flourish`

Puddle performs controlled signature magic: a turquoise droplet transforms into an amber star above the stirring rod; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle performs controlled signature magic: a turquoise droplet transforms into an amber star above the stirring rod; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `project-reveal`

Puddle completes a stable sparkling success potion, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle completes a stable sparkling success potion, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `prop-trick`

Puddle performs a playful expert trick: one potion bubble balances on the stirring rod and returns to the satchel; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle performs a playful expert trick: one potion bubble balances on the stirring rod and returns to the satchel; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `high-jump`

Puddle performs a larger anatomy-appropriate celebratory leap using frog-like crouches, buoyant leg springs and careful two-hand gestures. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Puddle lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle performs a larger anatomy-appropriate celebratory leap using frog-like crouches, buoyant leg springs and careful two-hand gestures. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Puddle lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `celebratory-spin`

Puddle makes one clear celebratory turn with frog-like crouches, buoyant leg springs and careful two-hand gestures; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle makes one clear celebratory turn with frog-like crouches, buoyant leg springs and careful two-hand gestures; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `sparkle-applause`

Puddle gives an anatomy-appropriate round of applause and the stirring rod and closed potion satchel remain secure, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle gives an anatomy-appropriate round of applause and the stirring rod and closed potion satchel remain secure, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `illusion-surprise`

Puddle conjures a small harmless surprise: a bubble becomes a tiny crown, pops, and leaves no residue; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle conjures a small harmless surprise: a bubble becomes a tiny crown, pops, and leaves no residue; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

#### `signature-finale`

Puddle's signature finale: Puddle brews one bubbling star potion and raises it in triumph; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Puddle, A jade frog alchemist with pale throat, amber goggles, teal potion satchel and one short stirring rod.
Action over exactly four seconds: Puddle's signature finale: Puddle brews one bubbling star potion and raises it in triumph; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: jade skin with pale throat; exactly two arms and two powerful legs; two amber goggles over two eyes; one teal potion satchel; one short stirring rod.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Puddle
```
</details>

### 12. Bramble (`bramble`)

**Role:** structure teacher  
**Species:** badger wardkeeper  
**Canonical description:** A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.

Permanent invariants:

- charcoal fur with cream facial stripes and chest
- exactly two arms and two legs
- moss-green cape with amber clasp
- one round rune shield
- two amber eyes

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Bramble, an original badger wardkeeper and structure teacher for The Vim Wilds.
Subject: A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- charcoal fur with cream facial stripes and chest
- exactly two arms and two legs
- moss-green cape with amber clasp
- one round rune shield
- two amber eyes
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Bramble makes one buoyant success hop using grounded hops, broad paw gestures and one cape sway, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble makes one buoyant success hop using grounded hops, broad paw gestures and one cape sway, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `victory-dance`

Bramble performs a short rhythmic victory dance using grounded hops, broad paw gestures and one cape sway; the round rune shield stays on one arm and pulses once; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble performs a short rhythmic victory dance using grounded hops, broad paw gestures and one cape sway; the round rune shield stays on one arm and pulses once; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `magic-flourish`

Bramble performs controlled signature magic: the shield projects nested turquoise structural wards; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble performs controlled signature magic: the shield projects nested turquoise structural wards; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `project-reveal`

Bramble completes a balanced stack of protective command wards, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble completes a balanced stack of protective command wards, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `prop-trick`

Bramble performs a playful expert trick: the shield rolls around one forearm and locks back into place; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble performs a playful expert trick: the shield rolls around one forearm and locks back into place; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `high-jump`

Bramble performs a larger anatomy-appropriate celebratory leap using grounded hops, broad paw gestures and one cape sway. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Bramble lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble performs a larger anatomy-appropriate celebratory leap using grounded hops, broad paw gestures and one cape sway. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Bramble lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `celebratory-spin`

Bramble makes one clear celebratory turn with grounded hops, broad paw gestures and one cape sway; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble makes one clear celebratory turn with grounded hops, broad paw gestures and one cape sway; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `sparkle-applause`

Bramble gives an anatomy-appropriate round of applause and the round rune shield stays on one arm and pulses once, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble gives an anatomy-appropriate round of applause and the round rune shield stays on one arm and pulses once, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `illusion-surprise`

Bramble conjures a small harmless surprise: a tiny hedge maze grows into a check mark and recedes; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble conjures a small harmless surprise: a tiny hedge maze grows into a check mark and recedes; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

#### `signature-finale`

Bramble's signature finale: Bramble raises a protective ward that blooms with amber forest flowers; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Bramble, A charcoal-and-cream badger wardkeeper with broad paws, moss cape, amber clasp and one round rune shield.
Action over exactly four seconds: Bramble's signature finale: Bramble raises a protective ward that blooms with amber forest flowers; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: charcoal fur with cream facial stripes and chest; exactly two arms and two legs; moss-green cape with amber clasp; one round rune shield; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Bramble
```
</details>

### 13. Mica (`mica`)

**Role:** register teacher  
**Species:** magpie relic keeper  
**Canonical description:** A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.

Permanent invariants:

- black-and-cream magpie plumage with subtle blue sheen
- exactly two wings and two feet
- one teal hoodlet
- one brown crystal satchel
- two amber eyes

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Mica, an original magpie relic keeper and register teacher for The Vim Wilds.
Subject: A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- black-and-cream magpie plumage with subtle blue sheen
- exactly two wings and two feet
- one teal hoodlet
- one brown crystal satchel
- two amber eyes
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Mica makes one buoyant success hop using quick bird hops, two-wing flourishes and precise head tilts, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica makes one buoyant success hop using quick bird hops, two-wing flourishes and precise head tilts, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `victory-dance`

Mica performs a short rhythmic victory dance using quick bird hops, two-wing flourishes and precise head tilts; the crystal satchel opens briefly and remains attached; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica performs a short rhythmic victory dance using quick bird hops, two-wing flourishes and precise head tilts; the crystal satchel opens briefly and remains attached; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `magic-flourish`

Mica performs controlled signature magic: one stored crystal copies its glow into three labelled-looking but textless slots; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica performs controlled signature magic: one stored crystal copies its glow into three labelled-looking but textless slots; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `project-reveal`

Mica completes an organised collection of glowing command crystals, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica completes an organised collection of glowing command crystals, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `prop-trick`

Mica performs a playful expert trick: three crystals pass between wings and return to the satchel; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica performs a playful expert trick: three crystals pass between wings and return to the satchel; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `high-jump`

Mica performs a larger anatomy-appropriate celebratory leap using quick bird hops, two-wing flourishes and precise head tilts. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Mica lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica performs a larger anatomy-appropriate celebratory leap using quick bird hops, two-wing flourishes and precise head tilts. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Mica lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `celebratory-spin`

Mica makes one clear celebratory turn with quick bird hops, two-wing flourishes and precise head tilts; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica makes one clear celebratory turn with quick bird hops, two-wing flourishes and precise head tilts; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `sparkle-applause`

Mica gives an anatomy-appropriate round of applause and the crystal satchel opens briefly and remains attached, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica gives an anatomy-appropriate round of applause and the crystal satchel opens briefly and remains attached, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `illusion-surprise`

Mica conjures a small harmless surprise: a shiny duplicate crystal bows to the original and dissolves; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica conjures a small harmless surprise: a shiny duplicate crystal bows to the original and dissolves; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

#### `signature-finale`

Mica's signature finale: Mica releases a spiral of collected crystals and recalls each one in order; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Mica, A black-and-cream magpie relic keeper with two wings, two feet, teal hoodlet and one brown crystal satchel.
Action over exactly four seconds: Mica's signature finale: Mica releases a spiral of collected crystals and recalls each one in order; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: black-and-cream magpie plumage with subtle blue sheen; exactly two wings and two feet; one teal hoodlet; one brown crystal satchel; two amber eyes.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Mica
```
</details>

### 14. Luma (`luma`)

**Role:** marks and jumps teacher  
**Species:** moon hare pathfinder  
**Canonical description:** A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.

Permanent invariants:

- cream-grey fur
- exactly two long ears, two arms and two legs
- violet short cape
- teal boots
- one crescent compass

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Luma, an original moon hare pathfinder and marks and jumps teacher for The Vim Wilds.
Subject: A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- cream-grey fur
- exactly two long ears, two arms and two legs
- violet short cape
- teal boots
- one crescent compass
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Luma makes one buoyant success hop using high hare hops, long-ear follow-through and one cape flutter, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma makes one buoyant success hop using high hare hops, long-ear follow-through and one cape flutter, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `victory-dance`

Luma performs a short rhythmic victory dance using high hare hops, long-ear follow-through and one cape flutter; the crescent compass stays in one paw and points between marks; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma performs a short rhythmic victory dance using high hare hops, long-ear follow-through and one cape flutter; the crescent compass stays in one paw and points between marks; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `magic-flourish`

Luma performs controlled signature magic: two moonlit marks connect with a violet teleport arc; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma performs controlled signature magic: two moonlit marks connect with a violet teleport arc; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `project-reveal`

Luma completes a completed path of moonlit navigation marks, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma completes a completed path of moonlit navigation marks, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `prop-trick`

Luma performs a playful expert trick: the crescent compass arcs overhead and lands in the same paw; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma performs a playful expert trick: the crescent compass arcs overhead and lands in the same paw; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `high-jump`

Luma performs a larger anatomy-appropriate celebratory leap using high hare hops, long-ear follow-through and one cape flutter. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Luma lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma performs a larger anatomy-appropriate celebratory leap using high hare hops, long-ear follow-through and one cape flutter. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Luma lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `celebratory-spin`

Luma makes one clear celebratory turn with high hare hops, long-ear follow-through and one cape flutter; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma makes one clear celebratory turn with high hare hops, long-ear follow-through and one cape flutter; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `sparkle-applause`

Luma gives an anatomy-appropriate round of applause and the crescent compass stays in one paw and points between marks, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma gives an anatomy-appropriate round of applause and the crescent compass stays in one paw and points between marks, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `illusion-surprise`

Luma conjures a small harmless surprise: a tiny moon-mark duplicate appears behind Luma and winks away; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma conjures a small harmless surprise: a tiny moon-mark duplicate appears behind Luma and winks away; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

#### `signature-finale`

Luma's signature finale: Luma jumps between three moon marks and returns through a violet arc; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Luma, A cream-grey moon hare with two long ears, violet short cape, teal boots and one crescent compass.
Action over exactly four seconds: Luma's signature finale: Luma jumps between three moon marks and returns through a violet arc; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: cream-grey fur; exactly two long ears, two arms and two legs; violet short cape; teal boots; one crescent compass.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Luma
```
</details>

### 15. Fen (`fen`)

**Role:** buffers and windows teacher  
**Species:** otter cartographer  
**Canonical description:** A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.

Permanent invariants:

- warm-brown fur with cream muzzle and chest
- exactly two arms, two legs and one otter tail
- teal vest
- one rolled parchment map
- one reed stylus

<details><summary>Canonical idle prompt</summary>

```text
Use case: stylized-concept
Asset type: canonical mobile-game character idle sprite
Input image: the attached Nix image is a style and scale reference only, not the subject to copy.
Primary request: Create Fen, an original otter cartographer and buffers and windows teacher for The Vim Wilds.
Subject: A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Style/medium: Detailed polished 2D pixel-art fantasy mobile-game mascot illustration matching the canonical Nix reference.
Composition/framing: One full-body character, centred, neutral three-quarter view facing viewer-left, readable at 92 pixels.
Color palette: Shared deep navy, warm cream and muted brown neutrals; amber, turquoise and violet magic; moderately rich saturation.
Permanent character invariants:
- warm-brown fur with cream muzzle and chest
- exactly two arms, two legs and one otter tail
- teal vest
- one rolled parchment map
- one reed stylus
Shared production rules:
- Two-and-a-half to three heads tall with a simple expressive face and a distinctive silhouette.
- Warm dark outline, restrained highlights, readable large shapes and no excessive costume detail.
- At most two permanent major props, with simplified hands and anatomy appropriate to the species.
- Transparent background, no cast shadow, no floor, no border, no text and no interface elements.
- Original design only: no named franchise, studio, game, artist, logo or recognisable copyrighted character.
Constraints: neutral attentive idle pose; generous padding; crisp readable silhouette; preserve exact limb and prop counts; use Nix only to match rendering density, outline language, lighting and world cohesion.
Avoid: do not turn this character into Nix; no teal hood or lantern staff unless explicitly listed above; no extra anatomy, props, scenery, floor, shadow, text, watermark, border, UI, photorealism or 3D render.
Background: genuinely transparent if supported; otherwise a completely uniform removable background with no checkerboard pattern.
```
</details>

Animations:

#### `joyful-hop`

Fen makes one buoyant success hop using fluid side steps, one tail sweep and careful map-handling gestures, shows unmistakable happiness, and settles exactly into the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen makes one buoyant success hop using fluid side steps, one tail sweep and careful map-handling gestures, shows unmistakable happiness, and settles exactly into the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `victory-dance`

Fen performs a short rhythmic victory dance using fluid side steps, one tail sweep and careful map-handling gestures; the map and reed stylus remain in the two existing paws; the movement stays readable and returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen performs a short rhythmic victory dance using fluid side steps, one tail sweep and careful map-handling gestures; the map and reed stylus remain in the two existing paws; the movement stays readable and returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `magic-flourish`

Fen performs controlled signature magic: the stylus divides a turquoise map into tidy glowing panes; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen performs controlled signature magic: the stylus divides a turquoise map into tidy glowing panes; the effect blooms briefly, clears completely, and leaves the exact approved character unchanged.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `project-reveal`

Fen completes a finished enchanted map of connected forest terminals, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen completes a finished enchanted map of connected forest terminals, proudly reveals the finished work with a warm celebratory reaction, then returns to the approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `prop-trick`

Fen performs a playful expert trick: the map rolls down one arm, catches the stylus, and rolls closed; only the canonical prop is used and it returns to its original place.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen performs a playful expert trick: the map rolls down one arm, catches the stylus, and rolls closed; only the canonical prop is used and it returns to its original place.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `high-jump`

Fen performs a larger anatomy-appropriate celebratory leap using fluid side steps, one tail sweep and careful map-handling gestures. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Fen lands softly and settles into the approved pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen performs a larger anatomy-appropriate celebratory leap using fluid side steps, one tail sweep and careful map-handling gestures. Throughout the airborne motion, the head, face, torso, all canonical limbs and props remain fully visible, connected and unchanged; nothing detaches, disappears or is occluded. Fen lands softly and settles into the approved pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `celebratory-spin`

Fen makes one clear celebratory turn with fluid side steps, one tail sweep and careful map-handling gestures; permanent costume and props remain attached and the character finishes at the original camera angle.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen makes one clear celebratory turn with fluid side steps, one tail sweep and careful map-handling gestures; permanent costume and props remain attached and the character finishes at the original camera angle.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `sparkle-applause`

Fen gives an anatomy-appropriate round of applause and the map and reed stylus remain in the two existing paws, accompanied by a restrained burst of amber and turquoise sparks.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen gives an anatomy-appropriate round of applause and the map and reed stylus remain in the two existing paws, accompanied by a restrained burst of amber and turquoise sparks.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `illusion-surprise`

Fen conjures a small harmless surprise: a tiny paper boat follows a glowing route and folds away; the illusion vanishes cleanly before the approved neutral pose returns.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen conjures a small harmless surprise: a tiny paper boat follows a glowing route and folds away; the illusion vanishes cleanly before the approved neutral pose returns.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

#### `signature-finale`

Fen's signature finale: Fen unfurls a map whose glowing path rises into the air and ends at a golden gate; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.

<details><summary>Full Veo prompt</summary>

```text
Locked camera and a completely static dark neutral background.
Animate only the supplied approved 2D pixel-art character Fen, A warm-brown otter cartographer with cream muzzle, teal vest, one rolled map and one reed stylus.
Action over exactly four seconds: Fen's signature finale: Fen unfurls a map whose glowing path rises into the air and ends at a golden gate; it is joyful, role-specific, fully visible, and resolves into the exact approved neutral pose.
Preserve the exact approved design, silhouette, pixel-art rendering, proportions, colours, camera angle and these permanent invariants: warm-brown fur with cream muzzle and chest; exactly two arms, two legs and one otter tail; teal vest; one rolled parchment map; one reed stylus.
Keep the full body visible at unchanged scale. Start from the supplied neutral pose and finish settled in that exact pose. Deliberately stylised 2D sprite animation, not photorealistic. Restrained amber, turquoise or violet magic is allowed only where described.

Negative prompt:
camera movement, pan, tilt, zoom, crop, cut, scene transition, changing background, new character, duplicate character, extra limbs, missing limbs, extra wings, missing wings, new props, missing props, mutated anatomy, detached head, missing head, headless body, changed costume, changed face, changed species, text, captions, watermark, writing, letters, glyph, emblem, logo, swastika, cross, religious symbol, political symbol, scenery, floor, realistic texture, photorealism, 3D render, anything inconsistent with Fen
```
</details>

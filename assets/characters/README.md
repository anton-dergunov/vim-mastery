# Character assets

Each character has a stable directory so the game and the generation pipeline
can address the same paths:

```text
assets/characters/<character-id>/
  idle.png                 # approved, transparent canonical still
  animations/
    <action-id>.webp       # approved transparent runtime animation
    <action-id>.json       # prompt, source, timing and approval metadata
```

`assets/characters/manifest.json` indexes approved idle and animation assets.
The raw Nano Banana and Veo outputs, lossless masters, review sheets and debug
images remain under ignored `artifacts/character-generation/` paths.

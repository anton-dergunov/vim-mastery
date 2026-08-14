import assert from "node:assert/strict";
import test from "node:test";

import { CharacterReactions } from "../character-reactions.js";

function fixture(randomValues = [0], options = {}) {
  const classes = new Set();
  const character = {
    __characterAsset: {
      idle: "idle.png",
      reactions: {
        attentive: { src: "attentive-a.webp", css_scale: 1.3 },
        puzzled: [
          { src: "puzzled-a.webp", css_scale: 1.3 },
          { src: "puzzled-b.webp" },
          { src: "puzzled-c.webp" },
        ],
      },
    },
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    dataset: {},
    style: {
      values: new Map(),
      setProperty(name, value) { this.values.set(name, value); },
      removeProperty(name) { this.values.delete(name); },
    },
    src: "",
  };
  let randomIndex = 0;
  const reactions = new CharacterReactions({
    layer: { querySelector: () => character },
    assetUrl: value => `/assets/${value}`,
    reducedMotion: () => false,
    random: () => randomValues[randomIndex++ % randomValues.length],
    fadeDurationMs: 0,
    ...options,
  });
  return { character, classes, reactions };
}

function reducedMotionFixture() {
  const result = fixture();
  result.reactions.reducedMotion = () => true;
  return result;
}

test("reaction collections vary playback without immediately repeating", async () => {
  const { character, reactions } = fixture([0, 0, 0.99]);

  await reactions.apply("puzzled");
  assert.equal(character.src, "/assets/puzzled-a.webp");
  assert.equal(character.dataset.reactionVariant, "1");
  assert.equal(character.style.values.get("--character-media-scale"), "1.3");

  await reactions.apply("puzzled");
  assert.equal(character.src, "/assets/puzzled-b.webp");
  assert.equal(character.dataset.reactionVariant, "2");

  await reactions.apply("puzzled");
  assert.equal(character.src, "/assets/puzzled-c.webp");
  assert.equal(character.dataset.reactionVariant, "3");
});

test("single reaction objects and idle fallback remain compatible", async () => {
  const { character, classes, reactions } = fixture();

  await reactions.apply("attentive");
  assert.equal(character.src, "/assets/attentive-a.webp");
  assert.equal(character.dataset.reactionVariant, "1");
  assert(classes.has("reaction-attentive"));

  await reactions.apply("encouraging");
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.dataset.reactionVariant, undefined);
  assert.equal(character.style.values.has("--character-media-scale"), false);
  assert(classes.has("reaction-encouraging"));
});

test("reduced motion keeps the idle still and uses the CSS state fallback", async () => {
  const { character, classes, reactions } = reducedMotionFixture();

  await reactions.apply("puzzled");
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(classes.has("reaction-has-media"), false);
  assert.equal(classes.has("reaction-puzzled"), true);
  assert.equal(reactions.activeDurationMs, 0);
});

test("decodes each pose before fading, then swaps its source and scale while hidden", async () => {
  const preparations = [];
  const fades = [];
  const paintedSources = [];
  const { character, classes, reactions } = fixture([0], {
    prepareMedia: source => new Promise(resolve => preparations.push({ source, resolve })),
    fadeDurationMs: 90,
    delay: () => new Promise(resolve => fades.push(resolve)),
    forceStyle: image => {
      assert.equal(classes.has("reaction-fading-out"), true);
      paintedSources.push(image.src);
    },
  });
  character.src = "/assets/idle.png";

  const showReaction = reactions.apply("attentive");
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.style.values.has("--character-media-scale"), false);
  assert.equal(classes.has("reaction-fading-out"), false);
  assert.equal(preparations[0].source, "/assets/attentive-a.webp");

  preparations.shift().resolve();
  await Promise.resolve();
  assert.equal(classes.has("reaction-fading-out"), true);
  assert.equal(character.src, "/assets/idle.png");
  fades.shift()();
  await showReaction;
  assert.equal(character.src, "/assets/attentive-a.webp");
  assert.equal(character.style.values.get("--character-media-scale"), "1.3");
  assert.equal(classes.has("reaction-fading-out"), false);
  assert.deepEqual(paintedSources, ["/assets/attentive-a.webp"]);

  const showIdle = reactions.apply("idle");
  assert.equal(character.src, "/assets/attentive-a.webp");
  assert.equal(character.style.values.get("--character-media-scale"), "1.3");
  preparations.shift().resolve();
  await Promise.resolve();
  assert.equal(classes.has("reaction-fading-out"), true);
  fades.shift()();
  await showIdle;
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.style.values.has("--character-media-scale"), false);
  assert.equal(classes.has("reaction-fading-out"), false);
  assert.deepEqual(paintedSources, ["/assets/attentive-a.webp", "/assets/idle.png"]);
});

test("discards a short reaction that ends before its media is ready", async () => {
  let resolveMedia;
  const { character, reactions } = fixture([0], {
    prepareMedia: () => new Promise(resolve => { resolveMedia = resolve; }),
  });
  character.src = "/assets/idle.png";

  const pending = reactions.apply("attentive");
  await reactions.apply("idle");
  resolveMedia();
  assert.equal(await pending, false);
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.style.values.has("--character-media-scale"), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { CharacterReactions } from "../character-reactions.js";

function fixture(randomValues = [0]) {
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
  });
  return { character, classes, reactions };
}

function reducedMotionFixture() {
  const result = fixture();
  result.reactions.reducedMotion = () => true;
  return result;
}

test("reaction collections vary playback without immediately repeating", () => {
  const { character, reactions } = fixture([0, 0, 0.99]);

  reactions.apply("puzzled");
  assert.equal(character.src, "/assets/puzzled-a.webp");
  assert.equal(character.dataset.reactionVariant, "1");
  assert.equal(character.style.values.get("--character-media-scale"), "1.3");

  reactions.apply("puzzled");
  assert.equal(character.src, "/assets/puzzled-b.webp");
  assert.equal(character.dataset.reactionVariant, "2");

  reactions.apply("puzzled");
  assert.equal(character.src, "/assets/puzzled-c.webp");
  assert.equal(character.dataset.reactionVariant, "3");
});

test("single reaction objects and idle fallback remain compatible", () => {
  const { character, classes, reactions } = fixture();

  reactions.apply("attentive");
  assert.equal(character.src, "/assets/attentive-a.webp");
  assert.equal(character.dataset.reactionVariant, "1");
  assert(classes.has("reaction-attentive"));

  reactions.apply("encouraging");
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.dataset.reactionVariant, undefined);
  assert.equal(character.style.values.has("--character-media-scale"), false);
  assert(classes.has("reaction-encouraging"));
});

test("reduced motion keeps the idle still and uses the CSS state fallback", () => {
  const { character, classes, reactions } = reducedMotionFixture();

  reactions.apply("puzzled");
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(classes.has("reaction-has-media"), false);
  assert.equal(classes.has("reaction-puzzled"), true);
  assert.equal(reactions.activeDurationMs, 0);
});

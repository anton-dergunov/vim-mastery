import assert from "node:assert/strict";
import test from "node:test";

import { CharacterReactions } from "../character-reactions.js";

function createLayer() {
  return {
    children: [],
    querySelector() {
      return this.children[0] || null;
    },
    querySelectorAll() {
      return [...this.children];
    },
  };
}

function createCharacter(layer) {
  const classes = new Set(["nix", "left"]);
  const attributes = new Map();
  const values = new Map();
  const character = {
    __characterAsset: null,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    dataset: {},
    style: {
      values,
      setProperty(name, value) { values.set(name, value); },
      removeProperty(name) { values.delete(name); },
    },
    src: "",
    isConnected: true,
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.get(name); },
    cloneNode() {
      const clone = createCharacter(layer);
      clone.src = this.src;
      clone.dataset = { ...this.dataset };
      clone.__characterAsset = this.__characterAsset;
      clone._classes.clear();
      for (const name of classes) clone._classes.add(name);
      clone.style.values.clear();
      for (const [name, value] of values) clone.style.values.set(name, value);
      return clone;
    },
    after(sibling) {
      const index = layer.children.indexOf(this);
      layer.children.splice(index + 1, 0, sibling);
      sibling.isConnected = true;
    },
    remove() {
      const index = layer.children.indexOf(this);
      if (index >= 0) layer.children.splice(index, 1);
      this.isConnected = false;
    },
    _classes: classes,
  };
  return character;
}

function fixture(randomValues = [0], options = {}) {
  const layer = createLayer();
  const character = createCharacter(layer);
  const classes = character._classes;
  character.__characterAsset = {
    idle: "idle.png",
    reactions: {
      attentive: { src: "attentive-a.webp", css_scale: 1.3 },
      puzzled: [
        { src: "puzzled-a.webp", css_scale: 1.3 },
        { src: "puzzled-b.webp" },
        { src: "puzzled-c.webp" },
      ],
    },
  };
  layer.children.push(character);
  let randomIndex = 0;
  const reactions = new CharacterReactions({
    layer,
    assetUrl: value => `/assets/${value}`,
    reducedMotion: () => false,
    random: () => randomValues[randomIndex++ % randomValues.length],
    settleDurationMs: 0,
    nextFrame: () => Promise.resolve(),
    ...options,
  });
  return { character, classes, layer, reactions };
}

function deferredSteps() {
  const steps = [];
  return {
    steps,
    delay(milliseconds) {
      return new Promise(resolve => steps.push({ milliseconds, resolve }));
    },
    release(expectedDuration) {
      const step = steps.shift();
      assert.equal(step?.milliseconds, expectedDuration);
      step.resolve();
    },
  };
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

test("settles at neutral, swaps one decoded visual, and returns to idle without stacking", async () => {
  const preparations = [];
  const timeline = deferredSteps();
  const frames = [];
  const paintedSources = [];
  const { character, layer, reactions } = fixture([0], {
    prepareMedia: source => new Promise(resolve => preparations.push({ source, resolve })),
    settleDurationMs: 180,
    delay: milliseconds => timeline.delay(milliseconds),
    nextFrame: () => new Promise(resolve => frames.push(resolve)),
    readTransform: () => "matrix(-1, 0, 0, 1, 0, -2)",
    forceStyle: image => paintedSources.push(image.src),
  });
  character.src = "/assets/idle.png";

  const showReaction = reactions.apply("attentive");
  assert.equal(preparations[0].source, "/assets/attentive-a.webp");
  assert.equal(layer.children.length, 1);
  assert.equal(character.src, "/assets/idle.png");

  preparations.shift().resolve();
  await Promise.resolve();
  assert(character.classList.contains("reaction-settling"));
  assert.equal(character.style.values.get("--reaction-settle-from"), "matrix(-1, 0, 0, 1, 0, -2)");
  assert.equal(character.dataset.reaction, undefined);

  timeline.release(180);
  await Promise.resolve();
  assert.equal(layer.children.length, 1);
  assert(character.classList.contains("reaction-neutral-ready"));
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.dataset.reaction, undefined);
  assert.deepEqual(paintedSources, ["/assets/idle.png"]);

  frames.shift()();
  assert.equal(await showReaction, true);
  assert.equal(layer.children.length, 1);
  assert.equal(character.src, "/assets/attentive-a.webp");
  assert.equal(character.dataset.reaction, "attentive");
  assert.equal(character.style.values.get("--character-media-scale"), "1.3");
  assert.equal(character.classList.contains("reaction-neutral-ready"), false);

  const showIdle = reactions.apply("idle");
  assert.equal(preparations[0].source, "/assets/idle.png");
  preparations.shift().resolve();
  await Promise.resolve();
  timeline.release(180);
  await Promise.resolve();
  assert.equal(layer.children.length, 1);
  assert.equal(character.src, "/assets/attentive-a.webp");
  frames.shift()();
  assert.equal(await showIdle, true);
  assert.equal(layer.children.length, 1);
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.style.values.has("--character-media-scale"), false);
});

test("completion cancels a neutral-ready swap without changing the visible character", async () => {
  const timeline = deferredSteps();
  const frames = [];
  const { character, layer, reactions } = fixture([0], {
    prepareMedia: () => Promise.resolve(),
    settleDurationMs: 180,
    delay: milliseconds => timeline.delay(milliseconds),
    nextFrame: () => new Promise(resolve => frames.push(resolve)),
  });
  character.src = "/assets/idle.png";

  const pending = reactions.apply("attentive");
  await Promise.resolve();
  timeline.release(180);
  await Promise.resolve();
  assert.equal(layer.children.length, 1);
  assert(character.classList.contains("reaction-neutral-ready"));

  await reactions.celebrate();
  assert.equal(layer.children.length, 1);
  assert.equal(reactions.state, "celebrating");
  assert.equal(layer.children[0].dataset.reaction, "celebrating");
  assert.equal(layer.children[0].classList.contains("reaction-settling"), false);
  assert.equal(layer.children[0].classList.contains("reaction-neutral-ready"), false);
  assert.notEqual(layer.children[0].getAttribute("aria-hidden"), "true");
  assert.equal(character.src, "/assets/idle.png");
  frames.shift()();
  assert.equal(await pending, false);
  assert.equal(layer.children.length, 1);
});

test("discards a short reaction that ends before its media is ready", async () => {
  let resolveMedia;
  const { character, layer, reactions } = fixture([0], {
    prepareMedia: () => new Promise(resolve => { resolveMedia = resolve; }),
  });
  character.src = "/assets/idle.png";

  const pending = reactions.apply("attentive");
  await reactions.apply("idle");
  resolveMedia();
  assert.equal(await pending, false);
  assert.equal(layer.children.length, 1);
  assert.equal(character.src, "/assets/idle.png");
  assert.equal(character.style.values.has("--character-media-scale"), false);
});

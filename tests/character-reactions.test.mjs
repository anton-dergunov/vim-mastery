import assert from "node:assert/strict";
import test from "node:test";

import { CharacterReactions } from "../character-reactions.js";

function createLayer() {
  return {
    children: [],
    querySelector() {
      return this.querySelectorAll()[0] || null;
    },
    querySelectorAll() {
      return this.children.flatMap(child => child._isMask ? child.children : [child]);
    },
    getBoundingClientRect() { return { left: 0, right: 390, top: 0, bottom: 844 }; },
  };
}

function createMaskLayer(layer, role) {
  const classes = new Set([
    "reaction-dissolve-mask",
    `reaction-dissolve-${role}-mask`,
    "reaction-dissolve-staged",
  ]);
  const values = new Map();
  const attributes = new Map();
  const mask = {
    _isMask: true,
    _parent: null,
    children: [],
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
    },
    style: {
      values,
      setProperty(name, value) { values.set(name, value); },
      removeProperty(name) { values.delete(name); },
    },
    append(child) {
      child.remove();
      this.children.push(child);
      child._parent = this;
      child.isConnected = true;
    },
    after(sibling) {
      sibling.remove?.();
      const index = this._parent.children.indexOf(this);
      this._parent.children.splice(index + 1, 0, sibling);
      sibling._parent = this._parent;
      sibling.isConnected = true;
    },
    remove() {
      if (!this._parent) return;
      const index = this._parent.children.indexOf(this);
      if (index >= 0) this._parent.children.splice(index, 1);
      this.children.forEach(child => { child.isConnected = false; });
      this._parent = null;
    },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.get(name); },
    _classes: classes,
  };
  if (role === "outgoing") mask.setAttribute("aria-hidden", "true");
  return mask;
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
    _parent: null,
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
      const index = this._parent.children.indexOf(this);
      this._parent.children.splice(index + 1, 0, sibling);
      sibling._parent = this._parent;
      sibling.isConnected = true;
    },
    remove() {
      if (!this._parent) return;
      const index = this._parent.children.indexOf(this);
      if (index >= 0) this._parent.children.splice(index, 1);
      this._parent = null;
      this.isConnected = false;
    },
    getBoundingClientRect() {
      return this.src.includes("idle")
        ? { left: 20, right: 120, top: 700, bottom: 820 }
        : { left: 10, right: 130, top: 690, bottom: 825 };
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
  character._parent = layer;
  let randomIndex = 0;
  const reactions = new CharacterReactions({
    layer,
    assetUrl: value => `/assets/${value}`,
    reducedMotion: () => false,
    random: () => randomValues[randomIndex++ % randomValues.length],
    settleDurationMs: 0,
    dissolveDurationMs: 0,
    nextFrame: () => Promise.resolve(),
    createMaskLayer: role => createMaskLayer(layer, role),
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

test("settles at neutral and dissolves decoded visuals through complementary layers", async () => {
  const preparations = [];
  const timeline = deferredSteps();
  const frames = [];
  const paintedSources = [];
  const { character, layer, reactions } = fixture([0], {
    prepareMedia: source => new Promise(resolve => preparations.push({ source, resolve })),
    settleDurationMs: 180,
    dissolveDurationMs: 320,
    delay: milliseconds => timeline.delay(milliseconds),
    nextFrame: () => new Promise(resolve => frames.push(resolve)),
    readTransform: () => "matrix(-1, 0, 0, 1, 0, -2)",
    forceStyle: mask => paintedSources.push(mask.children[0].src),
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
  assert.equal(layer.children.length, 2);
  const [outgoingMask, incomingMask] = layer.children;
  const [outgoing] = outgoingMask.children;
  const [incoming] = incomingMask.children;
  assert(outgoingMask.classList.contains("reaction-dissolve-outgoing-mask"));
  assert(outgoingMask.classList.contains("reaction-dissolve-staged"));
  assert(incomingMask.classList.contains("reaction-dissolve-incoming-mask"));
  assert(incomingMask.classList.contains("reaction-dissolve-staged"));
  for (const property of [
    "--reaction-dissolve-start",
    "--reaction-dissolve-end",
    "--reaction-dissolve-35-0",
    "--reaction-dissolve-35-10",
    "--reaction-dissolve-70-0",
    "--reaction-dissolve-70-10",
    "--reaction-dissolve-y-0",
    "--reaction-dissolve-y-10",
  ]) {
    assert.equal(incomingMask.style.values.get(property), outgoingMask.style.values.get(property));
  }
  assert.equal(outgoing.src, "/assets/idle.png");
  assert.equal(incoming.src, "/assets/attentive-a.webp");
  assert.equal(incoming.dataset.reaction, "attentive");
  assert.equal(incoming.style.values.get("--character-media-scale"), "1.3");
  assert.deepEqual(paintedSources, ["/assets/attentive-a.webp"]);

  frames.shift()();
  await Promise.resolve();
  assert(outgoingMask.classList.contains("reaction-dissolve-running-out"));
  assert(incomingMask.classList.contains("reaction-dissolve-running-in"));
  assert(outgoing.classList.contains("reaction-dissolve-frozen"));
  assert(incoming.classList.contains("reaction-dissolve-frozen"));
  assert.equal(outgoing.getAttribute("aria-hidden"), "true");
  timeline.release(320);
  assert.equal(await showReaction, true);
  assert.equal(layer.children.length, 1);
  assert.equal(layer.children[0], incoming);
  assert.equal(incoming.classList.contains("reaction-dissolve-frozen"), false);
  assert.notEqual(incoming.getAttribute("aria-hidden"), "true");

  const showIdle = reactions.apply("idle");
  assert.equal(preparations[0].source, "/assets/idle.png");
  preparations.shift().resolve();
  await Promise.resolve();
  timeline.release(180);
  await Promise.resolve();
  assert.equal(layer.children.length, 2);
  assert.equal(layer.children[0].children[0].src, "/assets/attentive-a.webp");
  assert.equal(layer.children[1].children[0].src, "/assets/idle.png");
  frames.shift()();
  await Promise.resolve();
  timeline.release(320);
  assert.equal(await showIdle, true);
  assert.equal(layer.children.length, 1);
  assert.equal(layer.children[0].src, "/assets/idle.png");
  assert.equal(layer.children[0].style.values.has("--character-media-scale"), false);
});

test("completion cancels an active dissolve without leaving duplicate characters", async () => {
  const timeline = deferredSteps();
  const frames = [];
  const { character, layer, reactions } = fixture([0], {
    prepareMedia: () => Promise.resolve(),
    settleDurationMs: 180,
    dissolveDurationMs: 320,
    delay: milliseconds => timeline.delay(milliseconds),
    nextFrame: () => new Promise(resolve => frames.push(resolve)),
  });
  character.src = "/assets/idle.png";

  const pending = reactions.apply("attentive");
  await Promise.resolve();
  timeline.release(180);
  await Promise.resolve();
  assert.equal(layer.children.length, 2);
  frames.shift()();
  await Promise.resolve();
  assert(layer.children[0].classList.contains("reaction-dissolve-running-out"));
  assert(layer.children[1].classList.contains("reaction-dissolve-running-in"));

  await reactions.celebrate();
  assert.equal(layer.children.length, 1);
  assert.equal(reactions.state, "celebrating");
  assert.equal(layer.children[0].dataset.reaction, "celebrating");
  assert.equal(layer.children[0].classList.contains("reaction-dissolve-frozen"), false);
  assert.notEqual(layer.children[0].getAttribute("aria-hidden"), "true");
  assert.equal(layer.children[0].src, "/assets/attentive-a.webp");
  timeline.release(320);
  assert.equal(await pending, false);
  assert.equal(layer.children.length, 1);
});

test("completion cancels neutral settling before dissolve layers are created", async () => {
  const timeline = deferredSteps();
  const { character, layer, reactions } = fixture([0], {
    prepareMedia: () => Promise.resolve(),
    settleDurationMs: 180,
    dissolveDurationMs: 320,
    delay: milliseconds => timeline.delay(milliseconds),
  });
  character.src = "/assets/idle.png";

  const pending = reactions.apply("attentive");
  await Promise.resolve();
  assert(character.classList.contains("reaction-settling"));

  await reactions.celebrate();
  assert.equal(layer.children.length, 1);
  assert.equal(character.classList.contains("reaction-settling"), false);
  assert.equal(character.dataset.reaction, "celebrating");
  timeline.release(180);
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

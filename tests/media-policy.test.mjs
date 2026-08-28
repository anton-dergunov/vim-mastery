import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  assertCoreMediaBudget,
  assertMediaAssets,
  collectMediaPolicy,
  contentRevision,
  CORE_MEDIA_MAX_BYTES,
  CORE_MEDIA_WARNING_BYTES,
} from "../media-policy.js";

const rootPath = new URL("../", import.meta.url).pathname;

test("media policy is deterministic and fails declared missing runtime assets", () => {
  const presentation = JSON.parse(readFileSync(join(rootPath, "content", "presentation.json"), "utf8"));
  const characters = JSON.parse(readFileSync(join(rootPath, "assets", "characters", "manifest.json"), "utf8"));
  const first = collectMediaPolicy(presentation, characters);
  const second = collectMediaPolicy(presentation, characters);
  assert.deepEqual(first, second);
  assertMediaAssets(rootPath, first);
  const warnings = [];
  const coreBytes = assertCoreMediaBudget(rootPath, first, {
    onWarning: message => warnings.push(message),
  });
  assert(coreBytes > 0);
  assert(coreBytes <= CORE_MEDIA_MAX_BYTES);
  assert.equal(warnings.length, coreBytes > CORE_MEDIA_WARNING_BYTES ? 1 : 0);
  assert(first.core.some(asset => asset.category === "registered-patch"));
  assert(first.core.some(asset => asset.category === "character-idle"));
  // Fourteen backdrops for fifteen units: Units 9 and 10 share one scene, and
  // the collector deduplicates by path.
  assert.equal(first.core.filter(asset => asset.category === "unit-story-base").length, 14);
  assert.equal(first.core.filter(asset => asset.category === "unit-story-image").length, 15);
  assert.equal(first.core.filter(asset => asset.category === "story-ui").length, 1);
  assert(first.optional.every(asset => [
    "character-animation",
    "character-reaction",
    "remote-scene-variant",
  ].includes(asset.category)));

  const variedCharacters = structuredClone(characters);
  for (const character of Object.values(variedCharacters.characters)) {
    character.reactions = {};
  }
  variedCharacters.characters.nix.reactions.attentive = [
    { src: "assets/characters/nix/animations/joyful-hop.webp" },
    { src: "assets/characters/nix/animations/high-jump.webp" },
  ];
  const variedMedia = collectMediaPolicy(presentation, variedCharacters);
  assert.deepEqual(
    variedMedia.optional
      .filter(asset => asset.category === "character-reaction")
      .map(asset => asset.path)
      .sort(),
    [
      "assets/characters/nix/animations/high-jump.webp",
      "assets/characters/nix/animations/joyful-hop.webp",
    ],
  );

  const broken = structuredClone(presentation);
  broken.story.intro[0].asset = "assets/worlds/story/declared-but-missing.webp";
  assert.throws(
    () => assertMediaAssets(rootPath, collectMediaPolicy(broken, characters)),
    /Missing story-still manifest asset/,
  );

  const unapproved = structuredClone(presentation);
  unapproved.units["modal-model"].completion.storyBackdrop =
    "assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/variants/mode-lantern-c01.webp";
  assert.throws(
    () => collectMediaPolicy(unapproved, characters),
    /Unapproved scene variants cannot be shipped as core runtime media/,
  );
});

test("core media budget rejects an oversized precache", () => {
  const temporary = mkdtempSync(join(tmpdir(), "vim-wilds-media-budget-"));
  try {
    const oversized = join(temporary, "oversized.webp");
    writeFileSync(oversized, "");
    truncateSync(oversized, CORE_MEDIA_MAX_BYTES + 1);
    assert.throws(
      () => assertCoreMediaBudget(temporary, {
        core: [{ path: "oversized.webp", category: "test" }],
      }),
      /Core media budget exceeded/,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("precache content revision changes when a generated asset changes", () => {
  const temporary = mkdtempSync(join(tmpdir(), "vim-wilds-cache-revision-"));
  try {
    writeFileSync(join(temporary, "asset.webp"), "first");
    const first = contentRevision(temporary, ["asset.webp"]);
    const stable = contentRevision(temporary, ["asset.webp"]);
    writeFileSync(join(temporary, "asset.webp"), "second");
    const changed = contentRevision(temporary, ["asset.webp"]);
    assert.equal(first, stable);
    assert.notEqual(first, changed);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

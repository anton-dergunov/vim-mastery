import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  assertMediaAssets,
  collectMediaPolicy,
  contentRevision,
  coreMediaBytes,
} from "../media-policy.js";

const root = new URL("../", import.meta.url);
const rootPath = root.pathname;

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test("production PWA precaches core media and streams optional animation and scene variants", () => {
  execFileSync("npm", ["run", "build"], { cwd: rootPath, stdio: "inherit" });
  const dist = join(rootPath, "dist");
  const output = files(dist);
  const worker = readFileSync(join(dist, "service-worker.js"), "utf8");
  const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
  const landing = readFileSync(join(dist, "index.html"), "utf8");
  const play = readFileSync(join(dist, "play", "index.html"), "utf8");
  const presentation = readFileSync(join(rootPath, "content", "presentation.json"), "utf8");
  const presentationData = JSON.parse(presentation);
  const characterManifest = JSON.parse(readFileSync(join(rootPath, "assets", "characters", "manifest.json"), "utf8"));
  const media = collectMediaPolicy(presentationData, characterManifest);
  const unitFiles = files(join(rootPath, "content", "units")).map(path => path.split("/").at(-1));

  assert.equal(existsSync(join(dist, "play", "index.html")), true);
  assert.equal(manifest.start_url, "./play/");
  assert.equal(existsSync(join(dist, "icons", "icon-192.png")), true);
  assert.equal(existsSync(join(dist, "icons", "icon-512.png")), true);
  for (const page of [landing, play]) {
    assert.match(page, /name="apple-mobile-web-app-capable" content="yes"/);
    assert.match(page, /name="apple-mobile-web-app-title" content="Vim Wilds"/);
    assert.match(page, /rel="apple-touch-icon" href="\/vim-mastery\/icons\/icon-192\.png"/);
  }
  unitFiles.forEach(file => {
    assert.equal(existsSync(join(dist, "content", "units", file)), true);
    assert.match(worker, new RegExp(`content/units/${file.replace(".", "\\.")}`));
  });
  assert.equal(readFileSync(join(dist, "content", "presentation.json"), "utf8"), presentation);
  assert.match(worker, /content\/presentation\.json/);
  assert.equal(media.core.length, 116);
  assert.equal(media.core.filter(asset => asset.category === "unit-story-base").length, 14);
  assert.equal(media.optional.filter(asset => asset.category === "remote-scene-variant").length, 700);
  media.core.forEach(({ path: file }) => {
    assert.equal(existsSync(join(dist, file)), true, `${file} must be emitted`);
    assert.equal(worker.includes(file), true, `${file} must be precached`);
  });
  const moonrootRoot = join(rootPath, "assets", "worlds", "moonroot-ruins");
  for (const sceneId of ["wayfinder-crossroads", "mode-lantern-grounds", "scribes-spring", "grammar-gate-court"]) {
    const remoteVariantRoot = join(moonrootRoot, "scenes", sceneId, "variants");
    const remoteVariants = files(remoteVariantRoot)
      .filter(file => file.endsWith(".webp"))
      .map(file => `assets/worlds/moonroot-ruins/scenes/${sceneId}/variants/${file.split("/").at(-1)}`);
    assert.equal(remoteVariants.length, 50);
    remoteVariants.forEach(file => {
      assert.equal(existsSync(join(dist, file)), true);
      assert.equal(worker.includes(file), false, `${file} must stream rather than precache`);
    });
    const completeVariantRoot = join(
      moonrootRoot,
      "scenes",
      sceneId,
      "variants-full",
    );
    const completeVariants = files(completeVariantRoot)
      .filter(file => file.endsWith(".webp"))
      .map(file => (
        `assets/worlds/moonroot-ruins/scenes/${sceneId}/variants-full/`
        + file.split("/").at(-1)
      ));
    assert.equal(completeVariants.length, 50);
    completeVariants.forEach(file => {
      assert.equal(existsSync(join(rootPath, file)), true);
      assert.equal(existsSync(join(dist, file)), false);
      assert.equal(worker.includes(file), false);
    });
  }
  const characterAnimations = files(join(rootPath, "assets", "characters"))
    .filter(file => file.includes("/animations/") && file.endsWith(".webp"))
    .map(file => `assets/characters/${file.slice(join(rootPath, "assets", "characters").length + 1)}`);
  assert.equal(characterAnimations.length, 150);
  characterAnimations.forEach(file => {
    assert.equal(existsSync(join(dist, file)), true);
    assert.equal(worker.includes(file), false, `${file} must stream rather than precache`);
  });
  for (const retiredAsset of [
    "assets/worlds/moonroot-ruins/backdrop-square.webp",
    "assets/worlds/moonroot-ruins/props/root-arch.webp",
  ]) {
    assert.equal(existsSync(join(dist, retiredAsset)), false);
    assert.equal(worker.includes(retiredAsset), false);
  }
  assert.doesNotMatch(worker, /raw\.githubusercontent\.com/);
  assert.match(worker, /const CACHE_NAME = "vim-wilds-0\.1\.0-dev\.[a-f0-9]+-[a-f0-9]{12}"/);
});

test("media policy is deterministic and fails declared missing runtime assets", () => {
  const presentation = JSON.parse(readFileSync(join(rootPath, "content", "presentation.json"), "utf8"));
  const characters = JSON.parse(readFileSync(join(rootPath, "assets", "characters", "manifest.json"), "utf8"));
  const first = collectMediaPolicy(presentation, characters);
  const second = collectMediaPolicy(presentation, characters);
  assert.deepEqual(first, second);
  assertMediaAssets(rootPath, first);
  assert(coreMediaBytes(rootPath, first) > 0);
  assert(first.core.some(asset => asset.category === "registered-patch"));
  assert(first.core.some(asset => asset.category === "character-idle"));
  assert.equal(first.core.filter(asset => asset.category === "unit-story-base").length, 14);
  assert(first.optional.every(asset => ["character-animation", "remote-scene-variant"].includes(asset.category)));

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

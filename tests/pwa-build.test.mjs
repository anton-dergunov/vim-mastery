import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const rootPath = root.pathname;

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test("production PWA precaches core media and streams GitHub Pages animation and scene variants", () => {
  execFileSync("npm", ["run", "build"], { cwd: rootPath, stdio: "inherit" });
  const dist = join(rootPath, "dist");
  const output = files(dist);
  const worker = readFileSync(join(dist, "service-worker.js"), "utf8");
  const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
  const landing = readFileSync(join(dist, "index.html"), "utf8");
  const play = readFileSync(join(dist, "play", "index.html"), "utf8");
  const presentation = readFileSync(join(rootPath, "content", "presentation.json"), "utf8");
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
  const moonrootRoot = join(rootPath, "assets", "worlds", "moonroot-ruins");
  const moonrootMedia = files(join(moonrootRoot, "scenes"))
    .filter(file => file.endsWith("/base.webp"))
    .map(file => `assets/worlds/moonroot-ruins/${file.slice(moonrootRoot.length + 1)}`);
  assert.equal(moonrootMedia.length, 12);
  moonrootMedia.forEach(file => {
    assert.equal(existsSync(join(dist, file)), true);
    assert.equal(worker.includes(file), true);
  });
  const remoteVariantRoot = join(moonrootRoot, "scenes", "wayfinder-crossroads", "variants");
  const remoteVariants = files(remoteVariantRoot)
    .filter(file => file.endsWith(".png"))
    .map(file => `assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/${file.split("/").at(-1)}`);
  assert.equal(remoteVariants.length, 50);
  remoteVariants.forEach(file => {
    assert.equal(existsSync(join(dist, file)), true);
    assert.equal(worker.includes(file), false, `${file} must stream rather than precache`);
  });
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
});

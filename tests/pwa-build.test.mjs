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

test("production PWA precaches all local lessons and excludes animation WebPs", () => {
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
    .filter(file => file.endsWith(".webp"))
    .map(file => `assets/worlds/moonroot-ruins/${file.slice(moonrootRoot.length + 1)}`);
  assert.equal(moonrootMedia.length, 72);
  moonrootMedia.forEach(file => {
    assert.equal(existsSync(join(dist, file)), true);
    assert.equal(worker.includes(file), true);
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

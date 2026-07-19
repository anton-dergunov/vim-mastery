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
  assert.equal(output.some(path => path.endsWith(".webp")), false);
  assert.doesNotMatch(worker, /raw\.githubusercontent\.com|\.webp/);
});

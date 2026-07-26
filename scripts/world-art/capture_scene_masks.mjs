#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const destination = resolve(root, "artifacts/world-generation/layout-masks");
const origin = "http://127.0.0.1:4173";

function waitForServer(child) {
  return new Promise((resolveReady, reject) => {
    const timeout = setTimeout(() => reject(new Error("Vite did not become ready")), 20_000);
    const inspect = chunk => {
      if (!String(chunk).includes("Local:")) return;
      clearTimeout(timeout);
      resolveReady();
    };
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("exit", code => {
      clearTimeout(timeout);
      reject(new Error(`Vite exited before mask capture (${code})`));
    });
  });
}

async function setKeyboard(page, visibility) {
  await page.goto(`${origin}/play/?unit=modal-model&activity=quick-exit-insert`);
  await page.evaluate(value => {
    const key = "vim-wilds.session.v1";
    const previous = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...previous, keyboardVisibility: value }));
  }, visibility);
  await page.reload();
  await page.waitForFunction(() => window.VimWilds?.getState && document.querySelector(".editor-stack"));
}

async function captureProfile(page, { id, viewport, keyboardVisibility }) {
  await page.setViewportSize(viewport);
  await setKeyboard(page, keyboardVisibility);
  const metrics = await page.evaluate(() => {
    const world = document.querySelector("#world").getBoundingClientRect();
    const editor = document.querySelector(".editor-stack").getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      world: { width: world.width, height: world.height },
      editor: {
        x: (editor.left - world.left) / world.width,
        y: (editor.top - world.top) / world.height,
        width: editor.width / world.width,
        height: editor.height / world.height,
      },
    };
  });
  await page.evaluate(profile => {
    const world = document.querySelector("#world");
    const editor = document.querySelector(".editor-stack");
    const worldRect = world.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    const mask = document.createElement("div");
    mask.id = "scene-layout-mask";
    Object.assign(mask.style, {
      position: "absolute",
      zIndex: "999",
      inset: "0",
      background: "#e6e2d8",
    });
    const blocked = document.createElement("div");
    blocked.dataset.role = "editor-occlusion";
    Object.assign(blocked.style, {
      position: "absolute",
      left: `${editorRect.left - worldRect.left}px`,
      top: `${editorRect.top - worldRect.top}px`,
      width: `${editorRect.width}px`,
      height: `${editorRect.height}px`,
      border: "4px solid #8e2333",
      boxSizing: "border-box",
      background: "repeating-linear-gradient(135deg, #d75a65 0 10px, #f1a4a9 10px 20px)",
    });
    mask.append(blocked);
    world.replaceChildren(mask);
    world.dataset.maskProfile = profile;
  }, id);
  await page.locator("#world").screenshot({ path: resolve(destination, `${id}-dom-mask.png`) });
  return { id, ...metrics };
}

async function main() {
  await mkdir(destination, { recursive: true });
  const vite = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    await waitForServer(vite);
    browser = await chromium.launch();
    const page = await browser.newPage();
    const profiles = [];
    profiles.push(await captureProfile(page, {
      id: "tall",
      viewport: { width: 390, height: 844 },
      keyboardVisibility: "hidden",
    }));
    profiles.push(await captureProfile(page, {
      id: "compact",
      viewport: { width: 390, height: 844 },
      keyboardVisibility: "visible",
    }));
    profiles.push(await captureProfile(page, {
      id: "wide",
      viewport: { width: 1280, height: 900 },
      keyboardVisibility: "hidden",
    }));
    await writeFile(resolve(destination, "metrics.json"), `${JSON.stringify({ schemaVersion: 1, profiles }, null, 2)}\n`);
    console.log(`Saved ${profiles.length} DOM-derived masks to ${destination}`);
  } finally {
    await browser?.close();
    if (vite.exitCode === null) {
      vite.kill("SIGTERM");
      await new Promise(resolveExit => {
        const timeout = setTimeout(resolveExit, 5_000);
        vite.once("exit", () => {
          clearTimeout(timeout);
          resolveExit();
        });
      });
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

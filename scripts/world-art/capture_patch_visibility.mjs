#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const destination = resolve(
  root,
  "artifacts/world-generation/patch-reviews/wayfinder-crossroads/round-03/visibility",
);
const origin = "http://127.0.0.1:4173";
const activityId = "home-row-identifier";
const activityUrl = `${origin}/play/?unit=cursor-movement&activity=${activityId}`;

const cases = [
  ...[
    [360, 740],
    [390, 844],
    [412, 915],
    [430, 932],
    [432, 960],
  ].flatMap(([width, height]) => [
    {
      id: `phone-${width}x${height}-keyboard-hidden`,
      viewport: { width, height },
      keyboardVisibility: "hidden",
      hasTouch: true,
    },
    {
      id: `phone-${width}x${height}-keyboard-visible`,
      viewport: { width, height },
      keyboardVisibility: "visible",
      hasTouch: true,
    },
  ]),
  {
    id: "phone-844x390-landscape",
    viewport: { width: 844, height: 390 },
    keyboardVisibility: "hidden",
    hasTouch: true,
  },
  {
    id: "tablet-768x1024-portrait",
    viewport: { width: 768, height: 1024 },
    keyboardVisibility: "hidden",
    hasTouch: true,
  },
  {
    id: "tablet-1024x768-landscape",
    viewport: { width: 1024, height: 768 },
    keyboardVisibility: "hidden",
    hasTouch: true,
  },
  {
    id: "desktop-1280x900",
    viewport: { width: 1280, height: 900 },
    keyboardVisibility: "hidden",
    hasTouch: false,
  },
  {
    id: "desktop-1440x1000",
    viewport: { width: 1440, height: 1000 },
    keyboardVisibility: "hidden",
    hasTouch: false,
  },
];

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
      reject(new Error(`Vite exited before visibility capture (${code})`));
    });
  });
}

function relativeRect(rect, world) {
  const left = Math.max(rect.left, world.left);
  const top = Math.max(rect.top, world.top);
  const right = Math.min(rect.right, world.right);
  const bottom = Math.min(rect.bottom, world.bottom);
  if (right <= left || bottom <= top) return null;
  return {
    x: (left - world.left) / world.width,
    y: (top - world.top) / world.height,
    width: (right - left) / world.width,
    height: (bottom - top) / world.height,
  };
}

async function captureCase(browser, captureCase) {
  const context = await browser.newContext({
    viewport: captureCase.viewport,
    hasTouch: captureCase.hasTouch,
  });
  const page = await context.newPage();
  await page.addInitScript(visibility => {
    const key = "vim-wilds.session.v1";
    const previous = JSON.parse(localStorage.getItem(key) || "{}");
    localStorage.setItem(key, JSON.stringify({ ...previous, keyboardVisibility: visibility }));
  }, captureCase.keyboardVisibility);
  await page.goto(activityUrl);
  await page.waitForFunction(() => (
    window.VimWilds?.getState
    && document.querySelector("#world")?.dataset.sceneId === "wayfinder-crossroads"
    && document.querySelector(".editor-stack")
  ));
  await page.dispatchEvent("body", "pointerdown");
  await page.waitForTimeout(80);

  const metrics = await page.evaluate(() => {
    const worldElement = document.querySelector("#world");
    const backdrop = document.querySelector(".world-backdrop");
    const world = worldElement.getBoundingClientRect();
    const rectFor = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      return relativeRectForPage(element.getBoundingClientRect(), world);
    };
    const relativeRectForPage = (rect, container) => {
      const left = Math.max(rect.left, container.left);
      const top = Math.max(rect.top, container.top);
      const right = Math.min(rect.right, container.right);
      const bottom = Math.min(rect.bottom, container.bottom);
      if (right <= left || bottom <= top) return null;
      return {
        x: (left - container.left) / container.width,
        y: (top - container.top) / container.height,
        width: (right - left) / container.width,
        height: (bottom - top) / container.height,
      };
    };
    const backdropStyle = getComputedStyle(backdrop);
    const focal = getComputedStyle(worldElement).getPropertyValue("--scene-focal-position").trim() || "50% 50%";
    const occlusions = [
      ["editor", ".editor-stack"],
      ["guide", ".character-layer .nix"],
      ["completion", ".completion-panel.in-world"],
    ].flatMap(([kind, selector]) => {
      const bounds = rectFor(selector);
      return bounds ? [{ kind, bounds }] : [];
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      world: { width: world.width, height: world.height },
      boardProfile: worldElement.dataset.boardProfile,
      sceneProfile: backdrop.dataset.sceneProfile,
      focalPosition: focal,
      backdropVisible: backdropStyle.display !== "none"
        && backdropStyle.visibility !== "hidden"
        && Number(backdropStyle.opacity || 1) > 0,
      pseudoInsetPixels: 4,
      occlusions,
    };
  });

  await page.locator("#world").screenshot({
    path: resolve(destination, "screenshots", `${captureCase.id}.png`),
  });
  await context.close();
  return { ...captureCase, ...metrics };
}

async function main() {
  await mkdir(resolve(destination, "screenshots"), { recursive: true });
  const vite = spawn(
    "npm",
    ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let browser;
  try {
    await waitForServer(vite);
    browser = await chromium.launch();
    const captures = [];
    for (const caseDefinition of cases) {
      const metrics = await captureCase(browser, caseDefinition);
      captures.push(metrics);
      console.log(
        `${caseDefinition.id}: ${metrics.boardProfile}/${metrics.sceneProfile}; `
        + `backdrop ${metrics.backdropVisible ? "visible" : "hidden"}`,
      );
    }
    const payload = {
      schemaVersion: 2,
      unitId: "cursor-movement",
      sceneId: "wayfinder-crossroads",
      activityId,
      captures,
    };
    await writeFile(resolve(destination, "metrics.json"), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`Saved ${captures.length} visibility captures to ${destination}`);
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

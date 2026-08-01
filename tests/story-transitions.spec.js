import { expect, test } from "@playwright/test";

const storyState = {
  introSeen: true,
  endingSeen: false,
  completedUnitStoryIds: [],
};

async function waitForApp(page) {
  await page.waitForFunction(() => window.VimWilds?.getState);
}

async function expectStoryToFitViewport(page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
    && document.documentElement.scrollHeight <= window.innerHeight
  ))).toBe(true);
  const bounds = await page.locator("#storyDialog").boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
  await expect(page.locator(".story-actions")).toBeInViewport();
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title === "loads every compressed story still in the browser") return;
  await page.route(/\.(?:png|webp)(?:\?.*)?$/, route => route.abort());
});

test("shows the exact three-panel introduction once with immediate skip and replay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/");
  await waitForApp(page);

  const dialog = page.locator("#storyDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-labelledby", "storyTitle");
  await expect(dialog).toHaveAttribute("aria-describedby", "storyCopy");
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeFocused();
  await expect(dialog.locator(".story-copy")).toHaveAttribute("aria-label",
    "Long ago, the Wilds answered to a precise language. Every motion had a destination; every change knew its range.",
  );
  await expect(dialog.getByRole("button", { name: "Skip story" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.locator(".story-copy")).toHaveAttribute("aria-label",
    "Then an unfinished command crossed the land. Paths shifted, memories scattered, and the great mechanisms fell silent.",
  );
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.locator(".story-copy")).toHaveAttribute("aria-label",
    "The language was not lost—only forgotten. Learn it with us, and the Wilds will remember.",
  );
  await expect(dialog.getByRole("button", { name: "Enter the Wilds" })).toBeVisible();
  await dialog.getByRole("button", { name: "Enter the Wilds" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await waitForApp(page);
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("button", { name: "Replay Story" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".story-progress")).toHaveText("1 of 3");
  await dialog.getByRole("button", { name: "Skip story" }).click();
});

test("loads every compressed story still in the browser", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await waitForApp(page);

  const results = await page.evaluate(async () => {
    const presentation = await fetch("../content/presentation.json").then(response => response.json());
    const assets = [
      ...Object.values(presentation.units).map(unit => unit.completion.storyImage),
      ...presentation.story.intro.map(panel => panel.asset),
      presentation.story.ending.asset,
    ];
    return Promise.all(assets.map(asset => new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve({
        asset,
        complete: image.complete,
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
      image.onerror = () => resolve({ asset, complete: false, width: 0, height: 0 });
      image.src = `../${asset}`;
    })));
  });

  expect(results).toHaveLength(18);
  expect(results.every(result => result.asset.endsWith(".webp"))).toBe(true);
  expect(results.every(result => result.complete && result.width > 0 && result.height > 0)).toBe(true);
});

test("allows skipping from every introduction panel", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);

  for (let panelIndex = 0; panelIndex < 3; panelIndex += 1) {
    if (panelIndex > 0) {
      await page.evaluate(() => {
        window.localStorage.removeItem("vim-wilds.story.v1");
        window.sessionStorage.removeItem("vim-wilds.story-transition.v1");
      });
      await page.reload();
      await waitForApp(page);
    }
    for (let step = 0; step < panelIndex; step += 1) {
      await page.getByRole("button", { name: "Continue" }).click();
    }
    await expect(page.locator(".story-progress")).toHaveText(`${panelIndex + 1} of 3`);
    await page.getByRole("button", { name: "Skip story" }).click();
    await expect(page.locator("#storyDialog")).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(
      window.localStorage.getItem("vim-wilds.story.v1"),
    ).introSeen)).toBe(true);
  }
});

test("renders selected WP-11 panorama candidates with a one-way in-game camera track", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/");
  await waitForApp(page);

  for (const candidate of ["05", "07", "10", "14"]) {
    expect(await page.evaluate(id => window.VimWilds.previewIntroArt(id), candidate)).toBe(true);
    const visual = page.locator(".story-visual");
    await expect(visual).toHaveClass(/story-panorama/);
    await expect(visual).toHaveAttribute("data-review-story-asset", new RegExp(`candidate-${candidate}\\.png$`));
    expect(await visual.evaluate(element => getComputedStyle(element).animationName)).toBe("story-panorama-camera-track");
    expect(await visual.evaluate(element => getComputedStyle(element).animationDuration)).toBe("60s");
  }
});

test("keeps Panels 1 and 2 on one camera clock, crossfades them, and restarts Panel 3", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?preview=story&story=intro&panel=connected-wilds");
  await waitForApp(page);
  const visual = page.locator(".story-visual");
  await page.waitForTimeout(300);
  const firstDelay = Number.parseFloat(await visual.evaluate(element => getComputedStyle(element).animationDelay));
  expect(firstDelay).toBeGreaterThan(-.1);
  expect(await visual.evaluate(element => getComputedStyle(element).backgroundSize)).not.toContain("185%");
  expect(await visual.evaluate(element => getComputedStyle(element).backgroundSize)).toContain("94%");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".story-surface")).toHaveAttribute("data-panel-id", "interrupted-command");
  const secondDelay = Number.parseFloat(await visual.evaluate(element => getComputedStyle(element).animationDelay));
  expect(secondDelay).toBeLessThan(firstDelay);
  expect(secondDelay).toBeLessThan(-.2);
  const crossfade = visual.locator(".story-panorama-crossfade");
  await expect(crossfade).toHaveCount(1);
  await expect(crossfade).toHaveClass(/is-leaving/);
  expect(Number.parseFloat(await crossfade.evaluate(element => getComputedStyle(element).transitionDuration)))
    .toBeGreaterThanOrEqual(1.4);
  expect(await crossfade.evaluate(element => getComputedStyle(element).animationPlayState)).toBe("running");
  const fadePosition = await crossfade.evaluate(element => getComputedStyle(element).backgroundPosition);
  await page.waitForTimeout(250);
  expect(await crossfade.evaluate(element => getComputedStyle(element).backgroundPosition)).not.toBe(fadePosition);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator(".story-surface")).toHaveAttribute("data-panel-id", "nix-at-the-threshold");
  const thirdDelay = Number.parseFloat(await visual.evaluate(element => getComputedStyle(element).animationDelay));
  expect(thirdDelay).toBeGreaterThan(secondDelay);
  expect(thirdDelay).toBeGreaterThan(-.25);
  await expect(crossfade).toHaveCount(0);
  expect(await visual.evaluate(element => getComputedStyle(element).animationName)).toBe("story-panorama-camera-track");
  expect(await visual.evaluate(element => getComputedStyle(element).animationDuration)).toBe("60s");
  const thirdPosition = await visual.evaluate(element => getComputedStyle(element).backgroundPosition);
  await page.waitForTimeout(250);
  expect(await visual.evaluate(element => getComputedStyle(element).backgroundPosition)).not.toBe(thirdPosition);
});

test("opens direct review URLs for intro, unit-ending candidates, and the finale", async ({ page }) => {
  await page.goto("/play/?preview=story&story=intro&panel=nix-at-the-threshold");
  await waitForApp(page);
  let surface = page.locator(".story-surface");
  await expect(surface).toHaveAttribute("data-panel-id", "nix-at-the-threshold");
  await expect(page.locator(".story-visual")).toHaveAttribute(
    "data-story-asset",
    "assets/worlds/story/intro/nix-at-the-threshold.webp",
  );

  await page.goto("/play/?preview=story&story=unit-ending&unit=cursor-movement&candidate=3");
  await waitForApp(page);
  surface = page.locator(".story-surface");
  await expect(surface).toHaveAttribute("data-kind", "unit");
  await expect(page.locator(".story-visual")).toHaveAttribute(
    "data-review-story-asset",
    "artifacts/world-generation/wp11/story-review-v2/unit-endings/cursor-movement-restoration-3x4/candidate-03.png",
  );
  await expect(page.locator(".story-visual")).toHaveClass(/story-unit-ending/);

  await page.goto("/play/?preview=story&story=finale");
  await waitForApp(page);
  await expect(page.locator(".story-surface")).toHaveAttribute("data-kind", "ending");
  await expect(page.locator(".story-visual")).toHaveClass(/story-panorama-reverse/);

  await page.goto("/play/?preview=story-index");
  await waitForApp(page);
  await expect(page.getByRole("dialog", { name: "Table of contents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Story scene review" })).toBeVisible();
  const unit14Review = page.locator(".story-review-unit").filter({ hasText: "Unit 14" });
  await expect(unit14Review.getByRole("link", { name: /Candidate/ })).toHaveCount(5);
});

test("uses a full portrait frame with top narrative text for unit-ending art", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?preview=story&story=unit-ending&unit=modal-model&candidate=1");
  await waitForApp(page);
  await expectStoryToFitViewport(page);

  const dialog = page.locator("#storyDialog");
  const visual = dialog.locator(".story-visual");
  const copy = dialog.locator(".story-copy");
  const title = dialog.locator(".story-title");
  const dialogBounds = await dialog.boundingBox();
  const visualBounds = await visual.boundingBox();
  const copyBounds = await copy.boundingBox();
  expect(dialogBounds.height).toBeGreaterThan(800);
  expect(Math.abs(visualBounds.height - dialogBounds.height)).toBeLessThanOrEqual(2);
  const titleBounds = await title.boundingBox();
  expect(titleBounds.y).toBeGreaterThan(dialogBounds.y + dialogBounds.height * .1);
  expect(titleBounds.y).toBeLessThan(dialogBounds.y + dialogBounds.height * .22);
  expect(copyBounds.y).toBeGreaterThan(dialogBounds.y + dialogBounds.height * .18);
  expect(copyBounds.y).toBeLessThan(dialogBounds.y + dialogBounds.height * .36);
  expect(Number.parseFloat(await copy.evaluate(element => getComputedStyle(element).fontSize)))
    .toBeGreaterThanOrEqual(23);
  await expect(dialog.locator(".story-heading")).toBeHidden();
  await expect(dialog.locator(".story-guide-action")).toHaveCount(0);
  await expect(copy).toHaveAttribute(
    "aria-label",
    "The Mode Lantern wakes. One key can hold more than one meaning—and now the Wilds remember how to listen.",
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  await expectStoryToFitViewport(page);
  const desktopBounds = await dialog.boundingBox();
  expect(desktopBounds.width).toBeLessThanOrEqual(560);
  expect(desktopBounds.height).toBeGreaterThan(740);
});

test("writes every illustrated story slowly with the approved flying pen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?preview=story&story=unit-ending&unit=entering-changing-text&candidate=3");
  await waitForApp(page);
  const copy = page.locator(".story-copy");
  const fullStory = await copy.getAttribute("aria-label");
  await page.waitForTimeout(500);
  const partialStory = await copy.textContent();
  expect(partialStory.length).toBeGreaterThan(2);
  expect(partialStory.length).toBeLessThan(fullStory.length / 2);
  await expect(copy).toHaveClass(/is-typing/);
  const anchor = copy.locator(".story-pen-anchor");
  await expect(anchor).toHaveCount(1);
  const pen = await anchor.evaluate(element => {
    const style = getComputedStyle(element, "::after");
    const anchorStyle = getComputedStyle(element);
    return {
      backgroundImage: style.backgroundImage,
      animationName: style.animationName,
      width: Number.parseFloat(style.width),
      position: style.position,
      anchorWidth: Number.parseFloat(anchorStyle.width),
    };
  });
  expect(pen.backgroundImage).toContain("flying-pen.png");
  expect(pen.animationName).toBe("story-pen-writing");
  expect(pen.width).toBeGreaterThanOrEqual(38);
  expect(pen.position).toBe("absolute");
  expect(pen.anchorWidth).toBe(0);

  await page.goto("/play/?preview=story&story=finale");
  await waitForApp(page);
  await expect(page.locator(".story-heading")).toBeHidden();
  await expect(page.locator(".story-copy")).toHaveClass(/is-typing/);
});

test("fits the complete narrative for every approved unit ending without a character overlay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await waitForApp(page);

  for (const unit of await page.evaluate(() => window.VimWilds.units)) {
    expect(await page.evaluate(unitId => window.VimWilds.showUnitStory(unitId), unit.id)).toBe(true);
    const dialog = page.locator("#storyDialog");
    const copy = dialog.locator(".story-copy");
    const actions = dialog.locator(".story-actions");
    await expect(copy).not.toHaveClass(/is-typing/);
    await expect(dialog.locator(".story-guide-action")).toHaveCount(0);
    await expect(dialog.locator(".story-visual")).toHaveAttribute(
      "data-story-asset",
      `assets/worlds/story/units/${unit.id}.webp`,
    );
    const copyBounds = await copy.boundingBox();
    const actionBounds = await actions.boundingBox();
    expect(copyBounds.y + copyBounds.height).toBeLessThan(actionBounds.y - 8);
  }

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 432, height: 960 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expectStoryToFitViewport(page);
    const copyBounds = await page.locator(".story-copy").boundingBox();
    const actionBounds = await page.locator(".story-actions").boundingBox();
    expect(copyBounds.y + copyBounds.height).toBeLessThan(actionBounds.y - 8);
  }
});

test("keeps direct activity and later-unit links unblocked", async ({ page }) => {
  await page.goto("/play/?unit=cursor-movement");
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeHidden();

  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeHidden();

  await page.goto("/play/?unit=modal-model");
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeVisible();

  await page.goto("/play/?unit=cursor-movement");
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeHidden();
  expect(await page.evaluate(() => window.sessionStorage.getItem(
    "vim-wilds.story-transition.v1",
  ))).toBeNull();
});

test("preserves the active intro panel across live layout changes", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  await page.getByRole("button", { name: "Continue" }).click();
  const surface = page.locator(".story-surface");
  await expect(surface).toHaveAttribute("data-panel-id", "interrupted-command");

  for (const viewport of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 432, height: 960 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(surface).toHaveAttribute("data-panel-id", "interrupted-command");
    await expectStoryToFitViewport(page);
  }
  expect(await surface.evaluate(element => getComputedStyle(element).gridTemplateColumns)).not.toBe("none");
});

test("intercepts the final unit boundary, restores on refresh, and archives the replay", async ({ page }) => {
  await page.addInitScript(saved => {
    if (!window.localStorage.getItem("vim-wilds.story.v1")) {
      window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify(saved));
    }
  }, storyState);
  await page.goto("/play/?unit=modal-model&activity=modal-model-core-summary");
  await waitForApp(page);
  await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.length - 1));
  await page.getByRole("button", { name: /Continue to Unit 2/ }).click();

  const dialog = page.locator("#storyDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".story-surface")).toHaveAttribute("data-unit-id", "modal-model");
  await expect(dialog.locator(".story-surface")).toHaveAttribute("data-landmark-id", "mode-lantern");
  await expect(dialog.locator(".story-visual")).toHaveAttribute(
    "data-story-asset",
    "assets/worlds/story/units/modal-model.webp",
  );
  await expect(dialog.locator(".story-visual")).toHaveClass(/story-unit-ending/);
  await expect(dialog.locator(".story-copy")).toHaveAttribute("aria-label",
    "The Mode Lantern wakes. One key can hold more than one meaning—and now the Wilds remember how to listen.",
  );

  await page.reload();
  await waitForApp(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".story-surface")).toHaveAttribute("data-unit-id", "modal-model");
  await dialog.getByRole("button", { name: "Continue to next unit" }).click();
  await page.waitForFunction(() => window.VimWilds?.getState().unitId === "cursor-movement");

  await page.getByRole("button", { name: "Open table of contents" }).click();
  await page.getByRole("button", { name: "Unit 1: The modal model" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".story-kicker")).toHaveText("Restoration replay");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  expect((await page.evaluate(() => window.VimWilds.getState().story.completedUnitStoryIds))).toEqual(["modal-model"]);
});

test("chains Unit 14 into the restored-world finale and archives its reverse journey", async ({ page }) => {
  await page.addInitScript(saved => {
    if (!window.localStorage.getItem("vim-wilds.story.v1")) {
      window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify(saved));
    }
  }, storyState);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=global-normal-automation&activity=global-normal-automation-summary");
  await waitForApp(page);

  const dialog = page.locator("#storyDialog");
  await page.getByRole("button", { name: "Complete Unit 14" }).click();
  await expect(dialog.locator(".story-surface")).toHaveAttribute("data-kind", "unit");
  await expect(dialog.getByRole("button", { name: "Continue to finale" })).toBeVisible();
  await dialog.getByRole("button", { name: "Continue to finale" }).click();

  const surface = dialog.locator(".story-surface");
  const visual = dialog.locator(".story-visual");
  await expect(surface).toHaveAttribute("data-kind", "ending");
  await expect(surface).toHaveAttribute("data-panel-id", "restored-wilds");
  await expect(visual).toHaveAttribute("data-story-asset", "assets/worlds/story/ending/restored-wilds.webp");
  await expect(visual).toHaveClass(/story-panorama-reverse/);
  expect(await visual.evaluate(element => getComputedStyle(element).animationName))
    .toBe("story-panorama-camera-track-reverse");
  expect(await visual.evaluate(element => getComputedStyle(element).animationDuration)).toBe("24s");
  await expect(dialog.locator(".story-copy")).toHaveAttribute("aria-label",
    "The language is alive. What you restore next is up to you.",
  );

  await page.reload();
  await waitForApp(page);
  await expect(dialog.locator(".story-surface")).toHaveAttribute("data-kind", "ending");
  await expect(dialog.locator(".story-visual")).toHaveClass(/story-panorama-reverse/);

  await dialog.getByRole("button", { name: "View the restored Wilds" }).click();
  await expect(page.getByRole("dialog", { name: "Table of contents" })).toBeVisible();
  expect(await page.evaluate(() => window.VimWilds.getState().story)).toMatchObject({
    endingSeen: true,
    completedUnitStoryIds: ["global-normal-automation"],
  });
  await page.getByRole("button", { name: "Replay finale" }).click();
  await expect(surface).toHaveAttribute("data-kind", "ending");
  await expect(dialog.locator(".story-kicker")).toHaveText("Finale replay");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
});

test("exposes a non-mutating transition helper for WP-11 choreography checks", async ({ page }) => {
  await page.addInitScript(saved => {
    if (!window.localStorage.getItem("vim-wilds.story.v1")) {
      window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify(saved));
    }
  }, storyState);
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await waitForApp(page);

  expect(await page.evaluate(() => window.VimWilds.showUnitStory("global-normal-automation"))).toBe(true);
  const surface = page.locator(".story-surface");
  await expect(surface).toHaveAttribute("data-unit-id", "global-normal-automation");
  await expect(surface).toHaveAttribute("data-action-id", "open-meridian-engine");
  await expect(surface).toHaveAttribute("data-guide-id", "cairn");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect((await page.evaluate(() => window.VimWilds.getState().story.completedUnitStoryIds))).toEqual([]);
});

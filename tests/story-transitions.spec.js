import { expect, test } from "@playwright/test";

const storyState = {
  introSeen: true,
  completedUnitStoryIds: [],
};

async function waitForApp(page) {
  await page.waitForFunction(() => window.VimWilds?.getState);
}

async function expectStoryToFitViewport(page) {
  expect(await page.evaluate(() => (
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

test.beforeEach(async ({ page }) => {
  await page.route(/\.(?:png|webp)(?:\?.*)?$/, route => route.abort());
});

test("shows the exact three-panel introduction once with immediate skip and replay", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/");
  await waitForApp(page);

  const dialog = page.locator("#storyDialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".story-copy")).toHaveText(
    "Long ago, the Wilds answered to a precise language. Every motion had a destination; every change knew its range.",
  );
  await expect(dialog.getByRole("button", { name: "Skip story" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Continue" })).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.locator(".story-copy")).toHaveText(
    "Then an unfinished command crossed the land. Paths shifted, memories scattered, and the great mechanisms fell silent.",
  );
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.locator(".story-copy")).toHaveText(
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
  await expect(dialog.locator(".story-copy")).toHaveText(
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

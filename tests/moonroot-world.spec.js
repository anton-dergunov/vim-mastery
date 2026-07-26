import { expect, test } from "@playwright/test";

const moonrootScenes = {
  "modal-model": "mode-lantern-grounds",
  "cursor-movement": "wayfinder-crossroads",
  "entering-changing-text": "scribes-spring",
  "operator-grammar": "grammar-gate-court",
};

test("renders the four registered Moonroot scenes while later units retain the legacy board", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.waitForFunction(() => window.VimWilds?.getState && document.querySelector("#world")?.dataset.renderer === "registered-scenes");

  const moonroot = page.locator("#world");
  await expect(moonroot).toHaveAttribute("data-world-id", "moonroot-ruins");
  await expect(moonroot).toHaveAttribute("data-scene-id", "mode-lantern-grounds");
  await expect(page.locator(".ground-grid .ground-cell")).toHaveCount(0);
  await expect(page.locator(".world-prop, .world-landmark")).toHaveCount(0);
  await expect(page.locator(".world-scene-patch")).toHaveCount(4);
  expect(await page.locator(".world-backdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
    .toContain("scenes/mode-lantern-grounds/");
  await expect(moonroot).not.toHaveClass(/scene-reveal-active/, { timeout: 1_500 });
  await expect(page.locator("#characterLayer")).toHaveCSS("opacity", "1");
  await expect(page.locator("#characterLayer > .nix")).toBeVisible();
  await page.screenshot({ path: "test-results/moonroot-unit-1-phone.png", fullPage: true });

  for (const viewport of [
    { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 412, height: 915 },
    { width: 430, height: 932 }, { width: 432, height: 960 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(moonroot).toHaveAttribute("data-board-profile", /^(tall|compact|wide|shallow)$/);
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= window.innerWidth
      && document.documentElement.scrollHeight <= window.innerHeight
    ))).toBe(true);
  }

  const guidePlate = await page.locator("#characterLayer").evaluate(element => {
    const style = getComputedStyle(element, "::before");
    return { display: style.display, background: style.backgroundImage, opacity: style.opacity };
  });
  expect(guidePlate.display).not.toBe("none");
  expect(guidePlate.background).toContain("gradient");
  expect(Number(guidePlate.opacity)).toBeGreaterThan(0);

  for (const [unitId, sceneId] of Object.entries(moonrootScenes)) {
    await page.goto(`/play/?unit=${unitId}`);
    await page.waitForFunction(() => document.querySelector("#world")?.dataset.renderer === "registered-scenes");
    await expect(page.locator("#world")).toHaveAttribute("data-scene-id", sceneId);
    await expect(page.locator("#world")).not.toHaveClass(/scene-reveal-active/, { timeout: 1_500 });
    await expect(page.locator("#worldGrid")).toHaveCSS("opacity", "1");
    expect(await page.locator(".world-backdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
      .toContain(`scenes/${sceneId}/`);
    await page.screenshot({ path: `test-results/moonroot-${unitId}-phone.png`, fullPage: true });
  }

  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.renderer === "registered-scenes");
  await page.locator("#world").evaluate(node => {
    Object.assign(node.style, { position: "fixed", inset: "0 auto auto 0", width: "1024px", height: "400px" });
    window.dispatchEvent(new Event("orientationchange"));
  });
  await expect(moonroot).toHaveAttribute("data-board-profile", "shallow");
  await expect(page.locator("#worldBackdrop")).toHaveAttribute("data-scene-profile", "wide");
  expect(await page.locator(".world-backdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
    .toContain("/wide/base.webp");
  await page.screenshot({ path: "test-results/moonroot-unit-1-wide.png", fullPage: true });

  await page.goto("/play/?unit=precision-motions-search&activity=find-family-demo");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.renderer === "legacy");
  await expect(page.locator("#world")).toHaveAttribute("data-world-id", "legacy");
  await expect(page.locator(".ground-grid .ground-cell")).not.toHaveCount(0);
  await expect(page.locator(".world-scene-patch")).toHaveCount(0);
});

test("maps learning phases to deterministic registered patches", async ({ page }) => {
  const cases = [
    ["welcome-to-modal-vim", "explain", 1],
    ["insert-return-demo", "demonstrate", 2],
    ["escape-seeded-insert", "isolate", 2],
    ["ctrl-bracket-seeded-replace", "mix", 3],
    ["identify-insert-mode", "challenge", 4],
    ["modal-model-core-summary", "summary", 3],
  ];
  await page.goto("/play/?unit=modal-model");
  await page.waitForFunction(() => window.VimWilds?.activities);
  for (const [activityId, phase, patchCount] of cases) {
    await page.evaluate(id => {
      const index = window.VimWilds.activities.findIndex(activity => activity.id === id);
      window.VimWilds.goToActivity(index);
    }, activityId);
    await expect(page.locator("#world")).toHaveAttribute("data-learning-phase", phase);
    await expect(page.locator(".world-scene-patch")).toHaveCount(patchCount);
  }
});

test("cancels the unit-entry reveal on input", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  const world = page.locator("#world");
  await expect(world).toHaveClass(/scene-reveal-active/, { timeout: 1_000 });
  await page.keyboard.press("Escape");
  await expect(world).not.toHaveClass(/scene-reveal-active/);
});

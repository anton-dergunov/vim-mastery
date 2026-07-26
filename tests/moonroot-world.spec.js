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
  await expect(page.locator(".world-scene-patch")).toHaveCount(0);
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

test("keeps retired proof overlays absent across learning phases", async ({ page }) => {
  const cases = [
    ["welcome-to-modal-vim", "explain"],
    ["insert-return-demo", "demonstrate"],
    ["escape-seeded-insert", "isolate"],
    ["ctrl-bracket-seeded-replace", "mix"],
    ["identify-insert-mode", "challenge"],
    ["modal-model-core-summary", "summary"],
  ];
  await page.goto("/play/?unit=modal-model");
  await page.waitForFunction(() => window.VimWilds?.activities);
  for (const [activityId, phase] of cases) {
    await page.evaluate(id => {
      const index = window.VimWilds.activities.findIndex(activity => activity.id === id);
      window.VimWilds.goToActivity(index);
    }, activityId);
    await expect(page.locator("#world")).toHaveAttribute("data-learning-phase", phase);
    await expect(page.locator(".world-scene-patch")).toHaveCount(0);
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

test("streams compact Wayfinder variants after the delay and silently falls back offline", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
  });
  const requests = [];
  await page.route("**/assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/*.png", route => {
    requests.push(route.request().url());
    return route.fulfill({
      path: "assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/northwest-hanging-lantern-c01.png",
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.boardProfile === "compact");

  const variant = page.locator(".world-remote-variant");
  await expect(variant).toHaveCount(0);
  await expect(variant).toHaveCount(1, { timeout: 17_000 });
  await expect(variant).toHaveClass(/is-visible/);
  expect(new URL(requests[0]).origin).toBe(new URL(page.url()).origin);
  expect(await variant.evaluate(element => getComputedStyle(element, "::before").filter)).toContain("brightness(0.82)");
  expect(await variant.evaluate(element => element.style.getPropertyValue("--remote-variant-fade"))).toBe("2600ms");
  expect(await page.locator("#worldGrid").evaluate(element => Number(getComputedStyle(element).zIndex))).toBeGreaterThan(
    await variant.evaluate(element => Number(getComputedStyle(element.parentElement).zIndex)),
  );

  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(variant).toHaveCount(0);

  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(variant).toHaveCount(1, { timeout: 3_000 });
});

test("falls back to GitHub Pages when a local development variant is missing", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.boardProfile === "compact");

  const localOrigin = new URL(page.url()).origin;
  const requests = [];
  await page.route("**/assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/*.png", route => {
    const source = route.request().url();
    requests.push(source);
    if (new URL(source).origin === localOrigin) return route.fulfill({ status: 404 });
    return route.fulfill({
      path: "assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/northwest-hanging-lantern-c01.png",
      contentType: "image/png",
      headers: { "access-control-allow-origin": "*" },
    });
  });

  await expect(page.locator(".world-remote-variant")).toHaveCount(1, { timeout: 17_000 });
  expect(new URL(requests[0]).origin).toBe(localOrigin);
  expect(new URL(requests[1]).origin).toBe("https://anton-dergunov.github.io");
});

test("uses the approved compact Wayfinder source and variants on a wide board", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "hidden" }));
  });
  await page.route("**/assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/*.png", route => route.fulfill({
    path: "assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/northwest-hanging-lantern-c01.png",
    contentType: "image/png",
    headers: { "access-control-allow-origin": "*" },
  }));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.locator("#world").evaluate(node => {
    Object.assign(node.style, { position: "fixed", inset: "0 auto auto 0", width: "1024px", height: "600px" });
    window.dispatchEvent(new Event("orientationchange"));
  });
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.boardProfile === "wide");

  expect(await page.locator("#worldBackdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
    .toContain("wayfinder-crossroads/compact/base.webp");
  await expect(page.locator(".world-remote-variant")).toHaveCount(1, { timeout: 17_000 });
});

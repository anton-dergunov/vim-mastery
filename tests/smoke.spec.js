import { expect, test } from "@playwright/test";

async function state(page) {
  await page.waitForFunction(() => window.VimWilds?.getState);
  return page.evaluate(() => window.VimWilds.getState());
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
    window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
      introSeen: true,
      completedUnitStoryIds: [],
    }));
    // The opening reference deck has its own suite; keep every other suite on
    // the path a returning learner takes.
    window.localStorage.setItem("vim-wilds.reference.v1", JSON.stringify({ orientationSeen: true }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
});

test("boots a phone activity and accepts the canonical physical Escape", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.locator(".cm-content").focus();
  await page.keyboard.press("Escape");

  expect(await state(page)).toMatchObject({
    complete: true,
    code: ["ready = True"],
    cursor: [0, 7],
    mode: "Complete",
  });
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
    && document.documentElement.scrollHeight <= window.innerHeight
  ))).toBe(true);
});

test("completes a touch Ctrl chord and releases the modifier latch", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=ctrl-bracket-seeded-replace");
  await page.locator('[data-mod="Ctrl"]').first().click();
  await page.locator('.key[data-key="["]').click();

  expect(await state(page)).toMatchObject({
    complete: true,
    cursor: [1, 9],
    mode: "Complete",
    modifiers: [],
  });
});

test("routes help input back to practice and preserves exact canonical completion", async ({ page }) => {
  await page.goto("/play/?unit=repeatable-editing&activity=dot-python-values");
  await page.getByRole("button", { name: "Open hints" }).click();
  await page.keyboard.press("c");
  await expect(page.locator("#helpCard")).not.toHaveClass(/open/);
  expect((await state(page)).history).toEqual(["c"]);

  await page.getByRole("button", { name: "Reset activity" }).click();
  await page.evaluate(() => window.VimWilds.solveCurrent());
  expect(await state(page)).toMatchObject({
    complete: true,
    code: ["east = 'ready'", "west = 'ready'", "north = 'ready'"],
    cursor: [2, 13],
    mode: "Complete",
  });
});

// The touch keyboard acts on pointerdown, and the last key swaps the keyboard
// for the completion panel under the finger. The click from that same tap must
// not land on Next and skip the completion screen.
test.describe("touch completion", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("the tap that completes an exercise does not also press Next", async ({ page }) => {
    const url = "/play/?unit=precision-motions-search&activity=repeat-separator-edit";
    const next = page.locator('.completion-panel [data-action="next"]');
    await page.goto(url);
    await state(page);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    const nextBox = await next.boundingBox();

    await page.goto(url);
    await state(page);
    await page.evaluate(() => ["f", ";", "r", ",", ";"].forEach(key => window.VimWilds.emit(key)));
    const keyBox = await page.locator('.key[data-key="."]').boundingBox();
    const left = Math.max(keyBox.x, nextBox.x);
    const right = Math.min(keyBox.x + keyBox.width, nextBox.x + nextBox.width);
    const top = Math.max(keyBox.y, nextBox.y);
    const bottom = Math.min(keyBox.y + keyBox.height, nextBox.y + nextBox.height);
    // The case only means something while the final key sits under Next.
    expect(right).toBeGreaterThan(left);
    expect(bottom).toBeGreaterThan(top);

    await page.touchscreen.tap((left + right) / 2, (top + bottom) / 2);
    expect(await state(page)).toMatchObject({
      activityId: "repeat-separator-edit",
      complete: true,
      code: ["x=1, y=2, z=3"],
    });
    await expect(page.locator(".completion-panel")).toBeVisible();

    await next.tap();
    expect((await state(page)).activityId).not.toBe("repeat-separator-edit");
  });
});

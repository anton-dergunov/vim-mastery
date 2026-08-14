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

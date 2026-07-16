import { expect, test } from "@playwright/test";
import { lessonFixtures } from "./vim-fixtures.mjs";
import { runNativeVim } from "./native-vim-runner.mjs";

test.describe("CodeMirror Vim conformance", () => {
  for (const fixture of lessonFixtures) {
    test(`virtual keyboard matches native Vim: ${fixture.id}`, async ({ page }) => {
      await page.goto("/");
      const browser = await page.evaluate(({ id, keys }) => {
        const index = window.VimWilds.exercises.findIndex(exercise => exercise.id === id);
        window.VimWilds.goTo(index);
        keys.forEach(key => window.VimWilds.emit(key));
        return window.VimWilds.getState();
      }, fixture);
      const native = runNativeVim(fixture);
      expect(browser.code).toEqual(native.code);
      expect(browser.complete).toBe(true);
    });
  }

  test("physical Ctrl+V keeps a Visual Block and replaces every row", async ({ page }) => {
    await page.goto("/");
    await page.locator(".cm-content").focus();
    await page.keyboard.down("Control");
    await page.keyboard.press("v");
    await page.keyboard.up("Control");
    await page.keyboard.press("3");
    await page.keyboard.press("j");
    await expect.poll(() => page.evaluate(() => window.VimWilds.getState().mode)).toBe("visual-block");
    expect(await page.evaluate(() => window.VimWilds.getState().selection)).toEqual({
      kind: "block",
      from: [0, 25],
      to: [3, 25],
    });
    await page.keyboard.press("r");
    await page.keyboard.press("x");
    expect(await page.evaluate(() => window.VimWilds.getState().complete)).toBe(true);
  });

  test("touch Ctrl+V keeps a Visual Block and replaces every row", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-mod=Ctrl]").first().click();
    await page.locator("[data-key=v]").click();
    await page.locator('[data-key="3"]').click();
    await page.locator("[data-key=j]").click();
    await expect.poll(() => page.evaluate(() => window.VimWilds.getState().mode)).toBe("visual-block");
    await page.locator("[data-key=r]").click();
    await page.locator("[data-key=x]").click();
    expect(await page.evaluate(() => window.VimWilds.getState().complete)).toBe(true);
  });

  test("physical keyboard dot-repeat matches native Vim", async ({ page }) => {
    const fixture = lessonFixtures.find(item => item.id === "mirror-repeat");
    await page.goto("/");
    await page.evaluate(() => window.VimWilds.goTo(4));
    await page.locator(".cm-content").focus();
    for (const key of ["c", "i", "w"]) await page.keyboard.press(key);
    await page.keyboard.type("new");
    await page.keyboard.press("Escape");
    for (const key of ["j", "b", ".", "j", "b", "."]) await page.keyboard.press(key);
    const browser = await page.evaluate(() => window.VimWilds.getState());
    expect(browser.code).toEqual(runNativeVim(fixture).code);
    expect(browser.complete).toBe(true);
  });

  test("success replaces Nix with the transparent WebP and reset restores the idle sprite", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect.poll(() => page.evaluate(() => window.VimWilds.getState().complete)).toBe(true);
    await expect(page.locator(".nix")).toHaveClass(/celebrating/);
    await expect(page.locator(".nix")).toHaveAttribute("src", /assets\/nix-success\.webp$/);

    await page.locator("#resetButton").click();
    await expect(page.locator(".nix")).not.toHaveClass(/celebrating/);
    await expect(page.locator(".nix")).toHaveAttribute("src", /assets\/nix\.png$/);
  });

  test("success WebP retains right-side mirroring", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const rightIndex = window.VimWilds.exercises.findIndex(exercise => exercise.scene.codeSide === "right");
      window.VimWilds.goTo(rightIndex);
      window.VimWilds.solveCurrent();
    });
    await expect(page.locator(".nix.right")).toHaveClass(/celebrating/);
    await expect(page.locator(".nix.right")).toHaveCSS("transform", "matrix(-1, 0, 0, 1, 0, 0)");
  });

  test("reduced-motion users retain the static Nix sprite on success", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect.poll(() => page.evaluate(() => window.VimWilds.getState().complete)).toBe(true);
    await expect(page.locator(".nix")).not.toHaveClass(/celebrating/);
    await expect(page.locator(".nix")).toHaveAttribute("src", /assets\/nix\.png$/);
  });

  test("touch Ctrl+Alt chord retains both modifiers", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-mod=Ctrl]").first().click();
    await page.locator("[data-mod=Alt]").first().click();
    await page.locator("[data-key=d]").click();
    expect(await page.evaluate(() => window.VimWilds.getState().history.at(-1))).toBe("Ctrl+Alt+d");
  });

  test("touch modifier cancellation and physical fallback both reach the engine", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-mod=Ctrl]").first().click();
    await page.locator("[data-mod=Ctrl]").first().click();
    await page.locator("[data-key=d]").click();
    expect(await page.evaluate(() => window.VimWilds.getState().history.at(-1))).toBe("d");

    await page.locator("#resetButton").click();
    await page.keyboard.press("j");
    const state = await page.evaluate(() => window.VimWilds.getState());
    expect(state.history.at(-1)).toBe("j");
    expect(state.cursor[0]).toBe(1);
  });
});

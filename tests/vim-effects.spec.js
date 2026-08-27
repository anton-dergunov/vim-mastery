import { expect, test } from "@playwright/test";

async function openActivity(page, unit, activity) {
  await page.goto(`/?unit=${unit}&activity=${activity}`);
  await page.waitForFunction(() => window.VimWilds?.getEffects && document.querySelector(".cm-editor"));
}

async function emit(page, keys) {
  await page.evaluate(tokens => tokens.forEach(token => window.VimWilds.emit(token)), keys);
}

async function effects(page) {
  return page.evaluate(() => window.VimWilds.getEffects());
}

test.describe("Semantic Vim effects", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      if (!window.localStorage.getItem("vim-wilds.session.v1")) {
        window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
      }
      if (!window.localStorage.getItem("vim-wilds.story.v1")) {
        window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
          introSeen: true,
          completedUnitStoryIds: [],
        }));
      }
    });
  });

  test("emits exact core ranges for operators, text objects, selections, yanks, puts, and dot", async ({ page }) => {
    await openActivity(page, "operator-grammar", "delete-motion-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await effects(page)).at(-1)).toMatchObject({
      type: "range-change",
      operation: "delete",
      ranges: [{ from: [0, 6], to: [0, 12] }],
      source: "demo",
    });

    await openActivity(page, "text-objects", "integration-delete-arguments");
    await emit(page, ["d", "i", "("]);
    expect((await effects(page)).at(-1)).toMatchObject({
      type: "range-change",
      operation: "delete",
      ranges: [{ from: [0, 7], to: [0, 18] }],
      source: "lesson",
    });

    const selectionCases = [
      ["select-character-range", ["v", "e"], "character"],
      ["select-line-range", ["V", "j"], "line"],
      ["select-block-range", ["Ctrl-v", "2", "j"], "block"],
    ];
    for (const [activity, keys, selectionKind] of selectionCases) {
      await openActivity(page, "visual-selection", activity);
      await emit(page, keys);
      const event = (await effects(page)).at(-1);
      expect(event).toMatchObject({ type: "selection", selectionKind });
      await expect(page.locator(`.cm-effect-selection-${selectionKind}`)).not.toHaveCount(0);
    }

    await openActivity(page, "registers-putting", "explicit-unnamed-put");
    await emit(page, ["y", "y"]);
    expect((await effects(page)).at(-1)).toMatchObject({
      type: "capture",
      operation: "yank",
      ranges: [{ from: [0, 0], to: [1, 0] }],
    });
    await emit(page, ["G", '"', '"', "p"]);
    const put = (await effects(page)).at(-1);
    expect(put).toMatchObject({ type: "materialize", operation: "put" });
    expect(put.changes[0].insertedText).toContain("INFO cache warm");

    await openActivity(page, "repeatable-editing", "dot-append-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    const repeats = (await effects(page)).filter(event => event.operation === "dot");
    expect(repeats).toHaveLength(2);
    expect(repeats.every(event => event.type === "repeat" && event.duration < 220)).toBe(true);
  });

  test("emits search, substitution, macro, jump, undo, and redo vocabulary", async ({ page }) => {
    await openActivity(page, "precision-motions-search", "search-forward-timeout");
    await emit(page, ["/", ..."timeout", "Enter"]);
    const search = (await effects(page)).at(-1);
    expect(search).toMatchObject({
      type: "matches",
      phase: "search",
      activeRange: { from: [1, 0], to: [1, 7] },
    });
    expect(search.ranges).toEqual([
      { from: [1, 0], to: [1, 7] },
      { from: [3, 0], to: [3, 7] },
    ]);

    await openActivity(page, "substitution-practical-regex", "global-flag-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    const substitute = (await effects(page)).at(-1);
    expect(substitute).toMatchObject({ type: "matches", operation: "substitute", phase: "substitute" });
    expect(substitute.ranges).toEqual([
      { from: [0, 0], to: [0, 4] },
      { from: [0, 5], to: [0, 9] },
      { from: [0, 10], to: [0, 14] },
    ]);

    await openActivity(page, "global-normal-automation", "global-delete-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    const globalDelete = (await effects(page)).at(-1);
    expect(globalDelete).toMatchObject({ type: "matches", phase: "global", operation: null });
    expect(globalDelete.ranges).toEqual([
      { from: [1, 0], to: [2, 0] },
      { from: [4, 0], to: [5, 0] },
      { from: [7, 0], to: [8, 0] },
      { from: [10, 0], to: [11, 0] },
      { from: [13, 0], to: [14, 0] },
      { from: [16, 0], to: [17, 0] },
    ]);

    await openActivity(page, "macros", "beacon-macro-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    const macroEvents = (await effects(page)).filter(event => event.operation === "macro");
    expect(macroEvents.some(event => event.phase === "record-start")).toBe(true);
    expect(macroEvents.some(event => event.phase === "record-stop")).toBe(true);
    expect(macroEvents.filter(event => event.phase === "replay")).toHaveLength(2);
    expect(macroEvents.filter(event => event.phase === "replay").every(event => event.type === "repeat" && event.replayType === "materialize")).toBe(true);

    await openActivity(page, "long-range-navigation", "mark-exact-isolate");
    await emit(page, ["`", "a"]);
    expect((await effects(page)).at(-1)).toMatchObject({
      type: "jump",
      phase: "trace",
      trace: { from: [12, 0], to: [4, 9] },
    });

    await openActivity(page, "entering-changing-text", "undo-redo-demo");
    for (let index = 0; index < 4; index += 1) await page.getByRole("button", { name: "Step" }).click();
    expect((await effects(page)).at(-1)).toMatchObject({ type: "rewind", direction: "undo" });
    await page.getByRole("button", { name: "Step" }).click();
    expect((await effects(page)).at(-1)).toMatchObject({ type: "rewind", direction: "redo" });
  });

  test("uses reduced-motion range color and clears effects on help, reset, and navigation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openActivity(page, "visual-selection", "select-character-range");
    await emit(page, ["v", "e"]);
    expect((await effects(page)).at(-1)).toMatchObject({ type: "selection", reducedMotion: true });

    await page.getByRole("button", { name: "Open hints" }).click();
    await expect(page.locator(".cm-effect-selection")).toHaveCount(0);

    await page.getByRole("button", { name: "Close help" }).click();
    await emit(page, ["v", "e"]);
    await page.getByRole("button", { name: "Reset activity" }).click();
    await expect(page.locator(".cm-effect-selection, .cm-effect-transient")).toHaveCount(0);
    expect(await effects(page)).toEqual([]);

    await emit(page, ["v"]);
    await page.evaluate(() => window.VimWilds.goToActivity(0));
    await expect(page.locator(".cm-effect-selection, .cm-effect-transient")).toHaveCount(0);
  });

  test("enables effects by default and persists the disabled setting", async ({ page }) => {
    await openActivity(page, "visual-selection", "select-character-range");
    expect(await page.evaluate(() => window.VimWilds.getState().vimEffects)).toBe("enabled");

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page.getByLabel("Enable effects")).toBeChecked();
    await page.getByLabel("Disable effects").check();
    await page.getByRole("button", { name: "Close settings" }).click();

    await emit(page, ["v", "e"]);
    expect((await effects(page)).at(-1)).toMatchObject({ type: "selection", selectionKind: "character" });
    await expect(page.locator(".cm-effect-selection, .cm-effect-transient")).toHaveCount(0);

    await page.reload();
    await page.waitForFunction(() => window.VimWilds?.getEffects && document.querySelector(".cm-editor"));
    expect(await page.evaluate(() => window.VimWilds.getState().vimEffects)).toBe("disabled");
    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page.getByLabel("Disable effects")).toBeChecked();

    await page.getByLabel("Enable effects").check();
    await page.getByRole("button", { name: "Close settings" }).click();
    await emit(page, ["v", "e"]);
    await expect(page.locator(".cm-effect-selection-character")).not.toHaveCount(0);
  });
});

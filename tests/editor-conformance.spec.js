import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const unit = JSON.parse(readFileSync(new URL("../content/units/10-repeatable-editing.json", import.meta.url), "utf8"));
const modalUnit = JSON.parse(readFileSync(new URL("../content/units/01-modal-model.json", import.meta.url), "utf8"));
const cursorUnit = JSON.parse(readFileSync(new URL("../content/units/02-cursor-movement.json", import.meta.url), "utf8"));
const changingUnit = JSON.parse(readFileSync(new URL("../content/units/03-entering-changing-text.json", import.meta.url), "utf8"));
const authoredActivities = unit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const authoredExercises = authoredActivities.filter(activity => activity.type === "exercise");
const cursorActivities = cursorUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const cursorExercises = cursorActivities.filter(activity => activity.type === "exercise");
const changingActivities = changingUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const changingExercises = changingActivities.filter(activity => activity.type === "exercise");
const successAnimation = readFileSync(new URL("../assets/characters/nix/animations/joyful-hop.webp", import.meta.url));
const keysFor = activity => activity.script?.steps.map(step => typeof step === "string" ? step : step.key) || [];
const indexOf = id => authoredActivities.findIndex(activity => activity.id === id);

async function state(page) {
  await page.waitForFunction(() => window.VimWilds?.getState);
  return page.evaluate(() => window.VimWilds.getState());
}

test.describe("Production lesson flow", () => {
  test.beforeEach(({ page }) => {
    const goto = page.goto.bind(page);
    Object.defineProperty(page, "goto", {
      configurable: true,
      value: async (url, options) => {
        const response = await goto(url, options);
        if (url !== "/") {
          await page.waitForFunction(() => window.VimWilds?.getState && document.querySelector("#worldGrid")?.childElementCount > 0);
        }
        return response;
      },
    });
  });

  test("introduces the installable game at the root route", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The Vim Wilds" })).toBeVisible();
    await expect(page.getByRole("link", { name: /start or continue practice/i })).toHaveAttribute("href", "./play/");
    await expect(page.locator("#appVersion")).toContainText("Build 0.1.0-dev.");
  });

  test("selects iPhone and iPad Safari instructions, including desktop-mode iPads", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15" });
      Object.defineProperty(navigator, "platform", { configurable: true, get: () => "MacIntel" });
      Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 5 });
    });
    await page.goto("/");
    await expect(page.locator("#install-ios-tab")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#install-ios-panel")).toBeVisible();
    await expect(page.locator("#install-ios-panel")).toContainText("Add to Home Screen");
    await page.locator("#install-other-tab").click();
    await expect(page.locator("#install-other-tab")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#install-other-panel")).toBeVisible();
    await expect(page.locator("#install-ios-panel")).toBeHidden();
  });

  test("selects Android instructions and supports keyboard-accessible install tabs", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0" });
    });
    await page.goto("/");
    await expect(page.locator("#install-android-tab")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#install-android-panel")).toContainText("Install app");
    await page.locator("#install-android-tab").press("ArrowLeft");
    await expect(page.locator("#install-ios-tab")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#install-ios-tab")).toBeFocused();
  });

  test("uses the polished UI as the only route and derives 70 runtime activities", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    const runtime = await page.evaluate(() => ({
      activityCount: window.VimWilds.activities.length,
      exerciseCount: window.VimWilds.exercises.length,
      state: window.VimWilds.getState(),
      legacy: document.querySelectorAll(".legacy-only, #activitySelect, #commandTray").length,
    }));
    expect(runtime.activityCount).toBe(70);
    expect(runtime.exerciseCount).toBe(authoredExercises.length);
    expect(runtime.state).toMatchObject({ activityId: "dot-python-values", practiceMode: "guided", sourceActivityId: "dot-python-values" });
    expect(runtime.legacy).toBe(0);
    await page.goto("/?unit=repeatable-editing&ui=next&activity=dot-python-values-recall");
    expect((await state(page))).toMatchObject({ activityId: "dot-python-values-recall", practiceMode: "recall", exerciseId: "dot-python-values" });
    await page.evaluate(() => window.VimWilds.goTo(0));
    expect((await state(page))).toMatchObject({ activityId: authoredExercises[0].id, practiceMode: "guided" });
  });

  test("keeps every theory card and opens its demo only from the final card", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-is-a-change");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    expect((await state(page)).activityId).toBe("dot-change-boundary");
    await expect(page.getByRole("button", { name: /show example/i })).toBeVisible();
    await page.getByRole("button", { name: /show example/i }).click();
    expect((await state(page)).activityId).toBe("dot-append-demo");
  });

  test("renders the unit table of contents with Guided and Recall pairs", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.getByRole("button", { name: "Open table of contents" }).click();
    await expect(page.locator(".toc-unit")).toHaveCount(4);
    await expect(page.locator(".toc-lesson")).toHaveCount(unit.lessons.length);
    await expect(page.locator(".toc-activity")).toHaveCount(70);
    await expect(page.locator(".activity-type.type-guided").first()).toHaveText("guided");
    await expect(page.locator(".activity-type.type-recall").first()).toHaveText("recall");
    const badgeColors = await page.evaluate(() => ({
      demo: getComputedStyle(document.querySelector(".activity-type.type-demo")).color,
      recall: getComputedStyle(document.querySelector(".activity-type.type-recall")).color,
    }));
    expect(badgeColors.demo).toBe("rgb(202, 183, 255)");
    expect(badgeColors.recall).toBe("rgb(243, 154, 195)");
    await page.locator('[data-activity-index="6"]').click();
    expect((await state(page))).toMatchObject({ activityId: "dot-python-values-recall", practiceMode: "recall" });
  });

  test("starts at Unit 1 and exposes all numbered units through the course contents", async ({ page }) => {
    await page.goto("/play/");
    expect((await state(page))).toMatchObject({ unitId: "modal-model", unitNumber: 1, activityId: "welcome-to-modal-vim" });
    const catalog = await page.evaluate(() => ({ unit: window.VimWilds.unit, units: window.VimWilds.units }));
    expect(catalog.units).toEqual([
      { id: "modal-model", unitNumber: 1, title: "The modal model" },
      { id: "cursor-movement", unitNumber: 2, title: "Cursor movement" },
      { id: "entering-changing-text", unitNumber: 3, title: "Entering and changing text" },
      { id: "repeatable-editing", unitNumber: 10, title: "Repeatable editing" },
    ]);
    await page.getByRole("button", { name: "Open table of contents" }).click();
    await expect(page.locator(".toc-unit")).toHaveCount(4);
    await expect(page.locator('[data-unit-id="cursor-movement"]')).toContainText("Unit 2");
    await expect(page.locator('[data-unit-id="repeatable-editing"]')).toContainText("Unit 10");
  });

  test("routes confident learners into the recall-only quick check", async ({ page }) => {
    await page.goto("/play/");
    await page.getByRole("button", { name: "Take quick check" }).click();
    expect((await state(page))).toMatchObject({ activityId: "quick-exit-insert-recall", practiceMode: "recall", mode: "insert", history: [] });
    await page.evaluate(() => window.VimWilds.emit("Escape"));
    expect((await state(page))).toMatchObject({ complete: true, mode: "Complete", code: ["ready = True"], cursor: [0, 7] });

    await page.goto("/?activity=quick-exit-insert");
    expect((await state(page))).toMatchObject({ activityId: "quick-exit-insert-recall", practiceMode: "recall", mode: "insert" });
  });

  test("seeds modes without history, resets them exactly, and exposes Operator-pending", async ({ page }) => {
    await page.goto("/?activity=escape-seeded-insert");
    expect((await state(page))).toMatchObject({ mode: "insert", cursor: [0, 6], history: [] });
    const insertCursor = await page.locator(".cm-cursor").evaluate(node => ({
      border: getComputedStyle(node).borderLeftWidth,
      background: getComputedStyle(node).backgroundColor,
    }));
    expect(insertCursor).toEqual({ border: "2px", background: "rgba(0, 0, 0, 0)" });
    await page.evaluate(() => window.VimWilds.emit("Escape"));
    expect((await state(page))).toMatchObject({ complete: true, cursor: [0, 5] });
    await page.getByRole("button", { name: "Reset activity" }).click();
    expect((await state(page))).toMatchObject({ mode: "insert", cursor: [0, 6], history: [], complete: false });

    await page.goto("/?activity=escape-seeded-operator");
    expect((await state(page))).toMatchObject({ mode: "operator-pending", history: [] });
    await expect(page.locator("#nextModePill")).toHaveText("Op-pending");
    await page.evaluate(() => window.VimWilds.emit("Escape"));
    expect((await state(page))).toMatchObject({ complete: true, code: ["timeout := 30", "start(timeout)"] });

    await page.goto("/?activity=ctrl-bracket-seeded-replace");
    expect((await state(page))).toMatchObject({ mode: "replace", history: [] });
    await expect(page.locator(".cm-cursor")).toHaveCSS("background-image", /linear-gradient/);
    await expect(page.locator(".cm-fat-cursor")).toHaveCSS("display", "none");

    await page.goto("/?activity=escape-seeded-command-line");
    expect((await state(page))).toMatchObject({ mode: "command-line", history: [] });
    await expect(page.locator(".cm-vim-panel")).toContainText(":");
    await expect(page.locator(".cm-vim-panel input")).toHaveAttribute("inputmode", "none");
    await expect(page.locator(".cm-vim-panel input")).toHaveAttribute("readonly", "");
    await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
    await page.evaluate(() => window.VimWilds.emit("Escape"));
    expect((await state(page))).toMatchObject({ complete: true, mode: "Complete", history: ["Escape"] });
    await expect(page.locator(".cm-vim-panel")).toHaveCount(0);
  });

  test("supports the mode compass, masked inspections, range reveal, and command assembly", async ({ page }) => {
    await page.goto("/?activity=mode-compass");
    await expect(page.locator(".mode-compass .mode-spoke")).toHaveCount(7);
    await expect(page.locator(".mode-home")).toContainText("Normal");

    await page.goto("/?activity=identify-insert-mode");
    await expect(page.locator("#nextModePill")).toHaveText("Identify");
    await page.locator('[data-choice="normal-answer"]').click();
    await expect(page.getByRole("button", { name: "Review this idea" })).toBeVisible();
    await expect(page.locator("#nextModePill")).toHaveText("Identify");
    await page.getByRole("button", { name: "Review this idea" }).click();
    expect((await state(page)).activityId).toBe("mode-compass");
    await page.getByRole("button", { name: "Back to quick check" }).click();
    expect((await state(page))).toMatchObject({ activityId: "identify-insert-mode", complete: false, mode: "insert" });
    await expect(page.locator(".choice-option.selected")).toHaveCount(0);
    await page.locator('[data-choice="insert-answer"]').click();
    await expect(page.locator("#nextModePill")).toHaveText("Insert");

    await page.goto("/?activity=predict-two-delete-words");
    await expect(page.locator(".cm-preview-range")).toHaveCount(0);
    await page.locator('[data-choice="range-two-words"]').click();
    await expect(page.locator(".cm-preview-range")).toHaveCount(1);

    await page.goto("/?activity=command-grammar-forge");
    await expect(page.locator(".command-forge .forge-part")).toHaveCount(3);
    await page.goto("/?activity=two-delete-words-demo");
    await page.getByRole("button", { name: "Step" }).click();
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).mode).toBe("operator-pending");
    await expect(page.locator(".assembly-part.active")).toHaveCount(2);
  });

  test("holds intermediate Unit 1 demo modes long enough to read", async ({ page }) => {
    await page.goto("/?activity=insert-return-demo");
    await page.getByRole("button", { name: "Play" }).click();
    await page.waitForTimeout(650);
    expect((await state(page))).toMatchObject({ playbackStep: 1, mode: "insert" });
    await page.waitForTimeout(700);
    expect((await state(page))).toMatchObject({ playbackStep: 2, mode: "normal" });
  });

  test("returns recall remediation to a clean quick-check retry", async ({ page }) => {
    await page.goto("/?activity=quick-exit-insert");
    await page.evaluate(() => {
      window.VimWilds.emit("x");
      window.VimWilds.emit("x");
      window.VimWilds.emit("x");
    });
    await page.getByRole("button", { name: "Review this idea" }).click();
    expect((await state(page)).activityId).toBe("mode-compass");
    await page.getByRole("button", { name: "Back to quick check" }).click();
    expect((await state(page))).toMatchObject({
      activityId: "quick-exit-insert-recall",
      practiceMode: "recall",
      mode: "insert",
      history: [],
      complete: false,
    });
  });

  test("continues from Unit 1 to Unit 2 instead of skipping the sequence", async ({ page }) => {
    await page.goto("/?activity=modal-model-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 2" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review the full introduction" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 2" }).click();
    await page.waitForURL(/unit=cursor-movement/);
    expect((await state(page))).toMatchObject({ unitId: "cursor-movement", unitNumber: 2, activityId: "home-row-directions" });
  });

  test("runs every Unit 2 movement and continues to Unit 3", async ({ page }) => {
    await page.goto("/?unit=cursor-movement");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 58, exerciseCount: cursorExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        if (activity.type === "exercise" && !current.complete) result.push({ id: activity.id, current });
        if (activity.type === "demo" && (JSON.stringify(current.code) !== JSON.stringify(activity.scenario.target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(activity.scenario.target.cursor))) result.push({ id: activity.id, current });
      }
      return result;
    });
    expect(failures).toEqual([]);
    await page.goto("/?unit=cursor-movement&activity=cursor-movement-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 3" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 3" }).click();
    await page.waitForURL(/unit=entering-changing-text/);
    expect((await state(page))).toMatchObject({ unitId: "entering-changing-text", unitNumber: 3, activityId: "entry-point-meanings" });
  });

  test("runs every Unit 3 local change and leaves Unit 4 as the next unavailable unit", async ({ page }) => {
    await page.goto("/?unit=entering-changing-text");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 72, exerciseCount: changingExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        if (activity.type === "exercise" && !current.complete) result.push({ id: activity.id, current });
        if (activity.type === "demo" && (JSON.stringify(current.code) !== JSON.stringify(activity.scenario.target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(activity.scenario.target.cursor))) result.push({ id: activity.id, current });
      }
      return result;
    });
    expect(failures).toEqual([]);
    await page.goto("/?unit=entering-changing-text&activity=entering-changing-text-unit-summary");
    await expect(page.locator(".unit-coming-soon")).toContainText("Unit 4 is next");
  });

  test("overwrites in Replace mode and groups complete changes for undo and redo", async ({ page }) => {
    await page.goto("/?unit=entering-changing-text&activity=replace-word-demo");
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page))).toMatchObject({ mode: "replace", code: ["mode = oldxx"], cursor: [0, 7] });
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page))).toMatchObject({ code: ["mode = draft"], cursor: [0, 11] });

    await page.goto("/?unit=entering-changing-text&activity=undo-redo-demo");
    for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).code).toEqual(["const ready = true;"]);
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).code).toEqual(["const ready = true"]);
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).code).toEqual(["const ready = true;"]);
  });

  test("enters Unit 3 Ctrl chords through touch and physical keyboards", async ({ page }) => {
    await page.goto("/?unit=entering-changing-text&activity=increment-version-number-recall");
    await page.locator('[data-mod="Ctrl"]').click();
    await page.locator('.key[data-key="a"]').click();
    expect((await state(page))).toMatchObject({ complete: true, code: ["version = 20"], modifiers: [] });
    await page.goto("/?unit=entering-changing-text&activity=increment-version-number");
    await page.locator(".cm-content").focus();
    await page.keyboard.press("Control+a");
    expect((await state(page))).toMatchObject({ complete: true, code: ["version = 20"] });

    await page.goto("/?unit=entering-changing-text&activity=decrement-retry-count-recall");
    await page.locator('.key[data-key="2"]').click();
    await page.locator('[data-mod="Ctrl"]').click();
    await page.locator('.key[data-key="x"]').click();
    expect((await state(page))).toMatchObject({ complete: true, code: ["retries = 3"], modifiers: [] });
    await page.goto("/?unit=entering-changing-text&activity=decrement-retry-count");
    await page.locator(".cm-content").focus();
    await page.evaluate(() => window.VimWilds.emit("2"));
    await page.keyboard.press("Control+x");
    expect((await state(page))).toMatchObject({ complete: true, code: ["retries = 3"] });

    await page.goto("/?unit=entering-changing-text&activity=redo-substitution-recall");
    for (const key of ["s", "r", "Escape", "u"]) await page.evaluate(token => window.VimWilds.emit(token), key);
    await page.locator('[data-mod="Ctrl"]').click();
    await page.locator('.key[data-key="r"]').click();
    await expect.poll(() => state(page)).toMatchObject({ complete: true, code: ["frog"], modifiers: [] });
    await page.goto("/?unit=entering-changing-text&activity=redo-substitution");
    await page.locator(".cm-content").focus();
    for (const key of ["s", "r", "Escape", "u"]) await page.evaluate(token => window.VimWilds.emit(token), key);
    await page.keyboard.press("Control+r");
    await expect.poll(() => state(page)).toMatchObject({ complete: true, code: ["frog"], modifiers: [] });
  });

  test("visualizes whitespace only where Unit 3 compares J with gJ", async ({ page }) => {
    await page.goto("/?unit=entering-changing-text&activity=join-spacing-demo");
    await expect(page.locator(".cm-highlightSpace")).toHaveCount(9);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page)).code).toEqual(["const left = first;", "const right =   second;"]);

    await page.goto("/?unit=entering-changing-text&activity=join-aqueduct");
    await expect(page.locator(".cm-highlightSpace")).toHaveCount(0);
  });

  test("keeps wrapped display-line motions deterministic at every target phone width", async ({ page }) => {
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]];
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/?unit=cursor-movement&activity=display-lines-demo");
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.evaluate(() => window.VimWilds.solveCurrent());
      expect((await state(page)).cursor, `${width}×${height}`).toEqual([1, 29]);
    }
  });

  test("enters g_ and counted | through touch Shift chords", async ({ page }) => {
    await page.goto("/?unit=cursor-movement&activity=last-nonblank-result");
    await page.locator('.key[data-key="g"]').click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="-"]').click();
    expect((await state(page))).toMatchObject({ complete: true, cursor: [0, 17], modifiers: [] });

    await page.goto("/?unit=cursor-movement&activity=counted-last-nonblank-column");
    for (const key of ["3", "g"]) await page.locator(`.key[data-key="${key}"]`).click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="-"]').click();
    await page.locator('.key[data-key="8"]').click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-shift="|"]').click();
    expect((await state(page))).toMatchObject({ complete: true, cursor: [2, 7], modifiers: [] });
  });

  test("makes g_ visibly distinct from the physical line end", async ({ page }) => {
    await page.goto("/?unit=cursor-movement&activity=line-landmarks-demo");
    const step = () => page.locator('.demo-controls [data-action="step"]').click();
    await step();
    await step();
    await step();
    expect((await state(page)).cursor).toEqual([0, 20]);
    await expect(page.locator(".cm-highlightSpace")).toHaveCount(7);

    await step();
    await step();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect((await state(page)).cursor).toEqual([0, 17]);
    const cursorPosition = await page.locator(".cm-vimCursorLayer .cm-fat-cursor").evaluate(node => {
      const { left, right } = node.getBoundingClientRect();
      return { left, right, character: node.textContent };
    });
    const trailingPosition = await page.locator(".cm-highlightSpace").last().evaluate(node => {
      const { left, right } = node.getBoundingClientRect();
      return { left, right };
    });
    expect(cursorPosition.character).toBe(")");
    expect(cursorPosition.right).toBeLessThanOrEqual(trailingPosition.left);
  });

  test("forms physical Shift symbol chords without the native editor input", async ({ page }) => {
    await page.goto("/?unit=cursor-movement&activity=last-nonblank-result");
    await page.locator(".cm-content").focus();
    await page.keyboard.press("g");
    await page.keyboard.down("Shift");
    await page.keyboard.press("-");
    await page.keyboard.up("Shift");
    expect((await state(page))).toMatchObject({ complete: true, cursor: [0, 17], history: ["g", "_"] });
    await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
  });

  test("completes every Unit 1 runnable with its authored sequence", async ({ page }) => {
    await page.goto("/play/");
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const state = window.VimWilds.getState();
        if (activity.type === "exercise" && !state.complete) result.push({ id: activity.id, state });
        if (activity.type === "demo" && (JSON.stringify(state.code) !== JSON.stringify(activity.scenario.target.lines)
          || JSON.stringify(state.cursor) !== JSON.stringify(activity.scenario.target.cursor))) result.push({ id: activity.id, state });
      }
      return result;
    });
    expect(failures).toEqual([]);
  });

  test("forms Ctrl-[ through the touch modifier latch and clears the latch", async ({ page }) => {
    await page.goto("/?activity=ctrl-bracket-seeded-replace");
    await page.locator('[data-mod="Ctrl"]').first().click();
    await page.locator('.key[data-key="["]').click();
    expect((await state(page))).toMatchObject({ complete: true, cursor: [1, 9], modifiers: [] });
  });

  test("keeps demo controls below the slab and preserves Play, Pause, Reset, Step, and Next", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-append-demo");
    const placement = await page.evaluate(() => {
      const slab = document.querySelector(".next-code-slab").getBoundingClientRect();
      const controls = document.querySelector(".demo-controls").getBoundingClientRect();
      return { slabBottom: slab.bottom, controlsTop: controls.top };
    });
    expect(placement.controlsTop).toBeGreaterThanOrEqual(placement.slabBottom);
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).playbackStep).toBe(1);
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Step" })).toBeEnabled();
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    expect((await state(page)).playbackStep).toBe(0);
    await page.getByRole("button", { name: "Next" }).click();
    expect((await state(page)).activityId).toBe("dot-python-values");
  });

  test("completes every guided and recall practice with the canonical authored sequence", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing");
    for (const activity of [...authoredExercises, ...authoredExercises.map(exercise => ({ ...exercise, id: `${exercise.id}-recall` }))]) {
      const result = await page.evaluate(({ id, keys }) => {
        const index = window.VimWilds.activities.findIndex(item => item.id === id);
        window.VimWilds.goToActivity(index);
        keys.forEach(key => window.VimWilds.emit(key));
        return window.VimWilds.getState();
      }, { id: activity.id, keys: keysFor(activity) });
      expect(result, activity.id).toMatchObject({
        complete: true,
        code: activity.scenario.target.lines,
        cursor: activity.scenario.target.cursor,
        exerciseId: activity.id.replace(/-recall$/, ""),
      });
    }
  });

  test("reveals hints progressively and resets only on reset or navigation", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.getByRole("button", { name: "Open hints" }).click();
    await expect(page.locator(".hint-step")).toHaveCount(1);
    await page.getByRole("button", { name: "Close help" }).click();
    await page.getByRole("button", { name: "Open hints" }).click();
    await expect(page.locator(".hint-step")).toHaveCount(2);
    await expect(page.locator(".hint-step small code").first()).toHaveText("ci'");
    const inlineColors = await page.evaluate(() => ({
      hint: getComputedStyle(document.querySelector(".hint-step small code")).color,
      instruction: getComputedStyle(document.querySelector("#activityInstruction code")).color,
    }));
    expect(inlineColors.hint).toBe("rgb(102, 86, 61)");
    expect(inlineColors.instruction).toBe("rgb(248, 231, 173)");
    await page.getByRole("button", { name: "Close help" }).click();
    await page.getByRole("button", { name: "Open hints" }).click();
    await expect(page.locator(".hint-step")).toHaveCount(3);
    await page.getByRole("button", { name: "Close help" }).click();
    await page.getByRole("button", { name: "Reset activity" }).click();
    await page.getByRole("button", { name: "Open hints" }).click();
    await expect(page.locator(".hint-step")).toHaveCount(1);
  });

  test("returns physical keyboard focus to practice after opening or closing Help", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.getByRole("button", { name: "Open hints" }).click();
    await page.keyboard.press("c");
    expect((await state(page)).history).toEqual(["c"]);
    await expect(page.locator("#helpCard")).not.toHaveClass(/open/);
    await page.getByRole("button", { name: "Open hints" }).click();
    await page.getByRole("button", { name: "Close help" }).click();
    await page.keyboard.press("i");
    expect((await state(page)).history).toEqual(["c", "i"]);
  });

  test("formats authored inline code and gives guided and recall mistakes distinct feedback", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await expect(page.locator("#activityInstruction code")).toHaveText(["draft", "ready"]);
    await page.evaluate(() => window.VimWilds.emit("x"));
    await expect(page.locator(".status-key")).toHaveClass(/error/);
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values-recall");
    await expect(page.locator(".status-primary")).toHaveText("Recall");
    await page.evaluate(() => window.VimWilds.emit("x"));
    await expect(page.locator(".status-primary")).toHaveText("Try");
    await page.evaluate(() => window.VimWilds.emit("x"));
    await page.evaluate(() => window.VimWilds.emit("x"));
    await expect(page.locator(".status-primary")).toHaveText("Next");
    await expect(page.locator(".status-key .command-key")).toHaveText("c");
  });

  test("shows characters only for practice and choices, with stable practice celebrations", async ({ page }) => {
    await page.route("https://raw.githubusercontent.com/anton-dergunov/vim-mastery/**", route => route.fulfill({
      contentType: "image/webp",
      body: successAnimation,
    }));
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.waitForFunction(() => document.documentElement.dataset.charactersReady === "true");
    await page.waitForTimeout(120);
    const guidedCharacter = await page.locator(".nix").evaluate(node => ({ character: node.dataset.character, animation: node.dataset.animation }));
    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "dot-python-values-recall")));
    await page.waitForFunction(() => document.querySelector(".nix")?.dataset.character);
    const recallCharacter = await page.locator(".nix").evaluate(node => ({ character: node.dataset.character, animation: node.dataset.animation }));
    expect(recallCharacter).toEqual(guidedCharacter);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator('.nix.celebrating[src^="blob:"]')).toBeVisible();
    for (const id of ["dot-is-a-change", "dot-append-demo", "repeat-unit-summary"]) {
      await page.evaluate(activityId => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === activityId)), id);
      await expect(page.locator(".nix")).toHaveCount(0);
    }
    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "repeat-is-wrong-choice")));
    await expect(page.locator(".nix")).toHaveCount(1);
    await page.waitForTimeout(120);
    const correctOptionId = await page.evaluate(() => window.VimWilds.activities.find(activity => activity.id === "repeat-is-wrong-choice").correctOptionId);
    await page.locator(`[data-choice="${correctOptionId}"]`).click();
    await expect(page.locator('.nix.celebrating[src^="blob:"]')).toBeVisible();
  });

  test("keeps the local idle character when remote celebration media is unavailable", async ({ page }) => {
    await page.route("https://raw.githubusercontent.com/anton-dergunov/vim-mastery/**", route => route.abort());
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator(".nix.celebrating")).toHaveCount(0);
    await expect(page.locator('.nix[src*="assets/characters/"]')).toBeVisible();
  });

  test("preserves settings, pointer locking, and compact completion geometry", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByLabel("Hall of Mirrors").check();
    await expect(page.locator("#world")).toHaveClass(/theme-glass/);
    await page.getByRole("button", { name: "Close settings" }).click();
    const before = await state(page);
    const box = await page.locator(".cm-scroller").boundingBox();
    await page.mouse.click(box.x + box.width - 10, box.y + 16);
    expect((await state(page)).cursor).toEqual(before.cursor);
    const keyboardHeight = await page.locator(".keyboard-panel").evaluate(node => node.getBoundingClientRect().height);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator(".keyboard")).toHaveCSS("visibility", "hidden");
    const geometry = await page.evaluate(() => ({
      panel: document.querySelector(".keyboard-panel").getBoundingClientRect().height,
      completion: document.querySelector(".completion-panel").getBoundingClientRect().height,
      keyboard: document.querySelector(".keyboard").getBoundingClientRect().height,
      next: document.querySelector(".completion-panel button").getBoundingClientRect().toJSON(),
    }));
    expect(geometry.panel).toBeCloseTo(keyboardHeight, 0);
    expect(geometry.completion).toBeCloseTo(geometry.keyboard, 0);
    expect(geometry.next.height).toBe(44);
    expect(geometry.next.width).toBeLessThanOrEqual(104);
  });

  test("keeps physical input gated, every demo canonical, and choice navigation intact", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-go-booleans");
    const exercise = authoredActivities.find(activity => activity.id === "dot-go-booleans");
    await page.locator(".cm-content").focus();
    await page.keyboard.press("x");
    expect((await state(page)).history).toEqual([]);
    await page.keyboard.press("c");
    expect((await state(page)).history).toEqual(["c"]);
    await page.evaluate(keys => keys.slice(1).forEach(key => window.VimWilds.emit(key)), keysFor(exercise));
    expect((await state(page)).complete).toBe(true);

    for (const demo of authoredActivities.filter(activity => activity.type === "demo")) {
      const result = await page.evaluate(id => {
        window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === id));
        window.VimWilds.solveCurrent();
        return window.VimWilds.getState();
      }, demo.id);
      expect(result.playbackStep, demo.id).toBe(keysFor(demo).length);
      expect(result.code, demo.id).toEqual(demo.scenario.target.lines);
      expect(result.cursor, demo.id).toEqual(demo.scenario.target.cursor);
    }

    const choice = authoredActivities.find(activity => activity.type === "choice");
    await page.evaluate(id => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === id)), choice.id);
    const wrong = choice.options.find(option => option.id !== choice.correctOptionId);
    const correct = choice.options.find(option => option.id === choice.correctOptionId);
    await page.locator(`[data-choice="${wrong.id}"]`).click();
    expect((await state(page)).complete).toBe(false);
    await page.locator(`[data-choice="${correct.id}"]`).click();
    expect((await state(page)).complete).toBe(true);
    await page.getByRole("button", { name: "Next" }).click();
    expect((await state(page)).activityType).toBe("summary");
  });

  test("keeps the complete contents dialog scrollable and persists a selected theme", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.getByRole("button", { name: "Open table of contents" }).click();
    const finalLesson = page.locator(".toc-lesson").last();
    await finalLesson.locator("summary").click();
    await page.locator(".toc-activity").last().scrollIntoViewIfNeeded();
    await page.locator("#tocLessons").evaluate(node => { node.scrollTop = node.scrollHeight; });
    const geometry = await page.evaluate(() => {
      const body = document.querySelector("#tocLessons");
      const unit = document.querySelector(".toc-unit");
      const last = document.querySelector(".toc-lesson:last-child .toc-activity:last-child");
      return { scrolls: body.scrollHeight > body.clientHeight, bodyBottom: body.getBoundingClientRect().bottom, unitBottom: unit.getBoundingClientRect().bottom, lastBottom: last.getBoundingClientRect().bottom };
    });
    expect(geometry.scrolls).toBe(true);
    expect(geometry.lastBottom).toBeLessThanOrEqual(geometry.bodyBottom + 1);
    expect(geometry.unitBottom).toBeLessThanOrEqual(geometry.bodyBottom + 1);
    await page.getByRole("button", { name: "Close table of contents" }).click();
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByLabel("Hall of Mirrors").check();
    await page.reload();
    await expect(page.locator("#world")).toHaveClass(/theme-glass/);
  });

  test("holds the console steady, preserves cursor locking, and changes only Shift emphasis", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?unit=repeatable-editing&activity=dot-append-demo");
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#phone")).getPropertyValue("--execution-console-height").trim());
    const consoleHeights = await page.evaluate(() => {
      const heights = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (!activity.script) continue;
        window.VimWilds.goToActivity(index);
        heights.push(document.querySelector("#nextCommandTray").getBoundingClientRect().height);
        activity.script.steps.forEach(step => {
          const key = typeof step === "string" ? step : step.key;
          if (activity.type === "demo") document.querySelector('.demo-controls [data-action="step"]').click();
          else window.VimWilds.emit(key);
          heights.push(document.querySelector("#nextCommandTray").getBoundingClientRect().height);
        });
      }
      return heights;
    });
    expect(new Set(consoleHeights.map(height => Math.round(height * 10) / 10)).size).toBe(1);

    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "dot-python-values")));
    const before = await state(page);
    const scroller = page.locator(".cm-scroller");
    const box = await scroller.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 18);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 20, box.y + 18, { steps: 5 });
    await page.mouse.up();
    const after = await state(page);
    expect(after.cursor).toEqual(before.cursor);
    expect(after.selection).toEqual(before.selection);
    const legend = page.locator('.key[data-key="1"] .stack');
    const beforeShift = await legend.evaluate(node => {
      const shifted = node.querySelector(".shifted");
      const base = node.querySelector(".base");
      return { shiftedTop: shifted.getBoundingClientRect().top, baseTop: base.getBoundingClientRect().top, shiftedColor: getComputedStyle(shifted).color, baseColor: getComputedStyle(base).color };
    });
    await page.locator('[data-mod="Shift"]').first().click();
    await expect(page.locator("#keyboard")).toHaveClass(/shift-layer/);
    await page.waitForTimeout(150);
    const afterShift = await legend.evaluate(node => {
      const shifted = node.querySelector(".shifted");
      const base = node.querySelector(".base");
      return { shiftedTop: shifted.getBoundingClientRect().top, baseTop: base.getBoundingClientRect().top, shiftedColor: getComputedStyle(shifted).color, baseColor: getComputedStyle(base).color };
    });
    expect(afterShift.shiftedTop).toBeCloseTo(beforeShift.shiftedTop, 1);
    expect(afterShift.baseTop).toBeCloseTo(beforeShift.baseTop, 1);
    expect(afterShift.shiftedColor).not.toBe(beforeShift.shiftedColor);
    expect(afterShift.baseColor).not.toBe(beforeShift.baseColor);
  });

  test("fills the visible phone viewport and keeps the Normal cursor readable", async ({ page }) => {
    for (const [width, height] of [[360, 740], [375, 812], [390, 844], [412, 915], [430, 932]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/play/?unit=repeatable-editing&activity=dot-python-values");
      await page.waitForFunction(() => document.documentElement.dataset.charactersReady);
      await page.waitForFunction(() => document.querySelector(".cm-fat-cursor, .cm-cursorLayer .cm-cursor"));
      const layout = await page.evaluate(() => {
        const phone = document.querySelector("#phone").getBoundingClientRect();
        const keyboard = document.querySelector(".keyboard").getBoundingClientRect();
        const cursor = document.querySelector(".cm-fat-cursor, .cm-cursorLayer .cm-cursor");
        const cursorStyle = getComputedStyle(cursor);
        return {
          phoneBottom: phone.bottom,
          keyboardBottom: keyboard.bottom,
          viewportHeight: window.visualViewport.height,
          viewportVariable: getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height").trim(),
          cursorBackground: cursorStyle.backgroundColor,
        };
      });
      expect(layout.viewportVariable, `${width}×${height}`).toBe(`${Math.round(layout.viewportHeight)}px`);
      expect(Math.abs(layout.phoneBottom - layout.viewportHeight), `${width}×${height}`).toBeLessThanOrEqual(1);
      expect(layout.keyboardBottom, `${width}×${height}`).toBeLessThanOrEqual(layout.phoneBottom + 1);
      expect(layout.cursorBackground, `${width}×${height}`).toBe("rgba(247, 216, 120, 0.18)");
    }
  });

  test("uses the full screen height for installed iPhone and iPad windows", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15" });
      Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
      Object.defineProperty(window.screen, "height", { configurable: true, get: () => 812 });
    });
    await page.setViewportSize({ width: 375, height: 724 });
    await page.goto("/play/?unit=repeatable-editing&activity=dot-python-values");
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-viewport-height").trim())).toBe("812px");
    const phone = await page.locator("#phone").evaluate(node => node.getBoundingClientRect().height);
    expect(phone).toBe(812);
  });

  test("keeps every production activity inside the target phone viewports without clipping", async ({ page }) => {
    test.setTimeout(240000);
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]];
    const textSelector = [
      ".lesson-label", ".activity-intro h1", ".activity-intro p", ".command-explanation", ".next-command-tray .command-text",
      ".next-command-tray .status-primary", ".next-command-tray .status-secondary", ".next-command-tray .command-key",
      ".field-note h2", ".field-note p", ".grammar", ".choice-option", ".demo-controls button", ".completion-panel strong", ".completion-panel p", ".cm-vim-message",
      ".mode-spoke strong", ".mode-spoke small", ".forge-part small", ".assembly-part small",
    ].join(",");
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (const unitId of ["modal-model", "cursor-movement", "entering-changing-text", "repeatable-editing"]) {
        await page.goto(`/?unit=${unitId}`);
        const activityCount = await page.evaluate(() => window.VimWilds.activities.length);
        for (let index = 0; index < activityCount; index += 1) {
          await page.evaluate(activityIndex => window.VimWilds.goToActivity(activityIndex), index);
          const result = await page.evaluate(selector => {
            const text = [...document.querySelectorAll(selector)].filter(node => node.getClientRects().length);
            const clipped = text.filter(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1).map(node => node.textContent);
            const styles = text.map(node => getComputedStyle(node));
            return {
              clipped,
              ellipsis: styles.some(style => style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none"),
              overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
            };
          }, textSelector);
          expect(result.clipped, `${width}×${height} ${unitId} activity ${index}`).toEqual([]);
          expect(result.ellipsis, `${width}×${height} ${unitId} activity ${index}`).toBe(false);
          expect(result.overflow, `${width}×${height} ${unitId} activity ${index}`).toBe(false);
        }
      }
    }
  });
});

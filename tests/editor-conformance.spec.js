import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const unit = JSON.parse(readFileSync(new URL("../content/units/10-repeatable-editing.json", import.meta.url), "utf8"));
const modalUnit = JSON.parse(readFileSync(new URL("../content/units/01-modal-model.json", import.meta.url), "utf8"));
const cursorUnit = JSON.parse(readFileSync(new URL("../content/units/02-cursor-movement.json", import.meta.url), "utf8"));
const changingUnit = JSON.parse(readFileSync(new URL("../content/units/03-entering-changing-text.json", import.meta.url), "utf8"));
const operatorUnit = JSON.parse(readFileSync(new URL("../content/units/04-operator-grammar.json", import.meta.url), "utf8"));
const precisionUnit = JSON.parse(readFileSync(new URL("../content/units/05-precision-motions-search.json", import.meta.url), "utf8"));
const textObjectUnit = JSON.parse(readFileSync(new URL("../content/units/06-text-objects.json", import.meta.url), "utf8"));
const visualUnit = JSON.parse(readFileSync(new URL("../content/units/07-visual-selection.json", import.meta.url), "utf8"));
const registerUnit = JSON.parse(readFileSync(new URL("../content/units/08-registers-putting.json", import.meta.url), "utf8"));
const navigationUnit = JSON.parse(readFileSync(new URL("../content/units/09-long-range-navigation.json", import.meta.url), "utf8"));
const rangeUnit = JSON.parse(readFileSync(new URL("../content/units/11-command-line-ranges-line-operations.json", import.meta.url), "utf8"));
const substitutionUnit = JSON.parse(readFileSync(new URL("../content/units/12-substitution-practical-regex.json", import.meta.url), "utf8"));
const macroUnit = JSON.parse(readFileSync(new URL("../content/units/13-macros.json", import.meta.url), "utf8"));
const automationUnit = JSON.parse(readFileSync(new URL("../content/units/14-global-normal-automation.json", import.meta.url), "utf8"));
const authoredActivities = unit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const authoredExercises = authoredActivities.filter(activity => activity.type === "exercise");
const cursorActivities = cursorUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const cursorExercises = cursorActivities.filter(activity => activity.type === "exercise");
const changingActivities = changingUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const changingExercises = changingActivities.filter(activity => activity.type === "exercise");
const operatorActivities = operatorUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const operatorExercises = operatorActivities.filter(activity => activity.type === "exercise");
const precisionActivities = precisionUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const precisionExercises = precisionActivities.filter(activity => activity.type === "exercise");
const textObjectActivities = textObjectUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const textObjectExercises = textObjectActivities.filter(activity => activity.type === "exercise");
const visualActivities = visualUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const visualExercises = visualActivities.filter(activity => activity.type === "exercise");
const registerActivities = registerUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const registerExercises = registerActivities.filter(activity => activity.type === "exercise");
const navigationActivities = navigationUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const navigationExercises = navigationActivities.filter(activity => activity.type === "exercise");
const rangeActivities = rangeUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const rangeExercises = rangeActivities.filter(activity => activity.type === "exercise");
const substitutionActivities = substitutionUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const substitutionExercises = substitutionActivities.filter(activity => activity.type === "exercise");
const macroActivities = macroUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const macroExercises = macroActivities.filter(activity => activity.type === "exercise");
const automationActivities = automationUnit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const automationExercises = automationActivities.filter(activity => activity.type === "exercise");
const successAnimation = readFileSync(new URL("../assets/characters/nix/animations/joyful-hop.webp", import.meta.url));
const keysFor = activity => activity.script?.steps.map(step => typeof step === "string" ? step : step.key) || [];
const indexOf = id => authoredActivities.findIndex(activity => activity.id === id);

async function state(page) {
  await page.waitForFunction(() => window.VimWilds?.getState);
  return page.evaluate(() => window.VimWilds.getState());
}

test.describe("Production lesson flow", () => {
  test.beforeEach(async ({ page }) => {
    // Interaction coverage deliberately opts into the touch keyboard. Product
    // defaults remain responsive (hidden on desktop, shown on touch devices).
    await page.addInitScript(completedUnitStoryIds => {
      const key = "vim-wilds.session.v1";
      const existing = JSON.parse(window.localStorage.getItem(key) || "{}");
      window.localStorage.setItem(key, JSON.stringify({ ...existing, keyboardVisibility: "visible" }));
      // Story behavior has its own focused suite. Keep editor/navigation
      // conformance on the post-story continuation path.
      window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
        introSeen: true,
        completedUnitStoryIds,
      }));
    }, [
      modalUnit.id,
      cursorUnit.id,
      changingUnit.id,
      operatorUnit.id,
      precisionUnit.id,
      textObjectUnit.id,
      visualUnit.id,
      registerUnit.id,
      navigationUnit.id,
      unit.id,
      rangeUnit.id,
      substitutionUnit.id,
      macroUnit.id,
      automationUnit.id,
    ]);
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
    await expect(page.locator(".toc-unit")).toHaveCount(14);
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
      { id: "operator-grammar", unitNumber: 4, title: "Operator grammar" },
      { id: "precision-motions-search", unitNumber: 5, title: "Precision motions and search" },
      { id: "text-objects", unitNumber: 6, title: "Text objects" },
      { id: "visual-selection", unitNumber: 7, title: "Visual selection" },
      { id: "registers-putting", unitNumber: 8, title: "Registers and putting" },
      { id: "long-range-navigation", unitNumber: 9, title: "Long-range navigation" },
      { id: "repeatable-editing", unitNumber: 10, title: "Repeatable editing" },
      { id: "command-line-ranges-line-operations", unitNumber: 11, title: "Command-line ranges and line operations" },
      { id: "substitution-practical-regex", unitNumber: 12, title: "Substitution and practical regex" },
      { id: "macros", unitNumber: 13, title: "Macros" },
      { id: "global-normal-automation", unitNumber: 14, title: "Global and Normal automation" },
    ]);
    await page.getByRole("button", { name: "Open table of contents" }).click();
    await expect(page.locator(".toc-unit")).toHaveCount(14);
    await expect(page.locator(".toc-arc-heading")).toHaveText(["Arc 1Foundations", "Arc 2Fluency tracks", "Arc 3Automation"]);
    await expect(page.locator(".toc-arc").first().locator(".toc-unit")).toHaveCount(6);
    await expect(page.locator(".toc-arc").nth(1).locator(".toc-unit")).toHaveCount(4);
    await expect(page.locator(".toc-arc").nth(2).locator(".toc-unit")).toHaveCount(4);
    await expect(page.locator(".toc-arc-divider")).toHaveCount(2);
    const arcPresentation = await page.evaluate(() => {
      const heading = document.querySelector(".toc-arc-heading");
      const divider = document.querySelector(".toc-arc-divider");
      return {
        justify: getComputedStyle(heading).justifyContent,
        align: getComputedStyle(heading).alignItems,
        labelSize: getComputedStyle(heading.querySelector("span")).fontSize,
        titleSize: getComputedStyle(heading.querySelector("strong")).fontSize,
        dividerDisplay: getComputedStyle(divider).display,
        ornament: divider.textContent.trim(),
      };
    });
    expect(arcPresentation).toEqual({ justify: "center", align: "center", labelSize: "15px", titleSize: "21px", dividerDisplay: "grid", ornament: "❦" });
    await expect(page.locator('[data-unit-id="cursor-movement"]')).toContainText("Unit 2");
    await expect(page.locator('[data-unit-id="visual-selection"]')).toContainText("Unit 7");
    await expect(page.locator('[data-unit-id="registers-putting"]')).toContainText("Unit 8");
    await expect(page.locator('[data-unit-id="long-range-navigation"]')).toContainText("Unit 9");
    await expect(page.locator('[data-unit-id="repeatable-editing"]')).toContainText("Unit 10");
    await expect(page.locator('[data-unit-id="command-line-ranges-line-operations"]')).toContainText("Unit 11");
    await expect(page.locator('[data-unit-id="substitution-practical-regex"]')).toContainText("Unit 12");
    await expect(page.locator('[data-unit-id="macros"]')).toContainText("Unit 13");
    await expect(page.locator('[data-unit-id="global-normal-automation"]')).toContainText("Unit 14");
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

    await page.goto("/?unit=text-objects&activity=around-word-demo");
    await page.getByRole("button", { name: "Step" }).click();
    await expect(page.locator(".assembly-part")).toHaveCount(2);
    await expect(page.locator(".assembly-part kbd")).toHaveText(["y", "aw"]);
    await expect(page.locator(".assembly-part small")).toHaveText(["yank", "around word"]);
    await page.getByRole("button", { name: "Step" }).click();
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).history).toEqual(["y", "a", "w"]);
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

  test("runs every Unit 3 local change and continues to Unit 4", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: "Continue to Unit 4" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 4" }).click();
    await page.waitForURL(/unit=operator-grammar/);
    expect((await state(page))).toMatchObject({ unitId: "operator-grammar", unitNumber: 4, activityId: "operator-sentence-meanings" });
  });

  test("reserves all three rows for the Unit 3 open-line demo before playback", async ({ page }) => {
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960], [888, 1248]];
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/?unit=entering-changing-text&activity=open-middle-line-demo");
      await page.waitForFunction(() => getComputedStyle(document.querySelector("#phone")).getPropertyValue("--execution-console-height").trim());
      const samples = await page.evaluate(async () => {
        const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const capture = () => {
          const slab = document.querySelector(".next-code-slab");
          const scroller = document.querySelector(".cm-scroller");
          const bounds = scroller.getBoundingClientRect();
          const lines = [...document.querySelectorAll(".cm-line")].map(line => line.getBoundingClientRect());
          return {
            height: slab.getBoundingClientRect().height,
            plannedRows: Number(document.querySelector(".editor-stack").dataset.plannedRows),
            lineCount: lines.length,
            linesVisible: lines.every(line => line.top >= bounds.top - 1 && line.bottom <= bounds.bottom + 1),
            documentOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          };
        };
        await settle();
        const result = [capture()];
        while (window.VimWilds.getState().playbackStep < 10) {
          document.querySelector('.demo-controls [data-action="step"]').click();
          await settle();
          result.push(capture());
        }
        return { result, state: window.VimWilds.getState() };
      });
      expect(new Set(samples.result.map(sample => sample.height)).size, `${width}×${height} stable editor`).toBe(1);
      expect(samples.result.every(sample => sample.plannedRows === 3), `${width}×${height} planned rows`).toBe(true);
      expect(samples.result.every(sample => sample.linesVisible), `${width}×${height} visible lines`).toBe(true);
      expect(samples.result.some(sample => sample.lineCount === 3), `${width}×${height} third line`).toBe(true);
      expect(samples.result.every(sample => !sample.documentOverflow), `${width}×${height} viewport overflow`).toBe(true);
      expect(samples.state).toMatchObject({
        playbackStep: 10,
        code: ["first()", "second()", "third()"],
        cursor: [1, 7],
        mode: "normal",
      });
    }
  });

  test("keeps the largest inferred non-viewport buffer fully visible", async ({ page }) => {
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960], [888, 1248]];
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/?unit=command-line-ranges-line-operations&activity=copy-range-to-end");
      await page.waitForFunction(() => getComputedStyle(document.querySelector("#phone")).getPropertyValue("--execution-console-height").trim());
      const result = await page.evaluate(async () => {
        const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await settle();
        const beforeHeight = document.querySelector(".next-code-slab").getBoundingClientRect().height;
        window.VimWilds.solveCurrent();
        await settle();
        const scroller = document.querySelector(".cm-scroller");
        const bounds = scroller.getBoundingClientRect();
        const lines = [...document.querySelectorAll(".cm-line")].map(line => line.getBoundingClientRect());
        return {
          beforeHeight,
          afterHeight: document.querySelector(".next-code-slab").getBoundingClientRect().height,
          plannedRows: Number(document.querySelector(".editor-stack").dataset.plannedRows),
          lineCount: lines.length,
          linesVisible: lines.every(line => line.top >= bounds.top - 1 && line.bottom <= bounds.bottom + 1),
          documentOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          state: window.VimWilds.getState(),
        };
      });
      expect(result.plannedRows, `${width}×${height} planned rows`).toBe(8);
      expect(result.afterHeight, `${width}×${height} stable editor`).toBe(result.beforeHeight);
      expect(result.lineCount, `${width}×${height} rendered lines`).toBe(8);
      expect(result.linesVisible, `${width}×${height} visible lines`).toBe(true);
      expect(result.documentOverflow, `${width}×${height} viewport overflow`).toBe(false);
      expect(result.state.complete).toBe(true);
    }
  });

  test("runs every Unit 4 operator activity and continues to Unit 5", async ({ page }) => {
    await page.goto("/?unit=operator-grammar");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 76, exerciseCount: operatorExercises.length });
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
    await page.goto("/?unit=operator-grammar&activity=operator-grammar-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 5" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 5" }).click();
    await page.waitForURL(/unit=precision-motions-search/);
    expect((await state(page))).toMatchObject({ unitId: "precision-motions-search", unitNumber: 5, activityId: "find-and-till-meaning" });
  });

  test("runs every Unit 5 precision activity and continues to Unit 6", async ({ page }) => {
    await page.goto("/?unit=precision-motions-search");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 67, exerciseCount: precisionExercises.length });
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
    await page.goto("/?unit=precision-motions-search&activity=precision-motions-search-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 6" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 6" }).click();
    await page.waitForURL(/unit=text-objects/);
    expect((await state(page))).toMatchObject({ unitId: "text-objects", unitNumber: 6, activityId: "inside-around-meaning" });
  });

  test("runs every Unit 6 text-object activity and continues to Unit 7", async ({ page }) => {
    await page.goto("/?unit=text-objects");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 95, exerciseCount: textObjectExercises.length });
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
    await page.goto("/?unit=text-objects&activity=text-objects-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 7" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 7" }).click();
    await page.waitForURL(/unit=visual-selection/);
    expect((await state(page))).toMatchObject({ unitId: "visual-selection", unitNumber: 7, activityId: "visual-shapes-meaning" });
  });

  test("runs every Unit 7 Visual activity and continues to Unit 8", async ({ page }) => {
    await page.goto("/?unit=visual-selection");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 84, exerciseCount: visualExercises.length });
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
    await page.goto("/?unit=visual-selection&activity=visual-selection-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 8" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 8" }).click();
    await page.waitForURL(/unit=registers-putting/);
    expect((await state(page))).toMatchObject({ unitId: "registers-putting", unitNumber: 8, activityId: "unnamed-register-meaning" });
  });

  test("runs every Unit 8 register activity with internal clipboard state", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: () => { throw new Error("device clipboard read"); },
          writeText: () => { throw new Error("device clipboard write"); },
        },
      });
    });
    await page.goto("/?unit=registers-putting");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 74, exerciseCount: registerExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        const expectedRegisters = activity.scenario.target.registers || {};
        const registersMatch = Object.entries(expectedRegisters).every(([name, expected]) => current.registers[name]?.text === expected.text && current.registers[name]?.type === expected.type);
        if (activity.type === "exercise" && !current.complete) result.push({ id: activity.id, current });
        if (activity.type === "demo" && (JSON.stringify(current.code) !== JSON.stringify(activity.scenario.target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(activity.scenario.target.cursor) || !registersMatch)) result.push({ id: activity.id, current });
      }
      return result;
    });
    expect(failures).toEqual([]);

    await page.goto("/?unit=registers-putting&activity=plus-line-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page)).registers["+"]).toEqual({ text: "export alpha\n", type: "linewise" });
    await page.evaluate(() => window.VimWilds.goToActivity(1));
    expect((await state(page)).registers["+"]).toEqual({ text: "", type: "characterwise" });

    await page.goto("/?unit=registers-putting&activity=plus-word");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect(await state(page)).toMatchObject({
      complete: true,
      code: ["amber blue amber green"],
      cursor: [0, 17],
      history: ['"', "+", "y", "w", "w", "w", '"', "+", "g", "P"],
    });

    await page.goto("/?unit=registers-putting&activity=inspect-plus-register");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator(".cm-vim-message")).toContainText('"+    release = stable');
    await expect(page.locator(".cm-vim-message")).toHaveCSS("white-space", "pre-wrap");

    await page.goto("/?unit=registers-putting&activity=registers-putting-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 9" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 9" }).click();
    await page.waitForURL(/unit=long-range-navigation/);
    expect((await state(page))).toMatchObject({ unitId: "long-range-navigation", unitNumber: 9, activityId: "window-landmarks-meaning" });
  });

  test("runs every Unit 9 activity with exact cursor and semantic viewport targets", async ({ page }) => {
    await page.goto("/?unit=long-range-navigation");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 104, exerciseCount: navigationExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        const target = activity.scenario.target;
        const viewportMatches = current.viewport?.topLine === target.viewport?.topLine
          && current.viewport?.bottomLine === target.viewport?.bottomLine;
        if (activity.type === "exercise" && !current.complete) result.push({ id: activity.id, current });
        if (activity.type === "demo" && (JSON.stringify(current.code) !== JSON.stringify(target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(target.cursor) || !viewportMatches)) result.push({ id: activity.id, current });
      }
      return result;
    });
    expect(failures).toEqual([]);

    await page.goto("/?unit=long-range-navigation&activity=long-range-navigation-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 10" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 10" }).click();
    await page.waitForURL(/unit=repeatable-editing/);
    expect((await state(page))).toMatchObject({ unitId: "repeatable-editing", unitNumber: 10, activityId: "dot-is-a-change" });
  });

  test("makes the middle-row and change-list movements visibly observable", async ({ page }) => {
    await page.goto("/?unit=long-range-navigation&activity=window-middle-isolate");
    expect(await state(page)).toMatchObject({ cursor: [10, 0], viewport: { topLine: 9, bottomLine: 15, totalLines: 30 } });
    await page.evaluate(() => window.VimWilds.emit("M"));
    expect(await state(page)).toMatchObject({ complete: true, cursor: [12, 0], viewport: { topLine: 9, bottomLine: 15, totalLines: 30 } });

    await page.goto("/?unit=long-range-navigation&activity=change-list-oldest-isolate");
    for (const key of ["g", ";"]) await page.evaluate(token => window.VimWilds.emit(token), key);
    expect(await state(page)).toMatchObject({ cursor: [20, 2], viewport: { topLine: 14, bottomLine: 20, totalLines: 30 } });
    for (const key of ["g", ";"]) await page.evaluate(token => window.VimWilds.emit(token), key);
    expect(await state(page)).toMatchObject({ complete: true, cursor: [4, 9], viewport: { topLine: 4, bottomLine: 10, totalLines: 30 } });

    await page.goto("/?unit=long-range-navigation&activity=change-list-newer-mix");
    for (const key of ["g", ";", "g", ";"]) await page.evaluate(token => window.VimWilds.emit(token), key);
    expect(await state(page)).toMatchObject({ cursor: [4, 9], viewport: { topLine: 4, bottomLine: 10, totalLines: 30 } });
    for (const key of ["g", ","]) await page.evaluate(token => window.VimWilds.emit(token), key);
    expect(await state(page)).toMatchObject({ complete: true, cursor: [20, 2], viewport: { topLine: 14, bottomLine: 20, totalLines: 30 } });
  });

  test("runs every Unit 13 macro activity and preserves macro isolation", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/?unit=macros");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 66, exerciseCount: macroExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        const target = activity.scenario.target;
        const registersMatch = Object.entries(target.registers || {}).every(([name, expected]) => (
          current.registers[name]?.text === expected.text && current.registers[name]?.type === expected.type
        ));
        if (JSON.stringify(current.code) !== JSON.stringify(target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(target.cursor)
          || !registersMatch
          || (activity.type === "exercise" && !current.complete)) result.push({ id: activity.id, current });
      }
      return result;
    });
    expect(failures).toEqual([]);

    await page.goto("/?unit=macros&activity=anchor-colon-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page)).registers.a).toEqual({ text: "0f:r=j", type: "characterwise" });
    await page.goto("/?unit=macros&activity=beacon-macro-demo");
    expect((await state(page)).registers.a?.text || "").toBe("");
  });

  test("runs every Unit 14 Global-Normal activity with native-equivalent state", async ({ page }) => {
    await page.goto("/?unit=global-normal-automation");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 66, exerciseCount: automationExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        const target = activity.scenario.target;
        if (JSON.stringify(current.code) !== JSON.stringify(target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(target.cursor)
          || (activity.type === "exercise" && !current.complete)) result.push({ id: activity.id, current, target });
      }
      return result;
    });
    expect(failures).toEqual([]);
  });

  test("keeps Ex command text visible while Unit 14 range commands are entered", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?unit=global-normal-automation&activity=normal-range-demo");
    await page.locator('.demo-controls [data-action="step"]').click();
    await expect(page.locator(".cm-vim-panel")).toBeVisible();
    await page.locator('.demo-controls [data-action="step"]').click();
    await expect(page.locator(".cm-vim-panel")).toBeVisible();
    const demoCommandInput = page.locator(".cm-vim-panel input, .cm-vim-panel textarea");
    await expect(demoCommandInput).toHaveValue("2");
    await expect(demoCommandInput).toHaveCSS("color", "rgb(246, 237, 218)");
    await expect(demoCommandInput).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "normal-python-comments")));
    await page.evaluate(() => { window.VimWilds.emit(":"); window.VimWilds.emit("2"); });
    await expect(page.locator(".cm-vim-panel")).toBeVisible();
    await expect(page.locator(".cm-vim-panel input, .cm-vim-panel textarea")).toHaveValue("2");
  });

  test("runs every Unit 11 Ex range activity with native-equivalent line and register state", async ({ page }) => {
    await page.goto("/?unit=command-line-ranges-line-operations");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 66, exerciseCount: rangeExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        const target = activity.scenario.target;
        const registersMatch = Object.entries(target.registers || {}).every(([name, expected]) => (
          current.registers[name]?.text === expected.text && current.registers[name]?.type === expected.type
        ));
        if (JSON.stringify(current.code) !== JSON.stringify(target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(target.cursor)
          || !registersMatch
          || (activity.type === "exercise" && !current.complete)) result.push({ id: activity.id, current });
      }
      return result;
    });
    expect(failures).toEqual([]);
  });

  test("runs every Unit 12 substitution activity with native-equivalent text and cursor state", async ({ page }) => {
    await page.goto("/?unit=substitution-practical-regex");
    const runtime = await page.evaluate(() => ({ activityCount: window.VimWilds.activities.length, exerciseCount: window.VimWilds.exercises.length }));
    expect(runtime).toEqual({ activityCount: 66, exerciseCount: substitutionExercises.length });
    const failures = await page.evaluate(() => {
      const result = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (activity.type !== "demo" && activity.type !== "exercise") continue;
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        const current = window.VimWilds.getState();
        const target = activity.scenario.target;
        if (JSON.stringify(current.code) !== JSON.stringify(target.lines)
          || JSON.stringify(current.cursor) !== JSON.stringify(target.cursor)
          || (activity.type === "exercise" && !current.complete)) result.push({ id: activity.id, current, target });
      }
      return result;
    });
    expect(failures).toEqual([]);
  });

  test("supports count-only and interactive confirmation through touch input", async ({ page }) => {
    await page.goto("/?unit=substitution-practical-regex&activity=count-without-changing");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page))).toMatchObject({ complete: true, code: ["WARN WARN", "WARN INFO"] });
    await expect(page.locator(".cm-vim-message")).toContainText("3 matches on 2 lines");

    await page.goto("/?unit=substitution-practical-regex&activity=confirm-all-remaining");
    const acceptAll = substitutionActivities.find(activity => activity.id === "confirm-all-remaining");
    await page.evaluate(keys => keys.slice(0, -1).forEach(key => window.VimWilds.emit(key)), keysFor(acceptAll));
    expect((await state(page))).toMatchObject({ mode: "command-line", code: ["draft draft draft"] });
    await page.locator('.key[data-key="a"]').click();
    expect((await state(page))).toMatchObject({ complete: true, code: ["live live live"], mode: "Complete" });

    await page.goto("/?unit=substitution-practical-regex&activity=confirm-skip-match");
    const skip = substitutionActivities.find(activity => activity.id === "confirm-skip-match");
    await page.evaluate(keys => keys.slice(0, -1).forEach(key => window.VimWilds.emit(key)), keysFor(skip));
    await page.locator('.key[data-key="n"]').click();
    expect((await state(page))).toMatchObject({ complete: true, code: ["old,keep"], modifiers: [] });

    await page.goto("/?unit=substitution-practical-regex&activity=confirm-all-remaining");
    await page.evaluate(keys => keys.slice(0, -1).forEach(key => window.VimWilds.emit(key)), keysFor(acceptAll));
    await page.getByRole("button", { name: "Reset activity" }).click();
    expect((await state(page))).toMatchObject({ complete: false, mode: "normal", code: ["draft draft draft"] });

    await page.goto("/?unit=substitution-practical-regex&activity=confirm-skip-match");
    await page.locator(".cm-content").focus();
    await page.keyboard.type(":s/old/new/c");
    await page.keyboard.press("Enter");
    expect((await state(page))).toMatchObject({ mode: "command-line", code: ["old,keep"] });
    await page.keyboard.press("n");
    expect((await state(page))).toMatchObject({ complete: true, mode: "Complete", code: ["old,keep"] });
  });

  test("matches native substitution case and replacement edge cases", async ({ page }) => {
    await page.goto("/?unit=substitution-practical-regex");
    const results = await page.evaluate(async () => {
      const { VimEngine, resetVimEngineState } = await import("/vim-engine.js");
      const cases = [
        { id: "default-case", lines: ["Foo foo"], keys: [...":%s/foo/bar/g", "Enter"], expected: ["Foo bar"] },
        { id: "i-and-I", lines: ["Foo foo", "Foo foo"], keys: [...":s/foo/bar/gi", "Enter", "j", ...":s/foo/baz/gI", "Enter"], expected: ["bar bar", "Foo baz"] },
        {
          id: "ampersand-zero-nine",
          lines: ["cat", "abcdefghi"],
          keys: [
            ...":s/cat/&:\\0/", "Enter", "j",
            ...":s/\\(a\\)\\(b\\)\\(c\\)\\(d\\)\\(e\\)\\(f\\)\\(g\\)\\(h\\)\\(i\\)/\\9\\1/", "Enter",
          ],
          expected: ["cat:cat", "ia"],
        },
        { id: "confirm-last", lines: ["draft draft"], keys: [...":s/draft/live/gc", "Enter", "l"], expected: ["live draft"] },
        { id: "confirm-quit", lines: ["draft draft"], keys: [...":s/draft/live/gc", "Enter", "q"], expected: ["draft draft"] },
        { id: "confirm-escape", lines: ["draft draft"], keys: [...":s/draft/live/gc", "Enter", "Escape"], expected: ["draft draft"] },
        { id: "escaped-delimiter-history", lines: ["foo", "foo"], keys: [...":s#foo#bar\\#baz#", "Enter", "j", "&"], expected: ["bar#baz", "bar#baz"] },
      ];
      return cases.map(testCase => {
        resetVimEngineState();
        const host = document.createElement("div");
        document.body.append(host);
        const engine = new VimEngine({ parent: host, text: testCase.lines.join("\n"), cursor: [0, 0], onEvent() {} });
        testCase.keys.forEach(key => engine.sendKey(key, { bypassLock: true, source: "fixture" }));
        const snapshot = engine.getSnapshot();
        const actual = snapshot.text.split("\n");
        engine.destroy();
        host.remove();
        return { id: testCase.id, actual, mode: snapshot.mode, expected: testCase.expected };
      });
    });
    for (const result of results) {
      expect(result.actual, result.id).toEqual(result.expected);
      expect(result.mode, result.id).toBe("normal");
    }
  });

  test("shows recording state and enters @ from physical and touch keyboards", async ({ page }) => {
    await page.goto("/?unit=macros&activity=comment-python-jobs");
    await page.evaluate(() => { window.VimWilds.emit("q"); window.VimWilds.emit("a"); });
    await expect(page.locator(".cm-vim-message")).toContainText("recording @a");
    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "comment-python-jobs")));
    const macroExercise = macroActivities.find(activity => activity.id === "comment-python-jobs");
    const beforeReplay = macroExercise.script.steps.slice(0, macroExercise.script.steps.indexOf("@"));
    await page.evaluate(keys => keys.forEach(key => window.VimWilds.emit(key)), beforeReplay);
    await page.locator(".cm-content").focus();
    await page.keyboard.press("Shift+2");
    expect((await state(page)).history.at(-1)).toBe("@");

    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "comment-python-jobs")));
    await page.evaluate(keys => keys.forEach(key => window.VimWilds.emit(key)), beforeReplay);
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="2"]').click();
    expect((await state(page))).toMatchObject({ modifiers: [], history: [...beforeReplay, "@"] });
  });

  test("continues from Unit 10 through published Units 11, 12, 13, and 14", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=repeat-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 11" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 11" }).click();
    await page.waitForURL(/unit=command-line-ranges-line-operations/);
    expect((await state(page))).toMatchObject({ unitId: "command-line-ranges-line-operations", unitNumber: 11, activityId: "addresses-before-actions" });

    await page.goto("/?unit=command-line-ranges-line-operations&activity=command-line-ranges-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 12" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 12" }).click();
    await page.waitForURL(/unit=substitution-practical-regex/);
    expect((await state(page))).toMatchObject({ unitId: "substitution-practical-regex", unitNumber: 12, activityId: "substitution-parts" });

    await page.goto("/?unit=substitution-practical-regex&activity=substitution-regex-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 13" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 13" }).click();
    await page.waitForURL(/unit=macros/);
    expect((await state(page))).toMatchObject({ unitId: "macros", unitNumber: 13, activityId: "macro-recording-meaning" });

    await page.goto("/?unit=macros&activity=macros-unit-summary");
    await expect(page.getByRole("button", { name: "Continue to Unit 14" })).toBeVisible();
    await page.getByRole("button", { name: "Continue to Unit 14" }).click();
    await page.waitForURL(/unit=global-normal-automation/);
    expect((await state(page))).toMatchObject({ unitId: "global-normal-automation", unitNumber: 14, activityId: "normal-range-meaning" });

    await page.goto("/?unit=global-normal-automation&activity=global-normal-automation-summary");
    await expect(page.getByRole("button", { name: "Complete Unit 14" })).toBeVisible();
    await page.getByRole("button", { name: "Complete Unit 14" }).click();
    const storySurface = page.locator(".story-surface");
    if (await storySurface.getAttribute("data-kind") === "unit") {
      await page.getByRole("button", { name: "Continue to finale" }).click();
    }
    await expect(storySurface).toHaveAttribute("data-kind", "ending");
    await page.getByRole("button", { name: "View the restored Wilds" }).click();
    await expect(page.getByRole("dialog", { name: "Table of contents" })).toBeVisible();
  });

  test("locks direct scrolling while Vim updates the Unit 9 position rail", async ({ page }) => {
    await page.goto("/?unit=long-range-navigation&activity=scroll-down-twice-mix");
    const before = await state(page);
    const scroller = page.locator(".cm-scroller");
    const box = await scroller.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(50);
    expect((await state(page)).viewport).toEqual(before.viewport);
    const directInput = await scroller.evaluate(node => ({
      touchCanceled: !node.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true })),
      overflow: getComputedStyle(node).overflow,
      touchAction: getComputedStyle(node).touchAction,
      scrollbarWidth: getComputedStyle(node).scrollbarWidth,
    }));
    expect(directInput).toEqual({ touchCanceled: true, overflow: "hidden", touchAction: "none", scrollbarWidth: "none" });

    const railBefore = await page.locator(".buffer-position").evaluate(node => ({
      pointerEvents: getComputedStyle(node).pointerEvents,
      above: node.classList.contains("has-above"),
      below: node.classList.contains("has-below"),
      top: node.querySelector("i").style.top,
    }));
    expect(railBefore).toMatchObject({ pointerEvents: "none", above: true, below: true });
    for (const key of ["Ctrl-e", "Ctrl-e"]) await page.evaluate(token => window.VimWilds.emit(token), key);
    const after = await state(page);
    expect(after).toMatchObject({ complete: true, viewport: { topLine: 11, bottomLine: 17, totalLines: 30 } });
    const railAfter = await page.locator(".buffer-position i").evaluate(node => node.style.top);
    expect(railAfter).not.toBe(railBefore.top);
  });

  test("reconstructs Unit 9 marks and history on reset and accepts touch and physical Ctrl chords", async ({ page }) => {
    await page.goto("/?unit=long-range-navigation&activity=change-list-newer-mix");
    const seeded = await state(page);
    await page.evaluate(() => window.VimWilds.emit("g"));
    await page.getByRole("button", { name: "Reset activity" }).click();
    expect(await state(page)).toMatchObject({ code: seeded.code, cursor: seeded.cursor, viewport: seeded.viewport, history: [] });
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page)).complete).toBe(true);

    await page.goto("/?unit=long-range-navigation&activity=half-page-down-mix");
    await page.locator('[data-mod="Ctrl"]').click();
    await page.locator('.key[data-key="d"]').click();
    expect((await state(page))).toMatchObject({ complete: true, cursor: [15, 0], viewport: { topLine: 12, bottomLine: 18, totalLines: 30 }, modifiers: [] });
    await page.goto("/?unit=long-range-navigation&activity=page-backward-isolate");
    await page.locator(".cm-content").focus();
    await page.keyboard.press("Control+b");
    expect((await state(page))).toMatchObject({ complete: true, cursor: [7, 0], viewport: { topLine: 4, bottomLine: 10, totalLines: 30 } });
  });

  test("matches native Vim for every method-boundary direction", async ({ page }) => {
    await page.goto("/?unit=long-range-navigation");
    const lines = navigationActivities.find(activity => activity.id === "method-start-mix").scenario.initial.lines;
    const results = await page.evaluate(async sourceLines => {
      const { VimEngine, resetVimEngineState } = await import("/vim-engine.js");
      const cases = [
        { keys: ["[", "m"], cursor: [12, 13] },
        { keys: ["]", "m"], cursor: [19, 10] },
        { keys: ["[", "M"], cursor: [10, 2] },
        { keys: ["]", "M"], cursor: [17, 2] },
      ];
      const output = [];
      for (const fixture of cases) {
        resetVimEngineState();
        const parent = document.createElement("div");
        document.body.append(parent);
        const engine = new VimEngine({ parent, text: sourceLines.join("\n"), cursor: [15, 10] });
        fixture.keys.forEach(key => engine.sendKey(key));
        output.push({ expected: fixture.cursor, actual: engine.getSnapshot().cursorPosition });
        engine.destroy();
        parent.remove();
      }
      return output;
    }, lines);
    for (const result of results) expect(result.actual).toEqual(result.expected);
  });

  test("matches native Visual Block insertion, block shifting, and characterwise gq", async ({ page }) => {
    await page.goto("/?unit=visual-selection");
    const results = await page.evaluate(async () => {
      const { VimEngine, resetVimEngineState } = await import("/vim-engine.js");
      const cases = [
        { id: "block-I", lines: ["one", "two", "six"], cursor: [0, 0], keys: ["Ctrl-v", "2", "j", "I", ">", " ", "Escape"], code: ["> one", "> two", "> six"], finalCursor: [0, 0] },
        { id: "block-A", lines: ["one", "two", "six"], cursor: [0, 2], keys: ["Ctrl-v", "2", "j", "A", "!", "Escape"], code: ["one!", "two!", "six!"], finalCursor: [0, 2] },
        { id: "block-shift", lines: ["aa", "bb", "cc"], cursor: [0, 0], keys: ["Ctrl-v", "2", "j", ">"], code: ["  aa", "  bb", "  cc"], finalCursor: [0, 0] },
        { id: "char-gq", lines: ["This compact paragraph contains several words for wrapping."], cursor: [0, 0], keys: ["v", "$", "g", "q"], code: ["This compact paragraph", "contains several words", "for wrapping."], finalCursor: [2, 0], textWidth: 24 },
      ];
      return cases.map(testCase => {
        resetVimEngineState();
        const host = document.createElement("div");
        document.body.append(host);
        const engine = new VimEngine({ parent: host, text: testCase.lines.join("\n"), cursor: testCase.cursor, textWidth: testCase.textWidth, onEvent() {} });
        testCase.keys.forEach(key => engine.sendKey(key, { bypassLock: true, source: "fixture" }));
        const snapshot = engine.getSnapshot();
        const result = { id: testCase.id, code: snapshot.text.split("\n"), cursor: snapshot.cursorPosition, mode: snapshot.mode };
        engine.destroy();
        host.remove();
        return { ...result, expectedCode: testCase.code, expectedCursor: testCase.finalCursor };
      });
    });
    for (const result of results) {
      expect(result.code, result.id).toEqual(result.expectedCode);
      expect(result.cursor, result.id).toEqual(result.expectedCursor);
      expect(result.mode, result.id).toBe("normal");
    }
  });

  test("reports Visual character, line, block, o/O, and gv geometry", async ({ page }) => {
    await page.goto("/?unit=visual-selection&activity=select-character-range");
    await page.evaluate(() => ["v", "e"].forEach(key => window.VimWilds.emit(key)));
    expect((await state(page))).toMatchObject({ mode: "visual", selection: { kind: "linear", from: [0, 0], to: [0, 5] } });

    await page.goto("/?unit=visual-selection&activity=select-line-range");
    await page.evaluate(() => ["V", "j"].forEach(key => window.VimWilds.emit(key)));
    expect((await state(page))).toMatchObject({ mode: "visual-line", selection: { kind: "linear", from: [0, 0] } });

    await page.goto("/?unit=visual-selection&activity=select-block-range");
    await page.evaluate(() => ["Ctrl-v", "2", "j"].forEach(key => window.VimWilds.emit(key)));
    expect((await state(page))).toMatchObject({ mode: "visual-block", selection: { kind: "block", from: [0, 3], to: [2, 3] } });

    await page.goto("/?unit=visual-selection&activity=swap-block-same-row-corner");
    await page.evaluate(() => ["Ctrl-v", "2", "j", "2", "l", "O"].forEach(key => window.VimWilds.emit(key)));
    expect((await state(page))).toMatchObject({ mode: "visual-block", cursor: [2, 1], selection: { kind: "block", from: [0, 1], to: [2, 3] } });

    await page.goto("/?unit=visual-selection&activity=reselect-indent-demo");
    for (let step = 0; step < 5; step += 1) await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page))).toMatchObject({ mode: "visual-line", selection: { kind: "linear", from: [0, 0] } });
  });

  test("advances the guidance one learner action at a time", async ({ page }) => {
    await page.goto("/?unit=visual-selection&activity=select-line-range");
    await expect(page.locator("#commandExplanation")).toHaveText("Switch to Visual Line mode.");

    await page.evaluate(() => window.VimWilds.emit("V"));
    await expect(page.locator("#commandExplanation")).toHaveText("Move one line down to extend the selection.");

    await page.evaluate(() => window.VimWilds.emit("j"));
    await expect(page.locator("#commandExplanation")).toHaveText("Delete the selected lines.");
  });

  test("enters Ctrl-v and shifted block insertion from touch and physical keyboards", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?unit=visual-selection&activity=prepend-comment-markers-recall");
    await page.locator('[data-mod="Ctrl"]').first().click();
    await page.locator('.key[data-key="v"]').click();
    await page.locator('.key[data-key="2"]').click();
    await page.locator('.key[data-key="j"]').click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="i"]').click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="3"]').click();
    await page.locator('.key[data-key=" "]').click();
    await page.locator('.key[data-key="Escape"]').click();
    expect((await state(page))).toMatchObject({ complete: true, code: ["# alpha", "# beta", "# gamma"], cursor: [0, 0], modifiers: [] });

    await page.goto("/?unit=visual-selection&activity=append-block-demo-recall");
    await page.locator(".cm-content").focus();
    await page.keyboard.press("Control+v");
    await page.keyboard.type("2j");
    await page.keyboard.press("Shift+A");
    await page.keyboard.type("!");
    await page.keyboard.press("Escape");
    expect((await state(page))).toMatchObject({ complete: true, code: ["one!", "two!", "six!"], cursor: [0, 2] });
  });

  test("holds Unit 7 Visual demo checkpoints long enough to read", async ({ page }) => {
    await page.goto("/?unit=visual-selection&activity=visual-shapes-demo");
    await page.getByRole("button", { name: "Play" }).click();
    await page.waitForTimeout(700);
    expect((await state(page))).toMatchObject({ playbackStep: 1, mode: "visual" });
  });

  test("matches native around-quote whitespace and balanced HTML tag objects", async ({ page }) => {
    await page.goto("/?unit=text-objects&activity=delete-around-double-quotes");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page))).toMatchObject({ complete: true, code: ["send(, next)"], cursor: [0, 5] });

    await page.goto("/?unit=text-objects&activity=change-inside-tag");
    await expect.poll(async () => (await state(page)).activityId).toBe("change-inside-tag");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page))).toMatchObject({ complete: true, code: ["<p>Ready</p>"], cursor: [0, 7] });

    await page.goto("/?unit=text-objects&activity=delete-around-tag");
    await expect.poll(async () => (await state(page)).activityId).toBe("delete-around-tag");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page))).toMatchObject({ complete: true, code: [""], cursor: [0, 0] });
  });

  test("preserves a completed edit when character assets finish loading", async ({ page }) => {
    let releaseManifest;
    await page.route("**/assets/characters/manifest.json", async route => {
      await new Promise(resolve => { releaseManifest = resolve; });
      await route.continue();
    });
    await page.goto("/?unit=text-objects&activity=delete-around-double-quotes");
    await expect.poll(() => Boolean(releaseManifest)).toBe(true);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page))).toMatchObject({ complete: true, code: ["send(, next)"], cursor: [0, 5] });
    releaseManifest();
    await page.waitForFunction(() => document.documentElement.dataset.charactersReady === "true");
    expect((await state(page))).toMatchObject({ complete: true, code: ["send(, next)"], cursor: [0, 5] });
  });

  test("renders affected text-object ranges and clears them on reset", async ({ page }) => {
    await page.goto("/?unit=text-objects&activity=around-double-quote-demo");
    for (let index = 0; index < 3; index += 1) await page.getByRole("button", { name: "Step" }).click();
    await expect(page.locator(".cm-preview-range")).toHaveCount(1);
    await expect(page.locator(".cm-preview-range")).toHaveText(' "draft"');
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.locator(".cm-preview-range")).toHaveCount(0);
  });

  test("enters shifted Unit 6 objects from touch and physical keyboards", async ({ page }) => {
    await page.goto("/?unit=text-objects&activity=change-inside-double-quotes-recall");
    await page.locator('.key[data-key="c"]').click();
    await page.locator('.key[data-key="i"]').click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="\'"]').click();
    for (const key of ["r", "e", "a", "d", "y", "Escape"]) await page.locator(`.key[data-key="${key}"]`).click();
    expect((await state(page))).toMatchObject({ complete: true, code: ['name = "ready";'], modifiers: [] });

    await page.goto("/?unit=text-objects&activity=inside-open-brace-recall");
    await page.locator('.key[data-key="y"]').click();
    await page.locator('.key[data-key="i"]').click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="["]').click();
    expect((await state(page)).complete).toBe(true);

    await page.goto("/?unit=text-objects&activity=around-open-angle-recall");
    await page.locator(".cm-content").focus();
    await page.keyboard.type("ya");
    await page.keyboard.press("Shift+,");
    expect((await state(page)).complete).toBe(true);
  });

  test("keeps gn forward and gN backward with ordered Visual match ranges", async ({ page }) => {
    await page.goto("/?unit=precision-motions-search&activity=select-search-matches");
    const keys = precisionActivities.find(activity => activity.id === "select-search-matches").script.steps;
    await page.evaluate(tokens => tokens.slice(0, 10).forEach(token => window.VimWilds.emit(token)), keys);
    expect((await state(page))).toMatchObject({
      mode: "visual",
      selection: { kind: "linear", from: [0, 11], to: [0, 16] },
    });
    await page.evaluate(tokens => tokens.slice(10, 14).forEach(token => window.VimWilds.emit(token)), keys);
    expect((await state(page))).toMatchObject({
      mode: "visual",
      selection: { kind: "linear", from: [0, 22], to: [0, 27] },
    });
    await page.evaluate(token => window.VimWilds.emit(token), keys.at(-1));
    expect((await state(page))).toMatchObject({ complete: true, code: ["draft keep draft keep draft."], cursor: [0, 26] });
  });

  test("enters Unit 5 shifted search and structure motions from touch and physical keyboards", async ({ page }) => {
    await page.goto("/?unit=precision-motions-search&activity=search-previous-ready-word-recall");
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="3"]').click();
    expect((await state(page))).toMatchObject({ complete: true, cursor: [0, 0], modifiers: [] });

    await page.goto("/?unit=precision-motions-search&activity=match-closing-brace-recall");
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="5"]').click();
    expect((await state(page))).toMatchObject({ complete: true, cursor: [2, 0], modifiers: [] });

    await page.goto("/?unit=precision-motions-search&activity=move-next-sentence-recall");
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="0"]').click();
    expect((await state(page))).toMatchObject({ complete: true, cursor: [0, 12], modifiers: [] });

    await page.goto("/?unit=precision-motions-search&activity=search-backward-error");
    await page.locator(".cm-content").focus();
    await page.keyboard.type("?ERROR");
    await page.keyboard.press("Enter");
    expect((await state(page))).toMatchObject({ complete: true, cursor: [3, 0] });
  });

  test("conforms Unit 4 operator state, formatting width, put shape, and repeat reset", async ({ page }) => {
    await page.goto("/?unit=operator-grammar&activity=delete-motion-demo");
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page))).toMatchObject({ mode: "operator-pending", code: ["cache stale value"], cursor: [0, 6] });

    for (const id of ["yank-line-shorthand", "multiply-operator-counts", "reindent-whole-buffer", "format-with-gq", "format-with-gw", "dot-change-demo"]) {
      const activity = operatorActivities.find(item => item.id === id);
      const result = await page.evaluate(activityId => {
        window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(item => item.sourceActivityId === activityId || item.id === activityId));
        window.VimWilds.solveCurrent();
        return window.VimWilds.getState();
      }, id);
      expect(result.code, id).toEqual(activity.scenario.target.lines);
      expect(result.cursor, id).toEqual(activity.scenario.target.cursor);
      expect(result.complete, id).toBe(activity.type === "exercise");
    }

    await page.goto("/?unit=operator-grammar&activity=dot-change-demo");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    expect((await state(page))).toMatchObject({ code: ["state old", "state old"], cursor: [0, 6], history: [], playbackStep: 0 });
  });

  test("enters Unit 4 uppercase and shifted operators through touch and physical keys", async ({ page }) => {
    await page.goto("/?unit=operator-grammar&activity=shift-current-line-recall");
    for (let index = 0; index < 2; index += 1) {
      await page.locator('[data-mod="Shift"]').first().click();
      await page.locator('.key[data-key="."]').click();
    }
    expect((await state(page))).toMatchObject({ complete: true, code: ["  alpha", "beta"], modifiers: [] });

    await page.goto("/?unit=operator-grammar&activity=yank-line-shorthand-recall");
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="y"]').click();
    await page.locator('.key[data-key="j"]').click();
    await page.locator('[data-mod="Shift"]').first().click();
    await page.locator('.key[data-key="p"]').click();
    expect((await state(page))).toMatchObject({ complete: true, code: ["const one = 1;", "const one = 1;", "const two = 2;"] });

    await page.goto("/?unit=operator-grammar&activity=unshift-motion-range");
    await page.locator(".cm-content").focus();
    await page.keyboard.press("Shift+,");
    await page.keyboard.press("j");
    expect((await state(page))).toMatchObject({ complete: true, code: ["alpha", "beta", "gamma"] });
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
    await expect(page.getByRole("button", { name: "Back" })).toBeEnabled();
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Step" })).toBeDisabled();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Step" })).toBeEnabled();
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    expect((await state(page)).playbackStep).toBe(0);
    await page.getByRole("button", { name: "Next" }).click();
    expect((await state(page)).activityId).toBe("dot-python-values");
  });

  test("groups Insert text into one demo step and replays backward deterministically", async ({ page }) => {
    await page.goto("/?unit=entering-changing-text&activity=entry-points-demo");
    await expect(page.getByRole("button", { name: "Back" })).toBeDisabled();

    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page))).toMatchObject({
      playbackStep: 1,
      mode: "insert",
      code: ["  enabled = true"],
    });

    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page))).toMatchObject({
      playbackStep: 7,
      mode: "insert",
      code: ["  const enabled = true"],
    });

    await page.getByRole("button", { name: "Back" }).click();
    expect((await state(page))).toMatchObject({
      playbackStep: 1,
      mode: "insert",
      code: ["  enabled = true"],
    });

    await page.getByRole("button", { name: "Step" }).click();
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page))).toMatchObject({
      playbackStep: 8,
      mode: "normal",
      code: ["  const enabled = true"],
    });
    await page.getByRole("button", { name: "Back" }).click();
    expect((await state(page))).toMatchObject({
      playbackStep: 7,
      mode: "insert",
      code: ["  const enabled = true"],
    });
  });

  test("reconstructs search, register, seeded, and viewport demo state when stepping back", async ({ page }) => {
    for (const [unitId, activityId, stepsBefore] of [
      ["precision-motions-search", "pattern-search-demo", 2],
      ["registers-putting", "unnamed-line-demo", 2],
      ["long-range-navigation", "last-change-line-demo", 1],
    ]) {
      await page.goto(`/?unit=${unitId}&activity=${activityId}`);
      for (let index = 0; index < stepsBefore; index += 1) {
        await page.getByRole("button", { name: "Step" }).click();
      }
      const before = await state(page);
      await page.getByRole("button", { name: "Step" }).click();
      await page.getByRole("button", { name: "Back" }).click();
      const restored = await state(page);
      expect(restored.playbackStep, activityId).toBe(before.playbackStep);
      expect(restored.code, activityId).toEqual(before.code);
      expect(restored.cursor, activityId).toEqual(before.cursor);
      expect(restored.mode, activityId).toBe(before.mode);
      expect(restored.registers, activityId).toEqual(before.registers);
      expect(restored.viewport, activityId).toEqual(before.viewport);
    }
  });

  test("lets guided and recall activities enter unrestricted Explore without awarding completion", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    const initial = await state(page);
    await page.getByRole("button", { name: "Explore" }).click();
    await expect(page.locator("#commandExplanation")).toContainText("use any Vim commands");
    await expect(page.locator(".status-key")).toBeHidden();
    expect((await state(page))).toMatchObject({
      practiceMode: "guided",
      practicePolicy: "explore",
      complete: false,
      exploreTargetReached: false,
      history: [],
      code: initial.code,
    });

    await page.evaluate(() => window.VimWilds.emit("l"));
    expect((await state(page)).history).toEqual(["l"]);
    await page.getByRole("button", { name: "Open hints" }).click();
    await expect(page.locator("#helpCard")).toHaveClass(/open/);
    await page.getByRole("button", { name: "Close help" }).click();
    await page.getByRole("button", { name: "Reset activity" }).click();
    expect((await state(page))).toMatchObject({
      practicePolicy: "explore",
      history: [],
      code: initial.code,
    });

    await page.evaluate(() => window.VimWilds.solveCurrent());
    expect((await state(page))).toMatchObject({
      practicePolicy: "explore",
      exploreTargetReached: true,
      complete: false,
    });
    await expect(page.locator("#commandExplanation")).toContainText("Target reached");
    await page.evaluate(() => window.VimWilds.emit("u"));
    const afterUndo = await state(page);
    expect(afterUndo.complete).toBe(false);
    expect(afterUndo.history.at(-1)).toBe("u");
    expect(afterUndo.code).not.toEqual(initial.code.map(line => line.replace("draft", "ready")));

    await page.getByRole("button", { name: "Exit" }).click();
    expect((await state(page))).toMatchObject({
      practiceMode: "guided",
      practicePolicy: "guided-sequence",
      exploreTargetReached: false,
      history: [],
      code: initial.code,
    });

    await page.evaluate(() => window.VimWilds.goToActivity(
      window.VimWilds.activities.findIndex(activity => activity.id === "dot-python-values-recall"),
    ));
    await page.getByRole("button", { name: "Explore" }).click();
    expect((await state(page))).toMatchObject({ practiceMode: "recall", practicePolicy: "explore" });
    await page.getByRole("button", { name: "Exit" }).click();
    expect((await state(page))).toMatchObject({
      practiceMode: "recall",
      practicePolicy: "recall-sequence",
      history: [],
    });
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
    }));
    expect(inlineColors.hint).toBe("rgb(102, 86, 61)");
    await expect(page.locator("#activityInstruction code")).toHaveCount(0);
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

  test("keeps practice copy outcome-only and gives guided and recall mistakes distinct feedback", async ({ page }) => {
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await expect(page.locator("#activityInstruction code")).toHaveCount(0);
    await expect(page.locator("#activityInstruction")).toContainText("ready");
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
    await page.route("**/assets/characters/**/animations/*.webp", route => route.abort());
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator(".nix.celebrating")).toHaveCount(0);
    await expect(page.locator('.nix[src*="assets/characters/"]')).toBeVisible();
  });

  test("renders each Moonroot unit as a clipped registered scene with stable identity", async ({ page }) => {
    const scenes = [
      ["modal-model", "mode-lantern-grounds", "mode-lantern"],
      ["cursor-movement", "wayfinder-crossroads", "wayfinder"],
      ["entering-changing-text", "scribes-spring", "scribes-spring"],
      ["operator-grammar", "grammar-gate-court", "grammar-gate"],
    ];
    for (const [unitId, sceneId, landmarkId] of scenes) {
      await page.goto(`/?unit=${unitId}`);
      const rendered = await page.locator("#world").evaluate(node => ({
        data: { ...node.dataset },
        classes: [...node.classList],
        ambientEffects: node.querySelectorAll(".world-ambient-effect").length,
        decorativeImages: node.querySelectorAll(".world-backdrop img, .world-ambient img").length,
        backdrop: getComputedStyle(node.querySelector(".world-backdrop")).backgroundImage,
        pointerEvents: [".world-backdrop", ".world-ambient"]
          .map(selector => getComputedStyle(node.querySelector(selector)).pointerEvents),
      }));
      expect(rendered.data).toMatchObject({
        renderer: "registered-scenes",
        unitId,
        worldId: "moonroot-ruins",
        sceneId,
        landmarkId,
        mode: "normal",
        reducedMotion: "false",
      });
      expect(["tall", "compact", "wide", "shallow"]).toContain(rendered.data.boardProfile);
      expect(rendered.classes).toContain("theme-moonroot");
      expect(rendered.ambientEffects).toBeGreaterThan(0);
      expect(rendered.decorativeImages).toBe(0);
      expect(rendered.backdrop).toContain("gradient");
      expect(rendered.pointerEvents).toEqual(["none", "none"]);

      await page.evaluate(() => window.VimWilds.goTo(0));
      await expect(page.locator("#characterLayer > .nix")).toHaveCount(1);
      await expect(page.locator("#worldGrid > .nix")).toHaveCount(0);
    }

    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByLabel("Moonroot Ruins").check();
    await expect(page.locator("#world")).toHaveClass(/theme-moonroot/);
    await expect(page.locator("#world")).toHaveAttribute("data-world-id", "moonroot-ruins");
  });

  test("switches board composition live without resetting the active Vim activity", async ({ page }) => {
    await page.goto("/?unit=modal-model&activity=practice-two-delete-words");
    await page.evaluate(() => window.VimWilds.emit("d"));
    const before = await state(page);
    for (const [width, height, profile, sceneProfile] of [
      [320, 400, "tall", "compact"],
      [480, 400, "compact", "compact"],
      [800, 400, "wide", "compact"],
      [1000, 400, "shallow", "wide"],
    ]) {
      await page.locator("#world").evaluate((node, size) => {
        Object.assign(node.style, {
          position: "fixed",
          inset: "auto",
          top: "0",
          left: "0",
          width: `${size.width}px`,
          height: `${size.height}px`,
        });
        window.dispatchEvent(new Event("orientationchange"));
      }, { width, height });
      await expect(page.locator("#world")).toHaveAttribute("data-board-profile", profile);
      await expect(page.locator("#worldBackdrop")).toHaveAttribute("data-scene-profile", sceneProfile);
      expect(await state(page)).toMatchObject({
        activityId: before.activityId,
        progress: before.progress,
        history: before.history,
        code: before.code,
        cursor: before.cursor,
      });
    }
  });

  test("marks reduced motion and skips the unit-entry reveal", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?unit=modal-model");
    await expect(page.locator("#world")).toHaveAttribute("data-reduced-motion", "true");
    expect(await page.locator(".world-ambient-effect").first().evaluate(node => getComputedStyle(node).animationName)).toBe("none");
    await expect(page.locator("#world")).not.toHaveClass(/scene-reveal-active/);
  });

  test("leaves board art unavailable when presentation data is invalid", async ({ page }) => {
    await page.route("**/content/presentation.json", route => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 2, worlds: {}, units: {}, story: {} }),
    }));
    await page.goto("/?unit=modal-model");
    await expect(page.locator("#world")).toHaveAttribute("data-renderer", "unavailable");
    await expect(page.locator("#world")).toHaveAttribute("data-unit-id", "modal-model");
    await expect(page.locator("#world")).toHaveAttribute("data-world-id", "none");
    await expect(page.locator(".world-ambient-effect")).toHaveCount(0);
  });

  test("persists independent generated-scene and character preferences", async ({ page }) => {
    const decorativeRequests = [];
    page.on("request", request => {
      if (/assets\/(?:characters|worlds)\//.test(request.url())) decorativeRequests.push(request.url());
    });
    await page.addInitScript(() => {
      const key = "vim-wilds.session.v1";
      const existing = JSON.parse(window.localStorage.getItem(key) || "{}");
      window.localStorage.setItem(key, JSON.stringify({
        ...existing,
        generatedBackdrops: existing.generatedBackdrops || "disabled",
        characters: existing.characters || "disabled",
      }));
    });
    await page.goto("/?unit=modal-model&activity=escape-seeded-insert");
    expect((await state(page))).toMatchObject({
      generatedBackdrops: "disabled",
      characters: "disabled",
    });
    await expect(page.locator("#world")).toHaveAttribute("data-renderer", "registered-scenes");
    await expect(page.locator("#world")).toHaveAttribute("data-simple-background", "true");
    await expect(page.locator(".nix")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-characters-ready", "disabled");
    expect(decorativeRequests.some(url => url.includes("scenes/mode-lantern-grounds/"))).toBe(true);

    const editorBefore = await state(page);
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByLabel("Show generated scenes").check();
    await expect(page.locator("#world")).toHaveAttribute("data-renderer", "registered-scenes");
    expect((await state(page))).toMatchObject({
      code: editorBefore.code,
      cursor: editorBefore.cursor,
      characters: "disabled",
    });
    await expect(page.locator(".nix")).toHaveCount(0);

    await page.getByLabel("Show characters").check();
    await page.waitForFunction(() => document.documentElement.dataset.charactersReady === "true");
    await expect(page.locator(".nix")).toHaveCount(1);
    expect((await state(page))).toMatchObject({
      generatedBackdrops: "enabled",
      characters: "enabled",
    });
    await page.getByLabel("Use simple backgrounds").check();
    await expect(page.locator("#world")).toHaveAttribute("data-renderer", "registered-scenes");
    await expect(page.locator(".nix")).toHaveCount(1);
    await page.getByLabel("Show generated scenes").check();

    await page.reload();
    expect((await state(page))).toMatchObject({
      generatedBackdrops: "enabled",
      characters: "enabled",
    });
    await expect(page.locator(".nix")).toHaveCount(1);

    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByLabel("Use simple backgrounds").check();
    await page.getByLabel("Hide characters").check();
    await page.getByRole("button", { name: "Close settings" }).click();
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values");
    await expect(page.locator("#world")).toHaveAttribute("data-renderer", "registered-scenes");
    await expect(page.locator("#world")).toHaveAttribute("data-simple-background", "true");
    await expect(page.locator(".nix")).toHaveCount(0);
    const baseBackground = await page.locator("#worldBackdrop").evaluate(node => getComputedStyle(node, "::before").backgroundImage);
    expect(baseBackground).toContain("scenes/echo-clock/");
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
      desktop: innerWidth >= 1024,
      panel: document.querySelector(".keyboard-panel").getBoundingClientRect().height,
      completion: document.querySelector(".completion-panel").getBoundingClientRect().height,
      keyboard: document.querySelector(".keyboard").getBoundingClientRect().height,
      next: document.querySelector(".completion-panel button").getBoundingClientRect().toJSON(),
    }));
    if (geometry.desktop) {
      expect(geometry.panel).toBeGreaterThanOrEqual(geometry.completion);
      expect(geometry.panel).toBeLessThanOrEqual(geometry.completion + 24);
      expect(geometry.panel).toBeLessThanOrEqual(keyboardHeight);
    } else {
      expect(geometry.panel).toBeCloseTo(keyboardHeight, 0);
      expect(geometry.completion).toBeCloseTo(geometry.keyboard, 0);
    }
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
    await expect(page.locator(".choice-feedback.incorrect")).toContainText("Not quite.");
    await expect(page.locator(`[data-choice="${wrong.id}"]`)).toHaveClass(/incorrect/);
    await page.locator(`[data-choice="${correct.id}"]`).click();
    expect((await state(page)).complete).toBe(true);
    await expect(page.locator(".choice-feedback.correct")).toContainText("Correct.");
    await expect(page.locator(`[data-choice="${correct.id}"]`)).toHaveClass(/correct/);
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
    const consoleMeasurements = await page.evaluate(async () => {
      const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const measurements = [];
      for (const [index, activity] of window.VimWilds.activities.entries()) {
        if (!activity.script) continue;
        window.VimWilds.goToActivity(index);
        await settle();
        const heights = [document.querySelector("#nextCommandTray").getBoundingClientRect().height];
        window.VimWilds.solveCurrent();
        await settle();
        heights.push(document.querySelector("#nextCommandTray").getBoundingClientRect().height);
        const history = document.querySelector("#nextCommandText");
        const explanation = document.querySelector("#commandExplanation");
        measurements.push({
          id: activity.id,
          heights,
          historyFits: history.scrollHeight <= history.clientHeight + 1,
          explanationFits: explanation.scrollHeight <= explanation.clientHeight + 1,
        });
      }
      return measurements;
    });
    for (const measurement of consoleMeasurements) {
      expect(new Set(measurement.heights.map(height => Math.round(height * 10) / 10)).size, measurement.id).toBe(1);
      expect(measurement.historyFits, `${measurement.id} history`).toBe(true);
      expect(measurement.explanationFits, `${measurement.id} explanation`).toBe(true);
    }

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

  test("reserves long canonical history and wrapped guidance on narrow phones", async ({ page }) => {
    const activity = automationActivities.find(item => item.id === "integrated-global-substitute");
    for (const [width, height] of [[360, 740], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/?unit=global-normal-automation&activity=integrated-global-substitute");
      await page.waitForFunction(() => getComputedStyle(document.querySelector("#phone")).getPropertyValue("--execution-console-height").trim());
      const result = await page.evaluate(async keys => {
        const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const capture = () => {
          const tray = document.querySelector("#nextCommandTray");
          const history = document.querySelector("#nextCommandText");
          const explanation = document.querySelector("#commandExplanation");
          const lineHeight = Number.parseFloat(getComputedStyle(explanation).lineHeight);
          return {
            height: tray.getBoundingClientRect().height,
            historyFits: history.scrollHeight <= history.clientHeight + 1,
            explanationFits: explanation.scrollHeight <= explanation.clientHeight + 1,
            explanationLines: explanation.getBoundingClientRect().height / lineHeight,
            overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          };
        };
        await settle();
        const samples = [capture()];
        for (const key of keys) {
          window.VimWilds.emit(key);
          await settle();
          samples.push(capture());
        }
        return { samples, state: window.VimWilds.getState() };
      }, keysFor(activity));
      expect(new Set(result.samples.map(sample => sample.height)).size, `${width}px stable console`).toBe(1);
      expect(result.samples.every(sample => sample.historyFits), `${width}px history`).toBe(true);
      expect(result.samples.every(sample => sample.explanationFits), `${width}px guidance`).toBe(true);
      expect(result.samples.some(sample => sample.explanationLines > 1.5), `${width}px wrapped guidance`).toBe(true);
      expect(result.samples.every(sample => !sample.overflow), `${width}px viewport`).toBe(true);
      expect(result.state).toMatchObject({ complete: true, code: activity.scenario.target.lines });
    }
  });

  test("keeps unbounded Explore edits inside the planned editor and history surfaces", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?unit=repeatable-editing&activity=dot-python-values-recall");
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#phone")).getPropertyValue("--execution-console-height").trim());
    await page.getByRole("button", { name: "Explore" }).click();
    const result = await page.evaluate(async () => {
      const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await settle();
      const tray = document.querySelector("#nextCommandTray");
      const slab = document.querySelector(".next-code-slab");
      const before = { tray: tray.getBoundingClientRect().height, slab: slab.getBoundingClientRect().height };
      for (let index = 0; index < 100; index += 1) {
        for (const key of ["o", "x", "Escape"]) window.VimWilds.emit(key);
      }
      await settle();
      const history = document.querySelector("#nextCommandText");
      const scroller = document.querySelector(".cm-scroller");
      const cursor = document.querySelector(".cm-cursor").getBoundingClientRect();
      const scrollerBounds = scroller.getBoundingClientRect();
      const afterGrowth = {
        tray: tray.getBoundingClientRect().height,
        slab: slab.getBoundingClientRect().height,
        historyScrolls: history.scrollHeight > history.clientHeight + 1,
        historyAtEnd: history.scrollTop + history.clientHeight >= history.scrollHeight - 1,
        editorScrolls: scroller.scrollHeight > scroller.clientHeight + 1,
        cursorVisible: cursor.top >= scrollerBounds.top - 1 && cursor.bottom <= scrollerBounds.bottom + 1,
      };
      history.scrollTop = 0;
      const olderHistoryReachable = history.scrollTop === 0;
      window.VimWilds.emit("j");
      await settle();
      return {
        before,
        afterGrowth,
        olderHistoryReachable,
        historyReturnsToEnd: history.scrollTop + history.clientHeight >= history.scrollHeight - 1,
        plannedRows: Number(document.querySelector(".editor-stack").dataset.plannedRows),
        state: window.VimWilds.getState(),
      };
    });
    expect(result.afterGrowth.tray).toBe(result.before.tray);
    expect(result.afterGrowth.slab).toBe(result.before.slab);
    expect(result.afterGrowth.historyScrolls).toBe(true);
    expect(result.afterGrowth.historyAtEnd).toBe(true);
    expect(result.afterGrowth.editorScrolls).toBe(true);
    expect(result.afterGrowth.cursorVisible).toBe(true);
    expect(result.olderHistoryReachable).toBe(true);
    expect(result.historyReturnsToEnd).toBe(true);
    expect(result.state.code.length).toBeGreaterThan(result.plannedRows);
  });

  test("renders grammar breaks, recall labels, and semantic assemblies without narrow-screen overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/?unit=cursor-movement&activity=home-row-directions");
    const grammar = await page.locator(".grammar").textContent();
    expect(grammar).toContain("\n");
    expect(grammar).not.toContain(" · ");

    await page.goto("/?unit=precision-motions-search&activity=cursor-word-search-meaning");
    await expect(page.locator(".grammar")).toContainText("* / #");
    expect(await page.locator(".grammar").textContent()).toContain("\n");

    await page.goto("/?unit=cursor-movement&activity=top-line-next-word-recall");
    await expect(page.locator(".status-primary")).toHaveText("Recall");
    await expect(page.locator(".status-secondary")).toHaveText("From\nmemory");
    const recallGeometry = await page.evaluate(() => {
      const tray = document.querySelector("#nextCommandTray");
      const rail = document.querySelector(".execution-status");
      const secondary = document.querySelector(".status-secondary");
      return {
        trayFits: tray.scrollWidth <= tray.clientWidth,
        railFits: rail.scrollWidth <= rail.clientWidth,
        secondaryFits: secondary.scrollWidth <= secondary.clientWidth,
        bodyFits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    expect(recallGeometry).toEqual({
      trayFits: true,
      railFits: true,
      secondaryFits: true,
      bodyFits: true,
    });

    await page.goto("/?unit=cursor-movement&activity=home-row-grid-demo");
    await expect(page.locator(".execution-assembly small")).toHaveText(["3×", "right", "2×", "down", "left", "up"]);
    const assemblyGeometry = await page.evaluate(() => {
      const tray = document.querySelector("#nextCommandTray").getBoundingClientRect();
      const assembly = document.querySelector(".execution-assembly").getBoundingClientRect();
      const parts = [...document.querySelectorAll(".assembly-part")].map(node => node.getBoundingClientRect());
      return {
        withinTray: assembly.left >= tray.left - 1 && assembly.right <= tray.right + 1,
        partsBounded: parts.every(part => part.left >= assembly.left - 1 && part.right <= assembly.right + 1),
        bodyFits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    expect(assemblyGeometry).toEqual({
      withinTray: true,
      partsBounded: true,
      bodyFits: true,
    });
  });

  test("fills the visible phone viewport and keeps the Normal cursor readable", async ({ page }) => {
    for (const [width, height] of [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]]) {
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

  test("keeps every production activity inside the target phone viewports without clipping @exhaustive", async ({ page }) => {
    // This exhaustively renders every activity at every target viewport. Keep
    // the budget proportional to the growing production curriculum so CI can
    // complete the coverage rather than timing out mid-matrix.
    // The matrix mounts every activity for five physical phone viewports.
    // Keep this intentionally exhaustive regression check independent of the
    // default test timeout as the published curriculum grows.
    test.setTimeout(1500000);
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]];
    const textSelector = [
      ".lesson-label", ".activity-intro h1", ".activity-intro p", ".command-explanation", ".next-command-tray .command-text",
      ".next-command-tray .status-primary", ".next-command-tray .status-secondary", ".next-command-tray .command-key",
      ".field-note h2", ".field-note p", ".grammar", ".choice-option", ".demo-controls button", ".completion-panel strong", ".completion-panel p", ".cm-vim-message",
      ".mode-spoke strong", ".mode-spoke small", ".forge-part small", ".assembly-part small",
    ].join(",");
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (const unitId of ["modal-model", "cursor-movement", "entering-changing-text", "operator-grammar", "precision-motions-search", "text-objects", "visual-selection", "registers-putting", "long-range-navigation", "repeatable-editing", "command-line-ranges-line-operations", "substitution-practical-regex", "macros", "global-normal-automation"]) {
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

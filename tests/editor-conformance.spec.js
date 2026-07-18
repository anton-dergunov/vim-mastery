import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const unit = JSON.parse(readFileSync(new URL("../content/units/repeatable-editing.json", import.meta.url), "utf8"));
const activities = unit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const keysFor = activity => activity.script?.steps.map(step => typeof step === "string" ? step : step.key) || [];
const indexOf = id => activities.findIndex(activity => activity.id === id);

async function state(page) {
  return page.evaluate(() => window.VimWilds.getState());
}

test.describe("Repeatable editing content runtime", () => {
  test("the table of contents and public activity API expose the complete authored order", async ({ page }) => {
    await page.goto("/");
    expect(await page.locator("#activitySelect option").count()).toBe(activities.length);
    const summaryIndex = indexOf("repeat-unit-summary");
    await page.locator("#activitySelect").selectOption(String(summaryIndex));
    expect((await state(page)).activityId).toBe("repeat-unit-summary");
    await page.evaluate(index => window.VimWilds.goToActivity(index), 0);
    const first = await state(page);
    expect(first).toMatchObject({ activityId: "dot-is-a-change", activityType: "theory", lessonId: "one-change-many-uses" });
    await expect(page.locator(".field-note").getByRole("button", { name: /show example/i })).toBeVisible();
  });

  test("theory links to its authored demo and a demo steps one token at a time", async ({ page }) => {
    await page.goto("/");
    await page.locator(".note-action").click();
    expect((await state(page)).activityId).toBe("dot-append-demo");
    const demo = activities[indexOf("dot-append-demo")];
    for (let step = 1; step <= keysFor(demo).length; step += 1) {
      await page.getByRole("button", { name: "Step" }).click();
      expect((await state(page)).playbackStep).toBe(step);
    }
    const after = await state(page);
    expect(after.code).toEqual(demo.scenario.target.lines);
    expect(after.cursor).toEqual(demo.scenario.target.cursor);
    await expect(page.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  test("normal and slow demo playback pause and reset deterministically", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(index => window.VimWilds.goToActivity(index), indexOf("find-todos-demo"));
    await page.getByRole("button", { name: "Play" }).click();
    await page.waitForTimeout(480);
    await page.getByRole("button", { name: "Pause" }).click();
    expect((await state(page)).playbackStep).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Reset" }).click();
    expect((await state(page)).playbackStep).toBe(0);
    await page.getByRole("button", { name: "Slow" }).click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: "Pause" }).click();
    expect((await state(page)).playbackStep).toBeGreaterThan(0);
  });

  test("practice rejects wrong virtual input without changing the editor or history", async ({ page }) => {
    await page.goto("/");
    const exercise = activities[indexOf("dot-python-values")];
    await page.evaluate(index => window.VimWilds.goToActivity(index), indexOf(exercise.id));
    const before = await state(page);
    await page.evaluate(() => window.VimWilds.emit("x"));
    const rejected = await state(page);
    expect(rejected.code).toEqual(before.code);
    expect(rejected.cursor).toEqual(before.cursor);
    expect(rejected.history).toEqual(before.history);
    expect(rejected.progress).toBe(0);
    await page.evaluate(keys => keys.forEach(key => window.VimWilds.emit(key)), keysFor(exercise));
    const complete = await state(page);
    expect(complete.complete).toBe(true);
    expect(complete.code).toEqual(exercise.scenario.target.lines);
  });

  test("practice routes physical keys through the same exact-sequence gate", async ({ page }) => {
    await page.goto("/");
    const exercise = activities[indexOf("dot-go-booleans")];
    await page.evaluate(index => window.VimWilds.goToActivity(index), indexOf(exercise.id));
    await page.locator(".cm-content").focus();
    await page.keyboard.press("x");
    expect((await state(page)).history).toEqual([]);
    await page.keyboard.press("c");
    expect((await state(page)).history).toEqual(["c"]);
    await page.evaluate(keys => keys.forEach(key => window.VimWilds.emit(key)), keysFor(exercise).slice(1));
    expect((await state(page)).complete).toBe(true);
  });

  test("every authored practice exercise can complete through its canonical sequence", async ({ page }) => {
    await page.goto("/");
    for (const exercise of activities.filter(activity => activity.type === "exercise")) {
      const result = await page.evaluate(({ id, keys }) => {
        const index = window.VimWilds.activities.findIndex(activity => activity.id === id);
        window.VimWilds.goToActivity(index);
        keys.forEach(key => window.VimWilds.emit(key));
        return window.VimWilds.getState();
      }, { id: exercise.id, keys: keysFor(exercise) });
      expect(result, exercise.id).toMatchObject({
        complete: true,
        code: exercise.scenario.target.lines,
        cursor: exercise.scenario.target.cursor,
      });
    }
  });

  test("every authored demonstration reaches its authored target through forward steps", async ({ page }) => {
    await page.goto("/");
    for (const demo of activities.filter(activity => activity.type === "demo")) {
      const result = await page.evaluate(({ id }) => {
        const index = window.VimWilds.activities.findIndex(activity => activity.id === id);
        window.VimWilds.goToActivity(index);
        window.VimWilds.solveCurrent();
        return window.VimWilds.getState();
      }, { id: demo.id });
      expect(result.playbackStep, demo.id).toBe(keysFor(demo).length);
      expect(result.code, demo.id).toEqual(demo.scenario.target.lines);
      expect(result.cursor, demo.id).toEqual(demo.scenario.target.cursor);
    }
  });

  test("choice feedback only completes on the authored answer and summaries can continue", async ({ page }) => {
    await page.goto("/");
    const choice = activities[indexOf("repeat-is-wrong-choice")];
    await page.evaluate(index => window.VimWilds.goToActivity(index), indexOf(choice.id));
    const wrong = choice.options.find(option => option.id !== choice.correctOptionId);
    const correct = choice.options.find(option => option.id === choice.correctOptionId);
    await page.locator(`[data-choice="${wrong.id}"]`).click();
    expect((await state(page)).complete).toBe(false);
    await expect(page.locator(".choice-feedback")).toBeVisible();
    await page.locator(`[data-choice="${correct.id}"]`).click();
    expect((await state(page)).complete).toBe(true);
    await page.getByRole("button", { name: /next/i }).click();
    expect((await state(page)).activityId).toBe("repeat-unit-summary");
  });

  test("phone layouts do not create document overflow at the supported viewport sizes", async ({ page }) => {
    for (const [width, height] of [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]]) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        width: window.innerWidth,
        height: window.innerHeight,
      }));
      expect(dimensions.scrollWidth, `${width}px width`).toBeLessThanOrEqual(dimensions.width);
      expect(dimensions.scrollHeight, `${height}px height`).toBeLessThanOrEqual(dimensions.height);
    }
  });
});

test.describe("Simplified UI review mode", () => {
  test("opens an accordion table of contents and navigates to any authored activity", async ({ page }) => {
    await page.goto("/?ui=next&activity=dot-python-values");
    await page.getByRole("button", { name: "Open table of contents" }).click();
    await expect(page.getByRole("dialog", { name: "Table of contents" })).toBeVisible();
    await expect(page.locator(".toc-lesson")).toHaveCount(unit.lessons.length);
    await expect(page.locator(".toc-activity")).toHaveCount(activities.length);
    await expect(page.locator(".toc-activity.current")).toContainText("Promote every cache mode");
    await expect(page.locator(".activity-type.type-theory").first()).toHaveText("Theory");
    await expect(page.locator(".activity-type.type-demo").first()).toHaveText("Demo");
    await expect(page.locator(".activity-type.type-exercise").first()).toHaveText("Exercise");
    await page.locator(".toc-lesson").nth(1).locator("summary").click();
    await page.locator(`[data-activity-index="${indexOf("repeat-self-contained")}"]`).click();
    await expect(page.getByRole("dialog", { name: "Table of contents" })).not.toBeVisible();
    expect((await state(page)).activityId).toBe("repeat-self-contained");
  });

  test("persists a manual world theme without changing the current activity", async ({ page }) => {
    await page.goto("/?ui=next&activity=dot-append-demo");
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.getByLabel("Hall of Mirrors").check();
    await expect(page.locator("#world")).toHaveClass(/theme-glass/);
    expect(await page.evaluate(() => localStorage.getItem("vim-wilds.theme"))).toBe("glass");
    expect((await state(page)).activityId).toBe("dot-append-demo");
    await page.reload();
    await expect(page.locator("#world")).toHaveClass(/theme-glass/);
  });

  test("keeps demo controls beside the editor and allows replay or immediate navigation", async ({ page }) => {
    await page.goto("/?ui=next&activity=dot-append-demo");
    await expect(page.locator(".command-explanation")).toHaveText("Append once and finish the change.");
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).playbackStep).toBe(1);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.getByRole("button", { name: "Replay" })).toBeVisible();
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    expect((await state(page)).activityId).toBe("dot-python-values");
  });

  test("replaces the completed exercise keyboard with full authored feedback", async ({ page }) => {
    const exercise = activities[indexOf("dot-python-values")];
    await page.goto("/?ui=next&activity=dot-python-values");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator(".keyboard")).not.toBeVisible();
    const result = page.locator(".completion-panel");
    await expect(result).toBeVisible();
    await expect(result.locator("strong")).toHaveText(exercise.feedback.success);
    await expect(result.locator("p")).toHaveText(exercise.feedback.why);
    await expect(result.getByRole("button", { name: "Next" })).toBeVisible();
  });

  test("renders all ordinary authored text without clipping at supported phone sizes", async ({ page }) => {
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]];
    const textSelector = [
      ".lesson-label",
      ".activity-intro h1",
      ".activity-intro p",
      ".command-explanation",
      ".next-command-tray .guidance",
      ".next-command-tray .command-text",
      ".field-note h2",
      ".field-note p",
      ".grammar",
      ".choice-option",
      ".control-deck button",
      ".completion-panel strong",
      ".completion-panel p",
      ".cm-vim-message",
    ].join(",");

    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/?ui=next");
      for (let index = 0; index < activities.length; index += 1) {
        await page.evaluate(activityIndex => window.VimWilds.goToActivity(activityIndex), index);
        const result = await page.evaluate(selector => {
          const clipped = [...document.querySelectorAll(selector)]
            .filter(element => element.getClientRects().length)
            .filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
            .map(element => ({ className: element.className, text: element.textContent }));
          const styles = [...document.querySelectorAll(selector)]
            .filter(element => element.getClientRects().length)
            .map(element => getComputedStyle(element));
          const phone = document.querySelector("#phone").getBoundingClientRect();
          const bounded = [
            ...document.querySelectorAll(".next-topbar > :not([hidden])"),
            document.querySelector(".activity-intro:not([hidden])"),
            document.querySelector(".next-command-tray:not(.hidden)"),
            document.querySelector(".game-area"),
            document.querySelector(".keyboard-panel:not(.empty-panel)"),
          ].filter(Boolean).filter(element => element.getClientRects().length);
          const outOfBounds = bounded.filter(element => {
            const rect = element.getBoundingClientRect();
            return rect.left < phone.left - 1 || rect.right > phone.right + 1 || rect.top < phone.top - 1 || rect.bottom > phone.bottom + 1;
          }).map(element => element.className);
          return {
            clipped,
            outOfBounds,
            usesEllipsis: styles.some(style => style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none"),
            documentOverflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
            editorFont: document.querySelector(".cm-scroller") ? parseFloat(getComputedStyle(document.querySelector(".cm-scroller")).fontSize) : null,
            guidanceFont: document.querySelector(".next-command-tray:not(.hidden) .guidance") ? parseFloat(getComputedStyle(document.querySelector(".next-command-tray .guidance")).fontSize) : null,
          };
        }, textSelector);
        expect(result.clipped, `${width}×${height} ${activities[index].id}`).toEqual([]);
        expect(result.outOfBounds, `${width}×${height} ${activities[index].id}`).toEqual([]);
        expect(result.usesEllipsis, `${width}×${height} ${activities[index].id}`).toBe(false);
        expect(result.documentOverflow, `${width}×${height} ${activities[index].id}`).toBe(false);
        if (result.editorFont !== null) expect(result.editorFont).toBeGreaterThanOrEqual(14);
        if (result.guidanceFont !== null) expect(result.guidanceFont).toBeGreaterThanOrEqual(16);
      }
    }
  });
});

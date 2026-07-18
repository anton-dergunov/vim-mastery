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

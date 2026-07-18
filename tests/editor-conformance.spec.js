import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const unit = JSON.parse(readFileSync(new URL("../content/units/repeatable-editing.json", import.meta.url), "utf8"));
const authoredActivities = unit.lessons.flatMap(lesson => lesson.activities.map(activity => ({ ...activity, lessonId: lesson.id })));
const authoredExercises = authoredActivities.filter(activity => activity.type === "exercise");
const keysFor = activity => activity.script?.steps.map(step => typeof step === "string" ? step : step.key) || [];
const indexOf = id => authoredActivities.findIndex(activity => activity.id === id);

async function state(page) {
  return page.evaluate(() => window.VimWilds.getState());
}

test.describe("Production lesson flow", () => {
  test("uses the polished UI as the only route and derives 70 runtime activities", async ({ page }) => {
    await page.goto("/?activity=dot-python-values");
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
    await page.goto("/?ui=next&activity=dot-python-values-recall");
    expect((await state(page))).toMatchObject({ activityId: "dot-python-values-recall", practiceMode: "recall", exerciseId: "dot-python-values" });
    await page.evaluate(() => window.VimWilds.goTo(0));
    expect((await state(page))).toMatchObject({ activityId: authoredExercises[0].id, practiceMode: "guided" });
  });

  test("keeps every theory card and opens its demo only from the final card", async ({ page }) => {
    await page.goto("/?activity=dot-is-a-change");
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    expect((await state(page)).activityId).toBe("dot-change-boundary");
    await expect(page.getByRole("button", { name: /show example/i })).toBeVisible();
    await page.getByRole("button", { name: /show example/i }).click();
    expect((await state(page)).activityId).toBe("dot-append-demo");
  });

  test("renders the unit table of contents with Guided and Recall pairs", async ({ page }) => {
    await page.goto("/?activity=dot-python-values");
    await page.getByRole("button", { name: "Open table of contents" }).click();
    await expect(page.locator(".toc-unit")).toHaveCount(1);
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

  test("keeps demo controls below the slab and preserves Play, Pause, Reset, Step, and Next", async ({ page }) => {
    await page.goto("/?activity=dot-append-demo");
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
    await page.goto("/");
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
    await page.goto("/?activity=dot-python-values");
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
    await page.goto("/?activity=dot-python-values");
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
    await page.goto("/?activity=dot-python-values");
    await expect(page.locator("#activityInstruction code")).toHaveText(["draft", "ready"]);
    await page.evaluate(() => window.VimWilds.emit("x"));
    await expect(page.locator(".status-key")).toHaveClass(/error/);
    await page.goto("/?activity=dot-python-values-recall");
    await expect(page.locator(".status-primary")).toHaveText("Recall");
    await page.evaluate(() => window.VimWilds.emit("x"));
    await expect(page.locator(".status-primary")).toHaveText("Try");
    await page.evaluate(() => window.VimWilds.emit("x"));
    await page.evaluate(() => window.VimWilds.emit("x"));
    await expect(page.locator(".status-primary")).toHaveText("Next");
    await expect(page.locator(".status-key .command-key")).toHaveText("c");
  });

  test("shows characters only for practice and choices, with stable practice celebrations", async ({ page }) => {
    await page.goto("/?activity=dot-python-values");
    await page.waitForFunction(() => document.documentElement.dataset.charactersReady === "true");
    const guidedCharacter = await page.locator(".nix").evaluate(node => ({ character: node.dataset.character, animation: node.dataset.animation }));
    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "dot-python-values-recall")));
    await page.waitForFunction(() => document.querySelector(".nix")?.dataset.character);
    const recallCharacter = await page.locator(".nix").evaluate(node => ({ character: node.dataset.character, animation: node.dataset.animation }));
    expect(recallCharacter).toEqual(guidedCharacter);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator('.nix.celebrating[src$=".webp"]')).toBeVisible();
    for (const id of ["dot-is-a-change", "dot-append-demo", "repeat-unit-summary"]) {
      await page.evaluate(activityId => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === activityId)), id);
      await expect(page.locator(".nix")).toHaveCount(0);
    }
    await page.evaluate(() => window.VimWilds.goToActivity(window.VimWilds.activities.findIndex(activity => activity.id === "repeat-is-wrong-choice")));
    await expect(page.locator(".nix")).toHaveCount(1);
  });

  test("preserves settings, pointer locking, and compact completion geometry", async ({ page }) => {
    await page.goto("/?activity=dot-python-values");
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
    await page.goto("/?activity=dot-go-booleans");
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
    await page.goto("/?activity=dot-python-values");
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
    await page.goto("/?activity=dot-append-demo");
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

  test("keeps every production activity inside the target phone viewports without clipping", async ({ page }) => {
    test.setTimeout(120000);
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]];
    const textSelector = [
      ".lesson-label", ".activity-intro h1", ".activity-intro p", ".command-explanation", ".next-command-tray .command-text",
      ".next-command-tray .status-primary", ".next-command-tray .status-secondary", ".next-command-tray .command-key",
      ".field-note h2", ".field-note p", ".grammar", ".choice-option", ".demo-controls button", ".completion-panel strong", ".completion-panel p", ".cm-vim-message",
    ].join(",");
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      for (let index = 0; index < 70; index += 1) {
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
        expect(result.clipped, `${width}×${height} activity ${index}`).toEqual([]);
        expect(result.ellipsis, `${width}×${height} activity ${index}`).toBe(false);
        expect(result.overflow, `${width}×${height} activity ${index}`).toBe(false);
      }
    }
  });
});

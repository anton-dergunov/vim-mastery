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
    await expect(page.locator(".toc-unit")).toHaveCount(1);
    await expect(page.locator(".toc-unit > summary")).toContainText("Unit 10");
    await expect(page.locator(".toc-unit > summary")).toContainText("Repeatable editing");
    await expect(page.locator(".toc-unit > summary")).toContainText("8 lessons");
    await expect(page.locator(".toc-lesson")).toHaveCount(unit.lessons.length);
    await expect(page.locator(".toc-activity")).toHaveCount(activities.length);
    await expect(page.locator(".toc-activity.current")).toContainText("Promote every cache mode");
    await expect(page.locator(".activity-type.type-theory").first()).toHaveText("Theory");
    await expect(page.locator(".activity-type.type-demo").first()).toHaveText("Demo");
    await expect(page.locator(".activity-type.type-exercise").first()).toHaveText("Exercise");
    await page.locator(".toc-unit > summary").click();
    await expect(page.locator(".toc-unit")).not.toHaveAttribute("open", "");
    await page.locator(".toc-unit > summary").click();
    const lastLesson = page.locator(".toc-lesson").last();
    await lastLesson.locator("summary").click();
    await page.locator(".toc-activity").last().scrollIntoViewIfNeeded();
    await page.locator("#tocLessons").evaluate(element => { element.scrollTop = element.scrollHeight; });
    const scrollGeometry = await page.evaluate(() => {
      const body = document.querySelector("#tocLessons");
      const unitBox = document.querySelector(".toc-unit");
      const last = document.querySelector(".toc-lesson:last-child .toc-activity:last-child");
      return {
        bodyBottom: body.getBoundingClientRect().bottom,
        unitBottom: unitBox.getBoundingClientRect().bottom,
        lastBottom: last.getBoundingClientRect().bottom,
        bodyScrolls: body.scrollHeight > body.clientHeight,
      };
    });
    expect(scrollGeometry.bodyScrolls).toBe(true);
    expect(scrollGeometry.lastBottom).toBeLessThanOrEqual(scrollGeometry.bodyBottom + 1);
    expect(scrollGeometry.unitBottom).toBeLessThanOrEqual(scrollGeometry.bodyBottom + 1);
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

  test("centers field notes safely without making the start of long notes inaccessible", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/?ui=next&activity=dot-is-a-change");
    for (const [index, activity] of activities.entries()) {
      if (["demo", "exercise"].includes(activity.type)) continue;
      await page.evaluate(activityIndex => window.VimWilds.goToActivity(activityIndex), index);
      const geometry = await page.evaluate(() => {
        const wrapper = document.querySelector(".field-note-wrap");
        const note = document.querySelector(".field-note");
        const outer = wrapper.getBoundingClientRect();
        const inner = note.getBoundingClientRect();
        return {
          fits: inner.height <= outer.height + 1,
          topGap: inner.top - outer.top,
          bottomGap: outer.bottom - inner.bottom,
          scrollTop: wrapper.scrollTop,
        };
      });
      if (geometry.fits) expect(Math.abs(geometry.topGap - geometry.bottomGap), activity.id).toBeLessThanOrEqual(1);
      else {
        expect(geometry.topGap, activity.id).toBeGreaterThanOrEqual(-1);
        expect(geometry.scrollTop, activity.id).toBe(0);
      }
    }
  });

  test("renders exact authored keys as stable keycaps in the status rail and history", async ({ page }) => {
    await page.goto("/?ui=next&activity=dot-append-demo");
    await expect(page.locator(".status-primary")).toHaveText("Step 1 of 7");
    await expect(page.locator(".status-key .command-key")).toHaveText("A");
    await expect(page.locator(".execution-status")).not.toContainText("Shift");
    await page.getByRole("button", { name: "Step" }).click();
    await expect(page.locator(".command-text .command-key")).toHaveText(["A"]);
    await page.getByRole("button", { name: "Step" }).click();
    await page.getByRole("button", { name: "Step" }).click();
    await expect(page.locator(".command-text .command-key")).toHaveText(["A", ";", "Esc"]);
    await page.evaluate(index => window.VimWilds.goToActivity(index), indexOf("dot-python-values"));
    await expect(page.locator(".status-primary")).toHaveText("Next");
    await expect(page.locator(".status-key .command-key")).toHaveText("c");
  });

  test("keeps one measured execution-console height across every runnable prefix", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?ui=next&activity=dot-append-demo");
    await page.waitForFunction(() => getComputedStyle(document.querySelector("#phone")).getPropertyValue("--execution-console-height").trim());
    const heights = await page.evaluate(() => {
      const measured = [];
      window.VimWilds.activities.forEach((activity, index) => {
        if (!["demo", "exercise"].includes(activity.type)) return;
        window.VimWilds.goToActivity(index);
        const record = () => measured.push(document.querySelector("#nextCommandTray").getBoundingClientRect().height);
        record();
        activity.script.steps.forEach(step => {
          const key = typeof step === "string" ? step : step.key;
          if (activity.type === "demo") document.querySelector('.demo-controls [data-action="step"]').click();
          else window.VimWilds.emit(key);
          record();
        });
      });
      return measured;
    });
    expect(new Set(heights.map(height => Math.round(height * 10) / 10)).size).toBe(1);
  });

  test("keeps stable demo controls below the editor and allows reset or immediate navigation", async ({ page }) => {
    await page.goto("/?ui=next&activity=dot-append-demo");
    await expect(page.locator(".command-explanation")).toHaveText("Append once and finish the change.");
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
    const placement = await page.evaluate(() => {
      const editor = document.querySelector(".next-code-slab").getBoundingClientRect();
      const controls = document.querySelector(".demo-controls").getBoundingClientRect();
      return { editorBottom: editor.bottom, controlsTop: controls.top };
    });
    expect(placement.controlsTop).toBeGreaterThanOrEqual(placement.editorBottom);
    await page.getByRole("button", { name: "Step" }).click();
    expect((await state(page)).playbackStep).toBe(1);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Step" })).toBeDisabled();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(page.getByRole("button", { name: "Step" })).toBeEnabled();
    expect((await state(page)).playbackStep).toBe(0);
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Step" })).toBeDisabled();
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Step" })).toBeEnabled();
    await page.getByRole("button", { name: "Next" }).click();
    expect((await state(page)).activityId).toBe("dot-python-values");
  });

  test("replaces the completed exercise keyboard with full authored feedback", async ({ page }) => {
    const exercise = activities[indexOf("dot-python-values")];
    await page.goto("/?ui=next&activity=dot-python-values");
    const activeSlotHeight = await page.locator(".keyboard-panel").evaluate(element => element.getBoundingClientRect().height);
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await expect(page.locator(".keyboard")).toHaveCSS("visibility", "hidden");
    const result = page.locator(".completion-panel");
    await expect(result).toBeVisible();
    await expect(result.locator("strong")).toHaveText(exercise.feedback.success);
    await expect(result.locator("p")).toHaveText(exercise.feedback.why);
    await expect(result.getByRole("button", { name: "Next" })).toBeVisible();
    const completed = await page.evaluate(() => ({
      slotHeight: document.querySelector(".keyboard-panel").getBoundingClientRect().height,
      keyboardHeight: document.querySelector(".keyboard").getBoundingClientRect().height,
      panelHeight: document.querySelector(".completion-panel").getBoundingClientRect().height,
      next: document.querySelector(".completion-panel button").getBoundingClientRect().toJSON(),
    }));
    expect(completed.slotHeight).toBeCloseTo(activeSlotHeight, 0);
    expect(completed.panelHeight).toBeCloseTo(completed.keyboardHeight, 0);
    expect(completed.next.height).toBe(44);
    expect(completed.next.width).toBeLessThanOrEqual(104);
  });

  test("rejects pointer cursor changes, keeps a visible block cursor, and sizes slabs by line count", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const oneLine = activities.find(activity => activity.script && activity.scenario.initial.lines.length === 1);
    const fiveLine = activities.find(activity => activity.script && activity.scenario.initial.lines.length === 5);
    await page.goto(`/?ui=next&activity=${oneLine.id}`);
    const oneLineHeight = await page.locator(".next-code-slab").evaluate(element => element.getBoundingClientRect().height);
    const before = await state(page);
    const scroller = page.locator(".cm-scroller");
    const box = await scroller.boundingBox();
    await page.mouse.click(box.x + box.width - 18, box.y + 18);
    await page.mouse.move(box.x + 25, box.y + 18);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 25, box.y + 18, { steps: 5 });
    await page.mouse.up();
    const afterPointer = await state(page);
    expect(afterPointer.cursor).toEqual(before.cursor);
    expect(afterPointer.selection).toEqual(before.selection);
    const cursorStyle = await page.locator(".cm-cursorLayer .cm-cursor").evaluate(element => {
      const style = getComputedStyle(element);
      return { width: element.getBoundingClientRect().width, display: style.display, opacity: style.opacity, background: style.backgroundColor };
    });
    expect(cursorStyle.display).not.toBe("none");
    expect(Number(cursorStyle.opacity)).toBeGreaterThan(0);
    expect(cursorStyle.width).toBeGreaterThanOrEqual(7);
    expect(cursorStyle.background).not.toBe("rgba(0, 0, 0, 0)");
    await page.evaluate(() => window.VimWilds.solveCurrent());
    const completed = await state(page);
    expect(completed.code).toEqual(oneLine.scenario.target.lines);
    expect(completed.cursor).toEqual(oneLine.scenario.target.cursor);
    await page.evaluate(index => window.VimWilds.goToActivity(index), indexOf(fiveLine.id));
    const fiveLineHeight = await page.locator(".next-code-slab").evaluate(element => element.getBoundingClientRect().height);
    expect(oneLineHeight).toBeGreaterThanOrEqual(132);
    expect(fiveLineHeight).toBeLessThanOrEqual(228);
    expect(fiveLineHeight).toBeGreaterThan(oneLineHeight);
  });

  test("changes Shift legend emphasis without moving either legend", async ({ page }) => {
    await page.goto("/?ui=next&activity=dot-python-values");
    const legends = page.locator('.key[data-key="1"] .stack');
    const before = await legends.evaluate(element => {
      const shifted = element.querySelector(".shifted");
      const base = element.querySelector(".base");
      return {
        shiftedTop: shifted.getBoundingClientRect().top,
        baseTop: base.getBoundingClientRect().top,
        shiftedColor: getComputedStyle(shifted).color,
        baseColor: getComputedStyle(base).color,
      };
    });
    await page.locator('[data-mod="Shift"]').first().click();
    await expect(page.locator("#keyboard")).toHaveClass(/shift-layer/);
    await page.waitForTimeout(150);
    const after = await legends.evaluate(element => {
      const shifted = element.querySelector(".shifted");
      const base = element.querySelector(".base");
      return {
        shiftedTop: shifted.getBoundingClientRect().top,
        baseTop: base.getBoundingClientRect().top,
        shiftedColor: getComputedStyle(shifted).color,
        baseColor: getComputedStyle(base).color,
      };
    });
    expect(after.shiftedTop).toBeCloseTo(before.shiftedTop, 1);
    expect(after.baseTop).toBeCloseTo(before.baseTop, 1);
    expect(after.shiftedColor).not.toBe(before.shiftedColor);
    expect(after.baseColor).not.toBe(before.baseColor);
  });

  test("renders all ordinary authored text without clipping at supported phone sizes", async ({ page }) => {
    test.setTimeout(90000);
    const viewports = [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]];
    const textSelector = [
      ".lesson-label",
      ".activity-intro h1",
      ".activity-intro p",
      ".command-explanation",
      ".next-command-tray .command-text",
      ".next-command-tray .status-primary",
      ".next-command-tray .status-secondary",
      ".next-command-tray .command-key",
      ".field-note h2",
      ".field-note p",
      ".grammar",
      ".choice-option",
      ".control-deck button",
      ".demo-controls button",
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
            keycapFont: document.querySelector(".next-command-tray:not(.hidden) .command-key") ? parseFloat(getComputedStyle(document.querySelector(".next-command-tray .command-key")).fontSize) : null,
          };
        }, textSelector);
        expect(result.clipped, `${width}×${height} ${activities[index].id}`).toEqual([]);
        expect(result.outOfBounds, `${width}×${height} ${activities[index].id}`).toEqual([]);
        expect(result.usesEllipsis, `${width}×${height} ${activities[index].id}`).toBe(false);
        expect(result.documentOverflow, `${width}×${height} ${activities[index].id}`).toBe(false);
        if (result.editorFont !== null) expect(result.editorFont).toBeGreaterThanOrEqual(14);
        if (result.keycapFont !== null) expect(result.keycapFont).toBeGreaterThanOrEqual(14);
      }
    }
  });
});

import { expect, test } from "@playwright/test";

async function state(page) {
  await page.waitForFunction(() => window.VimWilds?.getState);
  return page.evaluate(() => window.VimWilds.getState());
}

async function report(page) {
  return page.evaluate(() => window.VimWilds.feedback.report());
}

async function openFeedback(page) {
  await page.locator("#feedbackButton").click();
  await expect(page.locator("#feedbackDialog")).toHaveAttribute("open", "");
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
    window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
      introSeen: true,
      completedUnitStoryIds: [],
    }));
    window.localStorage.setItem("vim-wilds.reference.v1", JSON.stringify({ orientationSeen: true }));
    window.localStorage.setItem("vim-wilds.practice.v1", JSON.stringify({ noticeSeen: true }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
});

/* The global keydown handler is registered on document in the capture phase and
 * bails out only for named dialogs. Without its feedback guard, typing here is
 * swallowed in a theory activity and lands in the Vim buffer in an exercise —
 * two different failures, so both are worth pinning. */
test("typing a note reaches the textarea instead of the lesson", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  const before = await state(page);
  await openFeedback(page);

  await page.locator("#feedbackNote").click();
  await page.keyboard.type("iw is not suggested");

  await expect(page.locator("#feedbackNote")).toHaveValue("iw is not suggested");
  const after = await state(page);
  expect(after.code).toEqual(before.code);
  expect(after.history).toEqual(before.history);
  expect(after.complete).toBe(false);
});

test("typing a note in a theory activity is not swallowed", async ({ page }) => {
  await page.goto("/play/?unit=modal-model");
  await page.waitForFunction(() => window.VimWilds?.getState().activityType === "theory");
  await openFeedback(page);

  await page.locator("#feedbackNote").click();
  await page.keyboard.type("overflowing");
  await expect(page.locator("#feedbackNote")).toHaveValue("overflowing");
});

test("the report names the activity a screenshot could not", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await openFeedback(page);
  await page.locator("#feedbackNote").fill("Escape does not land where I expect");

  const envelope = await report(page);
  expect(envelope.location).toMatchObject({
    surface: "lesson",
    unitId: "modal-model",
    unitNumber: 1,
    // An exercise is delivered twice, guided then recall, so activityId carries
    // a mode suffix. sourceActivityId is the authored id that addresses both.
    sourceActivityId: "quick-exit-insert",
  });
  expect(envelope.location.activityId).toMatch(/^quick-exit-insert/);
  expect(envelope.location.lessonId).toBe("modal-model-quick-check");
  expect(envelope.note).toBe("Escape does not land where I expect");
  expect(envelope.app.deepLink).toContain("activity=quick-exit-insert");
  expect(envelope.app.version).toBeTruthy();
  expect(envelope.environment.viewport).toEqual({ width: 390, height: 844 });
});

test("refused keys reach the report", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.locator(".cm-content").focus();
  await page.keyboard.press("q");

  await openFeedback(page);
  const envelope = await report(page);
  expect(envelope.keys.rejected.map(entry => entry.key)).toContain("q");
});

test("a report is complete with no screenshot at all", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await openFeedback(page);
  await page.locator("#feedbackNote").fill("no picture needed");

  // Whatever the capture did, removing the image must leave a sendable report.
  const remove = page.locator("#feedbackShotRemove");
  if (await remove.isVisible()) await remove.click();

  const envelope = await report(page);
  expect(envelope.screenshot).toBeNull();
  expect(envelope.note).toBe("no picture needed");
  await expect(page.locator("#feedbackPreview")).not.toContainText("![screenshot]");
});

test("the scratchpad buffer is flagged and can be cleared in one tap", async ({ page }) => {
  await page.goto("/play/?practice=field-notes-prose");
  await page.waitForFunction(() => window.VimWilds?.getState().surface === "free-practice");
  await openFeedback(page);

  await expect(page.locator("#feedbackBufferNote")).toHaveAttribute("data-flagged", "true");
  expect(await report(page)).toMatchObject({
    location: { surface: "free-practice" },
  });

  await page.locator("#feedbackBufferClear").click();
  const cleared = await report(page);
  expect(cleared.editor.code).toBeNull();
  expect(cleared.editor.registers).toBeNull();
  expect(cleared.redactions.join(" ")).toContain("withheld");
});

test("a failed send is queued rather than lost", async ({ page }) => {
  await page.route("**/report", route => route.abort());
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await openFeedback(page);
  await page.locator("#feedbackNote").fill("queued while offline");

  const queued = await page.evaluate(async () => {
    const { queueReport, pendingCount } = await import("/feedback-transport.js");
    await queueReport({ report: { note: "queued while offline" }, markdown: "# queued", blob: null });
    return pendingCount();
  });
  expect(queued).toBeGreaterThan(0);
});

test("closing hands focus back to the editor and leaves no overflow", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await openFeedback(page);

  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
    && document.documentElement.scrollHeight <= window.innerHeight
  ))).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.locator("#feedbackDialog")).not.toHaveAttribute("open", "");

  // A dialog button that keeps focus silently kills physical input.
  await page.keyboard.press("Escape");
  expect(await state(page)).toMatchObject({ complete: true, mode: "Complete" });
});

test("a stray tap outside the sheet does not discard a half-written report", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await openFeedback(page);
  await page.locator("#feedbackNote").fill("half written");

  await page.locator("#feedbackDialog").click({ position: { x: 2, y: 2 }, force: true });
  await expect(page.locator("#feedbackDialog")).toHaveAttribute("open", "");
  await expect(page.locator("#feedbackNote")).toHaveValue("half written");
});

/* The capture restates pseudo-element backgrounds as real elements, because a
 * DOM rasterizer drops them and the board's scene art is painted that way. If
 * that scaffolding ever survived the capture, the live page would be left with
 * duplicated backdrops. */
test("capturing leaves the page exactly as it found it", async ({ page }) => {
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => window.VimWilds?.getState);

  const before = await page.evaluate(() => document.querySelectorAll("#phone *").length);
  await page.evaluate(async () => {
    const { captureScreenshot } = await import("/feedback-capture.js");
    await captureScreenshot(document.querySelector("#phone"));
  });

  expect(await page.evaluate(() => ({
    nodes: document.querySelectorAll("#phone *").length,
    markers: document.querySelectorAll("[data-feedback-pseudo]").length,
  }))).toEqual({ nodes: before, markers: 0 });
});

test("a capture that fails still restores the page", async ({ page }) => {
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => window.VimWilds?.getState);

  const before = await page.evaluate(() => document.querySelectorAll("#phone *").length);
  const result = await page.evaluate(async () => {
    const { captureScreenshot } = await import("/feedback-capture.js");
    // Zero milliseconds guarantees the timeout path, which is the ordinary
    // outcome on Safari and must not leave scaffolding behind.
    return captureScreenshot(document.querySelector("#phone"), { timeout: 0 });
  });

  expect(result.blob).toBeUndefined();
  expect(result.error).toBeTruthy();
  expect(await page.evaluate(() => ({
    nodes: document.querySelectorAll("#phone *").length,
    markers: document.querySelectorAll("[data-feedback-pseudo]").length,
  }))).toEqual({ nodes: before, markers: 0 });
});

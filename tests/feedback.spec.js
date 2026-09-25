import { expect, test } from "@playwright/test";

async function state(page) {
  await page.waitForFunction(() => window.VimWilds?.getState);
  return page.evaluate(() => window.VimWilds.getState());
}

async function report(page) {
  return page.evaluate(() => window.VimWilds.feedback.report());
}

async function openFeedback(page, selector = "#feedbackButton") {
  await page.locator(selector).click();
  await expect(page.locator("#feedbackDialog")).toHaveAttribute("open", "");
}

/* The five dialogs that had no way in. Each opens its surface, then reports it.
 * The sheet stacks over the dialog rather than replacing it, so the picture is
 * of the thing being reported and the reporter keeps their place. */
const DIALOG_ENTRIES = [
  {
    name: "the table of contents",
    dialog: "#tocDialog",
    reportedFrom: "contents",
    open: page => page.locator("#tocButton").click(),
  },
  {
    name: "the mastery panel",
    dialog: "#masteryDialog",
    reportedFrom: "mastery",
    open: page => page.evaluate(() => window.VimWilds.openMastery()),
  },
  {
    name: "the practice file picker",
    dialog: "#practiceFilesDialog",
    reportedFrom: "practice-files",
    open: async page => {
      await page.locator("#tocButton").click();
      await page.locator("[data-practice-browse]").click();
    },
  },
  {
    name: "the story card",
    dialog: "#storyDialog",
    reportedFrom: "story",
    open: page => page.evaluate(() => window.VimWilds.replayIntroStory()),
  },
  {
    name: "a reference deck",
    dialog: "#referenceDialog",
    reportedFrom: "reference",
    open: page => page.evaluate(() => window.VimWilds.openReference("survival")),
  },
];

async function openDialog(page, entry) {
  await page.waitForFunction(() => window.VimWilds?.getState);
  await entry.open(page);
  await expect(page.locator(entry.dialog)).toHaveAttribute("open", "");
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
  await openFeedback(page, "#practiceFeedbackButton");

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

/* Item 1 of the brief. A modal <dialog> paints in the top layer, above both the
 * board flag and the top bar that holds Settings, so before these controls
 * existed there was no way to report the sheet you were looking at. */
for (const entry of DIALOG_ENTRIES) {
  test(`a problem with ${entry.name} can be reported without leaving it`, async ({ page }) => {
    await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
    const before = await state(page);
    await openDialog(page, entry);

    await openFeedback(page, `${entry.dialog} [data-feedback-open]`);
    // Stacked, not swapped: the reporter keeps their place, and the picture is
    // taken of this sheet rather than of the lesson behind it.
    await expect(page.locator(entry.dialog)).toHaveAttribute("open", "");

    // .click() then keyboard.type, never .fill() — the failure being pinned is
    // the capture-phase keydown handler, which .fill() would bypass.
    await page.locator("#feedbackNote").click();
    await page.keyboard.type("this reads wrong");
    await expect(page.locator("#feedbackNote")).toHaveValue("this reads wrong");

    const envelope = await report(page);
    expect(envelope.location.reportedFrom).toBe(entry.reportedFrom);
    expect(envelope.note).toBe("this reads wrong");

    const after = await state(page);
    expect(after.code).toEqual(before.code);
    expect(after.history).toEqual(before.history);
    expect(after.complete).toBe(false);
  });
}

test("closing the sheet returns to the dialog it was opened from", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.waitForFunction(() => window.VimWilds?.openReference);
  await page.evaluate(() => window.VimWilds.openReference("survival"));
  await expect(page.locator("#referenceDialog")).toHaveAttribute("open", "");
  await page.locator('#referenceDialog [data-reference-action="next"]').click();
  const card = await page.evaluate(() => window.VimWilds.referenceState().cardIndex);

  await openFeedback(page, "#referenceDialog [data-feedback-open]");
  await page.keyboard.press("Escape");
  await expect(page.locator("#feedbackDialog")).not.toHaveAttribute("open", "");

  // The deck is still open on the same card, focus is back on the control that
  // opened the sheet rather than stranded on the inert editor, and Escape now
  // reaches the deck rather than the lesson underneath.
  await expect(page.locator("#referenceDialog")).toHaveAttribute("open", "");
  await expect(page.locator("#referenceDialog [data-feedback-open]")).toBeFocused();
  expect(await page.evaluate(() => window.VimWilds.referenceState().cardIndex)).toBe(card);

  await page.keyboard.press("Escape");
  await expect(page.locator("#referenceDialog")).not.toHaveAttribute("open", "");
  await page.keyboard.press("Escape");
  expect(await state(page)).toMatchObject({ complete: true, mode: "Complete" });
});

test("a report from a reference card names the deck and the card", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.waitForFunction(() => window.VimWilds?.openReference);
  await page.evaluate(() => window.VimWilds.openReference("survival"));
  await openFeedback(page, "#referenceDialog [data-feedback-open]");

  const envelope = await report(page);
  const expected = await page.evaluate(() => window.VimWilds.referenceState());
  expect(envelope.location.reportedFrom).toBe("reference");
  expect(envelope.location.reportedFromDetail).toContain("survival");
  expect(envelope.location.reportedFromDetail).toContain(expected.cardId);
  // The board underneath is still the surface, which is what keeps the
  // free-practice keystroke redaction keyed to the right thing.
  expect(envelope.location.surface).toBe("lesson");
  await expect(page.locator("#feedbackPlace")).toContainText("Reference");
});

test("the report sheet still opens from the board with no dialog attached", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await openFeedback(page);
  expect((await report(page)).location).toMatchObject({ reportedFrom: null, reportedFromDetail: null });
});

/* Item 4 of the brief. Free practice is the one surface whose buffer fills the
 * whole board, so the floating flag sat over text being edited. */
test("free practice reports from the top bar, not from over the scratchpad", async ({ page }) => {
  await page.goto("/play/?practice=field-notes-prose");
  await page.waitForFunction(() => window.VimWilds?.getState().surface === "free-practice");

  await expect(page.locator("#feedbackButton")).toBeHidden();
  await openFeedback(page, "#practiceFeedbackButton");
  expect((await report(page)).location).toMatchObject({ surface: "free-practice", reportedFrom: null });
});

test("a failed send is queued rather than lost", async ({ page }) => {
  await page.route("**/report", route => route.abort());
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await openFeedback(page);
  await page.locator("#feedbackNote").fill("queued while offline");

  const queued = await page.evaluate(async () => {
    const { queueReport, pendingCount } = await import("/feedback/transport.js");
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

  // A dialog button that keeps focus silently kills physical input. The handoff
  // runs in the queued `close` task, which can land behind a screenshot capture
  // still in flight, so wait for it rather than for the attribute alone.
  await expect(page.locator(".cm-editor")).toBeFocused();
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

/* Board art streams a scene variant into the board 2.5s after a lesson mounts
 * and holds it for another nine, so a node count taken before a capture and
 * compared after it measures live art rather than the capture's scaffolding.
 * Aborting the variant requests leaves the base scene, and the pseudo-element
 * backgrounds these captures exist to exercise, exactly as authored. */
async function withoutStreamedArt(page) {
  await page.route("**/variants/**", route => route.abort());
}

/* The capture restates pseudo-element backgrounds as real elements, because a
 * DOM rasterizer drops them and the board's scene art is painted that way. If
 * that scaffolding ever survived the capture, the live page would be left with
 * duplicated backdrops. */
test("capturing leaves the page exactly as it found it", async ({ page }) => {
  await withoutStreamedArt(page);
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => window.VimWilds?.getState);

  const before = await page.evaluate(() => document.querySelectorAll("#phone *").length);
  await page.evaluate(async () => {
    const { captureScreenshot } = await import("/feedback/capture.js");
    await captureScreenshot(document.querySelector("#phone"));
  });

  expect(await page.evaluate(() => ({
    nodes: document.querySelectorAll("#phone *").length,
    markers: document.querySelectorAll("[data-feedback-pseudo]").length,
  }))).toEqual({ nodes: before, markers: 0 });
});

/* The reference deck lives outside #phone, so the board capture root could
 * never see it. Capturing the dialog itself is what makes its report carry a
 * picture of the card rather than of the lesson behind it. */
test("capturing a dialog leaves the page exactly as it found it", async ({ page }) => {
  await withoutStreamedArt(page);
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => window.VimWilds?.getState);
  await page.evaluate(() => window.VimWilds.openReference("survival"));

  const before = await page.evaluate(() => document.querySelectorAll("body *").length);
  const result = await page.evaluate(async () => {
    const { captureScreenshot } = await import("/feedback/capture.js");
    const shot = await captureScreenshot(document.querySelector("#referenceDialog"));
    return { bytes: shot?.bytes ?? null, error: shot?.error ?? null };
  });

  // A report with no screenshot is complete, not degraded, so a capture failure
  // is not a test failure — leaving scaffolding behind is.
  if (!result.error) expect(result.bytes).toBeGreaterThan(0);
  expect(await page.evaluate(() => ({
    nodes: document.querySelectorAll("body *").length,
    markers: document.querySelectorAll("[data-feedback-pseudo]").length,
  }))).toEqual({ nodes: before, markers: 0 });
});

test("a capture that fails still restores the page", async ({ page }) => {
  await withoutStreamedArt(page);
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => window.VimWilds?.getState);

  const before = await page.evaluate(() => document.querySelectorAll("#phone *").length);
  const result = await page.evaluate(async () => {
    const { captureScreenshot } = await import("/feedback/capture.js");
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

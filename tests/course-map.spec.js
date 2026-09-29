import { expect, test } from "@playwright/test";

// The course map: Course, Practice and Reference tabs; a unit list and a page
// per unit; the story at both ends of the list. See docs/design-decisions.md.

const FINISHED = ["modal-model", "cursor-movement", "entering-changing-text", "operator-grammar"];

const seedLearner = (page, { completed = FINISHED, endingSeen = false, session = null } = {}) => page.addInitScript(seed => {
  window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
    introSeen: true,
    endingSeen: seed.endingSeen,
    completedUnitStoryIds: seed.completed,
  }));
  window.localStorage.setItem("vim-wilds.reference.v1", JSON.stringify({ orientationSeen: true }));
  window.localStorage.setItem("vim-wilds.practice.v1", JSON.stringify({ noticeSeen: true }));
  if (seed.session) window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify(seed.session));
}, { completed, endingSeen, session });

const waitForApp = page => page.waitForFunction(() => window.VimWilds?.getState);
const appState = page => page.evaluate(() => window.VimWilds.getState());

async function openMap(page, url) {
  await page.goto(url);
  await waitForApp(page);
  await page.locator("#tocButton").click();
  await expect(page.locator("#tocDialog")).toBeVisible();
}

// The part of `element` that is inside `container`'s visible box.
async function visibleWithin(page, element, container) {
  return page.evaluate(([row, box]) => {
    const rowRect = document.querySelector(row).getBoundingClientRect();
    const boxRect = document.querySelector(box).getBoundingClientRect();
    return rowRect.top >= boxRect.top - 1 && rowRect.bottom <= boxRect.bottom + 1;
  }, [element, container]);
}

async function expectNoDocumentOverflow(page) {
  expect(await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))).toEqual({ x: 0, y: 0 });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
});

test("opens from a Unit 5 activity on that unit's page, with the activity in view", async ({ page }) => {
  await seedLearner(page);
  // Lesson 8 of 11: far enough down the page that landing there takes a scroll.
  await openMap(page, "/play/?unit=precision-motions-search&activity=delete-delimited-call");
  const unitPage = page.locator("#tocUnitPage");
  await expect(page.getByRole("tab", { name: "Course" })).toHaveAttribute("aria-selected", "true");
  await expect(unitPage).not.toHaveAttribute("inert", "");
  await expect(unitPage.locator("#tocUnitTitle")).toHaveText("Precision motions and search");
  await expect(unitPage.locator(".toc-unit-progress")).toContainText("Lesson 8 of 11");
  const current = unitPage.locator(".toc-activity.current");
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("Remove the temporary argument list");
  expect(await visibleWithin(page, "#tocUnitPage .toc-activity.current", "#tocUnitPage")).toBe(true);
  // The bar has turned solid, so "All units" and the unit's name stay on screen.
  await expect(unitPage.locator(".toc-page-bar")).toHaveClass(/solid/);
  await expect(unitPage.locator("[data-toc-back]")).toBeVisible();

  await current.click();
  await expect(page.locator("#tocDialog")).toBeHidden();
  expect((await appState(page)).activityId).toBe("delete-delimited-call");
});

test("Escape steps back to the list before it closes the map", async ({ page }) => {
  await seedLearner(page);
  await openMap(page, "/play/?unit=precision-motions-search&activity=repeat-forward-commas");
  await page.keyboard.press("Escape");
  await expect(page.locator("#tocDialog")).toBeVisible();
  await expect(page.locator("#tocUnitList")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#tocUnitPage")).toHaveAttribute("inert", "");
  // The list lands on the unit the page showed, and hands it focus.
  const row = page.locator('#tocUnitList [data-toc-unit="precision-motions-search"]');
  await expect(row).toBeFocused();
  await expect(row).toHaveAttribute("aria-current", "true");
  await expect(row).toContainText("Lesson 2 of 11");
  expect(await visibleWithin(page, '#tocUnitList [data-toc-unit="precision-motions-search"]', "#tocUnitList")).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#tocDialog")).toBeHidden();

  // The close button never steps back: from a unit's page it closes at once.
  await page.locator("#tocButton").click();
  await page.locator("#tocDialog .dialog-close").click();
  await expect(page.locator("#tocDialog")).toBeHidden();
});

test("any unit opens in place, and its activities open that unit there", async ({ page }) => {
  await seedLearner(page);
  await openMap(page, "/play/?unit=precision-motions-search&activity=repeat-forward-commas");
  await page.locator("[data-toc-back]").click();
  await page.locator('#tocUnitList [data-toc-unit="macros"]').click();
  const unitPage = page.locator("#tocUnitPage");
  await expect(unitPage.locator("#tocUnitTitle")).toHaveText("Macros");
  // Another unit's lessons are fetched the first time its page opens, and its
  // flow is the one the unit will run: guided and recall pairs included.
  const lesson = unitPage.locator(".toc-lesson").filter({ hasText: "Replay at useful scale" });
  await lesson.locator("summary").click();
  await expect(lesson.locator(".activity-type.type-recall")).toHaveCount(3);
  // Nothing is locked: the warning says so, and every row stays a live button.
  await expect(unitPage.locator(".toc-unit-warning")).toContainText("Nothing is locked");
  await lesson.locator('[data-unit-activity="count-python-legacy-recall"]').click();
  await page.waitForURL(/unit=macros/);
  await waitForApp(page);
  const url = new URL(page.url());
  expect(url.searchParams.get("activity")).toBe("count-python-legacy-recall");
  expect(await appState(page)).toMatchObject({ unitId: "macros", activityId: "count-python-legacy-recall", practiceMode: "recall" });
});

test("the pager steps between neighbouring units", async ({ page }) => {
  await seedLearner(page);
  await openMap(page, "/play/?unit=precision-motions-search&activity=repeat-forward-commas");
  const unitPage = page.locator("#tocUnitPage");
  await unitPage.locator(".toc-pager-next").click();
  await expect(unitPage.locator("#tocUnitTitle")).toHaveText("Text objects");
  await expect(unitPage.locator('[data-unit-id="text-objects"]')).toHaveText("Open Unit 6 →");
  await unitPage.locator(".toc-pager-previous").click();
  await unitPage.locator(".toc-pager-previous").click();
  await expect(unitPage.locator("#tocUnitTitle")).toHaveText("Operator grammar");
  // A finished unit tells how its chapter ended and offers the replay.
  await expect(unitPage.locator(".toc-guide")).toContainText("chapter restored");
  await expect(unitPage.getByRole("button", { name: "Replay chapter" })).toBeVisible();
});

test("the story opens and closes the course list", async ({ page }) => {
  await seedLearner(page);
  await openMap(page, "/play/?unit=precision-motions-search&activity=repeat-forward-commas");
  await page.locator("[data-toc-back]").click();
  const list = page.locator("#tocUnitList");
  // The epilogue waits until the finale has been seen, and spoils nothing.
  await expect(list.locator("[data-story-replay-ending]")).toHaveCount(0);
  await expect(list.locator(".toc-story-row.later")).toContainText("After Unit 17");
  await list.locator("[data-story-replay-intro]").click();
  await expect(page.locator("#tocDialog")).toBeHidden();
  await expect(page.locator("#storyDialog .story-surface")).toHaveAttribute("data-kind", "intro");
  expect((await appState(page)).story.completedUnitStoryIds).toEqual(FINISHED);
});

test("the tabs switch with a tap and with the arrow keys", async ({ page }) => {
  await seedLearner(page);
  await openMap(page, "/play/?unit=precision-motions-search&activity=repeat-forward-commas");
  const course = page.getByRole("tab", { name: "Course" });
  await course.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Practice" })).toBeFocused();
  await expect(page.locator("#tocPractice")).toBeVisible();
  await expect(page.locator("#tocCourse")).toBeHidden();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tocReference")).toBeVisible();
  await expect(page.locator("#tocReference")).toContainText("Nothing here is scored");
  // Field notes are reading, so they sit with the decks, not with the drills.
  await expect(page.locator("#tocReference [data-field-note]")).toHaveCount(5);
  await expect(page.locator("#tocPractice [data-field-note]")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(course).toHaveAttribute("aria-selected", "true");
  // Escape on a tab other than Course closes the map outright.
  await page.getByRole("tab", { name: "Reference" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#tocDialog")).toBeHidden();
});

test("a field note starts from the Reference tab", async ({ page }) => {
  await seedLearner(page);
  await openMap(page, "/play/");
  await page.getByRole("tab", { name: "Reference" }).click();
  await page.locator('#tocReference [data-field-note="quickfix-as-a-work-list"]').click();
  await expect(page.locator("#tocDialog")).toBeHidden();
  expect(await page.evaluate(() => window.VimWilds.masteryState())).toMatchObject({ active: true, kind: "field-note" });
});

test("unit rows paint small thumbnails, and nothing when backdrops are off", async ({ page }) => {
  await seedLearner(page);
  await openMap(page, "/play/");
  const strip = page.locator('#tocUnitList [data-toc-unit="macros"] .toc-unit-strip');
  // A 320px thumbnail per unit: seventeen full boards would cost a phone
  // hundreds of megabytes of decoded image to paint 64px strips.
  expect(await strip.evaluate(node => getComputedStyle(node).backgroundImage)).toContain("/thumb.webp");
  expect(await page.locator("#tocUnitPage .toc-unit-hero").evaluate(node => getComputedStyle(node).backgroundImage)).toContain("/wide/base.webp");
  await page.locator("#tocDialog .dialog-close").click();

  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByRole("switch", { name: "Illustrated scenes" }).uncheck();
  await page.locator("#settingsDialog .dialog-close").click();
  await page.locator("#tocButton").click();
  expect(await strip.evaluate(node => getComputedStyle(node).backgroundImage)).not.toContain("url(");
  expect(await page.locator("#tocUnitPage .toc-unit-hero").evaluate(node => getComputedStyle(node).backgroundImage)).not.toContain("url(");
});

for (const [width, height] of [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]]) {
  test(`every view of the map fits ${width}x${height} without clipping`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedLearner(page);
    await openMap(page, "/play/?unit=precision-motions-search&activity=repeat-forward-commas");
    await expectNoDocumentOverflow(page);
    await page.locator("[data-toc-back]").click();
    await expectNoDocumentOverflow(page);
    // The phone-feedback overflow flags: arc headings, dividers and activity
    // numbers whose content ran a pixel or two past their own boxes.
    const clipped = await page.evaluate(() => [
      ...document.querySelectorAll(".toc-arc-heading, .toc-arc-heading span, .toc-arc-heading strong, .toc-arc-divider, .toc-arc-divider span, .toc-number, .toc-unit-row, .toc-unit-text strong"),
    ].filter(node => node.scrollHeight > node.clientHeight + 0.5 || node.scrollWidth > node.clientWidth + 0.5)
      .map(node => `${node.className || node.tagName}: ${node.textContent.trim().slice(0, 30)}`));
    expect(clipped).toEqual([]);
    await page.getByRole("tab", { name: "Practice" }).click();
    await expect(page.locator("#tocPractice .mastery-scratchpad")).toBeVisible();
    await expectNoDocumentOverflow(page);
    await page.getByRole("tab", { name: "Reference" }).click();
    await expect(page.locator("#tocReference .toc-deck").first()).toBeVisible();
    await expectNoDocumentOverflow(page);
  });
}

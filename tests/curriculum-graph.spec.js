import { expect, test } from "@playwright/test";

const seedReturningLearner = page => page.addInitScript(() => {
  window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
    introSeen: true,
    endingSeen: false,
    completedUnitStoryIds: [],
  }));
  window.localStorage.setItem("vim-wilds.reference.v1", JSON.stringify({ orientationSeen: true }));
  window.localStorage.setItem("vim-wilds.practice.v1", JSON.stringify({ noticeSeen: true }));
});

const seedFinishedUnits = (page, ids) => page.addInitScript(completed => {
  window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
    introSeen: true,
    endingSeen: false,
    completedUnitStoryIds: completed,
  }));
  window.localStorage.setItem("vim-wilds.reference.v1", JSON.stringify({ orientationSeen: true }));
  window.localStorage.setItem("vim-wilds.practice.v1", JSON.stringify({ noticeSeen: true }));
}, ids);

const waitForApp = page => page.waitForFunction(() => window.VimWilds?.getState);

async function openContents(page) {
  await page.goto("/play/");
  await waitForApp(page);
  await page.click("#tocButton");
  await expect(page.locator("#tocDialog")).toBeVisible();
}

// The unit whose details block a test wants to read, addressed by its summary
// text rather than by index, so renumbering does not silently retarget a test.
const unitBlock = (page, number) => page
  .locator("#tocLessons .toc-unit")
  .filter({ has: page.locator(`summary span:text-is("Unit ${number}")`) });

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  expect(overflow).toBe(0);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
});

test("every unit carries an in-your-editor note that opens the host-reality deck", async ({ page }) => {
  await seedReturningLearner(page);
  await openContents(page);

  const catalog = await page.evaluate(async () => {
    const response = await fetch("/content/unit-index.json");
    return response.json();
  });
  expect(catalog.units.length).toBe(17);

  const notes = page.locator("#tocLessons .toc-unit-editor");
  await expect(notes).toHaveCount(catalog.units.length);
  for (const entry of catalog.units) {
    const block = unitBlock(page, entry.unitNumber);
    await expect(block.locator(".toc-unit-editor-label")).toHaveText("In your editor");
    // The note is authored, not derived, so assert the authored text reaches
    // the screen rather than merely that some paragraph exists.
    const plain = entry.editorNote.replaceAll("`", "");
    await expect(block.locator(".toc-unit-editor p")).toContainText(plain.slice(0, 40));
  }

  const viewport = unitBlock(page, 10);
  await viewport.locator("summary").click();
  await viewport.locator(".toc-unit-editor button").click();
  await expect(page.locator("#tocDialog")).toBeHidden();
  const reference = page.locator("#referenceDialog");
  await expect(reference).toBeVisible();
  await expect(reference).toContainText("Chords an editor may claim");
  await expect(reference).toContainText("Ctrl-d");
});

test("skipping into Arc 3 warns about the whole closure and still opens the unit", async ({ page }) => {
  await seedReturningLearner(page);
  await openContents(page);

  const macros = unitBlock(page, 14);
  await macros.locator("summary").click();
  const warning = macros.locator(".toc-unit-warning");
  await expect(warning).toBeVisible();

  // Unit 14 names only Units 8 and 11, but their own prerequisites reach back
  // through 3, 4 and 6. The warning has to walk the graph, not read one edge.
  const head = warning.locator(".toc-unit-warning-head");
  for (const number of [3, 4, 6, 8, 11]) {
    await expect(head).toContainText(String(number));
  }
  // The body names Unit 14's own edges first; the closure lives in the heading.
  await expect(warning).toContainText("Registers and putting (Unit 8)");
  await expect(warning).toContainText("Repeatable editing (Unit 11)");
  await expect(warning).toContainText("5 earlier units");
  await expect(warning).toContainText("Nothing is locked");
  await expect(macros.locator(".toc-unit-recommended")).toContainText("Unit 5");

  // The promise that matters: a warning is not a lock.
  const open = macros.locator('button[data-unit-id="macros"]');
  await expect(open).toBeEnabled();
  await open.click();
  await waitForApp(page);
  expect(new URL(page.url()).searchParams.get("unit")).toBe("macros");
  expect(await page.evaluate(() => window.VimWilds.getState().unitId)).toBe("macros");
});

test("a finished prerequisite drops out of the warning", async ({ page }) => {
  await seedFinishedUnits(page, [
    "modal-model", "cursor-movement", "entering-changing-text", "operator-grammar",
    "text-objects", "visual-selection", "registers-putting", "repeatable-editing",
  ]);
  await openContents(page);

  const macros = unitBlock(page, 14);
  await macros.locator("summary").click();
  await expect(macros.locator(".toc-unit-warning")).toHaveCount(0);
  // Unit 5 is only recommended, so it survives as the soft line and never as a
  // warning.
  await expect(macros.locator(".toc-unit-recommended")).toContainText("not required");
});

test("the mastery surface never warns and Unit 1 has nothing to warn about", async ({ page }) => {
  await seedReturningLearner(page);
  await openContents(page);

  const mastery = unitBlock(page, 17);
  await mastery.locator("summary").click();
  await expect(mastery.locator(".toc-unit-warning")).toHaveCount(0);
  await expect(mastery.locator(".toc-unit-editor")).toBeVisible();

  const first = unitBlock(page, 1);
  await expect(first.locator(".toc-unit-warning")).toHaveCount(0);
  await expect(first.locator(".toc-unit-recommended")).toHaveCount(0);
});

test("an unreached topic offers a test out that actually starts", async ({ page }) => {
  await seedReturningLearner(page);
  await page.goto("/play/");
  await waitForApp(page);
  await page.click("#tocButton");
  await page.click("[data-mastery-open]");
  const mastery = page.locator("#masteryDialog");
  await expect(mastery).toBeVisible();
  await mastery.locator("details").first().evaluate(node => { node.open = true; });

  const row = mastery.locator(".mastery-concept").first();
  await expect(row.locator(".mastery-chip").first()).toHaveText(/unseen/i);
  const button = row.locator("[data-mastery-drill]");
  await expect(button).toHaveText("Test out");
  await expect(button).toBeEnabled();
  await expect(button).toHaveClass(/mastery-test-out/);

  await button.click();
  await expect(mastery).toBeHidden();
  // A test out plays the authored exercises for a topic the learner has not
  // reached, which is the whole point of the skip path being usable.
  await expect(page.locator("#activityInstruction")).toBeVisible();
  expect(await page.evaluate(() => window.VimWilds.getState().unitId)).toBeTruthy();
});

test("test out does not widen the review pool", async ({ page }) => {
  await seedReturningLearner(page);
  await page.goto("/play/");
  await waitForApp(page);
  await page.click("#tocButton");
  await page.click("[data-mastery-open]");
  const mastery = page.locator("#masteryDialog");
  await expect(mastery).toBeVisible();

  // `isEligibleForReview` deliberately excludes unseen and learning topics.
  // Offering a test out must not have loosened it.
  await expect(mastery.locator("[data-mastery-mixed]")).toBeDisabled();
  await expect(mastery.locator("[data-mastery-tool-choice]")).toBeDisabled();
  await expect(mastery.locator("[data-mastery-mixed]")).toContainText("Needs two practised topics");
});

for (const [width, height] of [[360, 740], [390, 844], [412, 915], [430, 932], [432, 960]]) {
  test(`contents dialog fits ${width}x${height} with the note and the warning @exhaustive`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedReturningLearner(page);
    await openContents(page);
    const macros = unitBlock(page, 14);
    await macros.locator("summary").click();
    await expect(macros.locator(".toc-unit-warning")).toBeVisible();
    await expect(macros.locator(".toc-unit-editor")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

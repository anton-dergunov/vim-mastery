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

const sessionState = page => page.evaluate(() => (
  JSON.parse(window.localStorage.getItem("vim-wilds.session.v1") || "{}")
));

// A true first run: nothing seeded. The entry question rides on the opening
// deck, so reaching it means passing the story and the deck first — which is
// also the assertion that it cannot appear anywhere else.
async function firstRunToEntryQuestion(page) {
  await page.goto("/play/");
  await waitForApp(page);
  await page.locator("#storyDialog").getByRole("button", { name: "Skip story" }).click();
  await page.locator("#referenceDialog").getByRole("button", { name: "Skip" }).click();
  const question = page.locator("#entryLevelDialog");
  await expect(question).toBeVisible();
  return question;
}

const ENTRY_LEVELS = [
  { label: "New to Vim", level: "new", unitId: "modal-model", unitNumber: 1 },
  { label: "Familiar with the basics", level: "basics", unitId: "visual-selection", unitNumber: 7 },
  { label: "Experienced", level: "experienced", unitId: "command-line-ranges-line-operations", unitNumber: 12 },
];

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

// Session 18 wrote "walk the three entry confidence levels end to end" as a
// validation step and had nothing to walk. This is that step.
for (const { label, level, unitId, unitNumber } of ENTRY_LEVELS) {
  test(`entering as "${label}" lands on Unit ${unitNumber} and saves it as the position`, async ({ page }) => {
    const question = await firstRunToEntryQuestion(page);

    // Scoped to the dialog: the Settings row carries the same three labels.
    await question.getByLabel(label).check();
    await expect(question.locator("#entryStartButton")).toHaveText(`Start Unit ${unitNumber}`);
    await question.locator("#entryStartButton").click();

    if (unitNumber !== 1) await page.waitForURL(new RegExp(`unit=${unitId}`));
    await waitForApp(page);
    await expect(page.locator("#entryLevelDialog")).toBeHidden();
    // A dialog's `close` event is queued, so the level is committed a task
    // after the sheet stops being visible.
    await page.waitForFunction(() => window.VimWilds.getState().entryLevel !== null);

    const state = await page.evaluate(() => window.VimWilds.getState());
    expect(state.unitId).toBe(unitId);
    expect(state.activityIndex).toBe(0);
    expect(state.entryLevel).toBe(level);
    expect(state.entryUnitId).toBe(unitId);

    const saved = await sessionState(page);
    expect(saved.unitId).toBe(unitId);
    expect(saved.entryLevel).toBe(level);

    // The landing is a real saved position, so a plain relaunch resumes it.
    await page.goto("/play/");
    await waitForApp(page);
    await expect(page.locator("#entryLevelDialog")).toBeHidden();
    expect(await page.evaluate(() => window.VimWilds.getState().unitId)).toBe(unitId);
  });
}

test("entering as experienced completes nothing it did not earn", async ({ page }) => {
  const question = await firstRunToEntryQuestion(page);
  await question.getByLabel("Experienced").check();
  await question.locator("#entryStartButton").click();
  await page.waitForURL(/unit=command-line-ranges-line-operations/);
  await waitForApp(page);

  // The level is a suggestion about where to open. It is not a completion.
  expect(await page.evaluate(() => window.VimWilds.getState().story.completedUnitStoryIds)).toEqual([]);
  const completions = await page.evaluate(async () => Object.keys((await window.VimWilds.masteryState()).completions));
  expect(completions).toEqual([]);
  expect((await sessionState(page)).unitId).toBe("command-line-ranges-line-operations");

  // The prerequisite warning is the feature working, not a bug to suppress.
  await page.click("#tocButton");
  const macros = unitBlock(page, 14);
  await macros.locator("summary").click();
  const warning = macros.locator(".toc-unit-warning");
  await expect(warning).toBeVisible();
  const head = warning.locator(".toc-unit-warning-head");
  for (const number of [3, 4, 6, 8, 11]) {
    await expect(head).toContainText(String(number));
  }
  await expect(warning).toContainText("Nothing is locked");
});

test("dismissing the entry question leaves today's behavior exactly as it is", async ({ page }) => {
  const question = await firstRunToEntryQuestion(page);
  await expect(question.getByLabel("New to Vim")).toBeChecked();

  // Escape is the regression guard for the keydown bail-out: without it the
  // capture handler swallows the key and the question cannot be dismissed.
  await page.keyboard.press("Escape");
  await expect(question).toBeHidden();
  await page.waitForFunction(() => window.VimWilds.getState().entryLevel !== null);

  expect(new URL(page.url()).searchParams.has("unit")).toBe(false);
  const state = await page.evaluate(() => window.VimWilds.getState());
  expect(state.unitId).toBe("modal-model");
  expect(state.activityIndex).toBe(0);
  expect(state.entryLevel).toBe("new");
  expect((await sessionState(page)).entryLevel).toBe("new");

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeHidden();
  await expect(page.locator("#referenceDialog")).toBeHidden();
  await expect(page.locator("#entryLevelDialog")).toBeHidden();
});

test("the starting point can be changed later from Settings without losing the saved place", async ({ page }) => {
  await seedReturningLearner(page);
  await page.goto("/play/");
  await waitForApp(page);
  // A learner already past the first run is never interrupted by the question.
  await expect(page.locator("#entryLevelDialog")).toBeHidden();

  const settings = page.locator("#settingsDialog");
  await page.getByRole("button", { name: "Open settings" }).click();
  await settings.getByLabel("Experienced").check();

  expect(await page.evaluate(() => window.VimWilds.getState().entryLevel)).toBe("experienced");
  // Recording a level must not teleport anyone away from where they are.
  expect(await page.evaluate(() => window.VimWilds.getState().unitId)).toBe("modal-model");
  await expect(settings.locator("#entryLandingButton")).toHaveText("Open Unit 12");

  await page.reload();
  await waitForApp(page);
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect(settings.getByLabel("Experienced")).toBeChecked();

  await settings.locator("#entryLandingButton").click();
  await page.waitForURL(/unit=command-line-ranges-line-operations/);
  await waitForApp(page);
  expect(await page.evaluate(() => window.VimWilds.getState().unitId)).toBe("command-line-ranges-line-operations");
});

// The curriculum promises any topic can be opened without finishing what comes
// before it. The contents dialog is that affordance; this is the half that was
// never asserted.
test("opening an unreached topic records no progress", async ({ page }) => {
  await seedReturningLearner(page);
  await openContents(page);
  const macros = unitBlock(page, 14);
  await macros.locator("summary").click();
  await macros.locator('button[data-unit-id="macros"]').click();
  await page.waitForURL(/unit=macros/);
  await waitForApp(page);

  expect(await page.evaluate(() => window.VimWilds.getState().unitId)).toBe("macros");
  expect(await page.evaluate(() => window.VimWilds.getState().story.completedUnitStoryIds)).toEqual([]);
  const completions = await page.evaluate(async () => Object.keys((await window.VimWilds.masteryState()).completions));
  expect(completions).toEqual([]);
});

for (const [width, height] of [[360, 740], [430, 932]]) {
  test(`the entry question and its settings row fit ${width}x${height} @exhaustive`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const question = await firstRunToEntryQuestion(page);
    for (const { label } of ENTRY_LEVELS) {
      await expect(question.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(question.locator("#entryStartButton")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Open settings" }).click();
    const row = page.locator("#entryLevelOptions");
    await row.scrollIntoViewIfNeeded();
    await expect(row.locator("#entryLandingButton")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

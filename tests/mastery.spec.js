import { expect, test } from "@playwright/test";

const sessionKey = "vim-wilds.session.v1";
const masteryKey = "vim-wilds.mastery.v1";

const waitForApp = page => page.waitForFunction(() => window.VimWilds?.masteryState);
const masteryState = page => page.evaluate(() => window.VimWilds.masteryState());
const appState = page => page.evaluate(() => window.VimWilds.getState());
const savedSession = page => page.evaluate(key => window.localStorage.getItem(key), sessionKey);

const seedReturningLearner = page => page.addInitScript(() => {
  window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
    introSeen: true,
    endingSeen: false,
    completedUnitStoryIds: [],
  }));
  window.localStorage.setItem("vim-wilds.reference.v1", JSON.stringify({ orientationSeen: true }));
  window.localStorage.setItem("vim-wilds.practice.v1", JSON.stringify({ noticeSeen: true }));
});

// Three concepts taken to `practiced` and nothing else. Seeding the store
// rather than playing the curriculum is what makes "mixed review draws only
// from completed topics" checkable in one test instead of forty exercises.
const PRACTISED = {
  "inside-around-words": ["uppercase-inside-word"],
  "unnamed-register": ["unnamed-word-copy"],
  "record-replay-macro": ["comment-python-jobs"],
};

const seedMastery = (page, completions, at = Math.floor(Date.now() / 1000)) => page.addInitScript(
  ({ key, ids, when }) => {
    window.localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1,
      completions: Object.fromEntries(ids.map(id => [id, { count: 1, lastAt: when }])),
      pinned: [],
    }));
  },
  { key: masteryKey, ids: completions, when: at },
);

// A learner opens the unit rows they care about; the test opens all of them so
// a concept row can be clicked without the walk being the subject of the test.
const expandMasteryUnits = page => page.evaluate(() => {
  document.querySelectorAll("#masteryDialog details").forEach(row => { row.open = true; });
});

async function expectNoDocumentOverflow(page) {
  expect(await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))).toEqual({ x: 0, y: 0 });
}

test.beforeEach(async ({ page }) => {
  await seedReturningLearner(page);
  await page.setViewportSize({ width: 360, height: 740 });
});

test("the mastery map is reachable from the contents before any progress", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  await page.click("#tocButton");
  await expect(page.locator(".toc-mastery")).toBeVisible();
  await page.click("[data-mastery-open]");
  await expect(page.locator("#masteryDialog")).toBeVisible();
  const state = await masteryState(page);
  expect(state.concepts).toHaveLength(138);
  expect(state.units).toHaveLength(17);
  // Nothing completed, so nothing is drillable and mixed review is closed.
  expect(state.concepts.every(concept => concept.state === "unseen")).toBe(true);
  await expect(page.locator("[data-mastery-mixed]")).toBeDisabled();
  await expectNoDocumentOverflow(page);
});

test("all five progress states are represented, and maintenance sits beside integrated", async ({ page }) => {
  const integrated = ["uppercase-inside-word", "change-inside-word", "delete-around-word"];
  // Old enough that the placeholder staleness rule has fired.
  await seedMastery(page, integrated, Math.floor(Date.now() / 1000) - 40 * 24 * 60 * 60);
  await page.goto("/play/");
  await waitForApp(page);
  const state = await masteryState(page);
  const byId = Object.fromEntries(state.concepts.map(concept => [concept.id, concept]));
  expect(byId["inside-around-words"].state).toBe("integrated");
  // The achieved state does not fall back; the refresh marker is a second fact.
  expect(byId["inside-around-words"].maintenanceDue).toBe(true);
  expect(new Set(state.concepts.map(concept => concept.state))).toContain("unseen");
  await page.evaluate(() => window.VimWilds.openMastery());
  const chips = page.locator(".mastery-unit", { hasText: "Text objects" });
  await page.locator(".mastery-unit").filter({ hasText: "Text objects" }).locator("summary").click();
  await expect(chips.locator(".mastery-chip.state-integrated").first()).toBeVisible();
  await expect(chips.locator(".mastery-chip.maintenance").first()).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("a completed topic is directly replayable and the drill runs its own queue", async ({ page }) => {
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  const before = await savedSession(page);
  await page.evaluate(() => window.VimWilds.startMasteryDrill("inside-around-words"));
  const state = await appState(page);
  expect(state.surface).toBe("mastery");
  expect(await page.locator("#phone").getAttribute("data-surface")).toBe("mastery");
  // Positions in this unit's lesson flow are meaningless inside a drill.
  expect(state.exerciseIndex).toBe(-1);
  const mastery = await masteryState(page);
  expect(mastery.active).toBe(true);
  expect(mastery.kind).toBe("focused");
  expect(mastery.length).toBeGreaterThan(1);
  expect(await savedSession(page)).toBe(before);
  await expectNoDocumentOverflow(page);
});

test("a drill replays a real exercise from another unit, with the prompt withheld", async ({ page }) => {
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  // The learner is sitting in Unit 1; the drill comes from Unit 14.
  expect((await appState(page)).unitId).toBe("modal-model");
  await page.evaluate(() => window.VimWilds.startMasteryDrill("record-replay-macro"));
  const before = await appState(page);
  expect(before.activityType).toBe("exercise");
  // Recall is the one "advanced variant" dimension that exists as authored
  // data: the exercise is real, the prompt is withheld.
  expect(before.practiceMode).toBe("recall");
  expect(before.practicePolicy).toBe("recall-sequence");
  await expect(page.locator(".activity-origin")).toHaveText("Unit 14");
  await page.evaluate(() => window.VimWilds.solveCurrent());
  const after = await appState(page);
  expect(after.complete).toBe(true);
  // Recorded against the authored id, not the id the drill ran under.
  const mastery = await masteryState(page);
  expect(mastery.completions).toContain("comment-python-jobs");
  expect(mastery.completions.every(id => !id.startsWith("mastery:"))).toBe(true);
  expect(failures).toEqual([]);
});

test("a full mastery session leaves the saved lesson position byte-identical", async ({ page }) => {
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  const before = await savedSession(page);
  await page.evaluate(() => window.VimWilds.startMasteryDrill("unnamed-register"));
  // Walk the whole queue, solving anything that can be solved.
  await page.evaluate(async () => {
    for (let step = 0; step < 40; step += 1) {
      const state = window.VimWilds.getState();
      if (state.surface !== "mastery") break;
      window.VimWilds.solveCurrent();
      const activity = window.VimWilds.getState();
      if (activity.activityType === "choice" && !activity.complete) break;
      document.querySelector('[data-action="next"]')?.click();
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  });
  expect(await savedSession(page)).toBe(before);
});

test("mixed review draws only from the topics the learner has practised", async ({ page }) => {
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  await page.evaluate(() => window.VimWilds.startMixedReview());
  const mastery = await masteryState(page);
  expect(mastery.active).toBe(true);
  expect(mastery.kind).toBe("mixed");
  const allowed = new Set(Object.keys(PRACTISED));
  expect(mastery.conceptIds.every(id => allowed.has(id))).toBe(true);
  expect(mastery.conceptIds.length).toBeGreaterThanOrEqual(2);
  // An unpractised concept from another unit never appears.
  expect(mastery.conceptIds).not.toContain("global-delete");
});

test("mixed review refuses to run below two practised topics", async ({ page }) => {
  await seedMastery(page, ["uppercase-inside-word"]);
  await page.goto("/play/");
  await waitForApp(page);
  const started = await page.evaluate(() => window.VimWilds.startMixedReview());
  expect(started).toBeNull();
  expect((await masteryState(page)).active).toBe(false);
  await page.evaluate(() => window.VimWilds.openMastery());
  await expect(page.locator("[data-mastery-mixed]")).toBeDisabled();
});

test("tool choice mode queues questions and never lowers progression", async ({ page }) => {
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  const before = await savedSession(page);
  const started = await page.evaluate(() => window.VimWilds.startToolChoice());
  expect(started).not.toBeNull();
  expect((await appState(page)).activityType).toBe("choice");
  expect(await savedSession(page)).toBe(before);
});

test("every field note renders, states its limitation, and offers no route out", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  const notes = await page.evaluate(() => window.VimWilds.fieldNotes());
  expect(notes).toHaveLength(5);
  for (const note of notes) {
    await page.evaluate(id => window.VimWilds.startFieldNote(id), note.id);
    await expect(page.locator(".field-note-limitation")).toBeVisible();
    await expect(page.locator(".field-note-limitation")).toContainText("briefing, not a drill");
    // Nothing that could navigate into a lesson and move the bookmark.
    await expect(page.locator("[data-remediation], [data-route], [data-demo]")).toHaveCount(0);
    await expectNoDocumentOverflow(page);
  }
});

test("a field note choice can be answered and explains itself", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  await page.evaluate(() => window.VimWilds.startFieldNote("argument-list-and-argdo"));
  // Walk to the note's question.
  for (let step = 0; step < 6; step += 1) {
    if ((await appState(page)).activityType === "choice") break;
    await page.evaluate(() => window.VimWilds.solveCurrent());
    await page.locator('[data-action="next"]').first().click();
  }
  expect((await appState(page)).activityType).toBe("choice");
  await page.locator('[data-choice="no-update"]').click();
  await expect(page.locator(".choice-feedback.correct")).toContainText("Correct.");
  await expect(page.locator(".choice-feedback")).toContainText("| update");
});

test("finishing a queue returns to the map rather than a lesson", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  await page.evaluate(() => window.VimWilds.startFieldNote("when-to-leave-vim"));
  const before = await savedSession(page);
  await page.evaluate(async () => {
    for (let step = 0; step < 12; step += 1) {
      if (window.VimWilds.getState().surface !== "mastery") break;
      window.VimWilds.solveCurrent();
      const state = window.VimWilds.getState();
      if (state.activityType === "choice" && !state.complete) {
        document.querySelector(".choice-option")?.click();
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      document.querySelector('[data-action="next"]')?.click();
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  });
  expect((await appState(page)).surface).toBe("lesson");
  expect(await page.locator("#phone").getAttribute("data-surface")).toBeNull();
  expect(await savedSession(page)).toBe(before);
  // No unit-boundary story was fired on the way out.
  await expect(page.locator("#storyDialog")).toBeHidden();
});

test("leaving a drill restores the lesson exactly where it was", async ({ page }) => {
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  const before = await appState(page);
  await page.evaluate(() => window.VimWilds.startMasteryDrill("record-replay-macro"));
  expect((await appState(page)).surface).toBe("mastery");
  await page.evaluate(() => window.VimWilds.exitMastery());
  const after = await appState(page);
  expect(after.surface).toBe("lesson");
  expect(after.activityId).toBe(before.activityId);
  expect(after.unitId).toBe(before.unitId);
});

test("free practice and mastery never overlap", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  await page.evaluate(() => window.VimWilds.openFreePractice());
  expect((await appState(page)).surface).toBe("free-practice");
  await page.evaluate(() => window.VimWilds.startFieldNote("buffers-and-bufdo"));
  expect((await appState(page)).surface).toBe("mastery");
  expect(await page.evaluate(() => window.VimWilds.freePracticeState().active)).toBe(false);
  await page.evaluate(() => window.VimWilds.exitMastery());
  expect((await appState(page)).surface).toBe("lesson");
});

test("completing a lesson exercise advances its concept state", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  const before = await masteryState(page);
  expect(before.completions).toHaveLength(0);
  await page.evaluate(() => window.VimWilds.goTo(0));
  await page.evaluate(() => window.VimWilds.solveCurrent());
  const after = await masteryState(page);
  expect(after.completions.length).toBeGreaterThan(0);
  const touched = after.concepts.filter(concept => concept.state !== "unseen");
  expect(touched.length).toBeGreaterThan(0);
});

test("a pinned focus list narrows mixed review without widening it", async ({ page }) => {
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  await page.evaluate(() => window.VimWilds.openMastery());
  await expandMasteryUnits(page);
  await page.locator('[data-mastery-pin="inside-around-words"]').click();
  await expandMasteryUnits(page);
  await page.locator('[data-mastery-pin="unnamed-register"]').click();
  expect((await masteryState(page)).pinned).toEqual(["inside-around-words", "unnamed-register"]);
  await page.evaluate(() => window.VimWilds.startMixedReview());
  const mastery = await masteryState(page);
  expect(mastery.conceptIds.sort()).toEqual(["inside-around-words", "unnamed-register"]);
  // A pin cannot reach a topic the learner has not practised.
  expect(mastery.conceptIds).not.toContain("global-delete");
});

// The designed target: portrait phones from 360 to 432 CSS pixels wide.
const PHONE_VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 432, height: 960 },
];

for (const viewport of PHONE_VIEWPORTS) {
  test(`the map, a drill and a field note fit ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await seedMastery(page, Object.values(PRACTISED).flat());
    await page.setViewportSize(viewport);
    await page.goto("/play/");
    await waitForApp(page);

    await page.evaluate(() => window.VimWilds.openMastery());
    await page.locator(".mastery-unit").first().locator("summary").click();
    await expectNoDocumentOverflow(page);
    // The map is long by nature; it must scroll inside its own dialog body and
    // never hand that scrolling to the document.
    expect(await page.evaluate(() => {
      const body = document.querySelector("#masteryBody");
      return body.scrollHeight > body.clientHeight;
    })).toBe(true);
    await page.evaluate(() => window.VimWilds.closeMastery());

    // A macro drill from Unit 14: the tallest buffer the surface can show.
    await page.evaluate(() => window.VimWilds.startMasteryDrill("record-replay-macro"));
    await expectNoDocumentOverflow(page);
    expect(await page.evaluate(() => document.querySelector(".code-slab") !== null)).toBe(true);
    await page.evaluate(() => window.VimWilds.exitMastery());

    // And the longest field note, whose demo carries a five-row buffer.
    await page.evaluate(() => window.VimWilds.startFieldNote("quickfix-as-a-work-list"));
    await expectNoDocumentOverflow(page);
    await page.evaluate(() => window.VimWilds.exitMastery());
  });
}

test("chapter completion and mastery read as different things", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
      introSeen: true,
      endingSeen: false,
      completedUnitStoryIds: ["modal-model"],
    }));
  });
  await seedMastery(page, Object.values(PRACTISED).flat());
  await page.goto("/play/");
  await waitForApp(page);
  await page.click("#tocButton");
  // The chapter marker lives on the unit row in the contents...
  await expect(page.locator(".toc-unit-complete")).toHaveCount(1);
  await expect(page.locator(".toc-mastery")).toBeVisible();
  await page.click("[data-mastery-open]");
  // ...and the mastery states live in their own surface, never on that row.
  await page.locator("#masteryDialog .mastery-unit").first().locator("summary").click();
  await expect(page.locator("#masteryDialog .toc-unit-complete")).toHaveCount(0);
  const chip = page.locator("#masteryDialog .mastery-chip").first();
  await chip.scrollIntoViewIfNeeded();
  await expect(chip).toBeVisible();
});

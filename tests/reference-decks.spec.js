import { expect, test } from "@playwright/test";

const referenceKey = "vim-wilds.reference.v1";
const storyKey = "vim-wilds.story.v1";

const waitForApp = page => page.waitForFunction(() => window.VimWilds?.referenceState);
const referenceState = page => page.evaluate(() => window.VimWilds.referenceState());

const seedStorySeen = page => page.addInitScript(storyStateKey => {
  window.localStorage.setItem(storyStateKey, JSON.stringify({
    introSeen: true,
    endingSeen: false,
    completedUnitStoryIds: [],
  }));
}, storyKey);

const seedOrientationSeen = page => page.addInitScript(key => {
  window.localStorage.setItem(key, JSON.stringify({ orientationSeen: true }));
}, referenceKey);

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ));
  expect(overflow).toBe(0);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
});

test("the opening deck follows the story introduction and hands off to Unit 1", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);

  const story = page.locator("#storyDialog");
  const reference = page.locator("#referenceDialog");
  await expect(story).toBeVisible();
  await expect(reference).toBeHidden();

  for (let panel = 0; panel < 2; panel += 1) {
    await story.getByRole("button", { name: "Continue" }).click();
  }
  await story.getByRole("button", { name: "Enter the Wilds" }).click();

  await expect(reference).toBeVisible();
  await expect(page.locator("#referenceKicker")).toHaveText("Before you start");
  await expect(page.locator("#referenceTitle")).toHaveText("What Vim is");
  await expect(page.locator("#referenceProgress")).toHaveText("1 of 3");
  await expectNoHorizontalOverflow(page);

  await reference.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("#referenceTitle")).toHaveText("Why this course exists");
  await reference.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("#referenceTitle")).toHaveText("Where to start");

  // The final card is the handoff, so it offers a choice instead of "Next".
  await expect(reference.getByRole("button", { name: "Next" })).toHaveCount(0);
  await expect(reference.getByRole("button", { name: "Read the survival cards" })).toBeVisible();
  await reference.getByRole("button", { name: "Start Unit 1" }).click();

  await expect(reference).toBeHidden();
  expect((await referenceState(page)).orientationSeen).toBe(true);
  expect(await page.evaluate(() => window.VimWilds.getState().unitId)).toBe("modal-model");
  expect(await page.evaluate(() => window.VimWilds.getState().activityIndex)).toBe(0);
});

test("skipping the story still reaches the opening, and skipping that reaches the lesson", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);

  await page.locator("#storyDialog").getByRole("button", { name: "Skip story" }).click();
  const reference = page.locator("#referenceDialog");
  await expect(reference).toBeVisible();

  await reference.getByRole("button", { name: "Skip" }).click();
  await expect(reference).toBeHidden();
  expect((await referenceState(page)).orientationSeen).toBe(true);
});

test("the opening runs once and never blocks a later launch", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  await page.locator("#storyDialog").getByRole("button", { name: "Skip story" }).click();
  await page.locator("#referenceDialog").getByRole("button", { name: "Skip" }).click();

  await page.reload();
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeHidden();
  await expect(page.locator("#referenceDialog")).toBeHidden();
});

test("a learner who already saw the story still gets the opening once", async ({ page }) => {
  await seedStorySeen(page);
  await page.goto("/play/");
  await waitForApp(page);

  await expect(page.locator("#storyDialog")).toBeHidden();
  await expect(page.locator("#referenceDialog")).toBeVisible();
  await expect(page.locator("#referenceTitle")).toHaveText("What Vim is");
});

test("the handoff card opens the survival deck and closes the opening for good", async ({ page }) => {
  await seedStorySeen(page);
  await page.goto("/play/");
  await waitForApp(page);

  const reference = page.locator("#referenceDialog");
  await reference.getByRole("button", { name: "Next" }).click();
  await reference.getByRole("button", { name: "Next" }).click();
  await reference.getByRole("button", { name: "Read the survival cards" }).click();

  await expect(page.locator("#referenceKicker")).toHaveText("Reference");
  await expect(page.locator("#referenceTitle")).toHaveText("Leaving safely");
  await expect(page.locator("#referenceProgress")).toHaveText("1 of 6");
  expect((await referenceState(page)).orientationSeen).toBe(true);

  // The survival deck ends on "Done" and leaves the lesson exactly where it was.
  for (let card = 0; card < 5; card += 1) {
    await reference.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.locator("#referenceProgress")).toHaveText("6 of 6");
  await reference.getByRole("button", { name: "Done" }).click();
  await expect(reference).toBeHidden();
});

test("every deck is reachable from the table of contents without touching progress", async ({ page }) => {
  await seedStorySeen(page);
  await seedOrientationSeen(page);
  await page.goto("/play/");
  await waitForApp(page);

  const decks = [
    { id: "orientation", cards: 3 },
    { id: "survival", cards: 6 },
    { id: "host-reality", cards: 1 },
    { id: "orientation-only", cards: 1 },
  ];
  await expect(page.locator("#tocLessons [data-reference-deck]")).toHaveCount(decks.length);

  const before = await page.evaluate(() => window.VimWilds.getState().activityId);
  for (const deck of decks) {
    await page.evaluate(() => document.querySelector("#tocDialog").showModal());
    await page.locator(`#tocLessons [data-reference-deck="${deck.id}"]`).click();
    await expect(page.locator("#referenceDialog")).toBeVisible();
    expect((await referenceState(page)).deckId).toBe(deck.id);
    expect((await referenceState(page)).cardCount).toBe(deck.cards);
    await expectNoHorizontalOverflow(page);
    await page.locator('#referenceDialog [data-reference-action="close"]').first().click();
    await expect(page.locator("#referenceDialog")).toBeHidden();
  }
  expect(await page.evaluate(() => window.VimWilds.getState().activityId)).toBe(before);
});

test("a reference deep link opens without playing the introduction", async ({ page }) => {
  await page.goto("/play/?reference=survival");
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeHidden();
  await expect(page.locator("#referenceDialog")).toBeVisible();
  expect((await referenceState(page)).deckId).toBe("survival");
  // A deep link is not the default arrival, so it must not consume the opening.
  expect((await referenceState(page)).orientationSeen).toBe(false);
});

test("an activity deep link never opens the opening deck", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await waitForApp(page);
  await expect(page.locator("#storyDialog")).toBeHidden();
  await expect(page.locator("#referenceDialog")).toBeHidden();
});

test("cards stack their columns on a phone and pair them on a wider screen", async ({ page }) => {
  await seedStorySeen(page);
  await seedOrientationSeen(page);
  await page.goto("/play/?reference=host-reality");
  await waitForApp(page);

  const firstRow = page.locator("#referenceCardBody .reference-row").first();
  await expect(firstRow.locator(".reference-row-vim")).toBeVisible();
  await expect(firstRow.locator(".reference-row-host")).toBeVisible();

  const stackedTops = await firstRow.evaluate(row => [
    row.querySelector(".reference-row-vim").getBoundingClientRect().top,
    row.querySelector(".reference-row-host").getBoundingClientRect().top,
  ]);
  expect(stackedTops[1]).toBeGreaterThan(stackedTops[0]);
  await expect(firstRow.locator(".reference-cell-label").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.setViewportSize({ width: 900, height: 1000 });
  await expect(page.locator("#referenceCardBody .reference-row-heading")).toBeVisible();
  const pairedTops = await firstRow.evaluate(row => [
    row.querySelector(".reference-row-vim").getBoundingClientRect().top,
    row.querySelector(".reference-row-host").getBoundingClientRect().top,
  ]);
  expect(pairedTops[1]).toBe(pairedTops[0]);
  await expectNoHorizontalOverflow(page);
});

test("the card body scrolls inside itself and the document never does", async ({ page }) => {
  await seedStorySeen(page);
  await seedOrientationSeen(page);
  await page.goto("/play/?reference=survival");
  await waitForApp(page);

  const body = page.locator("#referenceCardBody");
  expect(await body.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
  expect(await body.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (
    document.documentElement.scrollHeight <= document.documentElement.clientHeight
  ))).toBe(true);
  await expectNoHorizontalOverflow(page);

  // Paging to the next card returns to the top of the new one.
  await page.locator('#referenceDialog [data-reference-action="next"]').click();
  expect(await body.evaluate(node => node.scrollTop)).toBe(0);
});

test("the reference board renders the Mosslight Landing scene", async ({ page }) => {
  await seedStorySeen(page);
  await seedOrientationSeen(page);
  await page.goto("/play/?reference=orientation");
  await waitForApp(page);

  const visual = page.locator("#referenceVisual");
  await expect(visual).toHaveAttribute("data-scene-id", "mosslight-landing");
  await expect(visual).toHaveAttribute("data-world-id", "moonroot-ruins");
  await expect(visual).toHaveAttribute("data-renderer", "registered-scenes");
  const asset = await page.locator("#referenceBackdrop").evaluate(node => (
    node.style.getPropertyValue("--world-asset")
  ));
  expect(asset).toContain("mosslight-landing");
});

test("reduced motion keeps the cards readable and retires the variant layer", async ({ page, browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 360, height: 740 } });
  const reduced = await context.newPage();
  await reduced.addInitScript(key => {
    window.localStorage.setItem(key, JSON.stringify({ orientationSeen: true }));
  }, referenceKey);
  await reduced.goto("/play/?reference=survival");
  await reduced.waitForFunction(() => window.VimWilds?.referenceState);

  await expect(reduced.locator("#referenceVisual")).toHaveAttribute("data-reduced-motion", "true");
  await expect(reduced.locator("#referenceVariantLayer")).toBeHidden();
  await expect(reduced.locator("#referenceTitle")).toHaveText("Leaving safely");
  await context.close();
});

test("simple backgrounds keep the deck usable without generated scenes", async ({ page }) => {
  await seedOrientationSeen(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ generatedBackdrops: "disabled" }));
  });
  await page.goto("/play/?reference=survival");
  await waitForApp(page);

  await expect(page.locator("#referenceVisual")).toHaveAttribute("data-simple-background", "true");
  await expect(page.locator("#referenceVariantLayer")).toBeEmpty();
  await expect(page.locator("#referenceTitle")).toHaveText("Leaving safely");
});

test("every card fits the phone viewport matrix without overflow", async ({ page }) => {
  await seedStorySeen(page);
  await seedOrientationSeen(page);
  const viewports = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 432, height: 960 },
  ];
  await page.goto("/play/");
  await waitForApp(page);

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const deckId of ["orientation", "survival", "host-reality", "orientation-only"]) {
      await page.evaluate(id => window.VimWilds.openReference(id), deckId);
      const cardCount = (await referenceState(page)).cardCount;
      for (let card = 0; card < cardCount; card += 1) {
        if (card) await page.locator('#referenceDialog [data-reference-action="next"]').click();
        await expectNoHorizontalOverflow(page);
        const bounds = await page.locator("#referenceDialog").boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
        await expect(page.locator("#referenceActions")).toBeInViewport();
      }
      await page.evaluate(() => window.VimWilds.closeReference());
    }
  }
});

test("per-unit reference entries render and open their examples", async ({ page }) => {
  await seedStorySeen(page);
  await seedOrientationSeen(page);
  await page.goto("/play/");
  await waitForApp(page);

  await page.evaluate(() => document.querySelector("#tocDialog").showModal());
  await expect(page.locator("#tocLessons [data-reference-unit]")).toHaveCount(15);

  // The loaded unit is in memory; a later unit has to be fetched.
  await page.locator('#tocLessons [data-reference-unit="modal-model"]').click();
  await expect(page.locator("#referenceKicker")).toHaveText("Unit 1");
  await expect(page.locator("#referenceTitle")).toHaveText("The modal model");
  await expect(page.locator("#referenceCardBody .reference-row")).toHaveCount(7);
  await expectNoHorizontalOverflow(page);

  // A same-unit example jumps straight to that activity.
  await page.locator('#referenceCardBody [data-reference-activity="escape-seeded-insert"]').first().click();
  await expect(page.locator("#referenceDialog")).toBeHidden();
  expect(await page.evaluate(() => window.VimWilds.getState().activityId)).toBe("escape-seeded-insert");

  await page.evaluate(() => document.querySelector("#tocDialog").showModal());
  await page.locator('#tocLessons [data-reference-unit="macros"]').click();
  await expect(page.locator("#referenceTitle")).toHaveText("Macros");
  await expect(page.locator("#referenceCardBody .reference-row")).toHaveCount(9);
  // A cross-unit example is a link, because reaching it reloads the app.
  const href = await page.locator("#referenceCardBody .reference-examples a").first().getAttribute("href");
  expect(href).toContain("unit=macros");
  expect(href).toContain("activity=");
});

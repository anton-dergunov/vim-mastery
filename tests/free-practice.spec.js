import { expect, test } from "@playwright/test";

const sessionKey = "vim-wilds.session.v1";
const practiceKey = "vim-wilds.practice.v1";

const waitForApp = page => page.waitForFunction(() => window.VimWilds?.freePracticeState);
const practiceState = page => page.evaluate(() => window.VimWilds.freePracticeState());
const appState = page => page.evaluate(() => window.VimWilds.getState());

// Free practice is the one surface with no story and no orientation deck in
// front of it, so every test starts where a returning learner does.
const seedReturningLearner = page => page.addInitScript(() => {
  window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
    introSeen: true,
    endingSeen: false,
    completedUnitStoryIds: [],
  }));
  window.localStorage.setItem("vim-wilds.reference.v1", JSON.stringify({ orientationSeen: true }));
});

const seedNoticeSeen = page => page.addInitScript(key => {
  window.localStorage.setItem(key, JSON.stringify({ noticeSeen: true }));
}, practiceKey);

const seedKeyboardVisible = page => page.addInitScript(key => {
  const saved = JSON.parse(window.localStorage.getItem(key) || "{}");
  window.localStorage.setItem(key, JSON.stringify({ ...saved, keyboardVisibility: "visible" }));
}, sessionKey);

async function expectNoDocumentOverflow(page) {
  expect(await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))).toEqual({ x: 0, y: 0 });
}

// Rows the buffer actually shows, from the real scroller and the real line box.
const visibleRows = page => page.evaluate(() => {
  const scroller = document.querySelector(".cm-scroller");
  const line = document.querySelector(".cm-line");
  if (!scroller || !line) return 0;
  return Math.floor(scroller.clientHeight / line.getBoundingClientRect().height);
});

test.beforeEach(async ({ page }) => {
  await seedReturningLearner(page);
  await seedKeyboardVisible(page);
  await seedNoticeSeen(page);
  await page.setViewportSize({ width: 360, height: 740 });
});

test("free practice opens from the contents before any lesson is finished", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  // Parked on the very first activity of Unit 1: nothing has been done yet,
  // and free practice is reachable anyway.
  expect(await appState(page)).toMatchObject({ activityIndex: 0, unitId: "modal-model" });

  await page.locator("#tocButton").click();
  const section = page.locator("#tocLessons > *").first();
  await expect(section).toHaveClass(/toc-practice/);

  await page.locator("[data-practice-random]").first().click();
  await expect(page.locator("#phone")).toHaveAttribute("data-surface", "free-practice");
  expect(await appState(page)).toMatchObject({ surface: "free-practice", practicePolicy: "free" });
  expect((await practiceState(page)).active).toBe(true);
});

test("a random file is the default entry path, with no picker in the way", async ({ page }) => {
  await page.goto("/play/");
  await waitForApp(page);
  await page.evaluate(() => window.VimWilds.openFreePractice());

  const current = await practiceState(page);
  expect(current.pickerOpen).toBe(false);
  await expect(page.locator("#practiceFilesDialog")).toBeHidden();

  const samples = await page.evaluate(() => window.VimWilds.practiceSamples());
  expect(samples).toHaveLength(20);
  expect(samples.map(sample => sample.id)).toContain(current.sampleId);
  await expect(page.locator("#lessonLabel")).toHaveText(current.fileName);
});

test("the surface shows only the editor and the keyboard", async ({ page }) => {
  await page.goto("/play/?practice");
  await waitForApp(page);

  for (const selector of ["#activityIntro", "#nextCommandTray", "#helpCard",
    "#worldBackdrop", "#worldAmbient", "#worldRemoteVariantLayer"]) {
    await expect(page.locator(selector)).toBeHidden();
  }
  expect(await page.evaluate(() => ({
    characters: document.querySelector("#characterLayer").children.length,
    completion: document.querySelector("#completionHost").children.length,
  }))).toEqual({ characters: 0, completion: 0 });

  await expect(page.locator("#keyboard")).toBeVisible();
  await expect(page.locator(".cm-content")).toBeVisible();
  await expect(page.locator("#tocButton")).toBeHidden();
  await expect(page.locator("#settingsButton")).toBeHidden();
  await expect(page.locator("#practiceLeaveButton")).toBeVisible();
  await expect(page.locator("#practiceFilesButton")).toBeVisible();
  await expectNoDocumentOverflow(page);
});

test("the free practice editor is far taller than a lesson editor at 360x740", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=escape-seeded-visual-character");
  await waitForApp(page);
  const lessonRows = await visibleRows(page);

  await page.evaluate(() => window.VimWilds.openFreePractice());
  const practiceRows = await visibleRows(page);

  expect(lessonRows).toBeGreaterThan(0);
  expect(practiceRows).toBeGreaterThanOrEqual(18);
  expect(practiceRows).toBeGreaterThanOrEqual(lessonRows * 3);
});

test("a long buffer scrolls inside the editor and never the document", async ({ page }) => {
  const longest = await page.goto("/play/?practice").then(async () => {
    await waitForApp(page);
    const samples = await page.evaluate(() => window.VimWilds.practiceSamples());
    return samples.sort((a, b) => b.lineCount - a.lineCount)[0];
  });
  await page.evaluate(id => window.VimWilds.openFreePractice(id), longest.id);

  // The lesson's fixed-window clamp must not be in play here.
  await expect(page.locator(".editor-stack")).not.toHaveClass(/has-viewport/);
  expect(await page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller");
    return {
      overflowY: getComputedStyle(scroller).overflowY,
      scrolls: scroller.scrollHeight > scroller.clientHeight,
      top: scroller.scrollTop,
    };
  })).toMatchObject({ overflowY: "auto", scrolls: true, top: 0 });

  await page.locator(".cm-content").focus();
  await page.keyboard.press("Shift+G");
  // CodeMirror scrolls in its next measurement frame, so poll rather than read
  // the offset on the same tick as the keypress.
  await expect.poll(() => page.evaluate(() => document.querySelector(".cm-scroller").scrollTop))
    .toBeGreaterThan(0);
  await expectNoDocumentOverflow(page);
});

test("no sample buffer overflows the slab horizontally at 360px", async ({ page }) => {
  await page.goto("/play/?practice");
  await waitForApp(page);
  const samples = await page.evaluate(() => window.VimWilds.practiceSamples());

  for (const sample of samples) {
    await page.evaluate(id => window.VimWilds.openFreePractice(id), sample.id);
    const overflow = await page.evaluate(() => {
      const scroller = document.querySelector(".cm-scroller");
      return scroller.scrollWidth - scroller.clientWidth;
    });
    expect(overflow, `${sample.fileName} overflows the slab by ${overflow}px`).toBeLessThanOrEqual(1);
  }
});

test("latched modifiers and Caps Lock behave as they do in a lesson", async ({ page }) => {
  await page.goto("/play/?practice=field-notes-prose");
  await waitForApp(page);

  await page.locator('.key[data-key="i"]').click();
  await page.locator('[data-mod="Shift"]').first().click();
  await page.locator('.key[data-key="a"]').click();
  expect((await appState(page)).code[0].startsWith("A")).toBe(true);
  // The latch releases after the key it modified, exactly as in lesson mode.
  expect((await appState(page)).modifiers).toEqual([]);

  await page.locator('.key[data-key="Escape"]').click();
  await page.locator('.key[data-key="CapsLock"]').click();
  await expect(page.locator('.key[data-key="CapsLock"]')).toHaveClass(/latched/);
  await expect(page.locator("#keyboard")).toHaveClass(/letter-uppercase/);
});

test("input is not restricted to the taught command set", async ({ page }) => {
  await page.goto("/play/?practice=inventory-csv");
  await waitForApp(page);
  const before = (await appState(page)).code[0];

  await page.locator(".cm-content").focus();
  await page.keyboard.press("Shift+`");

  const after = await appState(page);
  expect(after.code[0]).not.toBe(before);
  // Nothing is judged here: no wrong-key flash, and no history to compare.
  expect(await page.locator(".key.wrong").count()).toBe(0);
  expect(after.history).toEqual([]);
  expect(after.complete).toBe(false);
});

test("entering, editing and leaving changes no progression state", async ({ page }) => {
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await waitForApp(page);
  const readSession = () => page.evaluate(key => {
    const saved = JSON.parse(window.localStorage.getItem(key) || "{}");
    delete saved.savedAt;
    return saved;
  }, sessionKey);
  const before = await readSession();

  await page.evaluate(() => window.VimWilds.openFreePractice("cart-javascript"));
  await page.locator(".cm-content").focus();
  await page.keyboard.press("d");
  await page.keyboard.press("d");
  await page.keyboard.press("x");
  expect(await readSession()).toEqual(before);

  await page.locator("#practiceLeaveButton").click();
  expect(await readSession()).toEqual(before);
  expect(await appState(page)).toMatchObject({
    surface: "lesson",
    activityId: before.activityId,
    complete: false,
    progress: 0,
    history: [],
  });
});

test("the compatibility notice appears once and is re-readable afterwards", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.removeItem(key), practiceKey);
  await page.goto("/play/?practice");
  await waitForApp(page);

  const notice = page.locator("#practiceNoticeDialog");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("not");
  await expect(notice).toContainText("Vim Wilds command set");

  await notice.locator('[data-close-dialog="practiceNoticeDialog"]').click();
  await expect(notice).toBeHidden();
  // `close` is dispatched as a task, so the dialog is hidden a tick before the
  // flag is written. Poll rather than read once.
  await expect.poll(() => page.evaluate(key => window.localStorage.getItem(key), practiceKey))
    .toBe(JSON.stringify({ noticeSeen: true }));

  await page.locator("#practiceLeaveButton").click();
  await page.evaluate(() => window.VimWilds.openFreePractice());
  await expect(notice).toBeHidden();

  // Never hidden, never nagging: the picker always carries the one-liner.
  await page.locator("#practiceFilesButton").click();
  await expect(page.locator(".practice-disclaimer")).toBeVisible();
  await page.locator("[data-practice-notice]").click();
  await expect(notice).toBeVisible();
});

test("dismissing the notice with Escape still records that it was shown", async ({ page }) => {
  await page.addInitScript(key => window.localStorage.removeItem(key), practiceKey);
  await page.goto("/play/?practice");
  await waitForApp(page);

  await expect(page.locator("#practiceNoticeDialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#practiceNoticeDialog")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.VimWilds.freePracticeState().noticeSeen)).toBe(true);
});

test("reset restores the open file rather than picking a new one", async ({ page }) => {
  await page.goto("/play/?practice=config-toml");
  await waitForApp(page);
  const original = (await appState(page)).code;

  await page.locator(".cm-content").focus();
  await page.keyboard.press("d");
  await page.keyboard.press("d");
  expect((await appState(page)).code).not.toEqual(original);

  await page.locator("#nextResetButton").click();
  expect((await appState(page)).code).toEqual(original);
  expect((await practiceState(page)).sampleId).toBe("config-toml");
});

test("picking another file swaps the buffer and returns focus to the editor", async ({ page }) => {
  await page.goto("/play/?practice=theme-css");
  await waitForApp(page);

  await page.locator("#practiceFilesButton").click();
  await expect(page.locator("#practiceFileList button")).toHaveCount(20);
  await page.locator('[data-practice-sample="release-shell"]').click();

  await expect(page.locator("#practiceFilesDialog")).toBeHidden();
  expect(await practiceState(page)).toMatchObject({ sampleId: "release-shell", fileName: "release.sh" });
  await expect(page.locator("#lessonLabel")).toHaveText("release.sh");
  // A dialog button that keeps focus silently kills physical input, because the
  // capture handler skips events targeted at a non-key button.
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".cm-editor")))).toBe(true);
});

test("a practice deep link is a clean arrival with no story or reference on top", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await page.goto("/play/?practice=gateway-log");
  await waitForApp(page);

  await expect(page.locator("#storyDialog")).toBeHidden();
  await expect(page.locator("#referenceDialog")).toBeHidden();
  expect((await practiceState(page)).sampleId).toBe("gateway-log");
});

test("the landing page forwards the practice parameter into the app", async ({ page }) => {
  await page.goto("/?practice=package-json");
  await waitForApp(page);

  expect(new URL(page.url()).pathname.endsWith("/play/")).toBe(true);
  expect((await practiceState(page)).sampleId).toBe("package-json");
});

// The short landscape layout hides the top bar and is gated on a coarse
// pointer, so this block needs touch emulation to reach it at all.
test.describe("short landscape", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("short landscape keeps the practice controls reachable", async ({ page }) => {
    await page.goto("/play/?practice=analytics-sql");
    await waitForApp(page);
    await page.setViewportSize({ width: 740, height: 360 });

    await expect(page.locator(".next-topbar")).toBeHidden();
    await expect(page.locator('[data-layout-action="practice-leave"]')).toBeVisible();
    await expect(page.locator('[data-layout-action="practice-files"]')).toBeVisible();
    await expect(page.locator('[data-layout-action="toc"]')).toBeHidden();
    await expect(page.locator('[data-layout-action="settings"]')).toBeHidden();
    await expectNoDocumentOverflow(page);
  });
});

test("free practice survives a resize and a late font load without throwing", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/play/?practice=deploy-yaml");
  await waitForApp(page);
  // The console probe is reached from the resize and font listeners without
  // going through renderCommand, so a rotation is its own regression path.
  await page.setViewportSize({ width: 412, height: 915 });
  await page.setViewportSize({ width: 740, height: 360 });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.evaluate(() => document.fonts.ready);

  expect(errors).toEqual([]);
  expect((await practiceState(page)).active).toBe(true);
});

test("solveCurrent is a safe no-op where there is no canonical solution", async ({ page }) => {
  await page.goto("/play/?practice=parser-rust");
  await waitForApp(page);
  const before = (await appState(page)).code;

  await page.evaluate(() => window.VimWilds.solveCurrent());

  expect((await appState(page)).code).toEqual(before);
  expect(await appState(page)).toMatchObject({ complete: false, surface: "free-practice" });
});

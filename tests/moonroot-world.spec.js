import { expect, test } from "@playwright/test";

const moonrootScenes = {
  "modal-model": "mode-lantern-grounds",
  "cursor-movement": "wayfinder-crossroads",
  "entering-changing-text": "scribes-spring",
  "operator-grammar": "grammar-gate-court",
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.story.v1", JSON.stringify({
      introSeen: true,
      completedUnitStoryIds: [],
    }));
  });
});

test("renders every unit with its registered scene", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.waitForFunction(() => window.VimWilds?.getState && document.querySelector("#world")?.dataset.renderer === "registered-scenes");

  const moonroot = page.locator("#world");
  await expect(moonroot).toHaveAttribute("data-world-id", "moonroot-ruins");
  await expect(moonroot).toHaveAttribute("data-scene-id", "mode-lantern-grounds");
  await expect(page.locator(".world-scene-patch")).toHaveCount(0);
  expect(await page.locator(".world-backdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
    .toContain("scenes/mode-lantern-grounds/");
  await expect(moonroot).not.toHaveClass(/scene-reveal-active/, { timeout: 1_500 });
  await expect(page.locator("#characterLayer")).toHaveCSS("opacity", "1");
  await expect(page.locator("#characterLayer > .nix")).toBeVisible();
  await page.screenshot({ path: "test-results/moonroot-unit-1-phone.png", fullPage: true });

  for (const viewport of [
    { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 412, height: 915 },
    { width: 430, height: 932 }, { width: 432, height: 960 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(moonroot).toHaveAttribute("data-board-profile", /^(tall|compact|wide|shallow)$/);
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= window.innerWidth
      && document.documentElement.scrollHeight <= window.innerHeight
    ))).toBe(true);
  }

  for (const [unitId, sceneId] of Object.entries(moonrootScenes)) {
    await page.goto(`/play/?unit=${unitId}`);
    await page.waitForFunction(() => document.querySelector("#world")?.dataset.renderer === "registered-scenes");
    await expect(page.locator("#world")).toHaveAttribute("data-scene-id", sceneId);
    await expect(page.locator("#world")).not.toHaveClass(/scene-reveal-active/, { timeout: 1_500 });
    await expect(page.locator("#worldGrid")).toHaveCSS("opacity", "1");
    expect(await page.locator(".world-backdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
      .toContain(`scenes/${sceneId}/`);
    await page.screenshot({ path: `test-results/moonroot-${unitId}-phone.png`, fullPage: true });
  }

  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.renderer === "registered-scenes");
  await page.locator("#world").evaluate(node => {
    Object.assign(node.style, { position: "fixed", inset: "0 auto auto 0", width: "1024px", height: "400px" });
    window.dispatchEvent(new Event("orientationchange"));
  });
  await expect(moonroot).toHaveAttribute("data-board-profile", "shallow");
  await expect(page.locator("#worldBackdrop")).toHaveAttribute("data-scene-profile", "wide");
  expect(await page.locator(".world-backdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
    .toContain("/wide/base.webp");
  await page.screenshot({ path: "test-results/moonroot-unit-1-wide.png", fullPage: true });

  await page.goto("/play/?unit=precision-motions-search&activity=find-family-demo");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.renderer === "registered-scenes");
  await expect(page.locator("#world")).toHaveAttribute("data-world-id", "starwater-sanctuary");
  await expect(page.locator("#world")).toHaveAttribute("data-scene-id", "starneedle-observatory");
  expect(await page.locator(".world-backdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
    .toContain("scenes/starneedle-observatory/");
  await expect(page.locator(".world-scene-patch")).toHaveCount(0);
});

test("keeps retired proof overlays absent across learning phases", async ({ page }) => {
  const cases = [
    ["welcome-to-modal-vim", "explain"],
    ["insert-return-demo", "demonstrate"],
    ["escape-seeded-insert", "isolate"],
    ["ctrl-bracket-seeded-replace", "mix"],
    ["identify-insert-mode", "challenge"],
    ["modal-model-core-summary", "summary"],
  ];
  await page.goto("/play/?unit=modal-model");
  await page.waitForFunction(() => window.VimWilds?.activities);
  for (const [activityId, phase] of cases) {
    await page.evaluate(id => {
      const index = window.VimWilds.activities.findIndex(activity => activity.id === id);
      window.VimWilds.goToActivity(index);
    }, activityId);
    await expect(page.locator("#world")).toHaveAttribute("data-learning-phase", phase);
    await expect(page.locator(".world-scene-patch")).toHaveCount(0);
  }
});

test("cancels the unit-entry reveal on input", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  const world = page.locator("#world");
  await expect(world).toHaveClass(/scene-reveal-active/, { timeout: 1_000 });
  await page.keyboard.press("Escape");
  await expect(world).not.toHaveClass(/scene-reveal-active/);
});

test("keeps the guide at the bottom left without covering the editor", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "hidden" }));
  });
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 432, height: 960 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1600, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
    await page.waitForFunction(() => document.querySelector("#characterLayer > .nix"));
    await expect(page.locator("#characterLayer")).toHaveAttribute("data-side", "left");
    await expect(page.locator(".nix")).toHaveClass(/left/);
    await page.locator(".nix").evaluate(image => image.decode());

    const bounds = await page.evaluate(() => {
      const world = document.querySelector("#world").getBoundingClientRect();
      const characterElement = document.querySelector("#characterLayer > .nix");
      characterElement.style.animation = "none";
      const character = characterElement.getBoundingClientRect();
      const editor = document.querySelector(".next-code-slab").getBoundingClientRect();
      return {
        world: { left: world.left, right: world.right, bottom: world.bottom, width: world.width },
        character: {
          left: character.left,
          right: character.right,
          top: character.top,
          bottom: character.bottom,
          cssWidth: Number.parseFloat(getComputedStyle(characterElement).width),
          cssMarginBottom: Number.parseFloat(getComputedStyle(characterElement).marginBottom),
        },
        editor: {
          left: editor.left,
          right: editor.right,
          top: editor.top,
          bottom: editor.bottom,
        },
      };
    });
    const overlapsEditor = (
      bounds.character.left < bounds.editor.right
      && bounds.character.right > bounds.editor.left
      && bounds.character.top < bounds.editor.bottom
      && bounds.character.bottom > bounds.editor.top
    );
    const expectedWidth = viewport.width < 600
      ? Math.min(94, Math.max(70, viewport.width * .23))
      : Math.min(234, Math.max(153, viewport.width * .195));
    const bottomInset = bounds.world.bottom - bounds.character.bottom;
    const leftInset = bounds.character.left - bounds.world.left;
    expect(overlapsEditor).toBe(false);
    expect(Math.abs(bounds.character.cssWidth - expectedWidth)).toBeLessThan(.5);
    expect(bounds.character.cssMarginBottom).toBe(viewport.width < 600 ? 6 : 12);
    expect(leftInset).toBeGreaterThanOrEqual(-1);
    expect(leftInset).toBeLessThan(30);
    expect(bottomInset).toBeGreaterThanOrEqual(bounds.character.cssMarginBottom - 1);
    expect(bottomInset).toBeLessThanOrEqual(bounds.character.cssMarginBottom + 4);
    await page.screenshot({
      path: `test-results/guide-bottom-left-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
  }
});

test("centers every scene content surface on iPad layouts", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "hidden" }));
  });
  const activities = [
    { id: "quick-exit-insert", selector: ".editor-stack" },
    { id: "mode-compass", selector: ".field-note-wrap" },
    { id: "identify-insert-mode", selector: ".inspection-layout" },
  ];

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    for (const activity of activities) {
      await page.goto(`/play/?unit=modal-model&activity=${activity.id}`);
      await page.waitForFunction(() => window.VimWilds?.getState);
      const centers = await page.locator(activity.selector).evaluate(element => {
        const world = document.querySelector("#world").getBoundingClientRect();
        const surface = element.getBoundingClientRect();
        return {
          world: world.left + world.width / 2,
          surface: surface.left + surface.width / 2,
        };
      });
      expect(Math.abs(centers.surface - centers.world), `${activity.id} at ${viewport.width}x${viewport.height}`)
        .toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `test-results/ipad-centered-${activity.id}-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });
    }
  }
});

test("uses supportive character reactions only after repeated mistakes", async ({ page }) => {
  let releasePuzzledMedia;
  const puzzledMediaHeld = new Promise(resolve => { releasePuzzledMedia = resolve; });
  await page.route("**/assets/characters/*/animations/puzzled-variant-*.webp", async route => {
    await puzzledMediaHeld;
    await route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.waitForFunction(() => window.VimWilds?.getState && document.querySelector("#characterLayer > .nix"));

  const pressKey = key => page.locator(`.key[data-key="${key}"]`).evaluate(element => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
  await pressKey("q");
  expect(await page.evaluate(() => window.VimWilds.getState().characterReaction)).toBe("idle");
  await pressKey("q");
  await expect.poll(() => page.evaluate(() => window.VimWilds.getState().characterReaction)).toBe("puzzled");
  const waitingVisual = await page.locator("#characterLayer > .nix").evaluate(image => ({
    source: image.getAttribute("src"),
    scale: image.style.getPropertyValue("--character-media-scale"),
    reaction: image.dataset.reaction,
  }));
  expect(waitingVisual.source).toMatch(/\/idle\.png$/);
  expect(waitingVisual.scale).toBe("");
  expect(waitingVisual.reaction).toBe("idle");
  await page.evaluate(() => {
    window.__reactionFrames = [];
    window.__sampleReactionFrames = true;
    const sample = () => {
      const images = [...document.querySelectorAll("#characterLayer .nix")];
      window.__reactionFrames.push(images.map(image => {
        const mask = image.closest(".reaction-dissolve-mask");
        return {
          opacity: Number.parseFloat(getComputedStyle(image).opacity),
          transform: getComputedStyle(image).transform,
          clipPath: mask ? getComputedStyle(mask).clipPath : "none",
          source: image.getAttribute("src"),
          settling: image.classList.contains("reaction-settling"),
          neutralReady: image.classList.contains("reaction-neutral-ready"),
          incoming: mask?.classList.contains("reaction-dissolve-incoming-mask") || false,
          outgoing: mask?.classList.contains("reaction-dissolve-outgoing-mask") || false,
          running: mask?.classList.contains("reaction-dissolve-running-in")
            || mask?.classList.contains("reaction-dissolve-running-out")
            || false,
        };
      }));
      if (window.__sampleReactionFrames) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  releasePuzzledMedia();
  await expect(page.locator("#characterLayer > .reaction-settling")).toHaveCount(1);
  await expect(page.locator("#characterLayer > .reaction-dissolve-running-in")).toHaveCount(1);
  await expect(page.locator("#characterLayer > .reaction-dissolve-running-out")).toHaveCount(1);
  await page.evaluate(() => new Promise(resolve => {
    let remaining = 8;
    const advance = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(advance);
    };
    requestAnimationFrame(advance);
  }));
  await page.screenshot({ path: "test-results/reaction-complementary-dissolve-390x844.png", fullPage: true });
  await expect(page.locator("#characterLayer > .nix")).toHaveCount(1);
  await expect(page.locator("#characterLayer > .nix")).toHaveAttribute("data-reaction-media-active", "true");
  await page.evaluate(() => { window.__sampleReactionFrames = false; });
  const transitionEvidence = await page.evaluate(() => {
    const frames = window.__reactionFrames;
    const neutral = frames.flat().find(frame => frame.neutralReady);
    const matrix = neutral ? new DOMMatrixReadOnly(neutral.transform) : null;
    const dissolveFrames = frames.filter(frame => frame.some(item => item.running));
    return {
      neverEmpty: frames.every(frame => frame.length >= 1),
      alwaysFullyOpaque: frames.flat().every(frame => frame.opacity >= .999),
      sawSettlingIdle: frames.flat().some(frame => frame.settling && /\/idle\.png$/.test(frame.source)),
      sawReaction: frames.flat().some(frame => /\/puzzled-variant-\d+\.webp$/.test(frame.source)),
      complementaryPairs: dissolveFrames.length > 0 && dissolveFrames.every(frame => (
        frame.length === 2
        && frame.filter(item => item.incoming).length === 1
        && frame.filter(item => item.outgoing).length === 1
        && frame.every(item => item.clipPath !== "none")
      )),
      neutral: matrix && {
        translateX: matrix.e,
        translateY: matrix.f,
        skewX: matrix.b,
        skewY: matrix.c,
      },
    };
  });
  expect(transitionEvidence.neverEmpty).toBe(true);
  expect(transitionEvidence.alwaysFullyOpaque).toBe(true);
  expect(transitionEvidence.sawSettlingIdle).toBe(true);
  expect(transitionEvidence.sawReaction).toBe(true);
  expect(transitionEvidence.complementaryPairs).toBe(true);
  expect(transitionEvidence.neutral).not.toBeNull();
  expect(Math.abs(transitionEvidence.neutral.translateX)).toBeLessThan(.1);
  expect(Math.abs(transitionEvidence.neutral.translateY)).toBeLessThan(.1);
  expect(Math.abs(transitionEvidence.neutral.skewX)).toBeLessThan(.1);
  expect(Math.abs(transitionEvidence.neutral.skewY)).toBeLessThan(.1);
  await page.screenshot({ path: "test-results/reaction-dissolve-complete-390x844.png", fullPage: true });
  const reactionScale = await page.locator("#characterLayer > .nix").evaluate(image => {
    const variant = Number(image.dataset.reactionVariant) - 1;
    return {
      applied: Number(image.style.getPropertyValue("--character-media-scale")),
      authored: Number(image.__characterAsset.reactions.puzzled[variant].css_scale || 1),
    };
  });
  expect(reactionScale.applied).toBe(reactionScale.authored);
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 430, height: 932 },
    { width: 432, height: 960 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const world = document.querySelector("#world").getBoundingClientRect();
      const character = document.querySelector("#characterLayer > .nix").getBoundingClientRect();
      return {
        characterCount: document.querySelectorAll("#characterLayer > .nix").length,
        fullyOpaque: Number.parseFloat(getComputedStyle(document.querySelector("#characterLayer > .nix")).opacity) >= .999,
        reactionActive: document.querySelector("#characterLayer > .nix").dataset.reactionMediaActive === "true",
        withinWorld: character.left >= world.left - 1
          && character.right <= world.right + 1
          && character.top >= world.top - 1
          && character.bottom <= world.bottom + 1,
        documentOverflow: document.documentElement.scrollWidth > innerWidth
          || document.documentElement.scrollHeight > innerHeight,
      };
    });
    expect(layout, `${viewport.width}x${viewport.height}`).toEqual({
      characterCount: 1,
      fullyOpaque: true,
      reactionActive: true,
      withinWorld: true,
      documentOverflow: false,
    });
  }
  await pressKey("q");
  await expect.poll(() => page.evaluate(() => window.VimWilds.getState().characterReaction)).toBe("encouraging");

  await pressKey("Escape");
  await expect.poll(() => page.evaluate(() => window.VimWilds.getState().characterReaction)).toBe("celebrating");
});

test("streams complete-board Wayfinder variants after the delay and silently falls back offline", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
  });
  const requests = [];
  await page.route("**/assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/*.webp", route => {
    requests.push(route.request().url());
    return route.fulfill({
      path: "assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/northwest-hanging-lantern-c01.webp",
      contentType: "image/webp",
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.boardProfile === "compact");

  const variant = page.locator(".world-remote-variant");
  await expect(variant).toHaveCount(0);
  await expect(variant).toHaveCount(1, { timeout: 5_000 });
  await expect(variant).toHaveClass(/is-visible/);
  expect(new URL(requests[0]).origin).toBe(new URL(page.url()).origin);
  expect(await variant.evaluate(element => getComputedStyle(element, "::before").filter)).toContain("brightness(0.82)");
  expect(await variant.evaluate(element => element.style.getPropertyValue("--remote-variant-fade"))).toBe("1200ms");
  expect(await variant.evaluate(element => getComputedStyle(element, "::after").content)).not.toBe("none");
  expect(await page.locator("#worldGrid").evaluate(element => Number(getComputedStyle(element).zIndex))).toBeGreaterThan(
    await variant.evaluate(element => Number(getComputedStyle(element.parentElement).zIndex)),
  );
  await page.waitForTimeout(1_300);
  await page.screenshot({ path: "test-results/complete-board-visible.png", fullPage: true });

  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(variant).toHaveCount(0);

  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(variant).toHaveCount(1, { timeout: 3_000 });
});

test("falls back to GitHub Pages when a local development variant is missing", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "visible" }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/?unit=cursor-movement&activity=home-row-identifier");
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.boardProfile === "compact");

  const localOrigin = new URL(page.url()).origin;
  const requests = [];
  await page.route("**/assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/*.webp", route => {
    const source = route.request().url();
    requests.push(source);
    if (new URL(source).origin === localOrigin) return route.fulfill({ status: 404 });
    return route.fulfill({
      path: "assets/worlds/moonroot-ruins/scenes/wayfinder-crossroads/variants/northwest-hanging-lantern-c01.webp",
      contentType: "image/webp",
      headers: { "access-control-allow-origin": "*" },
    });
  });

  await expect(page.locator(".world-remote-variant")).toHaveCount(1, { timeout: 5_000 });
  expect(new URL(requests[0]).origin).toBe(localOrigin);
  expect(new URL(requests[1]).origin).toBe("https://anton-dergunov.github.io");
});

test("uses the registered compact source and variants on every wide board", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("vim-wilds.session.v1", JSON.stringify({ keyboardVisibility: "hidden" }));
  });
  await page.route("**/assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/variants/*.webp", route => route.fulfill({
    path: "assets/worlds/moonroot-ruins/scenes/mode-lantern-grounds/variants/upper-left-ruin-window-c01.webp",
    contentType: "image/webp",
    headers: { "access-control-allow-origin": "*" },
  }));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/play/?unit=modal-model&activity=quick-exit-insert");
  await page.locator("#world").evaluate(node => {
    Object.assign(node.style, { position: "fixed", inset: "0 auto auto 0", width: "1024px", height: "600px" });
    window.dispatchEvent(new Event("orientationchange"));
  });
  await page.waitForFunction(() => document.querySelector("#world")?.dataset.boardProfile === "wide");

  expect(await page.locator("#worldBackdrop").evaluate(element => getComputedStyle(element, "::before").backgroundImage))
    .toContain("mode-lantern-grounds/compact/base.webp");
  await expect(page.locator("#worldBackdrop")).toHaveAttribute("data-scene-profile", "compact");
  await expect(page.locator(".world-remote-variant")).toHaveCount(1, { timeout: 5_000 });
});

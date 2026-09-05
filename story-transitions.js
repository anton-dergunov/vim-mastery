import { boardProfileForBounds, sceneProfileForBoard } from "./world-presentation.js";

export const STORY_STORAGE_KEY = "vim-wilds.story.v1";
export const STORY_TRANSITION_KEY = "vim-wilds.story-transition.v1";

const INTRO_PANORAMA_DURATION_MS = 60_000;
const FINALE_PANORAMA_DURATION_MS = 24_000;

function readJson(storage, key, fallback) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function storyState(storage) {
  const candidate = readJson(storage, STORY_STORAGE_KEY, {});
  return {
    introSeen: candidate.introSeen === true,
    endingSeen: candidate.endingSeen === true,
    completedUnitStoryIds: [...new Set(
      Array.isArray(candidate.completedUnitStoryIds)
        ? candidate.completedUnitStoryIds.filter(value => typeof value === "string")
        : [],
    )],
  };
}

export class StoryTransitions {
  constructor({
    root,
    presentation,
    units,
    currentUnitId,
    shouldShowIntro,
    onNavigate,
    onOpenContents,
    onIntroFinished = () => {},
    onStateChange = () => {},
    assetUrl = value => value,
    durableStorage = window.localStorage,
    transitionStorage = window.sessionStorage,
  }) {
    this.root = root;
    this.presentation = presentation;
    this.units = new Map(units.map(unit => [unit.id, unit]));
    this.currentUnitId = currentUnitId;
    this.shouldShowIntro = shouldShowIntro;
    this.onNavigate = onNavigate;
    this.onOpenContents = onOpenContents;
    this.onIntroFinished = onIntroFinished;
    this.onStateChange = onStateChange;
    this.assetUrl = assetUrl;
    this.durableStorage = durableStorage;
    this.transitionStorage = transitionStorage;
    this.state = storyState(durableStorage);
    this.active = null;
    this.elements = {
      surface: root.querySelector(".story-surface"),
      visual: root.querySelector(".story-visual"),
      progress: root.querySelector(".story-progress"),
      kicker: root.querySelector(".story-kicker"),
      title: root.querySelector(".story-title"),
      speaker: root.querySelector(".story-speaker"),
      copy: root.querySelector(".story-copy"),
      action: root.querySelector(".story-action-copy"),
      hook: root.querySelector(".story-next-hook"),
      boardBase: root.querySelector(".story-board-base"),
      dormantLandmark: root.querySelector(".story-landmark-dormant"),
      restoredLandmark: root.querySelector(".story-landmark-restored"),
      lightPath: root.querySelector(".story-light-path"),
      skip: root.querySelector('[data-story-action="skip"]'),
      continue: root.querySelector('[data-story-action="continue"]'),
    };
    this.handleClick = event => {
      const action = event.target.closest("[data-story-action]")?.dataset.storyAction;
      if (action === "continue") this.continue();
      if (action === "skip") this.finish();
    };
    this.handleCancel = event => {
      event.preventDefault();
      this.finish();
    };
    this.choreographyTimer = null;
    this.typingTimer = null;
    this.writingFinishTimer = null;
    this.panoramaCrossfadeTimer = null;
    this.layoutFrame = null;
    const writingPenAsset = this.presentation?.story?.writingPenAsset;
    if (writingPenAsset) {
      this.root.style.setProperty(
        "--story-pen-asset",
        `url("${this.assetUrl(writingPenAsset)}")`,
      );
    }
    this.handleResize = () => {
      if (this.active?.kind !== "unit") return;
      const completion = this.presentation?.units?.[this.active.unitId]?.completion;
      if (this.active.reviewAsset || completion?.storyImage) return;
      cancelAnimationFrame(this.layoutFrame);
      this.layoutFrame = requestAnimationFrame(() => {
        this.layoutFrame = null;
        this.renderUnitArt();
      });
    };
  }

  start() {
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("cancel", this.handleCancel);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("orientationchange", this.handleResize);
    const transition = readJson(this.transitionStorage, STORY_TRANSITION_KEY, null);
    if (this.restore(transition)) return;
    if (!this.state.introSeen && this.shouldShowIntro) this.showIntro();
  }

  stop() {
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("cancel", this.handleCancel);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleResize);
    cancelAnimationFrame(this.layoutFrame);
    this.clearChoreography();
  }

  restore(transition) {
    if (transition?.kind === "intro" && this.shouldShowIntro) {
      this.showIntro({
        panelIndex: transition.panelIndex,
        panoramaStartedAt: transition.panoramaStartedAt,
        restoring: true,
      });
      return true;
    }
    if (
      transition?.kind === "unit"
      && transition.unitId === this.currentUnitId
      && this.presentation?.units?.[transition.unitId]
    ) {
      this.showUnit(transition.unitId, {
        targetUnitId: transition.targetUnitId || null,
        replay: transition.replay === true,
        reviewAsset: transition.reviewAsset || null,
        restoring: true,
      });
      return true;
    }
    if (transition?.kind === "ending" && this.presentation?.story?.ending?.asset) {
      this.showEnding({
        replay: transition.replay === true,
        panoramaStartedAt: transition.panoramaStartedAt,
        restoring: true,
      });
      return true;
    }
    if (transition) {
      try {
        this.transitionStorage.removeItem(STORY_TRANSITION_KEY);
      } catch {}
    }
    return false;
  }

  persistState() {
    try {
      this.durableStorage.setItem(STORY_STORAGE_KEY, JSON.stringify({
        introSeen: this.state.introSeen,
        endingSeen: this.state.endingSeen,
        completedUnitStoryIds: this.state.completedUnitStoryIds,
      }));
    } catch {}
    this.onStateChange(this.getState());
  }

  persistTransition() {
    try {
      if (this.active) this.transitionStorage.setItem(STORY_TRANSITION_KEY, JSON.stringify(this.active));
      else this.transitionStorage.removeItem(STORY_TRANSITION_KEY);
    } catch {}
  }

  getState() {
    return {
      introSeen: this.state.introSeen,
      endingSeen: this.state.endingSeen,
      completedUnitStoryIds: [...this.state.completedUnitStoryIds],
      active: this.active ? { ...this.active } : null,
    };
  }

  hasCompletedUnitStory(unitId) {
    return this.state.completedUnitStoryIds.includes(unitId);
  }

  showIntro({
    panelIndex = 0,
    replay = false,
    restoring = false,
    reviewAsset = null,
    panoramaStartedAt = null,
  } = {}) {
    const panels = this.presentation?.story?.intro;
    if (!Array.isArray(panels) || panels.length !== 3) return false;
    const safeIndex = Number.isInteger(panelIndex) ? Math.max(0, Math.min(panels.length - 1, panelIndex)) : 0;
    const sharedStart = safeIndex < 2
      ? panoramaStartedAt || (
        this.active?.kind === "intro" && this.active.panelIndex < 2
          ? this.active.panoramaStartedAt
          : null
      ) || Date.now()
      : panoramaStartedAt || Date.now();
    this.active = {
      kind: "intro",
      panelIndex: safeIndex,
      replay,
      reviewAsset,
      panoramaStartedAt: sharedStart,
    };
    if (!restoring) this.persistTransition();
    this.render();
    this.open();
    return true;
  }

  showUnit(unitId, {
    targetUnitId = null,
    replay = false,
    reviewAsset = null,
    restoring = false,
  } = {}) {
    if (!this.presentation?.units?.[unitId]) return false;
    this.active = { kind: "unit", unitId, targetUnitId, replay, reviewAsset };
    if (!restoring) this.persistTransition();
    this.render();
    this.open();
    return true;
  }

  showUnitAtBoundary(unitId, targetUnitId) {
    if (this.hasCompletedUnitStory(unitId)) {
      if (!targetUnitId && !this.state.endingSeen) return this.showEnding();
      return false;
    }
    return this.showUnit(unitId, { targetUnitId });
  }

  showEnding({ replay = false, restoring = false, panoramaStartedAt = null } = {}) {
    if (!this.presentation?.story?.ending?.asset) return false;
    this.active = { kind: "ending", replay, panoramaStartedAt: panoramaStartedAt || Date.now() };
    if (!restoring) this.persistTransition();
    this.render();
    this.open();
    return true;
  }

  open() {
    if (!this.root.open) this.root.showModal();
    this.elements.continue.focus();
  }

  continue() {
    if (this.active?.kind === "intro") {
      const panels = this.presentation.story.intro;
      if (this.active.panelIndex < panels.length - 1) {
        this.active.panelIndex += 1;
        if (this.active.panelIndex === 2) this.active.panoramaStartedAt = Date.now();
        this.persistTransition();
        this.render();
        return;
      }
    }
    this.finish();
  }

  finish() {
    const completed = this.active;
    if (!completed) return;
    if (completed.kind === "intro") {
      this.state.introSeen = true;
      this.persistState();
    } else if (completed.kind === "unit" && !completed.replay && !this.hasCompletedUnitStory(completed.unitId)) {
      this.state.completedUnitStoryIds.push(completed.unitId);
      this.persistState();
    } else if (completed.kind === "ending" && !completed.replay) {
      this.state.endingSeen = true;
      this.persistState();
    }

    if (
      completed.kind === "unit"
      && !completed.replay
      && !completed.targetUnitId
      && this.presentation?.story?.ending?.asset
    ) {
      this.active = { kind: "ending", replay: false, panoramaStartedAt: Date.now() };
      this.persistTransition();
      this.render();
      this.elements.continue.focus();
      return;
    }
    this.active = null;
    this.persistTransition();
    if (this.root.open) this.root.close();

    if (completed.kind === "intro") {
      // Fires whether the learner read all three panels or skipped from the
      // first, so anything that follows the opening runs exactly once either way.
      this.onIntroFinished({ replay: completed.replay === true });
      return;
    }
    if (completed.kind === "ending") {
      if (!completed.replay) this.onOpenContents();
      return;
    }
    if (completed.kind !== "unit" || completed.replay) return;
    if (completed.targetUnitId) this.onNavigate(completed.targetUnitId);
    else this.onOpenContents();
  }

  render() {
    if (this.active?.kind === "intro") this.renderIntro();
    if (this.active?.kind === "unit") this.renderUnit();
    if (this.active?.kind === "ending") this.renderEnding();
  }

  resetSurfaceData() {
    this.clearChoreography();
    for (const key of [
      "kind",
      "panelId",
      "unitId",
      "worldId",
      "sceneId",
      "landmarkId",
      "guideId",
      "actionId",
      "storyAsset",
      "reviewStoryAsset",
      "storyProfile",
      "registeredScene",
    ]) {
      delete this.elements.surface.dataset[key];
      delete this.elements.visual.dataset[key];
    }
    this.elements.speaker.hidden = true;
    this.elements.action.hidden = true;
    this.elements.hook.hidden = true;
    this.elements.visual.classList.remove(
      "has-story-art",
      "story-panorama",
      "story-panorama-reverse",
      "story-unit-ending",
    );
    this.elements.visual.style.removeProperty("--story-asset");
    this.elements.visual.style.removeProperty("--story-panorama-delay");
    this.elements.visual.style.removeProperty("--story-panorama-duration");
    this.elements.surface.dataset.restoration = "idle";
    this.elements.lightPath?.classList.remove("has-light-path");
    for (const element of [
      this.elements.boardBase,
      this.elements.dormantLandmark,
      this.elements.restoredLandmark,
      this.elements.lightPath,
    ]) {
      element?.style.removeProperty("--story-layer-asset");
      element?.removeAttribute("data-asset");
    }
    this.elements.visual.querySelectorAll(".story-panorama-crossfade").forEach(element => element.remove());
  }

  clearChoreography() {
    if (this.choreographyTimer) window.clearTimeout(this.choreographyTimer);
    if (this.typingTimer) window.clearTimeout(this.typingTimer);
    if (this.writingFinishTimer) window.clearTimeout(this.writingFinishTimer);
    if (this.panoramaCrossfadeTimer) window.clearTimeout(this.panoramaCrossfadeTimer);
    this.choreographyTimer = null;
    this.typingTimer = null;
    this.writingFinishTimer = null;
    this.panoramaCrossfadeTimer = null;
    this.elements.copy.classList.remove("is-typing", "is-writing-finished");
    this.elements.copy.querySelector(".story-pen-anchor")?.remove();
  }

  setStoryCopy(copy, { type = false } = {}) {
    const text = String(copy || "");
    this.elements.copy.setAttribute("aria-label", text);
    this.elements.copy.classList.remove("is-typing", "is-writing-finished");
    if (!type || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.elements.copy.textContent = text;
      return;
    }
    this.elements.copy.textContent = "";
    const textNode = document.createTextNode("");
    const penAnchor = document.createElement("span");
    penAnchor.className = "story-pen-anchor is-writing";
    penAnchor.setAttribute("aria-hidden", "true");
    this.elements.copy.append(textNode, penAnchor);
    this.elements.copy.classList.add("is-typing");
    let index = 0;
    const typeNext = () => {
      index = Math.min(text.length, index + 1);
      textNode.data = text.slice(0, index);
      if (index >= text.length) {
        this.elements.copy.classList.remove("is-typing");
        penAnchor.classList.remove("is-writing");
        penAnchor.classList.add("is-writing-finished");
        this.typingTimer = null;
        this.writingFinishTimer = window.setTimeout(() => {
          penAnchor.remove();
          this.writingFinishTimer = null;
        }, 900);
        return;
      }
      const character = text[index - 1];
      const delay = /[.!?]/.test(character)
        ? 360
        : /[,;:—]/.test(character)
          ? 180
          : /\s/.test(character) ? 34 : 62;
      this.typingTimer = window.setTimeout(typeNext, delay);
    };
    typeNext();
  }

  setLayerAsset(element, asset) {
    if (!element) return;
    if (!asset) {
      element.style.removeProperty("--story-layer-asset");
      element.removeAttribute("data-asset");
      return;
    }
    element.dataset.asset = asset;
    element.style.setProperty("--story-layer-asset", `url("${this.assetUrl(asset)}")`);
  }

  renderUnitArt() {
    if (this.active?.kind !== "unit") return;
    const unitPresentation = this.presentation.units[this.active.unitId];
    const scene = unitPresentation?.scenes?.[unitPresentation.sceneId];
    const boardProfile = boardProfileForBounds(this.elements.visual.getBoundingClientRect());
    const profile = sceneProfileForBoard(boardProfile);
    const profileData = scene?.profiles?.[profile];
    const patches = profileData?.patches || {};
    const dormant = scene?.landmarkPatches?.dormant ? patches[scene.landmarkPatches.dormant] : null;
    const restored = scene?.landmarkPatches?.restored ? patches[scene.landmarkPatches.restored] : null;

    this.elements.surface.dataset.storyProfile = profile;
    this.elements.visual.dataset.storyProfile = profile;
    this.elements.surface.dataset.registeredScene = String(Boolean(profileData?.base));
    this.setLayerAsset(this.elements.boardBase, profileData?.base || unitPresentation?.completion?.storyBackdrop || null);
    this.setLayerAsset(this.elements.dormantLandmark, dormant);
    this.setLayerAsset(this.elements.restoredLandmark, restored);
    this.elements.lightPath?.classList.toggle("has-light-path", Boolean(restored));
    this.elements.surface.dataset.restoration = "dormant";
    this.clearChoreography();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.choreographyTimer = window.setTimeout(() => {
        if (this.active?.kind === "unit") this.elements.surface.dataset.restoration = "restored";
      }, 420);
    } else {
      this.elements.surface.dataset.restoration = "restored";
    }
  }

  renderIntro() {
    const panels = this.presentation.story.intro;
    const panel = panels[this.active.panelIndex];
    const previousPanelId = this.elements.surface.dataset.panelId;
    const previousAsset = this.elements.visual.dataset.storyAsset;
    const crossfadeFromConnected = previousPanelId === "connected-wilds"
      && panel.id === "interrupted-command"
      && previousAsset;
    this.resetSurfaceData();
    const last = this.active.panelIndex === panels.length - 1;
    this.elements.surface.dataset.kind = "intro";
    this.elements.surface.dataset.panelId = panel.id;
    this.elements.visual.dataset.panelId = panel.id;
    const isPanorama = ["connected-wilds", "interrupted-command", "nix-at-the-threshold"].includes(panel.id);
    const asset = panel.id === "connected-wilds" && this.active.reviewAsset
      ? this.active.reviewAsset
      : panel.asset;
    if (asset) {
      this.elements.visual.dataset.storyAsset = asset;
      this.elements.visual.style.setProperty("--story-asset", `url("${this.assetUrl(asset)}")`);
      this.elements.visual.classList.add("has-story-art");
    }
    this.elements.visual.classList.toggle("story-panorama", Boolean(asset && isPanorama));
    if (asset && isPanorama) this.setPanoramaTiming();
    if (crossfadeFromConnected) {
      this.addPanoramaCrossfade(previousAsset);
    }
    if (isPanorama && this.active.reviewAsset) this.elements.visual.dataset.reviewStoryAsset = this.active.reviewAsset;
    this.elements.visual.setAttribute("aria-label", `Story illustration ${this.active.panelIndex + 1} of ${panels.length}`);
    this.elements.progress.textContent = `${this.active.panelIndex + 1} of ${panels.length}`;
    this.elements.kicker.textContent = this.active.replay ? "Replay story" : "The Wilds remember";
    this.elements.title.textContent = panel.speaker || "The Vim Wilds";
    this.elements.speaker.textContent = panel.speaker || "";
    this.setStoryCopy(panel.copy, { type: Boolean(asset) });
    this.elements.skip.textContent = "Skip story";
    this.elements.continue.textContent = last ? "Enter the Wilds" : "Continue";
  }

  renderUnit() {
    this.resetSurfaceData();
    const unitPresentation = this.presentation.units[this.active.unitId];
    const unit = this.units.get(this.active.unitId);
    const world = this.presentation.worlds[unitPresentation.worldId];
    const completion = unitPresentation.completion;
    const storyAsset = this.active.reviewAsset || completion.storyImage || null;
    const title = unit ? `Unit ${unit.unitNumber} · ${unit.title}` : "Unit restored";
    this.elements.surface.dataset.kind = "unit";
    this.elements.surface.dataset.unitId = this.active.unitId;
    this.elements.surface.dataset.worldId = unitPresentation.worldId;
    this.elements.surface.dataset.sceneId = unitPresentation.sceneId || "pending";
    this.elements.surface.dataset.landmarkId = unitPresentation.landmark.id;
    this.elements.surface.dataset.guideId = unitPresentation.guideCharacterId;
    this.elements.surface.dataset.actionId = completion.actionId;
    this.elements.visual.setAttribute("aria-label", completion.action);
    this.elements.progress.textContent = world?.displayName || "The Vim Wilds";
    this.elements.kicker.textContent = this.active.replay ? "Restoration replay" : "Landmark restored";
    this.elements.title.textContent = title;
    if (storyAsset) {
      this.elements.visual.dataset.storyAsset = storyAsset;
      if (this.active.reviewAsset) this.elements.visual.dataset.reviewStoryAsset = storyAsset;
      this.elements.visual.style.setProperty("--story-asset", `url("${this.assetUrl(storyAsset)}")`);
      this.elements.visual.classList.add("has-story-art", "story-unit-ending");
      this.elements.surface.dataset.restoration = "restored";
    } else {
      this.renderUnitArt();
    }
    this.setStoryCopy(completion.copy, { type: Boolean(storyAsset) });
    this.elements.action.textContent = completion.action;
    this.elements.action.hidden = false;
    this.elements.hook.textContent = completion.nextHook.speaker
      ? `${completion.nextHook.speaker}: “${completion.nextHook.copy}”`
      : completion.nextHook.copy;
    this.elements.hook.hidden = false;
    this.elements.skip.textContent = this.active.replay ? "Close replay" : "Skip";
    this.elements.continue.textContent = this.active.replay
      ? "Close"
      : this.active.targetUnitId
        ? "Continue to next unit"
        : this.presentation?.story?.ending?.asset ? "Continue to finale" : "Return to contents";
  }

  renderEnding() {
    this.resetSurfaceData();
    const ending = this.presentation.story.ending;
    this.elements.surface.dataset.kind = "ending";
    this.elements.surface.dataset.panelId = ending.id;
    this.elements.visual.dataset.panelId = ending.id;
    this.elements.visual.dataset.storyAsset = ending.asset;
    this.elements.visual.style.setProperty("--story-asset", `url("${this.assetUrl(ending.asset)}")`);
    this.elements.visual.classList.add("has-story-art", "story-panorama", "story-panorama-reverse");
    this.setPanoramaTiming();
    this.elements.visual.setAttribute("aria-label", ending.ariaLabel);
    this.elements.progress.textContent = ending.progressLabel;
    this.elements.kicker.textContent = this.active.replay ? "Finale replay" : "The Wilds remember";
    this.elements.title.textContent = ending.title;
    this.elements.speaker.textContent = ending.speaker;
    this.elements.speaker.hidden = false;
    this.setStoryCopy(ending.copy, { type: true });
    this.elements.skip.textContent = this.active.replay ? "Close finale" : "Skip finale";
    this.elements.continue.textContent = this.active.replay ? "Close" : "View the restored Wilds";
  }

  setPanoramaTiming() {
    const startedAt = Number(this.active?.panoramaStartedAt) || Date.now();
    const duration = this.active?.kind === "ending"
      ? FINALE_PANORAMA_DURATION_MS
      : INTRO_PANORAMA_DURATION_MS;
    const elapsed = Math.min(duration, Math.max(0, Date.now() - startedAt));
    this.elements.visual.style.setProperty("--story-panorama-delay", `${-elapsed}ms`);
    this.elements.visual.style.setProperty("--story-panorama-duration", `${duration}ms`);
  }

  addPanoramaCrossfade(asset) {
    const layer = document.createElement("div");
    layer.className = "story-panorama-crossfade";
    layer.setAttribute("aria-hidden", "true");
    layer.style.setProperty("--story-crossfade-asset", `url("${this.assetUrl(asset)}")`);
    layer.style.setProperty(
      "--story-panorama-delay",
      this.elements.visual.style.getPropertyValue("--story-panorama-delay"),
    );
    layer.style.setProperty(
      "--story-panorama-duration",
      this.elements.visual.style.getPropertyValue("--story-panorama-duration"),
    );
    this.elements.visual.append(layer);
    requestAnimationFrame(() => layer.classList.add("is-leaving"));
    this.panoramaCrossfadeTimer = window.setTimeout(() => {
      layer.remove();
      this.panoramaCrossfadeTimer = null;
    }, 1500);
  }
}

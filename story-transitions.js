export const STORY_STORAGE_KEY = "vim-wilds.story.v1";
export const STORY_TRANSITION_KEY = "vim-wilds.story-transition.v1";

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
  }

  start() {
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("cancel", this.handleCancel);
    const transition = readJson(this.transitionStorage, STORY_TRANSITION_KEY, null);
    if (this.restore(transition)) return;
    if (!this.state.introSeen && this.shouldShowIntro) this.showIntro();
  }

  stop() {
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("cancel", this.handleCancel);
  }

  restore(transition) {
    if (transition?.kind === "intro" && this.shouldShowIntro) {
      this.showIntro({ panelIndex: transition.panelIndex, restoring: true });
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
      completedUnitStoryIds: [...this.state.completedUnitStoryIds],
      active: this.active ? { ...this.active } : null,
    };
  }

  hasCompletedUnitStory(unitId) {
    return this.state.completedUnitStoryIds.includes(unitId);
  }

  showIntro({ panelIndex = 0, replay = false, restoring = false } = {}) {
    const panels = this.presentation?.story?.intro;
    if (!Array.isArray(panels) || panels.length !== 3) return false;
    const safeIndex = Number.isInteger(panelIndex) ? Math.max(0, Math.min(panels.length - 1, panelIndex)) : 0;
    this.active = { kind: "intro", panelIndex: safeIndex, replay };
    if (!restoring) this.persistTransition();
    this.render();
    this.open();
    return true;
  }

  showUnit(unitId, {
    targetUnitId = null,
    replay = false,
    restoring = false,
  } = {}) {
    if (!this.presentation?.units?.[unitId]) return false;
    this.active = { kind: "unit", unitId, targetUnitId, replay };
    if (!restoring) this.persistTransition();
    this.render();
    this.open();
    return true;
  }

  showUnitAtBoundary(unitId, targetUnitId) {
    if (this.hasCompletedUnitStory(unitId)) return false;
    return this.showUnit(unitId, { targetUnitId });
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
    } else if (!completed.replay && !this.hasCompletedUnitStory(completed.unitId)) {
      this.state.completedUnitStoryIds.push(completed.unitId);
      this.persistState();
    }
    this.active = null;
    this.persistTransition();
    if (this.root.open) this.root.close();

    if (completed.kind !== "unit" || completed.replay) return;
    if (completed.targetUnitId) this.onNavigate(completed.targetUnitId);
    else this.onOpenContents();
  }

  render() {
    if (this.active?.kind === "intro") this.renderIntro();
    if (this.active?.kind === "unit") this.renderUnit();
  }

  resetSurfaceData() {
    for (const key of ["kind", "panelId", "unitId", "worldId", "sceneId", "landmarkId", "guideId", "actionId", "storyAsset"]) {
      delete this.elements.surface.dataset[key];
      delete this.elements.visual.dataset[key];
    }
    this.elements.speaker.hidden = true;
    this.elements.action.hidden = true;
    this.elements.hook.hidden = true;
    this.elements.visual.classList.remove("has-story-art");
    this.elements.visual.style.removeProperty("--story-asset");
  }

  renderIntro() {
    this.resetSurfaceData();
    const panels = this.presentation.story.intro;
    const panel = panels[this.active.panelIndex];
    const last = this.active.panelIndex === panels.length - 1;
    this.elements.surface.dataset.kind = "intro";
    this.elements.surface.dataset.panelId = panel.id;
    this.elements.visual.dataset.panelId = panel.id;
    if (panel.asset) {
      this.elements.visual.dataset.storyAsset = panel.asset;
      this.elements.visual.style.setProperty("--story-asset", `url("${this.assetUrl(panel.asset)}")`);
      this.elements.visual.classList.add("has-story-art");
    }
    this.elements.visual.setAttribute("aria-label", `Story illustration ${this.active.panelIndex + 1} of ${panels.length}`);
    this.elements.progress.textContent = `${this.active.panelIndex + 1} of ${panels.length}`;
    this.elements.kicker.textContent = this.active.replay ? "Replay story" : "The Wilds remember";
    this.elements.title.textContent = panel.speaker || "The Vim Wilds";
    this.elements.speaker.textContent = panel.speaker || "";
    this.elements.copy.textContent = panel.copy;
    this.elements.skip.textContent = "Skip story";
    this.elements.continue.textContent = last ? "Enter the Wilds" : "Continue";
  }

  renderUnit() {
    this.resetSurfaceData();
    const unitPresentation = this.presentation.units[this.active.unitId];
    const unit = this.units.get(this.active.unitId);
    const world = this.presentation.worlds[unitPresentation.worldId];
    const completion = unitPresentation.completion;
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
    this.elements.copy.textContent = completion.copy;
    if (completion.storyBackdrop) {
      this.elements.visual.dataset.storyAsset = completion.storyBackdrop;
      this.elements.visual.style.setProperty("--story-asset", `url("${this.assetUrl(completion.storyBackdrop)}")`);
      this.elements.visual.classList.add("has-story-art");
    }
    this.elements.action.textContent = completion.action;
    this.elements.action.hidden = false;
    this.elements.hook.textContent = completion.nextHook.speaker
      ? `${completion.nextHook.speaker}: “${completion.nextHook.copy}”`
      : completion.nextHook.copy;
    this.elements.hook.hidden = false;
    this.elements.skip.textContent = this.active.replay ? "Close replay" : "Skip";
    this.elements.continue.textContent = this.active.replay
      ? "Close"
      : this.active.targetUnitId ? "Continue to next unit" : "Return to contents";
  }
}

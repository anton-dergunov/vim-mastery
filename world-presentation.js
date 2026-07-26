const BOARD_PROFILES = ["tall", "compact", "wide", "shallow"];
const SCENE_PROFILES = ["tall", "compact", "wide"];

export function boardProfileForBounds({ width = 0, height = 0 } = {}) {
  const ratio = height > 0 ? width / height : 1;
  if (ratio < 0.9) return "tall";
  if (ratio <= 1.58) return "compact";
  if (ratio <= 2.4) return "wide";
  return "shallow";
}

export function sceneProfileForBoard(profile) {
  if (profile === "shallow") return "wide";
  return SCENE_PROFILES.includes(profile) ? profile : "compact";
}

// Temporary aliases keep external experiments readable while the repository
// moves from the old shape vocabulary to registered scene profiles.
export const boardShapeForBounds = boardProfileForBounds;
export const backdropShapeForBoard = sceneProfileForBoard;

function setAsset(element, asset, assetUrl) {
  if (!asset) {
    element.style.removeProperty("--world-asset");
    return;
  }
  element.style.setProperty("--world-asset", `url("${assetUrl(asset)}")`);
}

function activePatchIds(scene, phase, landmarkState) {
  const phaseIds = scene.phasePatches?.[phase] || scene.phasePatches?.explain || [];
  const landmarkId = scene.landmarkPatches?.[landmarkState];
  return landmarkId ? [...phaseIds, landmarkId] : [...phaseIds];
}

export class WorldPresentationRenderer {
  constructor({
    world,
    backdropLayer,
    ambientLayer,
    patchLayer,
    assetUrl = value => value,
    onLegacyResize = () => {},
  }) {
    this.world = world;
    this.backdropLayer = backdropLayer;
    this.ambientLayer = ambientLayer;
    this.patchLayer = patchLayer;
    this.assetUrl = assetUrl;
    this.onLegacyResize = onLegacyResize;
    this.presentation = null;
    this.presentationKey = null;
    this.phase = "explain";
    this.landmarkState = "dormant";
    this.profile = null;
    this.resizeObserver = null;
    this.layoutFrame = null;
    this.reducedMotionQuery = null;
    this.revealKey = null;
    this.revealLoadTimer = null;
    this.revealHoldTimer = null;
    this.revealImage = null;
    this.handleResize = () => {
      if (boardProfileForBounds(this.world.getBoundingClientRect()) !== this.profile) {
        this.cancelReveal();
      }
      this.scheduleLayout();
    };
    this.handleOrientationChange = () => {
      this.cancelReveal();
      this.scheduleLayout();
    };
    this.handleReducedMotion = event => {
      this.world.dataset.reducedMotion = String(event.matches);
      if (event.matches) this.cancelReveal();
    };
    this.handleRevealInput = () => this.cancelReveal();
  }

  setPresentation(presentation, {
    unitId,
    phase = "explain",
    landmarkState = "dormant",
  } = {}) {
    const scene = presentation?.scene;
    const valid = Boolean(presentation?.world && presentation?.unit && scene?.profiles);
    this.presentation = valid ? presentation : null;
    this.phase = phase;
    this.landmarkState = landmarkState;
    this.world.dataset.unitId = unitId || presentation?.unit?.id || "unknown";
    this.world.dataset.renderer = valid ? "registered-scenes" : "legacy";
    this.world.dataset.worldId = valid ? presentation.world.id : "legacy";
    this.world.dataset.sceneId = valid ? scene.id : "none";
    this.world.dataset.landmarkId = valid ? presentation.unit.landmark.id : "none";
    this.world.dataset.learningPhase = phase;

    if (!valid) {
      this.cancelReveal();
      this.presentationKey = null;
      this.world.style.removeProperty("--world-fallback");
      this.backdropLayer.style.removeProperty("--world-asset");
      this.backdropLayer.removeAttribute("data-scene-profile");
      this.ambientLayer.replaceChildren();
      this.patchLayer.replaceChildren();
      this.updateLayout();
      return false;
    }

    this.world.style.setProperty("--world-fallback", presentation.world.fallbackGradient);
    const key = `${presentation.world.id}:${presentation.unit.id}:${scene.id}`;
    if (key !== this.presentationKey) {
      this.cancelReveal();
      this.presentationKey = key;
      this.buildAmbientLayer();
    }
    this.updateLayout(true);
    return true;
  }

  buildAmbientLayer() {
    const effects = this.presentation.world.ambientEffects.map((effect, index) => {
      const element = document.createElement("i");
      element.className = "world-ambient-effect";
      element.dataset.effect = effect;
      element.style.setProperty("--ambient-index", String(index));
      return element;
    });
    this.ambientLayer.replaceChildren(...effects);
  }

  buildPatchLayer(profile) {
    const profileData = this.presentation.scene.profiles[profile];
    const patches = profileData?.patches || {};
    const elements = activePatchIds(this.presentation.scene, this.phase, this.landmarkState)
      .map(patchId => {
        const asset = patches[patchId];
        if (!asset) return null;
        const element = document.createElement("div");
        element.className = "world-scene-patch";
        element.dataset.patchId = patchId;
        setAsset(element, asset, this.assetUrl);
        return element;
      })
      .filter(Boolean);
    this.patchLayer.replaceChildren(...elements);
  }

  updateLayout(force = false) {
    const nextProfile = boardProfileForBounds(this.world.getBoundingClientRect());
    if (!force && nextProfile === this.profile) {
      if (!this.presentation) this.onLegacyResize();
      return;
    }
    this.profile = nextProfile;
    this.world.dataset.boardProfile = nextProfile;
    // Keep the old attribute for one compatibility release; its values now
    // deliberately identify registered profiles, not prop-placement shapes.
    this.world.dataset.boardShape = nextProfile;
    if (!this.presentation) {
      this.onLegacyResize();
      return;
    }

    const sceneProfile = sceneProfileForBoard(nextProfile);
    const profileData = this.presentation.scene.profiles[sceneProfile];
    setAsset(this.backdropLayer, profileData?.base, this.assetUrl);
    this.backdropLayer.dataset.sceneProfile = sceneProfile;
    this.backdropLayer.dataset.backdropShape = sceneProfile;
    const focalPosition = profileData?.focalPosition || "50% 50%";
    this.world.style.setProperty("--scene-focal-position", focalPosition);
    this.buildPatchLayer(sceneProfile);
  }

  considerUnitReveal() {
    if (!this.presentation || this.revealKey === this.presentationKey) return;
    this.revealKey = this.presentationKey;
    if (this.reducedMotionQuery?.matches || this.profile === "shallow") return;
    const profile = sceneProfileForBoard(this.profile);
    const source = this.presentation.scene.profiles[profile]?.base;
    if (!source) return;

    const image = new Image();
    this.revealImage = image;
    let settled = false;
    const stopWaiting = () => {
      if (settled) return;
      settled = true;
      clearTimeout(this.revealLoadTimer);
      this.revealLoadTimer = null;
      this.revealImage = null;
    };
    image.addEventListener("load", () => {
      if (settled) return;
      stopWaiting();
      this.world.classList.add("scene-reveal-active");
      this.revealHoldTimer = window.setTimeout(() => this.cancelReveal(), 520);
    }, { once: true });
    image.addEventListener("error", stopWaiting, { once: true });
    this.revealLoadTimer = window.setTimeout(stopWaiting, 180);
    image.src = this.assetUrl(source);
  }

  cancelReveal() {
    clearTimeout(this.revealLoadTimer);
    clearTimeout(this.revealHoldTimer);
    this.revealLoadTimer = null;
    this.revealHoldTimer = null;
    this.revealImage = null;
    this.world.classList.remove("scene-reveal-active");
  }

  scheduleLayout() {
    cancelAnimationFrame(this.layoutFrame);
    this.layoutFrame = requestAnimationFrame(() => {
      this.layoutFrame = null;
      this.updateLayout();
    });
  }

  start() {
    this.reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.world.dataset.reducedMotion = String(this.reducedMotionQuery.matches);
    if (this.reducedMotionQuery.addEventListener) {
      this.reducedMotionQuery.addEventListener("change", this.handleReducedMotion);
    } else {
      this.reducedMotionQuery.addListener?.(this.handleReducedMotion);
    }
    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.world);
    } else {
      window.addEventListener("resize", this.handleResize);
    }
    window.addEventListener("orientationchange", this.handleOrientationChange);
    window.addEventListener("keydown", this.handleRevealInput, true);
    window.addEventListener("pointerdown", this.handleRevealInput, true);
    this.updateLayout(true);
  }

  stop() {
    this.cancelReveal();
    cancelAnimationFrame(this.layoutFrame);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleOrientationChange);
    window.removeEventListener("keydown", this.handleRevealInput, true);
    window.removeEventListener("pointerdown", this.handleRevealInput, true);
    if (this.reducedMotionQuery?.removeEventListener) {
      this.reducedMotionQuery.removeEventListener("change", this.handleReducedMotion);
    } else {
      this.reducedMotionQuery?.removeListener?.(this.handleReducedMotion);
    }
  }
}

export { BOARD_PROFILES };

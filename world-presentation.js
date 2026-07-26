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

export function remoteVariantPaths(config) {
  if (!config?.assetRoot || !Array.isArray(config.siteIds) || !Number.isInteger(config.variantsPerSite)) return [];
  return config.siteIds.flatMap(siteId => Array.from(
    { length: config.variantsPerSite },
    (_, index) => `${config.assetRoot}/${siteId}-c${String(index + 1).padStart(2, "0")}.png`,
  ));
}

export class WorldPresentationRenderer {
  constructor({
    world,
    backdropLayer,
    ambientLayer,
    remoteVariantLayer,
    assetUrl = value => value,
    remoteAssetUrls = value => [value],
    onLegacyResize = () => {},
  }) {
    this.world = world;
    this.backdropLayer = backdropLayer;
    this.ambientLayer = ambientLayer;
    this.remoteVariantLayer = remoteVariantLayer;
    this.assetUrl = assetUrl;
    this.remoteAssetUrls = remoteAssetUrls;
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
    this.remoteVariantTimer = null;
    this.remoteVariantFadeTimer = null;
    this.remoteVariantController = null;
    this.remoteVariantObjectUrl = null;
    this.remoteVariantBag = [];
    this.remoteVariantCandidate = null;
    this.remoteVariantPausedOffline = false;
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
      this.syncRemoteVariants();
    };
    this.handleRevealInput = () => this.cancelReveal();
    this.handleOnline = () => {
      this.remoteVariantPausedOffline = false;
      this.syncRemoteVariants({ resumeImmediately: true });
    };
    this.handleOffline = () => {
      this.remoteVariantPausedOffline = true;
      this.cancelRemoteVariants({ clearLayer: true });
    };
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
      this.cancelRemoteVariants({ clearLayer: true, resetBag: true });
      this.presentationKey = null;
      this.world.style.removeProperty("--world-fallback");
      this.backdropLayer.style.removeProperty("--world-asset");
      this.backdropLayer.removeAttribute("data-scene-profile");
      this.ambientLayer.replaceChildren();
      this.remoteVariantLayer?.replaceChildren();
      this.updateLayout();
      return false;
    }

    this.world.style.setProperty("--world-fallback", presentation.world.fallbackGradient);
    const key = `${presentation.world.id}:${presentation.unit.id}:${scene.id}`;
    if (key !== this.presentationKey) {
      this.cancelReveal();
      this.cancelRemoteVariants({ clearLayer: true, resetBag: true });
      this.presentationKey = key;
      this.remoteVariantPausedOffline = !navigator.onLine;
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

  remoteVariantsAreEligible() {
    const config = this.presentation?.scene?.remoteVariants;
    return Boolean(
      config
      && this.remoteVariantLayer
      && config.profiles?.includes(sceneProfileForBoard(this.profile))
      && this.profile !== "shallow"
      && !this.reducedMotionQuery?.matches
      && navigator.onLine
      && !this.remoteVariantPausedOffline,
    );
  }

  cancelRemoteVariants({ clearLayer = false, resetBag = false } = {}) {
    clearTimeout(this.remoteVariantTimer);
    clearTimeout(this.remoteVariantFadeTimer);
    this.remoteVariantTimer = null;
    this.remoteVariantFadeTimer = null;
    this.remoteVariantController?.abort();
    this.remoteVariantController = null;
    if (this.remoteVariantObjectUrl) URL.revokeObjectURL(this.remoteVariantObjectUrl);
    this.remoteVariantObjectUrl = null;
    if (clearLayer) this.remoteVariantLayer?.replaceChildren();
    if (resetBag) {
      this.remoteVariantBag = [];
      this.remoteVariantCandidate = null;
    }
  }

  scheduleRemoteVariant(delay) {
    if (!this.remoteVariantsAreEligible() || this.remoteVariantTimer || this.remoteVariantController || this.remoteVariantLayer?.childElementCount) return;
    this.remoteVariantTimer = window.setTimeout(() => {
      this.remoteVariantTimer = null;
      this.showRemoteVariant();
    }, delay);
  }

  nextRemoteVariant(config) {
    if (this.remoteVariantCandidate) return this.remoteVariantCandidate;
    if (!this.remoteVariantBag.length) {
      this.remoteVariantBag = remoteVariantPaths(config);
      for (let index = this.remoteVariantBag.length - 1; index > 0; index -= 1) {
        const other = Math.floor(Math.random() * (index + 1));
        [this.remoteVariantBag[index], this.remoteVariantBag[other]] = [this.remoteVariantBag[other], this.remoteVariantBag[index]];
      }
    }
    this.remoteVariantCandidate = this.remoteVariantBag.shift() || null;
    return this.remoteVariantCandidate;
  }

  async showRemoteVariant() {
    const config = this.presentation?.scene?.remoteVariants;
    if (!config || !this.remoteVariantsAreEligible()) return;
    const asset = this.nextRemoteVariant(config);
    if (!asset) return;
    const sources = this.remoteAssetUrls(asset);
    const controller = new AbortController();
    this.remoteVariantController = controller;
    let pendingObjectUrl = null;
    try {
      let response = null;
      let lastError = null;
      for (const source of sources) {
        try {
          const candidate = await fetch(source, {
            cache: "no-store",
            mode: "cors",
            signal: controller.signal,
          });
          if (candidate.ok) {
            response = candidate;
            break;
          }
          lastError = new Error(`Remote scene variant request failed (${candidate.status})`);
        } catch (error) {
          if (error.name === "AbortError" || controller.signal.aborted) throw error;
          lastError = error;
        }
      }
      if (!response) throw lastError || new Error("Remote scene variant request failed");
      const objectUrl = URL.createObjectURL(await response.blob());
      pendingObjectUrl = objectUrl;
      const image = new Image();
      image.src = objectUrl;
      await image.decode();
      if (controller.signal.aborted || !this.remoteVariantsAreEligible()) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      this.remoteVariantController = null;
      this.remoteVariantObjectUrl = objectUrl;
      pendingObjectUrl = null;
      const variant = document.createElement("div");
      variant.className = "world-remote-variant";
      variant.dataset.asset = asset;
      variant.style.setProperty("--world-asset", `url("${objectUrl}")`);
      variant.style.setProperty("--remote-variant-fade", `${config.timing.fadeMs}ms`);
      this.remoteVariantLayer.replaceChildren(variant);
      // Force the zero-opacity state to paint before beginning the transition.
      // A single animation frame is not reliable after a freshly decoded image.
      void variant.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => variant.classList.add("is-visible")));
      this.remoteVariantFadeTimer = window.setTimeout(() => {
        variant.classList.remove("is-visible");
        this.remoteVariantFadeTimer = window.setTimeout(() => {
          if (variant.isConnected) variant.remove();
          if (this.remoteVariantObjectUrl === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            this.remoteVariantObjectUrl = null;
          }
          this.remoteVariantCandidate = null;
          this.remoteVariantFadeTimer = null;
          this.scheduleRemoteVariant(config.timing.gapMs);
        }, config.timing.fadeMs);
      }, config.timing.fadeMs + config.timing.holdMs);
    } catch (error) {
      if (pendingObjectUrl) URL.revokeObjectURL(pendingObjectUrl);
      if (error.name === "AbortError" || controller.signal.aborted) return;
      this.remoteVariantController = null;
      // Remote art is strictly optional: retain the base board and retry later.
      this.scheduleRemoteVariant(config.timing.gapMs);
    }
  }

  syncRemoteVariants({ resumeImmediately = false } = {}) {
    const config = this.presentation?.scene?.remoteVariants;
    if (!config || !this.remoteVariantsAreEligible()) {
      this.cancelRemoteVariants({ clearLayer: true });
      return;
    }
    const delay = resumeImmediately ? 0 : config.timing.initialDelayMs;
    this.scheduleRemoteVariant(delay);
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
    this.syncRemoteVariants();
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
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    this.updateLayout(true);
  }

  stop() {
    this.cancelReveal();
    this.cancelRemoteVariants({ clearLayer: true, resetBag: true });
    cancelAnimationFrame(this.layoutFrame);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleOrientationChange);
    window.removeEventListener("keydown", this.handleRevealInput, true);
    window.removeEventListener("pointerdown", this.handleRevealInput, true);
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    if (this.reducedMotionQuery?.removeEventListener) {
      this.reducedMotionQuery.removeEventListener("change", this.handleReducedMotion);
    } else {
      this.reducedMotionQuery?.removeListener?.(this.handleReducedMotion);
    }
  }
}

export { BOARD_PROFILES };

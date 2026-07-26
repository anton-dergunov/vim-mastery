const BOARD_SHAPES = ["portrait", "square", "wide", "shallow"];

export function boardShapeForBounds({ width = 0, height = 0 } = {}) {
  const ratio = height > 0 ? width / height : 1;
  if (ratio < 0.85) return "portrait";
  if (ratio <= 1.35) return "square";
  if (ratio <= 2.4) return "wide";
  return "shallow";
}

export function backdropShapeForBoard(shape) {
  return shape === "shallow" ? "wide" : BOARD_SHAPES.includes(shape) ? shape : "square";
}

function applyPlacement(element, placements, shape) {
  const placement = placements?.[shape];
  const hidden = !placement || placement.hidden === true;
  element.hidden = hidden;
  element.dataset.boardShape = shape;
  if (hidden) return;
  element.style.setProperty("--placement-x", `${placement.x}%`);
  element.style.setProperty("--placement-y", `${placement.y}%`);
  element.style.setProperty("--placement-scale", String(placement.scale));
}

function setAsset(element, asset, assetUrl) {
  element.style.setProperty("--world-asset", `url("${assetUrl(asset)}")`);
}

export class WorldPresentationRenderer {
  constructor({
    world,
    backdropLayer,
    ambientLayer,
    landmarkLayer,
    propLayer,
    assetUrl = value => value,
    onLegacyResize = () => {},
  }) {
    this.world = world;
    this.backdropLayer = backdropLayer;
    this.ambientLayer = ambientLayer;
    this.landmarkLayer = landmarkLayer;
    this.propLayer = propLayer;
    this.assetUrl = assetUrl;
    this.onLegacyResize = onLegacyResize;
    this.presentation = null;
    this.presentationKey = null;
    this.shape = null;
    this.resizeObserver = null;
    this.layoutFrame = null;
    this.reducedMotionQuery = null;
    this.handleResize = () => this.scheduleLayout();
    this.handleReducedMotion = event => {
      this.world.dataset.reducedMotion = String(event.matches);
    };
  }

  setPresentation(presentation, { unitId } = {}) {
    const valid = Boolean(presentation?.world && presentation?.unit);
    this.presentation = valid ? presentation : null;
    this.world.dataset.unitId = unitId || presentation?.unit?.id || "unknown";
    this.world.dataset.renderer = valid ? "layered" : "legacy";
    this.world.dataset.worldId = valid ? presentation.world.id : "legacy";
    this.world.dataset.landmarkId = valid ? presentation.unit.landmark.id : "none";

    if (!valid) {
      this.presentationKey = null;
      this.world.style.removeProperty("--world-fallback");
      this.backdropLayer.style.removeProperty("--world-asset");
      this.ambientLayer.replaceChildren();
      this.landmarkLayer.replaceChildren();
      this.propLayer.replaceChildren();
      this.updateLayout();
      return false;
    }

    this.world.style.setProperty("--world-fallback", presentation.world.fallbackGradient);
    const key = `${presentation.world.id}:${presentation.unit.id}`;
    if (key !== this.presentationKey) {
      this.presentationKey = key;
      this.buildAmbientLayer();
      this.buildPropLayer();
      this.buildLandmarkLayer();
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

  buildPropLayer() {
    const props = this.presentation.world.props.map(prop => {
      const element = document.createElement("div");
      element.className = "world-prop";
      element.dataset.propId = prop.id;
      setAsset(element, prop.asset, this.assetUrl);
      return element;
    });
    this.propLayer.replaceChildren(...props);
  }

  buildLandmarkLayer() {
    const landmark = document.createElement("div");
    landmark.className = "world-landmark dormant";
    landmark.dataset.landmarkId = this.presentation.unit.landmark.id;
    landmark.dataset.landmarkState = "dormant";
    setAsset(landmark, this.presentation.unit.landmark.assets.dormant, this.assetUrl);
    this.landmarkLayer.replaceChildren(landmark);
  }

  updateLayout(force = false) {
    const nextShape = boardShapeForBounds(this.world.getBoundingClientRect());
    if (!force && nextShape === this.shape) {
      if (!this.presentation) this.onLegacyResize();
      return;
    }
    this.shape = nextShape;
    this.world.dataset.boardShape = nextShape;
    if (!this.presentation) {
      this.onLegacyResize();
      return;
    }

    const backdropShape = backdropShapeForBoard(nextShape);
    setAsset(this.backdropLayer, this.presentation.world.backdrops[backdropShape], this.assetUrl);
    this.backdropLayer.dataset.backdropShape = backdropShape;
    this.propLayer.querySelectorAll(".world-prop").forEach((element, index) => {
      applyPlacement(element, this.presentation.world.props[index]?.placements, nextShape);
    });
    const landmark = this.landmarkLayer.querySelector(".world-landmark");
    if (landmark) applyPlacement(landmark, this.presentation.unit.landmark.placements, nextShape);
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
    window.addEventListener("orientationchange", this.handleResize);
    this.updateLayout(true);
  }

  stop() {
    cancelAnimationFrame(this.layoutFrame);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("orientationchange", this.handleResize);
    if (this.reducedMotionQuery?.removeEventListener) {
      this.reducedMotionQuery.removeEventListener("change", this.handleReducedMotion);
    } else {
      this.reducedMotionQuery?.removeListener?.(this.handleReducedMotion);
    }
  }
}

const REACTION_STATES = new Set([
  "idle",
  "attentive",
  "puzzled",
  "encouraging",
  "celebrating",
]);

/**
 * Keeps decorative character feedback isolated from lesson input. A pose is
 * optional: when a character does not ship one, its approved idle still stays
 * visible and CSS supplies the gentle state cue instead.
 */
export class CharacterReactions {
  constructor({
    layer,
    assetUrl = value => value,
    reducedMotion = () => false,
    random = Math.random,
    prepareMedia,
    settleDurationMs = 180,
    fadeDurationMs = 420,
    delay = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)),
    forceStyle = character => void character.offsetWidth,
    readTransform = character => typeof getComputedStyle === "function"
      ? getComputedStyle(character).transform
      : "none",
  } = {}) {
    this.layer = layer;
    this.assetUrl = assetUrl;
    this.reducedMotion = reducedMotion;
    this.random = random;
    this.prepareMedia = prepareMedia || (source => {
      if (typeof Image === "undefined") return Promise.resolve();
      const image = new Image();
      const loaded = new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
      image.src = source;
      return typeof image.decode === "function"
        ? image.decode().catch(() => image.complete && image.naturalWidth ? undefined : loaded)
        : loaded;
    });
    this.settleDurationMs = settleDurationMs;
    this.fadeDurationMs = fadeDurationMs;
    this.delay = delay;
    this.forceStyle = forceStyle;
    this.readTransform = readTransform;
    this.activityKey = null;
    this.state = "idle";
    this.resetTimer = null;
    this.lastVariantByState = new Map();
    this.activeDurationMs = 0;
    this.mediaRequest = 0;
    this.transitionOwner = null;
  }

  setActivity(activity) {
    const nextKey = activity?.id || null;
    if (nextKey === this.activityKey) return;
    this.activityKey = nextKey;
    this.clearTimer();
    this.apply("idle");
  }

  clearTimer() {
    if (this.resetTimer) window.clearTimeout(this.resetTimer);
    this.resetTimer = null;
  }

  element() {
    return this.layer?.querySelector(".nix:not(.reaction-outgoing)")
      || this.layer?.querySelector(".nix")
      || null;
  }

  reactionCandidates(asset, state) {
    const configured = asset?.reactions?.[state] ?? asset?.poses?.[state];
    if (!configured) return [];
    return (Array.isArray(configured) ? configured : [configured])
      .filter(candidate => typeof candidate === "string" || candidate?.src);
  }

  chooseReaction(candidates, state) {
    if (candidates.length <= 1) return { candidate: candidates[0], index: 0 };
    const previous = this.lastVariantByState.get(state);
    let index = Math.floor(this.random() * candidates.length);
    if (index === previous) index = (index + 1) % candidates.length;
    this.lastVariantByState.set(state, index);
    return { candidate: candidates[index], index };
  }

  clearTransitionClasses(character) {
    character?.classList.remove(
      "reaction-settling",
      "reaction-staged",
      "reaction-transitioning-in",
      "reaction-transitioning-out",
      "reaction-outgoing",
    );
    character?.style.removeProperty("--reaction-settle-from");
  }

  cancelTransition() {
    const current = this.element();
    const characters = this.layer?.querySelectorAll?.(".nix") || [];
    for (const character of characters) {
      if (character.classList.contains("reaction-outgoing")) {
        character.remove();
        continue;
      }
      this.clearTransitionClasses(character);
      character.removeAttribute?.("aria-hidden");
    }
    if (current?.isConnected !== false) {
      this.clearTransitionClasses(current);
      current?.removeAttribute?.("aria-hidden");
    }
    this.transitionOwner = null;
  }

  commitVisual(character, { source, scale = 1, reactionMedia = false }) {
    character.src = source;
    if (reactionMedia) character.style.setProperty("--character-media-scale", String(scale));
    else character.style.removeProperty("--character-media-scale");
    character.classList.toggle("reaction-has-media", reactionMedia);
    if (reactionMedia) character.dataset.reactionMediaActive = "true";
    else delete character.dataset.reactionMediaActive;
  }

  applyReactionState(character, { state, variant }) {
    character.dataset.reaction = state;
    if (variant !== null) character.dataset.reactionVariant = String(variant + 1);
    else delete character.dataset.reactionVariant;
    for (const candidate of REACTION_STATES) {
      character.classList.toggle(`reaction-${candidate}`, candidate === state);
    }
  }

  applyFallback(character, presentation) {
    const idle = character.__characterAsset?.idle;
    if (idle) this.commitVisual(character, {
      source: this.assetUrl(idle),
      reactionMedia: false,
    });
    this.activeDurationMs = 0;
    this.applyReactionState(character, presentation);
  }

  async swapVisual(character, visual, presentation, request) {
    try {
      await this.prepareMedia(visual.source);
    } catch {
      if (request !== this.mediaRequest || character !== this.element()) return false;
      this.applyFallback(character, presentation);
      return true;
    }
    if (request !== this.mediaRequest || character !== this.element()) return false;

    const shouldCrossfade = !this.reducedMotion() && this.fadeDurationMs > 0;
    if (!shouldCrossfade || typeof character.cloneNode !== "function" || typeof character.after !== "function") {
      this.commitVisual(character, visual);
      this.applyReactionState(character, presentation);
      return true;
    }

    this.transitionOwner = request;
    character.style.setProperty("--reaction-settle-from", this.readTransform(character));
    character.style.setProperty("--reaction-settle-duration", `${this.settleDurationMs}ms`);
    character.style.setProperty("--reaction-fade-duration", `${this.fadeDurationMs}ms`);
    character.classList.add("reaction-settling");
    if (this.settleDurationMs > 0) {
      await this.delay(this.settleDurationMs);
      if (request !== this.mediaRequest || character !== this.element()) {
        if (this.transitionOwner === request) this.cancelTransition();
        return false;
      }
    }

    const incoming = character.cloneNode();
    incoming.__characterAsset = character.__characterAsset;
    this.clearTransitionClasses(incoming);
    this.commitVisual(incoming, visual);
    this.applyReactionState(incoming, presentation);
    incoming.style.setProperty("--reaction-settle-duration", `${this.settleDurationMs}ms`);
    incoming.style.setProperty("--reaction-fade-duration", `${this.fadeDurationMs}ms`);
    incoming.classList.add("reaction-staged");
    incoming.removeAttribute?.("aria-hidden");
    character.after(incoming);
    this.forceStyle(incoming);

    if (request !== this.mediaRequest || character !== this.element()) {
      incoming.remove();
      if (this.transitionOwner === request) this.cancelTransition();
      return false;
    }

    character.classList.remove("reaction-settling");
    character.classList.add("reaction-outgoing", "reaction-transitioning-out");
    character.setAttribute?.("aria-hidden", "true");
    incoming.classList.remove("reaction-staged");
    incoming.classList.add("reaction-transitioning-in");

    await this.delay(this.fadeDurationMs);
    if (request !== this.mediaRequest || incoming !== this.element()) return false;

    character.remove();
    this.clearTransitionClasses(incoming);
    incoming.removeAttribute?.("aria-hidden");
    if (this.transitionOwner === request) {
      this.transitionOwner = null;
    }
    return true;
  }

  apply(nextState) {
    const state = REACTION_STATES.has(nextState) ? nextState : "idle";
    this.state = state;
    const request = ++this.mediaRequest;
    this.cancelTransition();
    const character = this.element();
    if (!character) return Promise.resolve(false);

    const asset = character.__characterAsset;
    const candidates = this.reactionCandidates(asset, state);
    const { candidate: pose, index } = this.chooseReaction(candidates, state);
    const presentation = { state, variant: pose ? index : null };
    const source = typeof pose === "string" ? pose : pose?.src;
    const usesReactionMedia = Boolean(source && !this.reducedMotion());
    this.activeDurationMs = usesReactionMedia
      ? Math.max(4000, Number(pose?.duration_seconds || 4) * 1000)
      : 0;
    if (usesReactionMedia) {
      return this.swapVisual(character, {
        source: this.assetUrl(source),
        scale: Number(pose?.css_scale) || 1,
        reactionMedia: true,
      }, presentation, request);
    }
    if (asset?.idle && character.dataset.reactionMediaActive === "true") {
      return this.swapVisual(character, {
        source: this.assetUrl(asset.idle),
        reactionMedia: false,
      }, presentation, request);
    }
    if (asset?.idle) this.commitVisual(character, {
      source: this.assetUrl(asset.idle),
      reactionMedia: false,
    });
    this.applyReactionState(character, presentation);
    return Promise.resolve(true);
  }

  incorrectInput(consecutiveMistakes) {
    if (consecutiveMistakes === 2) this.showTemporarily("puzzled");
    if (consecutiveMistakes >= 3) this.showTemporarily("encouraging");
  }

  correctProgress() {
    this.clearTimer();
    this.apply("idle");
  }

  modeChanged(mode) {
    if (mode === "operator-pending" && this.state === "idle") this.apply("attentive");
    if (mode !== "operator-pending" && this.state === "attentive") this.apply("idle");
  }

  celebrate() {
    this.clearTimer();
    this.state = "celebrating";
    this.activeDurationMs = 0;
    this.mediaRequest += 1;
    this.cancelTransition();
    const character = this.element();
    if (!character) return Promise.resolve(false);
    this.applyReactionState(character, { state: "celebrating", variant: null });
    return Promise.resolve(true);
  }

  showTemporarily(state) {
    this.clearTimer();
    const pending = this.apply(state);
    const request = this.mediaRequest;
    Promise.resolve(pending).then(applied => {
      if (!applied || request !== this.mediaRequest || this.state !== state) return;
      const duration = this.activeDurationMs ? this.activeDurationMs + 120 : 2800;
      this.resetTimer = window.setTimeout(() => {
        this.resetTimer = null;
        this.apply("idle");
      }, duration);
    });
  }

  stop() {
    this.clearTimer();
    this.mediaRequest += 1;
    this.cancelTransition();
    this.activityKey = null;
    this.state = "idle";
  }
}

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
    dissolveDurationMs = 320,
    delay = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)),
    forceStyle = character => void character.offsetWidth,
    nextFrame = () => new Promise(resolve => window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    })),
    createMaskLayer = role => {
      const mask = document.createElement("span");
      mask.className = `reaction-dissolve-mask reaction-dissolve-${role}-mask reaction-dissolve-staged`;
      if (role === "outgoing") mask.setAttribute("aria-hidden", "true");
      return mask;
    },
    promoteMaskLayer = (mask, character) => mask.after(character),
    readBounds = element => element.getBoundingClientRect(),
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
    this.dissolveDurationMs = dissolveDurationMs;
    this.delay = delay;
    this.forceStyle = forceStyle;
    this.nextFrame = nextFrame;
    this.createMaskLayer = createMaskLayer;
    this.promoteMaskLayer = promoteMaskLayer;
    this.readBounds = readBounds;
    this.readTransform = readTransform;
    this.activityKey = null;
    this.state = "idle";
    this.resetTimer = null;
    this.lastVariantByState = new Map();
    this.activeDurationMs = 0;
    this.mediaRequest = 0;
    this.transitionOwner = null;
    this.transition = null;
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
    if (this.transition?.incoming && this.transition.incoming.isConnected !== false) {
      return this.transition.incoming;
    }
    return this.layer?.querySelector(".nix") || null;
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
      "reaction-neutral-ready",
      "reaction-dissolve-frozen",
    );
    character?.style.removeProperty("--reaction-settle-from");
  }

  cancelTransition() {
    if (this.transition) {
      const { incoming, incomingMask, outgoingMask } = this.transition;
      this.promoteMaskLayer(incomingMask, incoming);
      outgoingMask.remove();
      incomingMask.remove();
      this.clearTransitionClasses(incoming);
      incoming.removeAttribute?.("aria-hidden");
      this.transition = null;
      this.transitionOwner = null;
      return;
    }
    const current = this.element();
    this.clearTransitionClasses(current);
    current?.removeAttribute?.("aria-hidden");
    this.transitionOwner = null;
  }

  configureDissolveMasks(outgoingMask, incomingMask, outgoing, incoming) {
    const containerBounds = this.readBounds(this.layer);
    const outgoingBounds = this.readBounds(outgoing);
    const incomingBounds = this.readBounds(incoming);
    const start = Math.min(outgoingBounds.left, incomingBounds.left) - containerBounds.left - 18;
    const end = Math.max(outgoingBounds.right, incomingBounds.right) - containerBounds.left + 18;
    const top = Math.min(outgoingBounds.top, incomingBounds.top) - containerBounds.top - 18;
    const bottom = Math.max(outgoingBounds.bottom, incomingBounds.bottom) - containerBounds.top + 18;
    const width = Math.max(1, end - start);
    const height = Math.max(1, bottom - top);
    const stages = {
      35: [.23, .39, .30, .44, .25, .41, .33, .47, .27, .42, .35],
      70: [.62, .78, .69, .83, .64, .80, .71, .86, .66, .81, .73],
    };
    for (const mask of [outgoingMask, incomingMask]) {
      mask.style.setProperty("--reaction-dissolve-duration", `${this.dissolveDurationMs}ms`);
      mask.style.setProperty("--reaction-dissolve-start", `${start}px`);
      mask.style.setProperty("--reaction-dissolve-end", `${end}px`);
      for (let index = 0; index <= 10; index += 1) {
        mask.style.setProperty(`--reaction-dissolve-y-${index}`, `${top + height * index / 10}px`);
      }
      for (const [stage, positions] of Object.entries(stages)) {
        positions.forEach((position, index) => {
          mask.style.setProperty(`--reaction-dissolve-${stage}-${index}`, `${start + width * position}px`);
        });
      }
    }
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

    const shouldDissolve = !this.reducedMotion()
      && this.dissolveDurationMs > 0
      && typeof character.cloneNode === "function"
      && typeof character.after === "function"
      && typeof this.createMaskLayer === "function";
    if (!shouldDissolve) {
      this.commitVisual(character, visual);
      this.applyReactionState(character, presentation);
      return true;
    }

    this.transitionOwner = request;
    character.style.setProperty("--reaction-settle-from", this.readTransform(character));
    character.style.setProperty("--reaction-settle-duration", `${this.settleDurationMs}ms`);
    character.classList.add("reaction-settling");
    if (this.settleDurationMs > 0) {
      await this.delay(this.settleDurationMs);
      if (request !== this.mediaRequest || character !== this.element()) {
        if (this.transitionOwner === request) this.cancelTransition();
        return false;
      }
    }

    character.classList.add("reaction-neutral-ready");
    const incoming = character.cloneNode();
    incoming.__characterAsset = character.__characterAsset;
    this.clearTransitionClasses(incoming);
    this.commitVisual(incoming, visual);
    this.applyReactionState(incoming, presentation);
    incoming.classList.add("reaction-dissolve-frozen");
    incoming.removeAttribute?.("aria-hidden");

    const outgoingMask = this.createMaskLayer("outgoing");
    const incomingMask = this.createMaskLayer("incoming");
    character.after(outgoingMask);
    outgoingMask.append(character);
    outgoingMask.after(incomingMask);
    incomingMask.append(incoming);
    this.transition = { outgoing: character, incoming, outgoingMask, incomingMask };

    character.classList.add("reaction-dissolve-frozen");
    character.classList.remove("reaction-settling");
    character.setAttribute?.("aria-hidden", "true");
    this.configureDissolveMasks(outgoingMask, incomingMask, character, incoming);
    this.forceStyle(incomingMask);
    await this.nextFrame();
    if (request !== this.mediaRequest || incoming !== this.element()) {
      if (this.transitionOwner === request) this.cancelTransition();
      return false;
    }

    character.classList.remove("reaction-neutral-ready");
    outgoingMask.classList.remove("reaction-dissolve-staged");
    incomingMask.classList.remove("reaction-dissolve-staged");
    outgoingMask.classList.add("reaction-dissolve-running-out");
    incomingMask.classList.add("reaction-dissolve-running-in");

    await this.delay(this.dissolveDurationMs);
    if (request !== this.mediaRequest || incoming !== this.element()) return false;

    this.promoteMaskLayer(incomingMask, incoming);
    outgoingMask.remove();
    incomingMask.remove();
    this.clearTransitionClasses(incoming);
    incoming.removeAttribute?.("aria-hidden");
    this.transition = null;
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

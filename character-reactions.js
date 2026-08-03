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
    fadeDurationMs = 90,
    delay = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds)),
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
    this.fadeDurationMs = fadeDurationMs;
    this.delay = delay;
    this.activityKey = null;
    this.state = "idle";
    this.resetTimer = null;
    this.lastVariantByState = new Map();
    this.activeDurationMs = 0;
    this.mediaRequest = 0;
    this.fadeOwner = null;
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

  cancelFade(character = this.element()) {
    if (character) character.classList.remove("reaction-fading-out");
    this.fadeOwner = null;
  }

  commitVisual(character, { source, scale = 1, reactionMedia = false }) {
    character.src = source;
    if (reactionMedia) character.style.setProperty("--character-media-scale", String(scale));
    else character.style.removeProperty("--character-media-scale");
    character.classList.toggle("reaction-has-media", reactionMedia);
    if (reactionMedia) character.dataset.reactionMediaActive = "true";
    else delete character.dataset.reactionMediaActive;
  }

  async swapVisual(character, visual, request) {
    try {
      await this.prepareMedia(visual.source);
    } catch {
      return false;
    }
    if (request !== this.mediaRequest || character !== this.element()) return false;

    const shouldFade = !this.reducedMotion() && this.fadeDurationMs > 0;
    if (shouldFade) {
      this.fadeOwner = request;
      character.classList.add("reaction-fading-out");
      await this.delay(this.fadeDurationMs);
      if (request !== this.mediaRequest || character !== this.element()) {
        if (this.fadeOwner === request) this.cancelFade(character);
        return false;
      }
    }

    this.commitVisual(character, visual);
    if (this.fadeOwner === request) this.cancelFade(character);
    return true;
  }

  apply(nextState) {
    const state = REACTION_STATES.has(nextState) ? nextState : "idle";
    this.state = state;
    const character = this.element();
    if (!character) return;
    const request = ++this.mediaRequest;
    this.cancelFade(character);

    const asset = character.__characterAsset;
    const candidates = this.reactionCandidates(asset, state);
    const { candidate: pose, index } = this.chooseReaction(candidates, state);
    character.dataset.reaction = state;
    if (pose) character.dataset.reactionVariant = String(index + 1);
    else delete character.dataset.reactionVariant;
    const source = typeof pose === "string" ? pose : pose?.src;
    const usesReactionMedia = Boolean(source && !this.reducedMotion());
    this.activeDurationMs = usesReactionMedia
      ? Math.max(4000, Number(pose?.duration_seconds || 4) * 1000)
      : 0;
    character.classList.toggle("reaction-crossfade", !this.reducedMotion());
    for (const candidate of REACTION_STATES) {
      character.classList.toggle(`reaction-${candidate}`, candidate === state);
    }
    if (usesReactionMedia) {
      return this.swapVisual(character, {
        source: this.assetUrl(source),
        scale: Number(pose?.css_scale) || 1,
        reactionMedia: true,
      }, request);
    }
    if (asset?.idle && character.dataset.reactionMediaActive === "true") {
      return this.swapVisual(character, {
        source: this.assetUrl(asset.idle),
        reactionMedia: false,
      }, request);
    }
    if (asset?.idle) this.commitVisual(character, {
      source: this.assetUrl(asset.idle),
      reactionMedia: false,
    });
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
    this.apply("celebrating");
  }

  showTemporarily(state) {
    this.clearTimer();
    this.apply(state);
    this.resetTimer = window.setTimeout(() => {
      this.resetTimer = null;
      this.apply("idle");
    }, this.activeDurationMs ? this.activeDurationMs + 120 : 2800);
  }

  stop() {
    this.clearTimer();
    this.mediaRequest += 1;
    this.cancelFade();
    this.activityKey = null;
    this.state = "idle";
  }
}

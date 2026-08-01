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
  } = {}) {
    this.layer = layer;
    this.assetUrl = assetUrl;
    this.reducedMotion = reducedMotion;
    this.random = random;
    this.activityKey = null;
    this.state = "idle";
    this.resetTimer = null;
    this.lastVariantByState = new Map();
    this.activeDurationMs = 0;
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

  apply(nextState) {
    const state = REACTION_STATES.has(nextState) ? nextState : "idle";
    this.state = state;
    const character = this.element();
    if (!character) return;

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
    character.classList.toggle("reaction-has-media", usesReactionMedia);
    character.classList.toggle("reaction-crossfade", !this.reducedMotion());
    for (const candidate of REACTION_STATES) {
      character.classList.toggle(`reaction-${candidate}`, candidate === state);
    }
    if (usesReactionMedia) character.src = this.assetUrl(source);
    else if (asset?.idle) character.src = this.assetUrl(asset.idle);
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
    this.activityKey = null;
    this.state = "idle";
  }
}

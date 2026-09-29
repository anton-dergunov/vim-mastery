/* Practice: checking each key against the script, mistakes, hints, choices,
 * and completion.
 */

import { $$, vibrate } from "../app/dom.js";
import { renderInline } from "../app/html.js";
import { elements, state, unit } from "../app/context.js";
import {
  currentActivity,
  isExplore,
  isFreePractice,
  isPractice,
  scriptKeys,
} from "../app/activity.js";
import { renderActivityControls, renderAll, renderMode } from "../app/render.js";
import { functionalThemeFor, renderCompletionHost, renderWorld, setTheme } from "./board.js";
import { characterReactions, playSuccessCharacter } from "./characters.js";
import { renderCommand } from "./console.js";
import { clearPlayback } from "./demo.js";
import { matchesTarget } from "./target.js";
import { vimEngine } from "../editor/mount.js";
import {
  dismissExOutput,
  renderBufferPosition,
  renderEditorMarks,
  renderExOutput,
} from "../editor/readouts.js";
import { requiredButtons } from "../keyboard/keyboard.js";
import { recordActivityCompletion } from "../surfaces/mastery.js";

export function renderHints() {
  const hints = isPractice() && !isFreePractice() ? currentActivity().hints : [];
  elements.hintSteps.innerHTML = hints.slice(0, state.hintLevel).map((hint, index) => `<div class="hint-step"><kbd>Hint ${index + 1}</kbd><small>${renderInline(hint)}</small></div>`).join("");
}

function isTargetSnapshot(snapshot) {
  // Free practice has no target. Answering here keeps the predicate honest
  // instead of making every caller check first.
  return matchesTarget(snapshot, currentActivity().scenario?.target);
}

function completeActivity() {
  state.complete = true;
  recordActivityCompletion();
  clearPlayback();
  vimEngine?.setLocked(true);
  setTheme(functionalThemeFor());
  if (currentActivity().type === "choice") renderWorld();
  else renderCompletionHost();
  if (isPractice() || currentActivity().type === "choice") playSuccessCharacter();
  if (isPractice() || currentActivity().type === "choice") characterReactions.celebrate();
  renderMode();
  renderCommand();
  renderActivityControls();
  vibrate([18, 35, 18]);
}

function reachExploreTarget() {
  if (!isExplore() || state.exploreTargetReached) return;
  state.exploreTargetReached = true;
  renderCommand();
  renderActivityControls();
  playSuccessCharacter({ allowExplore: true });
  vibrate([18, 35, 18]);
}

export function handleEngineEvent(event) {
  // The app injects every accepted physical key through processToken. Adapter
  // keypress notifications are therefore duplicates, and search prompts can
  // report them with a stale pre-search cursor after the real selection event.
  if (event.kind === "key" && event.source === "physical") return;
  state.editorSnapshot = event.snapshot;
  renderBufferPosition();
  renderEditorMarks();
  renderExOutput();
  // Only the gate's explicit injection is evidence of learner/demo progress.
  // CodeMirror can also report keypresses from its transient search prompt;
  // those must not turn an accepted sequence into a different one.
  // Free practice keeps no history: there is nothing to compare it against,
  // and a long session would grow the array without bound.
  if (event.kind === "key" && !isFreePractice() && (event.source === "lesson" || event.source === "demo")) {
    state.history.push(event.key);
    if (isPractice()) state.progress = state.history.length;
  }
  renderMode();
  if (event.kind === "mode" || event.kind === "key") characterReactions.modeChanged(event.snapshot?.mode);
  renderCommand();
  // No target, no completion, no progress. The early return sits below the
  // renders so the mode pill still tracks the buffer.
  if (isFreePractice()) return;
  if (isExplore() && isTargetSnapshot(event.snapshot)) {
    reachExploreTarget();
  } else if (isPractice() && !state.complete && state.progress === scriptKeys().length && isTargetSnapshot(event.snapshot)) {
    completeActivity();
  }
}

export function handleSemanticEffect(event) {
  state.semanticEffects.push({
    ...event,
    unitId: unit.id,
    activityId: currentActivity().id,
  });
  if (state.semanticEffects.length > 80) state.semanticEffects.splice(0, state.semanticEffects.length - 80);
}

export function clearPracticeError() {
  if (state.errorTimer) window.clearTimeout(state.errorTimer);
  state.errorTimer = null;
  state.recallFeedback = null;
  state.consecutiveMistakes = 0;
  characterReactions.correctProgress();
  elements.statusKey?.classList.remove("error");
}

function flashWrongKey(button) {
  if (!button) return;
  button.classList.remove("wrong");
  void button.offsetWidth;
  button.classList.add("wrong");
  window.setTimeout(() => button.classList.remove("wrong"), 360);
}

export function flashError(token, button) {
  elements.commandTray.classList.remove("error");
  void elements.commandTray.offsetWidth;
  elements.commandTray.classList.add("error");
  window.setTimeout(() => elements.commandTray.classList.remove("error"), 300);
  if (!isPractice()) return;
  // Nothing is wrong in a scratchpad: there is no expected key to have missed.
  if (isFreePractice()) return;
  // The refused key is the whole content of a "this command was not accepted"
  // report, and it is the one thing the app otherwise throws away: state.history
  // records accepted keys only, because processToken returns before sendKey.
  state.rejectedKeys.push({ key: token, expected: scriptKeys()[state.progress] ?? null });
  if (state.rejectedKeys.length > 40) state.rejectedKeys.shift();
  state.consecutiveMistakes += 1;
  characterReactions.incorrectInput(state.consecutiveMistakes);
  if (currentActivity().practiceMode === "guided") {
    elements.statusKey?.classList.remove("error");
    void elements.statusKey?.offsetWidth;
    elements.statusKey?.classList.add("error");
    window.setTimeout(() => elements.statusKey?.classList.remove("error"), 420);
    return;
  }
  // Only a touched on-screen key gets a red flash. Physical keys retain the
  // compact rail feedback without inventing a keyboard interaction.
  flashWrongKey(button);
  state.recallFeedback = state.consecutiveMistakes >= 3 ? "reveal" : "retry";
  if (state.errorTimer) window.clearTimeout(state.errorTimer);
  renderCommand();
  renderActivityControls();
  state.errorTimer = window.setTimeout(() => {
    state.errorTimer = null;
    if (state.recallFeedback === "reveal") state.consecutiveMistakes = 0;
    state.recallFeedback = null;
    renderCommand();
    renderActivityControls();
  }, state.recallFeedback === "reveal" ? 1400 : 520);
}

export function processToken(token, button) {
  if (!isPractice() || state.complete || !vimEngine) return false;
  // Any key dismisses Vim's message screen, including one this lesson is about
  // to refuse. It never swallows the key: the token still does whatever it
  // would have done.
  dismissExOutput();
  if (isFreePractice()) {
    // Every token the keyboard can produce is sent. The disclaimer, not an
    // allow-list, is what covers a command the adapter implements differently:
    // being unable to try something is worse than trying it and finding it
    // imperfect.
    return vimEngine.sendKey(token, { source: "lesson" });
  }
  if (isExplore()) {
    clearPracticeError();
    setHelp(false);
    return vimEngine.sendKey(token, { source: "lesson" });
  }
  const expected = scriptKeys()[state.progress];
  if (token !== expected) {
    flashError(token, button);
    return false;
  }
  clearPracticeError();
  setHelp(false);
  return vimEngine.sendKey(token, { source: "lesson" });
}

// The keyboard answers only the final hint, which already spells the answer
// out in text. It plays the remaining keys in order, each with the modifier it
// needs, and loops until the card closes. Earlier hints stay words only.
const hintKeyTiming = { on: 550, off: 150, rest: 1200 };
let hintKeyTimer = null;

function clearHintKeys() {
  window.clearTimeout(hintKeyTimer);
  hintKeyTimer = null;
  $$(".key", elements.keyboard).forEach(button => button.classList.remove("hinted", "hint-playing"));
}

function showHintKeys() {
  const tokens = scriptKeys().slice(state.progress);
  if (!tokens.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    tokens.forEach(token => requiredButtons(token).forEach(button => button.classList.add("hinted")));
    return;
  }
  let index = 0;
  const light = () => {
    requiredButtons(tokens[index]).forEach(button => button.classList.add("hint-playing"));
    hintKeyTimer = window.setTimeout(dim, hintKeyTiming.on);
  };
  const dim = () => {
    $$(".key.hint-playing", elements.keyboard).forEach(button => button.classList.remove("hint-playing"));
    index = (index + 1) % tokens.length;
    hintKeyTimer = window.setTimeout(light, index ? hintKeyTiming.off : hintKeyTiming.rest);
  };
  light();
}

export function setHelp(open) {
  const canHelp = isPractice() && !isFreePractice();
  const hints = currentActivity().hints || [];
  if (open && canHelp) {
    state.hintLevel = Math.min(hints.length, state.hintLevel + 1);
    renderHints();
  }
  elements.helpCard.classList.toggle("open", Boolean(open && canHelp));
  elements.helpCard.setAttribute("aria-hidden", String(!(open && canHelp)));
  if (open) vimEngine?.clearEffects();
  elements.hintButton?.setAttribute("aria-expanded", String(Boolean(open && canHelp)));
  clearHintKeys();
  if (open && canHelp) {
    if (hints.length && state.hintLevel >= hints.length) showHintKeys();
    vibrate(5);
  }
  // The hint control receives browser focus on tap. Restore the practice
  // editor immediately so physical Vim input remains uninterrupted.
  if (canHelp) vimEngine?.focus();
}

export function processChoice(id) {
  const activity = currentActivity();
  if (activity.type !== "choice" || state.complete) return;
  state.choiceResult = id;
  if (id === activity.correctOptionId) completeActivity();
  else renderAll();
}

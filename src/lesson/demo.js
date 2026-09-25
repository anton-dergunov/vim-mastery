/* Demo playback: stepping, grouping typed text, going back, and autoplay.
 */

import { vibrate } from "../app/dom.js";
import { state } from "../app/context.js";
import { currentActivity, isDemo, scriptKeys } from "../app/activity.js";
import { resetActivity } from "../app/navigation.js";
import { renderActivityControls } from "../app/render.js";
import { activeCommandGroup, renderCommand } from "./console.js";
import { vimEngine } from "../editor/mount.js";
import { renderEditorMarks } from "../editor/readouts.js";

export function clearPlayback() {
  if (state.playbackTimer) window.clearTimeout(state.playbackTimer);
  state.playbackTimer = null;
  state.playbackMode = null;
}

function rawDemoStep() {
  if (!isDemo() || state.playbackStep >= scriptKeys().length || !vimEngine) return false;
  const activityId = currentActivity().id;
  const token = scriptKeys()[state.playbackStep];
  vimEngine.sendKey(token, { bypassLock: true, source: "demo" });
  state.playbackStep += 1;
  const renderedStep = state.playbackStep;
  const checkpoint = currentActivity().script.checkpoints?.find(item => item.afterStep === renderedStep);
  renderEditorMarks(checkpoint?.affectedRange || null);
  // CodeMirror positions its block cursor in its next measurement frame.
  // Defer the surrounding demo status by the same frame so a visible step
  // never advertises a new command while showing the previous cursor.
  requestAnimationFrame(() => {
    if (!isDemo() || currentActivity().id !== activityId || state.playbackStep !== renderedStep) return;
    renderCommand();
    renderActivityControls();
  });
  return state.playbackStep < scriptKeys().length;
}

function isGroupedTextToken(token) {
  return token === " " || token.length === 1;
}

export function stepDemo() {
  if (!isDemo() || state.playbackStep >= scriptKeys().length || !vimEngine) return false;
  const start = state.playbackStep;
  const startingMode = state.editorSnapshot?.mode;
  state.playbackStops.push(start);
  rawDemoStep();
  if (startingMode !== "insert" && startingMode !== "replace") {
    return state.playbackStep < scriptKeys().length;
  }
  const activity = currentActivity();
  const group = activeCommandGroup(activity, start);
  if (activity.script.checkpoints?.some(item => item.afterStep === state.playbackStep)
    || (group && state.playbackStep >= group.to)
    || state.editorSnapshot?.mode !== startingMode) {
    return state.playbackStep < scriptKeys(activity).length;
  }
  while (state.playbackStep < scriptKeys(activity).length) {
    const nextToken = scriptKeys(activity)[state.playbackStep];
    if (!isGroupedTextToken(nextToken)) break;
    if (state.editorSnapshot?.mode !== startingMode) break;
    if (group && state.playbackStep >= group.to) break;
    rawDemoStep();
    if (activity.script.checkpoints?.some(item => item.afterStep === state.playbackStep)) break;
  }
  return state.playbackStep < scriptKeys(activity).length;
}

export function backDemo() {
  if (!isDemo() || state.playbackTimer || state.playbackStep === 0) return;
  const remainingStops = state.playbackStops.slice(0, -1);
  const target = state.playbackStops.at(-1) ?? Math.max(0, state.playbackStep - 1);
  resetActivity({ vibrateReset: false });
  state.playbackStops = remainingStops;
  while (state.playbackStep < target) rawDemoStep();
  const checkpoint = currentActivity().script.checkpoints?.find(item => item.afterStep === target);
  renderEditorMarks(checkpoint?.affectedRange || null);
  renderCommand();
  renderActivityControls();
  vibrate(5);
}

export function playDemo(interval) {
  if (!isDemo() || state.playbackTimer) return;
  state.playbackMode = interval === 850 ? "slow" : "normal";
  const tick = () => {
    if (!stepDemo()) {
      clearPlayback();
      renderActivityControls();
      return;
    }
    const checkpoint = currentActivity().script.checkpoints?.find(item => item.afterStep === state.playbackStep);
    const demonstratesIntermediateMode = checkpoint?.mode && checkpoint.mode !== "normal";
    const delay = demonstratesIntermediateMode ? Math.max(interval, 1200) : interval;
    state.playbackTimer = window.setTimeout(tick, delay);
    renderActivityControls();
  };
  tick();
}

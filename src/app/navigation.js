/* Moving between activities and units, and the actions lesson buttons trigger.
 */

import { findNextSequentialUnit } from "./unit-navigation.js";
import { vibrate } from "./dom.js";
import { activities, elements, persistSession, state, unit, units } from "./context.js";
import { currentActivity, isMasterySession, isPractice, practicePolicyValues } from "./activity.js";
import { renderActivityControls, renderAll } from "./render.js";
import { backDemo, clearPlayback, playDemo, stepDemo } from "../lesson/demo.js";
import { clearPracticeError, setHelp } from "../lesson/practice.js";
import { storyTransitions } from "../dialogs/story.js";
import { openTableOfContents } from "../dialogs/contents.js";
import { exitFreePractice } from "../surfaces/free-practice.js";
import {
  advanceMasteryQueue,
  exitMasterySession,
  openMastery,
  recordActivityCompletion,
} from "../surfaces/mastery.js";

export function nextSequentialUnit() {
  return findNextSequentialUnit(units, unit);
}

export function resetActivity({ vibrateReset = true } = {}) {
  clearPlayback();
  state.progress = 0;
  state.history = [];
  state.rejectedKeys = [];
  state.modifiers.clear();
  state.physicalShift = false;
  state.complete = false;
  state.choiceResult = null;
  state.playbackStep = 0;
  state.editorSnapshot = null;
  state.semanticEffects = [];
  state.playbackStops = [];
  state.exploreTargetReached = false;
  state.hintLevel = 0;
  clearPracticeError();
  setHelp(false);
  renderAll();
  if (vibrateReset) vibrate(9);
}

export function goToActivity(index, { preserveRemediation = false } = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= activities.length) throw new RangeError("Invalid activity index");
  elements.tocDialog?.close();
  if (!preserveRemediation) state.remediationReturnId = null;
  state.practicePolicyOverride = null;
  state.freePractice = null;
  state.masterySession = null;
  delete elements.phone.dataset.surface;
  state.activityIndex = index;
  resetActivity({ vibrateReset: false });
  persistSession();
}

export function navigateToUnit(unitId) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("unit", unitId);
  nextUrl.searchParams.delete("activity");
  window.location.assign(nextUrl);
}

export function nextActivity() {
  if (isPractice() && !state.complete) return;
  if (currentActivity().type === "choice" && !state.complete) return;
  // Theory, demos and summaries have no success event of their own, so leaving
  // one is the only evidence it was read. Exercises and choices record on
  // completion instead; see completeActivity.
  if (["theory", "demo", "summary"].includes(currentActivity().type)) recordActivityCompletion();
  // A drill must never reach the unit boundary below it: finishing the last
  // activity of a unit inside a drill would fire that unit's ending story.
  if (isMasterySession()) {
    advanceMasteryQueue();
    return;
  }
  if (state.activityIndex === activities.length - 1) {
    if (unit.surface === "mastery") {
      void openMastery();
      return;
    }
    const nextUnit = nextSequentialUnit();
    if (storyTransitions.showUnitAtBoundary(unit.id, nextUnit?.id || null)) return;
    if (nextUnit) navigateToUnit(nextUnit.id);
    else openTableOfContents();
    return;
  }
  goToActivity(state.activityIndex + 1);
}

function previousActivity() {
  if (state.activityIndex > 0) goToActivity(state.activityIndex - 1);
}

export function goToActivityId(id, options) {
  const index = activities.findIndex(activity => activity.id === id || activity.sourceActivityId === id);
  if (index >= 0) goToActivity(index, options);
}

export function goToRemediation(id) {
  state.remediationReturnId = currentActivity().id;
  goToActivityId(id, { preserveRemediation: true });
}

function returnFromRemediation() {
  const returnId = state.remediationReturnId;
  if (!returnId) return;
  state.remediationReturnId = null;
  goToActivityId(returnId);
}

export function handleActivityAction(action) {
  if (!action) return;
  if (action === "reset") resetActivity();
  if (action === "step") stepDemo();
  if (action === "back") backDemo();
  if (action === "play") playDemo(420);
  if (action === "slow") playDemo(850);
  if (action === "pause") { clearPlayback(); renderActivityControls(); }
  if (action === "play-toggle") {
    if (state.playbackTimer) {
      clearPlayback();
      renderActivityControls();
    } else {
      playDemo(850);
    }
  }
  if (action === "next") nextActivity();
  if (action === "previous") previousActivity();
  if (action === "return-remediation") returnFromRemediation();
  if (action === "open-toc") openTableOfContents();
  if (action === "explore") {
    state.practicePolicyOverride = practicePolicyValues.explore;
    resetActivity({ vibrateReset: false });
    persistSession();
  }
  if (action === "exit-explore") {
    state.practicePolicyOverride = null;
    resetActivity({ vibrateReset: false });
    persistSession();
  }
}

export function leaveCurrentSurface() {
  if (isMasterySession()) exitMasterySession();
  else exitFreePractice();
}

/* Questions about the activity on screen: which one it is, what kind it is,
 * and which practice policy applies to it.
 */

import { activities, languageNames, state } from "./context.js";

export const practicePolicyValues = Object.freeze({
  guided: "guided-sequence",
  recall: "recall-sequence",
  explore: "explore",
  free: "free",
});

export function currentActivity() {
  // Mastery wins over free practice so the two surfaces can never overlap, and
  // both win over the lesson position, which stays exactly where it was.
  return masteryActivity() || state.freePractice?.activity || activities[state.activityIndex];
}

function masteryActivity() {
  const session = state.masterySession;
  return session ? session.queue[session.index] || null : null;
}

export function isRunnable(activity = currentActivity()) {
  return activity?.type === "demo" || activity?.type === "exercise";
}

export function hasEditor(activity = currentActivity()) {
  return isRunnable(activity) || Boolean(activity?.inspection);
}

export function initialStateFor(activity = currentActivity()) {
  return activity?.scenario?.initial || activity?.inspection?.initial || null;
}

export function plannedEditorRows(activity = currentActivity()) {
  const requiredRows = activity?.editor?.requiredRows;
  const viewportRows = activity?.editor?.viewportRows;
  if (requiredRows !== undefined) {
    if (!Number.isInteger(requiredRows) || requiredRows < 1 || requiredRows > 12) {
      throw new RangeError("requiredRows must be an integer from 1 to 12");
    }
    if (viewportRows !== undefined) throw new RangeError("requiredRows cannot be combined with viewportRows");
  }
  const authoredLineCounts = [
    activity?.scenario?.initial?.lines?.length,
    activity?.scenario?.target?.lines?.length,
    ...(activity?.script?.checkpoints || []).map(checkpoint => checkpoint.lines?.length),
    requiredRows,
  ].filter(Number.isInteger);
  return Math.max(1, ...authoredLineCounts);
}

export function isPractice(activity = currentActivity()) {
  return activity?.type === "exercise";
}

export function isDemo(activity = currentActivity()) {
  return activity?.type === "demo";
}

export function isFreePractice() {
  return state.freePractice !== null;
}

export function freePracticeSample() {
  return state.freePractice?.sample || null;
}

export function isMasterySession() {
  return state.masterySession !== null;
}

/**
 * One name for "which surface is on screen". The header, the leave controls and
 * the exported state all used to branch on a single free-practice boolean; a
 * second boolean beside it would make each of those unreadable.
 */
export function surfaceKind() {
  if (isMasterySession()) return "mastery";
  if (isFreePractice()) return "free-practice";
  return "lesson";
}

export function basePracticePolicy(activity = currentActivity()) {
  return activity?.practiceMode === "recall" ? practicePolicyValues.recall : practicePolicyValues.guided;
}

export function practicePolicy(activity = currentActivity()) {
  if (!isPractice(activity)) return null;
  if (isFreePractice() && activity === currentActivity()) return practicePolicyValues.free;
  if (activity === currentActivity() && state.practicePolicyOverride === practicePolicyValues.explore) {
    return practicePolicyValues.explore;
  }
  return basePracticePolicy(activity);
}

export function isExplore(activity = currentActivity()) {
  return practicePolicy(activity) === practicePolicyValues.explore;
}

export function scriptKeys(activity = currentActivity()) {
  return activity.script.steps.map(step => typeof step === "string" ? step : step.key);
}

export function languageLabel(activity) {
  return languageNames.get(activity.languageId) || activity.languageId;
}

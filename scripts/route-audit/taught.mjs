/* Taught: loads the course in the order a learner meets it and works out, for
 * each exercise, which commands the course has shown by then.
 *
 * Order is unit number, then lesson order, then the runtime flow inside a
 * lesson (`activityFlowFor` in src/app/context.js): demos first, then guided
 * exercises in authored order, then recall-only ones. What an exercise may use
 * is every command used in a demo or exercise before it, plus its own
 * canonical commands. Setup keys are hidden from the learner, so they teach
 * nothing.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { atomsOf } from "./grammar.mjs";

export const keyOf = step => (typeof step === "string" ? step : step.key);
export const keysOf = activity => activity.script.steps.map(keyOf);

export function loadCourse(root) {
  const index = JSON.parse(readFileSync(resolve(root, "content/unit-index.json"), "utf8"));
  return [...index.units]
    .sort((left, right) => left.unitNumber - right.unitNumber)
    .map(entry => ({ ...JSON.parse(readFileSync(resolve(root, entry.path), "utf8")), unitNumber: entry.unitNumber, path: entry.path }));
}

// Every demo and exercise in the order the learner meets it.
export function orderedRunnables(units) {
  const ordered = [];
  for (const unit of units) {
    for (const lesson of unit.lessons || []) {
      const demos = lesson.activities.filter(activity => activity.type === "demo");
      const exercises = lesson.activities.filter(activity => activity.type === "exercise");
      const guided = exercises.filter(activity => activity.delivery !== "recall");
      const recallOnly = exercises.filter(activity => activity.delivery === "recall");
      for (const activity of [...demos, ...guided, ...recallOnly]) {
        ordered.push({ unit, lesson, activity });
      }
    }
  }
  return ordered;
}

/**
 * Given parsed traces keyed by activity id, return for each exercise the atoms
 * it may use, and for each atom the activity that first used it.
 */
export function buildTaughtIndex(ordered, parsedById) {
  const seen = new Set();
  const firstUse = new Map();
  const allowed = new Map();
  for (const { unit, activity } of ordered) {
    const parsed = parsedById.get(activity.id);
    const own = parsed ? atomsOf(parsed) : new Set();
    if (activity.type === "exercise") allowed.set(activity.id, new Set([...seen, ...own]));
    for (const atom of own) {
      if (!seen.has(atom)) firstUse.set(atom, { activityId: activity.id, unitNumber: unit.unitNumber });
      seen.add(atom);
    }
  }
  return { allowed, firstUse };
}

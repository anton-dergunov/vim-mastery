import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const unitDirectory = new URL("../content/units/", import.meta.url);
const units = readdirSync(unitDirectory)
  .filter(file => /^\d{2}-.*\.json$/.test(file))
  .sort()
  .map(file => JSON.parse(readFileSync(new URL(file, unitDirectory), "utf8")));
const runnable = units.flatMap(unit => unit.lessons)
  .flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");
const keysOf = activity => activity.script.steps.map(step => typeof step === "string" ? step : step.key);

test("every canonical script resolves to contiguous action-sized guidance", () => {
  for (const activity of runnable) {
    const keys = keysOf(activity);
    const groups = activity.script.commandGroups;
    let next = 0;
    for (const group of groups) {
      assert.equal(group.from, next, `${activity.id} action guidance must be contiguous`);
      assert(group.to > group.from && group.to <= keys.length, `${activity.id} has an invalid action range`);
      assert(group.explanation.trim(), `${activity.id} has an empty action explanation`);
      assert.notEqual(group.explanation, "Perform the next Vim action in the sequence.", `${activity.id} needs specific action guidance`);
      next = group.to;
    }
    assert.equal(next, keys.length, `${activity.id} action guidance must cover every key`);
  }
});

test("Visual Line practice describes selection, extension, and deletion separately", () => {
  const activity = units.flatMap(unit => unit.lessons)
    .flatMap(lesson => lesson.activities)
    .find(item => item.id === "select-line-range");

  assert.deepEqual(activity.script.commandGroups, [
    { from: 0, to: 1, display: "V", explanation: "Switch to Visual Line mode." },
    { from: 1, to: 2, display: "j", explanation: "Move one line down to extend the selection." },
    { from: 2, to: 3, display: "d", explanation: "Delete the selected lines." },
  ]);
});

test("text entry and Ex commands expose their meaningful phases", () => {
  const activities = units.flatMap(unit => unit.lessons).flatMap(lesson => lesson.activities);
  const insert = activities.find(item => item.id === "insert-missing-digit");
  assert.deepEqual(insert.script.commandGroups.map(group => group.explanation), [
    "Enter Insert mode before the cursor.",
    "Type the requested text.",
    "Return to Normal mode.",
  ]);

  const substitute = activities.find(item => item.id === "replace-all-todos");
  assert.deepEqual(substitute.script.commandGroups.map(group => group.explanation), [
    "Open Vim's command line.",
    "Address the whole buffer and start a substitution.",
    "Set `TODO` as the search pattern.",
    "Set `DONE` as the replacement.",
    "Set how the substitution should handle its matches.",
    "Run the command.",
  ]);
});

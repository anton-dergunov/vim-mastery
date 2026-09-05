import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { runNativeVim } from "./native-vim-runner.mjs";

const rootPath = new URL("../", import.meta.url).pathname;
const contentPath = join(rootPath, "content");
const readJson = name => JSON.parse(readFileSync(join(contentPath, name), "utf8"));

const catalog = readJson("field-notes.json");
const schema = readJson("field-notes.schema.json");
const languageProfiles = readJson("language-profiles.json");
const profileIds = new Set(languageProfiles.profiles.map(profile => profile.id));

const unitsPath = join(contentPath, "units");
const unitActivityIds = new Set(
  readdirSync(unitsPath)
    .filter(name => /^\d{2}-.*\.json$/.test(name))
    .flatMap(name => JSON.parse(readFileSync(join(unitsPath, name), "utf8")).lessons)
    .flatMap(lesson => lesson.activities)
    .map(activity => activity.id),
);

const activities = catalog.notes.flatMap(note => note.activities);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test("the field note schema keeps its published shape", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$id, "https://vimwilds.local/schemas/field-notes.schema.json");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.schemaVersion, { const: 1 });
  assert.deepEqual(schema.$defs.note.required, ["id", "title", "kicker", "summary", "limitation", "activities"]);
  // Only the three types that need no multi-file editor. Adding `exercise`
  // here would be a promise the app cannot keep.
  assert.deepEqual(
    schema.$defs.note.properties.activities.items.oneOf.map(entry => entry.$ref),
    ["#/$defs/theory", "#/$defs/demo", "#/$defs/choice"],
  );
  assert.equal(catalog.schemaVersion, 1);
  assert.match(catalog.contentVersion, /^field-notes-\d{4}-\d{2}-\d{2}$/);
});

test("the brief's five notes all exist", () => {
  assert.deepEqual(catalog.notes.map(note => note.id), [
    "argument-list-and-argdo",
    "buffers-and-bufdo",
    "quickfix-as-a-work-list",
    "non-interactive-vim",
    "when-to-leave-vim",
  ]);
});

test("every note states its own limitation", () => {
  // The honesty requirement, mechanized. These are briefings, and a learner
  // who mistakes them for practice will believe they have drilled something
  // they have only read about.
  for (const note of catalog.notes) {
    assert(note.limitation.trim().length > 80, `${note.id} limitation is too thin to be honest`);
    assert(note.limitation.length <= 320, `${note.id} limitation is too long to read on a phone`);
    assert(note.summary.length <= 120);
  }
});

test("field note ids never collide with the curriculum", () => {
  // The mastery runtime queues these objects through the same renderers as
  // real activities, and progress is keyed by activity id. A collision would
  // silently credit a curriculum concept for reading a briefing.
  assert.equal(unitActivityIds.size, 818);
  const ids = [...catalog.notes.map(note => note.id), ...activities.map(activity => activity.id)];
  assert.equal(new Set(ids).size, ids.length, "field note ids collide with each other");
  for (const id of ids) {
    assert.match(id, idPattern);
    assert(!unitActivityIds.has(id), `${id} is already a curriculum activity id`);
  }
});

test("no field note can navigate into the curriculum", () => {
  // Every one of these fields resolves through goToActivity, which moves the
  // saved lesson position. A field note that carried one would let a briefing
  // rewrite where the learner had got to.
  for (const activity of activities) {
    for (const field of ["routes", "remediationRef", "demoRef", "activityRef"]) {
      assert.equal(activity[field], undefined, `${activity.id} carries ${field}`);
    }
  }
});

test("theory bodies stay inside the measured curriculum range", () => {
  // The longest theory body the product ships is 555 characters. A field note
  // is not a licence to write a wall of text onto a 360px board.
  for (const activity of activities.filter(item => item.type === "theory")) {
    assert(activity.body.length <= 560, `${activity.id} body is ${activity.body.length} characters`);
    assert.equal(activity.phase, "explain");
  }
});

test("every choice is answerable and explains itself", () => {
  const choices = activities.filter(activity => activity.type === "choice");
  assert.equal(choices.length, 5, "each note closes on a question");
  for (const choice of choices) {
    assert.equal(choice.phase, "challenge");
    assert(choice.options.length >= 2);
    const optionIds = choice.options.map(option => option.id);
    assert.equal(new Set(optionIds).size, optionIds.length, `${choice.id} repeats an option id`);
    assert(optionIds.includes(choice.correctOptionId), `${choice.id} has no correct option`);
    assert(choice.explanation.length > 120, `${choice.id} explanation does not earn the wrong answers`);
  }
});

test("instructions describe the outcome rather than the keystrokes", () => {
  // The same rule the curriculum is held to in content-data.test.mjs.
  for (const activity of activities.filter(item => item.type === "demo")) {
    assert(!/^(?:use|press|type|execute|run)\b/i.test(activity.instruction), `${activity.id} starts with a recipe`);
    assert(profileIds.has(activity.languageId), `${activity.id} uses unknown language ${activity.languageId}`);
    assert.equal(activity.hints.length, 0, "a demo is watched, not hinted");
  }
});

test("a demo runs the payload of a driver it cannot execute", () => {
  // The adapter has no :argdo, :bufdo, :cdo or quickfix at all, so a demo of
  // the driver itself could never pass conformance. What these demos run is
  // the per-file command the driver repeats, and `payloadOf` records which
  // driver that is so the claim stays checkable.
  const demos = activities.filter(activity => activity.type === "demo");
  assert.equal(demos.length, 2);
  for (const demo of demos) {
    assert.match(demo.provenance.payloadOf, /^:(argdo|bufdo|cdo|cfdo)\s/);
    assert.equal(demo.provenance.nativeValidation, "passed");
    assert.equal(demo.provenance.browserConformance, "passed");
    for (const step of demo.script.steps) {
      assert(!/argdo|bufdo|cdo|cfdo|copen|cnext/.test(step), `${demo.id} tries to run a driver command`);
    }
  }
});

test("demo scripts are contiguous, complete and checkpointed", () => {
  for (const demo of activities.filter(activity => activity.type === "demo")) {
    const keys = demo.script.steps;
    let next = 0;
    for (const group of demo.script.commandGroups) {
      assert.equal(group.from, next, `${demo.id} command groups must be contiguous`);
      assert(group.to > group.from && group.to <= keys.length, `${demo.id} group ${group.display} is out of range`);
      assert(group.explanation.trim(), `${demo.id} group ${group.display} has an empty explanation`);
      assert.notEqual(group.explanation, "Perform the next Vim action in the sequence.", `${demo.id} needs specific action guidance`);
      next = group.to;
    }
    assert.equal(next, keys.length, `${demo.id} command groups must cover every key`);
    const final = demo.script.checkpoints.at(-1);
    assert.equal(final.afterStep, keys.length, `${demo.id} needs a final checkpoint at its last key`);
    assert.deepEqual(final.lines, demo.scenario.target.lines);
    assert.deepEqual(final.cursor, demo.scenario.target.cursor);
    assert.equal(final.mode, demo.scenario.target.mode);
    assert(demo.scenario.initial.lines.length <= 7, `${demo.id} shows more than seven rows`);
  }
});

for (const demo of activities.filter(activity => activity.type === "demo")) {
  test(`native Vim reproduces ${demo.id}`, () => {
    const result = runNativeVim({
      initialCode: demo.scenario.initial.lines,
      cursor: demo.scenario.initial.cursor,
      keys: demo.script.steps,
    });
    assert.deepEqual(result.code, demo.scenario.target.lines);
    assert.deepEqual(result.cursor, demo.scenario.target.cursor);
    assert.equal(result.mode, demo.scenario.target.mode);
  });
}

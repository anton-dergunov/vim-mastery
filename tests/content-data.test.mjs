import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { findNextSequentialUnit } from "../unit-navigation.js";
import { runNativeVim } from "./native-vim-runner.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const unit = readJson("../content/units/10-repeatable-editing.json");
const unitDirectory = new URL("../content/units/", import.meta.url);
const unitFiles = readdirSync(unitDirectory).filter(file => /^\d{2}-.*\.json$/.test(file)).sort();
const units = unitFiles.map(file => ({ file, data: JSON.parse(readFileSync(new URL(file, unitDirectory), "utf8")) }));
const modalUnit = units.find(item => item.data.id === "modal-model").data;
const cursorUnit = units.find(item => item.data.id === "cursor-movement").data;
const changingUnit = units.find(item => item.data.id === "entering-changing-text").data;
const operatorUnit = units.find(item => item.data.id === "operator-grammar").data;
const precisionUnit = units.find(item => item.data.id === "precision-motions-search").data;
const textObjectUnit = units.find(item => item.data.id === "text-objects").data;
const visualUnit = units.find(item => item.data.id === "visual-selection").data;
const registerUnit = units.find(item => item.data.id === "registers-putting").data;
const unitCatalog = readJson("../content/unit-index.json");
const registry = readJson("../content/language-profiles.json");
const schema = readJson("../content/unit-content.schema.json");
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const activities = unit.lessons.flatMap(lesson => lesson.activities);
const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
const activityById = new Map(activities.map(activity => [activity.id, activity]));
const profileById = new Map(registry.profiles.map(profile => [profile.id, profile]));
const keysOf = activity => activity.script.steps.map(step => typeof step === "string" ? step : step.key);

test("content files expose the expected schema versions", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(unit.schemaVersion, 1);
  assert.equal(unit.unitNumber, 10);
  assert.equal(cursorUnit.schemaVersion, 1);
  assert.equal(cursorUnit.unitNumber, 2);
  assert.equal(operatorUnit.schemaVersion, 1);
  assert.equal(operatorUnit.unitNumber, 4);
  assert.equal(registry.schemaVersion, 1);
  assert.equal(unit.releaseStatus, "authoring");
  assert.deepEqual(unit.playback, {
    modes: ["normal", "slow", "manual"],
    manualStep: "one-input-key",
    reset: "initial-state",
    backwardStep: "deferred",
  });
});

test("numbered unit catalog is ordered and internally linked", () => {
  assert.deepEqual(units.map(item => item.data.unitNumber), [1, 2, 3, 4, 5, 6, 7, 8, 10]);
  for (const { file, data } of units) {
    assert.equal(Number(file.slice(0, 2)), data.unitNumber, `${file} disagrees with unitNumber`);
    const allActivities = data.lessons.flatMap(lesson => lesson.activities);
    const ids = new Set();
    for (const lesson of data.lessons) {
      assert(!ids.has(lesson.id), `${data.id} duplicates ${lesson.id}`);
      ids.add(lesson.id);
      for (const activity of lesson.activities) {
        assert(!ids.has(activity.id), `${data.id} duplicates ${activity.id}`);
        ids.add(activity.id);
      }
    }
    const activityIds = new Set(allActivities.map(activity => activity.id));
    for (const activity of allActivities) {
      for (const route of activity.routes || []) assert(activityIds.has(route.activityRef), `${activity.id} routes to missing ${route.activityRef}`);
      if (activity.remediationRef) assert(activityIds.has(activity.remediationRef), `${activity.id} remediates to missing ${activity.remediationRef}`);
      if (activity.scenario?.initial.setup) {
        assert.notEqual(activity.scenario.initial.mode, "normal", `${activity.id} should not seed an unnecessary Normal state`);
      }
    }
    for (const coverage of data.coverage) {
      for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
        assert(coverage[phase].length, `${data.id} ${coverage.concept} lacks ${phase}`);
        for (const ref of coverage[phase]) assert(activityIds.has(ref), `${coverage.concept} references missing ${ref}`);
      }
    }
  }
});

test("unit continuation requires the immediately following unit", () => {
  const current = { unitNumber: 1 };
  assert.equal(findNextSequentialUnit(units.map(item => item.data), current), cursorUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), cursorUnit), changingUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), changingUnit), operatorUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), operatorUnit), precisionUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), precisionUnit), textObjectUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), textObjectUnit), visualUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), visualUnit), registerUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), registerUnit), null, "Unit 8 must not skip to Unit 10");
});

test("unit catalog groups implemented units into curriculum arcs", () => {
  assert.equal(unitCatalog.schemaVersion, 2);
  assert.deepEqual(unitCatalog.arcs, [
    { id: "foundations", arcNumber: 1, title: "Foundations", unitNumbers: [1, 2, 3, 4, 5, 6] },
    { id: "fluency-tracks", arcNumber: 2, title: "Fluency tracks", unitNumbers: [7, 8, 9, 10] },
  ]);
  assert.deepEqual(unitCatalog.units.map(item => item.unitNumber), [1, 2, 3, 4, 5, 6, 7, 8, 10]);
  const assigned = unitCatalog.units.map(item => unitCatalog.arcs.filter(arc => arc.unitNumbers.includes(item.unitNumber)).length);
  assert(assigned.every(count => count === 1), "each implemented unit must belong to exactly one arc");
});

test("Unit 7 curriculum definition is preserved verbatim", () => {
  assert.deepEqual(visualUnit.curriculumDefinition, {
    unit: "7. Visual selection",
    commandsAndConcepts: "`v`, `V`, `Ctrl-v`; `o`, `O`; `gv`; selection operations `d c y x r ~ u U > < = gq`; Visual Block `I A c d x r`",
    prerequisites: "Units 1–6",
    learningOutcome: "Select character, line, and rectangular ranges; modify them; and decide when selection is clearer than operator-motion",
    representativeExercises: "Indent lines; replace a column marker; prepend text to several rows; reselect and correct the last selection",
    priorityAndPortability: "Core. `Ctrl-v` is semantically important even when a host reserves that chord; the app teaches Vim behavior",
  });
  assert.deepEqual(visualUnit.prerequisiteSkillIds, ["modal-model", "cursor-movement", "entering-changing-text", "operator-grammar", "precision-motions-search", "text-objects"]);
  assert.equal(visualUnit.lessons.length, 9);
});

test("Unit 8 preserves the focused registers-and-putting curriculum", () => {
  assert.deepEqual(registerUnit.curriculumDefinition, {
    unit: "8. Registers and putting",
    commandsAndConcepts: "Unnamed `\"\"`; yank `\"0`; numbered `\"1`–`\"9`; named `\"a`–`\"z`; append with `\"A`–`\"Z`; black-hole `\"_`; small delete `\"-`; clipboard `\"+`; `p P gp gP`; `:registers` as inspection",
    prerequisites: "Units 1–6, especially `y d c p`",
    learningOutcome: "Preserve yanks, select storage deliberately, reuse multiple snippets, and understand why delete/change affects later puts",
    representativeExercises: "Delete without overwriting a yank; paste the previous yank after another edit; collect lines into a named register; choose where to put text and where the cursor should land",
    priorityAndPortability: "Core through named and black-hole registers. The useful but host-dependent `\"+` clipboard is emulated inside each Vim Wilds exercise and never touches the device clipboard",
  });
  assert.deepEqual(registerUnit.prerequisiteSkillIds, ["modal-model", "cursor-movement", "entering-changing-text", "operator-grammar", "precision-motions-search", "text-objects"]);
  assert.equal(registerUnit.lessons.length, 9);
  assert.equal(registerUnit.lessons.flatMap(lesson => lesson.activities).filter(activity => activity.type === "demo" || activity.type === "exercise").length, 36);
  assert.deepEqual(registerUnit.coverage.map(item => item.concept), [
    "unnamed register",
    "p P gp gP",
    "yank register zero",
    "numbered registers",
    "small-delete register",
    "black-hole register",
    "named registers",
    "uppercase register append",
    "emulated plus register and inspection",
    "integrated register choice",
  ]);
  assert(!registerUnit.curriculumDefinition.commandsAndConcepts.includes('"*'));
  assert(!registerUnit.curriculumDefinition.commandsAndConcepts.includes('"='));
  const languageCounts = new Map();
  for (const activity of registerUnit.lessons.flatMap(lesson => lesson.activities).filter(activity => activity.type === "demo" || activity.type === "exercise")) {
    languageCounts.set(activity.languageId, (languageCounts.get(activity.languageId) || 0) + 1);
  }
  assert(languageCounts.size >= 10, "Unit 8 should use a broad language and text-format mix");
  assert((languageCounts.get("python") || 0) >= 3, "Unit 8 should include regular Python practice");
});

test("Unit 1 curriculum definition is preserved verbatim", () => {
  assert.deepEqual(modalUnit.curriculumDefinition, {
    unit: "1. The modal model",
    commandsAndConcepts: "Normal, Insert, Replace, Operator-pending, Visual Character, Visual Line, Visual Block, Command-line; `Esc`, `Ctrl-[`; cancellation; cursor semantics; `count + operator + motion/text object`",
    prerequisites: "None",
    learningOutcome: "Identify the active mode, return safely to Normal mode, and read a composed command as a sentence",
    representativeExercises: "Leave Insert mode; cancel a partial operator; predict the range of `2dw`; distinguish a motion from an edit",
    priorityAndPortability: "Core. Hosts may reserve `Ctrl-[`, so `Esc` remains the primary mobile legend",
  });
  assert.equal(modalUnit.lessons.length, 5);
  assert(modalUnit.lessons.flatMap(lesson => lesson.activities).length >= 30);
});

test("Unit 10 curriculum definition is preserved verbatim", () => {
  assert.deepEqual(unit.curriculumDefinition, {
    unit: "10. Repeatable editing",
    commandsAndConcepts: "Deliberate `.`, `;`/`,` plus `.`, `n`/`N` plus `.`, `@:`, `&`, `:~`; count vs repeat; repeat-friendly cursor placement",
    prerequisites: "Units 1–6; Unit 8 recommended",
    learningOutcome: "Design one change that can be replayed across nearby or searched instances, and recognize when repeat is the wrong tool",
    representativeExercises: "Change one field and repeat on later rows; search for a token and apply the same edit; compare `3dd` with repeated `dd`; rerun a recent Ex change",
    priorityAndPortability: "Core. `@:`, `&`, and `:~` bridge into Arc 3 and appear only after basic Command-line use",
  });
});

test("Unit 2 curriculum definition is preserved verbatim", () => {
  assert.deepEqual(cursorUnit.curriculumDefinition, {
    unit: "2. Cursor movement",
    commandsAndConcepts: "`h j k l`; counts; `0`, `^`, `$`, `g_`, `|`; `w W e E b B ge gE`; `gg`, `G`; `gj`, `gk`",
    prerequisites: "Unit 1",
    learningOutcome: "Reach characters, words, line boundaries, and buffer boundaries without editing",
    representativeExercises: "Move to an identifier, last nonblank character, next WORD, or requested line; compare logical and wrapped display lines",
    priorityAndPortability: "Core. `gj/gk` behavior depends on wrapping, but the distinction is portable",
  });
  assert.deepEqual(cursorUnit.prerequisiteSkillIds, ["modal-model"]);
  assert.equal(cursorUnit.releaseStatus, "authoring");
});

test("Unit 2 covers every movement family with cursor-only runnable states", () => {
  const expectedConcepts = [
    "h j k l and counts",
    "0 ^ $ g_ and count|",
    "w and W",
    "e E b B ge gE",
    "gg G and counted G",
    "j k versus gj gk",
    "integrated cursor movement",
  ];
  assert.deepEqual(cursorUnit.coverage.map(item => item.concept), expectedConcepts);
  const cursorActivities = cursorUnit.lessons.flatMap(lesson => lesson.activities);
  const cursorRunnable = cursorActivities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert(cursorRunnable.length >= 25);
  for (const activity of cursorRunnable) {
    assert.deepEqual(activity.scenario.target.lines, activity.scenario.initial.lines, `${activity.id} must not edit text`);
    assert(activity.scenario.target.cursor, `${activity.id} needs an exact target cursor`);
    const finalCheckpoint = activity.script.checkpoints.at(-1);
    assert.deepEqual(finalCheckpoint.lines, activity.scenario.target.lines, `${activity.id} final checkpoint needs target lines`);
    assert.deepEqual(finalCheckpoint.cursor, activity.scenario.target.cursor, `${activity.id} final checkpoint needs target cursor`);
    assert.equal(activity.provenance.nativeValidation, "passed");
    assert.equal(activity.provenance.browserConformance, "passed");
  }
  const wrapped = cursorRunnable.filter(activity => activity.editor?.wrapColumns);
  assert.equal(wrapped.length, 4);
  assert(wrapped.every(activity => activity.editor.wrapColumns === 24));
  const visibleWhitespace = cursorRunnable.filter(activity => activity.editor?.visualizeWhitespace);
  assert.deepEqual(visibleWhitespace.map(activity => activity.id), [
    "line-landmarks-demo",
    "last-nonblank-result",
    "indented-yaml-edges",
    "counted-last-nonblank-column",
  ]);
});

test("Unit 3 preserves the curriculum and covers every local-change family", () => {
  assert.deepEqual(changingUnit.curriculumDefinition, {
    unit: "3. Entering and changing text",
    commandsAndConcepts: "`i I a A o O`; `x X`; `r R`; `s S`; `J gJ`; `u`, `Ctrl-r`; `~`, `g~`, `gu`, `gU`; `Ctrl-a`, `Ctrl-x`",
    prerequisites: "Units 1–2",
    learningOutcome: "Choose a precise entry/change command, undo safely, and perform common local transformations",
    representativeExercises: "Append an argument; open a line; replace a delimiter; join a wrapped statement; change case; increment a version number",
    priorityAndPortability: "Core, with `R`, `gJ`, and numeric changes introduced after the everyday commands",
  });
  assert.deepEqual(changingUnit.prerequisiteSkillIds, ["modal-model", "cursor-movement"]);
  assert.equal(changingUnit.releaseStatus, "authoring");
  assert.equal(changingUnit.lessons.length, 9);
  assert.deepEqual(changingUnit.coverage.map(item => item.concept), [
    "i I a A", "o O", "x X r", "s S R", "u and Ctrl-r", "J and gJ",
    "~ g~ gu gU", "Ctrl-a and Ctrl-x", "integrated local changes",
  ]);
  const activities = changingUnit.lessons.flatMap(lesson => lesson.activities);
  const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert(runnable.length >= 30);
  assert.deepEqual(runnable.filter(activity => activity.editor?.visualizeWhitespace).map(activity => activity.id), [
    "join-spacing-demo", "join-preserve-spaces",
  ]);
  for (const activity of runnable) {
    assert.equal(activity.provenance.nativeValidation, "passed");
    assert.equal(activity.provenance.browserConformance, "passed");
    assert.equal(activity.provenance.reviewStatus, "draft");
    assert.equal(activity.script.checkpoints.at(-1).afterStep, keysOf(activity).length);
    assert.deepEqual(activity.script.checkpoints.at(-1).lines, activity.scenario.target.lines);
    assert.deepEqual(activity.script.checkpoints.at(-1).cursor, activity.scenario.target.cursor);
  }
});

test("Unit 4 preserves the curriculum and covers every operator family", () => {
  assert.deepEqual(operatorUnit.curriculumDefinition, {
    unit: "4. Operator grammar",
    commandsAndConcepts: "`d c y`; `dd cc yy`; `D C Y`; `p P`; counts before operators or motions; linewise vs characterwise ranges; `> < =`; `gq gw`; `.`",
    prerequisites: "Units 1–3",
    learningOutcome: "Compose operators with motions, predict the affected range, put text, and make a change deliberately repeatable",
    representativeExercises: "Delete two words; change to line end; duplicate a line; indent a block by motion; reflow a paragraph; repeat a prepared change",
    priorityAndPortability: "Core. Host formatting may affect `=` and `gq`, so exercises use deterministic app behavior",
  });
  assert.deepEqual(operatorUnit.prerequisiteSkillIds, ["modal-model", "cursor-movement", "entering-changing-text"]);
  assert.equal(operatorUnit.releaseStatus, "authoring");
  assert.equal(operatorUnit.lessons.length, 9);
  assert.deepEqual(operatorUnit.coverage.map(item => item.concept), [
    "d c y with motions", "dd cc yy D C Y", "p P and register shape", "operator and motion counts",
    "> and <", "= reindent", "gq and gw", "introductory dot repeat", "integrated operator grammar",
  ]);
  const activities = operatorUnit.lessons.flatMap(lesson => lesson.activities);
  const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert(runnable.length >= 35);
  assert.deepEqual(runnable.filter(activity => activity.editor?.textWidth).map(activity => activity.editor.textWidth), [40, 40, 40, 40]);
  assert.deepEqual(runnable.filter(activity => activity.editor?.visualizeWhitespace).map(activity => activity.id), [
    "shift-motion-demo", "shift-current-line",
  ]);
  for (const activity of runnable) {
    assert.equal(activity.provenance.nativeValidation, "passed");
    assert.equal(activity.provenance.browserConformance, "passed");
    assert.equal(activity.provenance.reviewStatus, "draft");
    assert.equal(activity.script.checkpoints.at(-1).afterStep, keysOf(activity).length);
    assert.deepEqual(activity.script.checkpoints.at(-1).lines, activity.scenario.target.lines);
    assert.deepEqual(activity.script.checkpoints.at(-1).cursor, activity.scenario.target.cursor);
  }
});

test("Unit 5 preserves the curriculum and covers every precision-search family", () => {
  assert.deepEqual(precisionUnit.curriculumDefinition, {
    unit: "5. Precision motions and search",
    commandsAndConcepts: "`f F t T ; ,`; `/ ? n N`; `* # g* g#`; `gn gN`; `%`; `(`, `)`, `{`, `}`",
    prerequisites: "Units 1–4",
    learningOutcome: "Select the smallest reliable motion for nearby punctuation, repeated text, matching delimiters, sentences, and paragraphs",
    representativeExercises: "Delete until a quote; repeat a comma find; change the next search match; jump between brackets; move by paragraphs in prose or comments",
    priorityAndPortability: "Core. Search and pair matching remain text-based rather than IDE-semantic",
  });
  assert.deepEqual(precisionUnit.prerequisiteSkillIds, ["modal-model", "cursor-movement", "entering-changing-text", "operator-grammar"]);
  assert.equal(precisionUnit.releaseStatus, "authoring");
  assert.equal(precisionUnit.lessons.length, 8);
  assert.deepEqual(precisionUnit.coverage.map(item => item.concept), [
    "f F t T", "; and ,", "/ ? n N", "* # g* g#", "gn and gN", "% matching delimiters",
    "( and ) sentence motions", "{ and } paragraph motions", "integrated precision motion and search",
  ]);
  const activities = precisionUnit.lessons.flatMap(lesson => lesson.activities);
  const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnable.length, 33);
  for (const activity of runnable) {
    assert(profileById.has(activity.languageId), `${activity.id} uses unknown language ${activity.languageId}`);
    assert.equal(activity.provenance.nativeValidation, "passed");
    assert.equal(activity.provenance.browserConformance, "passed");
    assert.equal(activity.provenance.reviewStatus, "draft");
    const keys = keysOf(activity);
    let next = 0;
    for (const group of activity.script.commandGroups) {
      assert.equal(group.from, next, `${activity.id} command groups must be contiguous`);
      assert(group.to > group.from && group.to <= keys.length, `${activity.id} has an invalid command group`);
      next = group.to;
    }
    assert.equal(next, keys.length, `${activity.id} command groups must cover every key`);
    const finalCheckpoint = activity.script.checkpoints.at(-1);
    assert.equal(finalCheckpoint.afterStep, keys.length);
    assert.deepEqual(finalCheckpoint.lines, activity.scenario.target.lines);
    assert.deepEqual(finalCheckpoint.cursor, activity.scenario.target.cursor);
  }
  const selectionDemo = activities.find(activity => activity.id === "search-match-range-demo");
  assert.deepEqual(selectionDemo.script.checkpoints.filter(checkpoint => checkpoint.affectedRange).map(checkpoint => checkpoint.affectedRange), [
    { from: [0, 11], to: [0, 16] },
    { from: [0, 21], to: [0, 26] },
  ]);
});

test("Unit 6 preserves the curriculum and covers every text-object family", () => {
  assert.deepEqual(textObjectUnit.curriculumDefinition, {
    unit: "6. Text objects",
    commandsAndConcepts: "`iw aw iW aW`; `i\" a\"`, `i' a'`, ``i` a` ``; `i( a(`, `i) a)`, `ib ab`; `i[ a[`, `i] a]`; `i{ a{`, `i} a}`, `iB aB`; `i< a<`, `i> a>`; `is as`, `ip ap`, `it at`",
    prerequisites: "Units 1–5",
    learningOutcome: "Choose inside versus around and apply any learned operator to a structural object",
    representativeExercises: "Change a quoted value; delete function arguments; yank an object literal; uppercase a word; indent a paragraph; replace tag contents",
    priorityAndPortability: "Core. Tag and angle-bracket objects are exercised only where the buffer makes their boundaries unambiguous",
  });
  assert.deepEqual(textObjectUnit.prerequisiteSkillIds, [
    "modal-model", "cursor-movement", "entering-changing-text", "operator-grammar", "precision-motions-search",
  ]);
  assert.equal(textObjectUnit.releaseStatus, "authoring");
  assert.equal(textObjectUnit.lessons.length, 9);
  assert.deepEqual(textObjectUnit.coverage.map(item => item.concept), [
    "inside versus around and iw aw", "iW and aW", "quote text objects",
    "parenthesis objects and ib ab", "bracket and brace objects and iB aB",
    "angle-bracket objects", "sentence and paragraph objects", "tag objects", "integrated text objects",
  ]);
  const activities = textObjectUnit.lessons.flatMap(lesson => lesson.activities);
  const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnable.length, 47);
  const objectSpellings = new Set(runnable.map(activity => keysOf(activity).slice(1, 3).join("")));
  for (const spelling of [
    "iw", "aw", "iW", "aW", 'i"', 'a"', "i'", "a'", "i`", "a`",
    "i(", "a(", "i)", "a)", "ib", "ab", "i[", "a[", "i]", "a]",
    "i{", "a{", "i}", "a}", "iB", "aB", "i<", "a<", "i>", "a>",
    "is", "as", "ip", "ap", "it", "at",
  ]) assert(objectSpellings.has(spelling), `Unit 6 lacks executable ${spelling}`);
  assert.deepEqual(runnable.filter(activity => activity.editor?.visualizeWhitespace).map(activity => activity.id), ["around-double-quote-demo"]);
  for (const activity of runnable) {
    assert(profileById.has(activity.languageId), `${activity.id} uses unknown language ${activity.languageId}`);
    assert.equal(activity.provenance.nativeValidation, "passed");
    assert.equal(activity.provenance.browserConformance, "passed");
    assert.equal(activity.provenance.reviewStatus, "draft");
    const keys = keysOf(activity);
    assert.equal(activity.script.commandGroups[0].from, 0);
    assert.equal(activity.script.commandGroups.at(-1).to, keys.length);
    const finalCheckpoint = activity.script.checkpoints.at(-1);
    assert.equal(finalCheckpoint.afterStep, keys.length);
    assert.deepEqual(finalCheckpoint.lines, activity.scenario.target.lines);
    assert.deepEqual(finalCheckpoint.cursor, activity.scenario.target.cursor);
    assert.equal(finalCheckpoint.mode, activity.scenario.target.mode);
  }
});

test("language profiles are complete and uniquely addressable", () => {
  assert.equal(profileById.size, registry.profiles.length);
  for (const profile of registry.profiles) {
    assert.match(profile.id, idPattern);
    for (const field of ["displayName", "category", "extensions", "affordances", "comments", "strings", "delimiters", "indentation", "suitableFor", "validation", "codeMirror"]) {
      assert.notEqual(profile[field], undefined, `${profile.id} is missing ${field}`);
    }
  }
  for (const required of ["typescript", "javascript", "python", "java", "csharp", "go", "rust", "c", "cpp", "php", "ruby", "kotlin", "swift", "shell", "sql", "markdown", "json", "yaml", "toml", "html", "css", "xml", "csv", "log", "prose"]) {
    assert(profileById.has(required), `missing language profile ${required}`);
  }
});

test("lessons and activities have stable unique IDs and complete learning phases", () => {
  const ids = new Set();
  for (const lesson of unit.lessons) {
    assert.match(lesson.id, idPattern);
    assert(!ids.has(lesson.id), `duplicate id ${lesson.id}`);
    ids.add(lesson.id);
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
    for (const activity of lesson.activities) {
      assert.match(activity.id, idPattern);
      assert(!ids.has(activity.id), `duplicate id ${activity.id}`);
      ids.add(activity.id);
    }
  }
  assert.equal(activityById.size, activities.length);
  assert(runnable.length >= 30, "the validation unit must contain substantial executable practice");
});

test("runnable activities reference languages and contain coherent scripts", () => {
  for (const activity of runnable) {
    assert(profileById.has(activity.languageId), `${activity.id} uses unknown language ${activity.languageId}`);
    const { initial, target } = activity.scenario;
    assert(initial.lines.length > 0 && target.lines.length > 0, `${activity.id} has an empty buffer`);
    assert(initial.cursor[0] < initial.lines.length, `${activity.id} cursor row is outside the buffer`);
    assert(initial.cursor[1] < Math.max(1, initial.lines[initial.cursor[0]].length), `${activity.id} cursor column is outside the line`);
    const keys = keysOf(activity);
    assert(keys.length > 0, `${activity.id} has no keys`);
    let next = 0;
    for (const group of activity.script.commandGroups) {
      assert.equal(group.from, next, `${activity.id} command groups must be contiguous`);
      assert(group.to > group.from && group.to <= keys.length, `${activity.id} has an invalid command group`);
      next = group.to;
    }
    assert.equal(next, keys.length, `${activity.id} command groups must cover every key`);
    const finalCheckpoint = activity.script.checkpoints.at(-1);
    assert.equal(finalCheckpoint.afterStep, keys.length, `${activity.id} needs a final checkpoint at its last key`);
    assert.deepEqual(finalCheckpoint.lines, target.lines, `${activity.id} final checkpoint must contain the target`);
    assert.equal(activity.verification.inputPolicy, "exact-sequence");
    assert.equal(activity.provenance.method, "llm-authored");
    assert.equal(activity.provenance.browserConformance, "pending");
  }
});

test("references and coverage point to real activities", () => {
  const referenceIds = new Set();
  for (const entry of unit.reference) {
    assert(!referenceIds.has(entry.id), `duplicate reference ${entry.id}`);
    referenceIds.add(entry.id);
    for (const ref of entry.exampleActivityRefs) assert(activityById.has(ref), `${entry.id} references missing ${ref}`);
  }
  const expectedConcepts = ["deliberate .", "repeat-friendly cursor placement", "; and , plus .", "n and N plus .", "count vs repeat and dot counts", "@:", "&", ":~", "recognize when repeat is wrong"];
  assert.deepEqual(unit.coverage.map(item => item.concept), expectedConcepts);
  for (const item of unit.coverage) {
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(item[phase].length > 0, `${item.concept} has no ${phase} coverage`);
      for (const ref of item[phase]) assert(activityById.has(ref), `${item.concept} references missing ${ref}`);
    }
  }
});

test("the validation unit uses a broad, natural language mix", () => {
  const counts = new Map();
  for (const activity of runnable) counts.set(activity.languageId, (counts.get(activity.languageId) || 0) + 1);
  assert(counts.size >= 12, `expected at least 12 profiles, received ${counts.size}`);
  assert((counts.get("python") || 0) >= 3, "Python must appear in demonstrations and practice");
  const nonProgramming = new Set(["markdown", "json", "yaml", "toml", "html", "css", "xml", "csv", "log", "prose"]);
  const neutralCount = [...counts].reduce((sum, [id, count]) => sum + (nonProgramming.has(id) ? count : 0), 0);
  assert(neutralCount / runnable.length >= 0.2, "documentation, configuration, data, logs, and prose should be meaningfully represented");
});

test("complete JSON scenarios parse before and after", () => {
  for (const activity of runnable.filter(item => item.languageId === "json" && item.sourceKind === "complete")) {
    assert.doesNotThrow(() => JSON.parse(activity.scenario.initial.lines.join("\n")), `${activity.id} initial JSON is invalid`);
    assert.doesNotThrow(() => JSON.parse(activity.scenario.target.lines.join("\n")), `${activity.id} target JSON is invalid`);
  }
});

for (const activity of runnable) {
  test(`native Vim content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const result = runNativeVim({
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
    });
    assert.deepEqual(result.code, activity.scenario.target.lines);
    if (activity.scenario.target.cursor) assert.deepEqual(result.cursor, activity.scenario.target.cursor);

    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({
        initialCode: activity.scenario.initial.lines,
        cursor: activity.scenario.initial.cursor,
        keys: keys.slice(0, checkpoint.afterStep),
      });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
    }
  });
}

const modalRunnable = modalUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of modalRunnable) {
  test(`native Vim Unit 1 content: ${activity.id}`, () => {
    const setupKeys = (activity.scenario.initial.setup?.steps || []).map(step => typeof step === "string" ? step : step.key);
    const cursor = activity.scenario.initial.setup?.cursor || activity.scenario.initial.cursor;
    const keys = keysOf(activity);
    const setupState = runNativeVim({ initialCode: activity.scenario.initial.lines, cursor, keys: setupKeys });
    assert.deepEqual(setupState.code, activity.scenario.initial.lines, `${activity.id} setup must not change text`);

    const result = runNativeVim({ initialCode: activity.scenario.initial.lines, cursor, setupKeys, keys });
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);

    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({
        initialCode: activity.scenario.initial.lines,
        cursor,
        setupKeys,
        keys: keys.slice(0, checkpoint.afterStep),
      });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
    }
  });
}

const cursorRunnable = cursorUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of cursorRunnable) {
  test(`native Vim Unit 2 content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const result = runNativeVim({
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
    });
    assert.deepEqual(result.code, activity.scenario.target.lines);
    // Headless Vim has no display geometry, so wrapped-screen cursor positions
    // are asserted by the fixed-width browser conformance tests instead.
    if (!activity.editor?.wrapColumns) assert.deepEqual(result.cursor, activity.scenario.target.cursor);

    if (activity.editor?.wrapColumns) return;
    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({
        initialCode: activity.scenario.initial.lines,
        cursor: activity.scenario.initial.cursor,
        keys: keys.slice(0, checkpoint.afterStep),
      });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
    }
  });
}

const changingRunnable = changingUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of changingRunnable) {
  test(`native Vim Unit 3 content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const result = runNativeVim({
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
    });
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);

    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({
        initialCode: activity.scenario.initial.lines,
        cursor: activity.scenario.initial.cursor,
        keys: keys.slice(0, checkpoint.afterStep),
      });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      if (checkpoint.mode) assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
    }
  });
}

const operatorRunnable = operatorUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of operatorRunnable) {
  test(`native Vim Unit 4 content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const options = {
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
      textWidth: activity.editor?.textWidth,
    };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);

    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      // Headless feedkeys returns to Normal when an incomplete operator or
      // change is the final queued input; browser fixtures own intermediate
      // mode assertions while native Vim still verifies every text/cursor state.
      if (checkpoint.mode && checkpoint.afterStep === keys.length) {
        assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
      }
    }
  });
}

const precisionRunnable = precisionUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of precisionRunnable) {
  test(`native Vim Unit 5 content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const options = {
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
    };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);

    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      // Headless feedkeys exits standalone Visual match selections before the
      // assertion function runs; browser fixtures own those affected ranges.
      if (checkpoint.mode && !checkpoint.affectedRange && checkpoint.afterStep === keys.length) {
        assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
      }
    }
  });
}

const textObjectRunnable = textObjectUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of textObjectRunnable) {
  test(`native Vim Unit 6 content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const options = {
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
    };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);

    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      if (checkpoint.mode && checkpoint.afterStep === keys.length) {
        assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
      }
    }
  });
}

const visualActivities = visualUnit.lessons.flatMap(lesson => lesson.activities);
const visualRunnable = visualActivities.filter(activity => activity.type === "demo" || activity.type === "exercise");

test("Unit 7 covers the Visual curriculum with complete references and learning phases", () => {
  assert.equal(visualRunnable.length, 37);
  assert.deepEqual(visualUnit.coverage.map(item => item.concept), [
    "Visual Character, Visual Line, and Visual Block",
    "Visual selection d c y x r operations",
    "Visual Line operations",
    "o and O selection endpoints",
    "gv reselection",
    "selection case, shift, reindent, and gq",
    "Visual Block c d x r",
    "Visual Block I and A",
    "Visual selection versus operator-motion",
  ]);
  const activityIds = new Set(visualActivities.map(activity => activity.id));
  for (const lesson of visualUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  for (const entry of visualUnit.reference) {
    for (const ref of entry.exampleActivityRefs) assert(activityIds.has(ref), `${entry.id} references missing ${ref}`);
  }
  for (const entry of visualUnit.coverage) {
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(entry[phase].length, `${entry.concept} has no ${phase} coverage`);
      for (const ref of entry[phase]) assert(activityIds.has(ref), `${entry.concept} references missing ${ref}`);
    }
  }
});

for (const activity of visualRunnable) {
  test(`native Vim Unit 7 content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const options = {
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
      textWidth: activity.editor?.textWidth,
    };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);
    const finalCheckpoint = activity.script.checkpoints.at(-1);
    assert.equal(finalCheckpoint.afterStep, keys.length);
    assert.deepEqual(finalCheckpoint.lines, activity.scenario.target.lines);
    assert.deepEqual(finalCheckpoint.cursor, activity.scenario.target.cursor);
    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor) assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
    }
  });
}

const registerActivities = registerUnit.lessons.flatMap(lesson => lesson.activities);
const registerRunnable = registerActivities.filter(activity => activity.type === "demo" || activity.type === "exercise");

test("Unit 8 covers every register family with complete learning phases", () => {
  const ids = new Set(registerActivities.map(activity => activity.id));
  for (const lesson of registerUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  for (const entry of registerUnit.reference) {
    for (const ref of entry.exampleActivityRefs) assert(ids.has(ref), `${entry.id} references missing ${ref}`);
  }
});

for (const activity of registerRunnable) {
  test(`native Vim Unit 8 content: ${activity.id}`, () => {
    const keys = keysOf(activity);
    const registerNames = Object.keys(activity.scenario.target.registers || {});
    const options = {
      initialCode: activity.scenario.initial.lines,
      cursor: activity.scenario.initial.cursor,
      keys,
      registerNames,
      registerAliases: registerNames.includes("+") ? { "+": "z" } : {},
    };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);
    assert.deepEqual(result.registers, activity.scenario.target.registers);
    for (const checkpoint of activity.script.checkpoints) {
      const checkpointNames = Object.keys(checkpoint.registers || {});
      const checkpointResult = runNativeVim({
        ...options,
        keys: keys.slice(0, checkpoint.afterStep),
        registerNames: checkpointNames,
        registerAliases: checkpointNames.includes("+") ? { "+": "z" } : {},
      });
      assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      assert.deepEqual(checkpointResult.registers, checkpoint.registers || {}, `${activity.id} checkpoint ${checkpoint.afterStep} registers`);
    }
  });
}

test("native Vim accepts gj and gk as logical-line equivalents without wrapping", () => {
  const initialCode = ["alpha", "bravo", "charlie"];
  const down = runNativeVim({ initialCode, cursor: [0, 2], keys: ["g", "j"] });
  const up = runNativeVim({ initialCode, cursor: [2, 2], keys: ["g", "k"] });
  assert.deepEqual(down.cursor, [1, 2]);
  assert.deepEqual(up.cursor, [1, 2]);
});

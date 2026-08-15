import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import {
  loadUnitCatalogWithPresentation,
  resolveUnitPresentation,
  validatePresentationManifest,
} from "../presentation-data.js";
import { findNextSequentialUnit } from "../unit-navigation.js";
import {
  boardProfileForBounds,
  registeredSceneProfileForBoard,
  remoteVariantPaths,
  sceneProfileForBoard,
} from "../world-presentation.js";
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
const navigationUnit = units.find(item => item.data.id === "long-range-navigation").data;
const rangeUnit = units.find(item => item.data.id === "command-line-ranges-line-operations").data;
const substitutionUnit = units.find(item => item.data.id === "substitution-practical-regex").data;
const macroUnit = units.find(item => item.data.id === "macros").data;
const automationUnit = units.find(item => item.data.id === "global-normal-automation").data;
const unitCatalog = readJson("../content/unit-index.json");
const registry = readJson("../content/language-profiles.json");
const schema = readJson("../content/unit-content.schema.json");
const presentation = readJson("../content/presentation.json");
const presentationSchema = readJson("../content/presentation.schema.json");
const characterManifest = readJson("../assets/characters/manifest.json");
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const activities = unit.lessons.flatMap(lesson => lesson.activities);
const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
const activityById = new Map(activities.map(activity => [activity.id, activity]));
const profileById = new Map(registry.profiles.map(profile => [profile.id, profile]));
const keysOf = activity => activity.script.steps.map(step => typeof step === "string" ? step : step.key);
const plannedRowsOf = activity => Math.max(
  1,
  activity.scenario.initial.lines.length,
  activity.scenario.target.lines.length,
  ...(activity.script.checkpoints || []).map(checkpoint => checkpoint.lines?.length || 0),
  activity.editor?.requiredRows || 0,
);

test("content files expose the expected schema versions", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(presentationSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(presentationSchema.$id, "https://vimwilds.local/schemas/presentation.schema.json");
  assert.equal(presentation.schemaVersion, 2);
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
    manualStep: "one-input-or-text-run",
    reset: "initial-state",
    backwardStep: "previous-manual-step",
  });
});

test("every practice prompt describes outcomes without revealing its canonical recipe", () => {
  const exercises = units.flatMap(({ data }) => data.lessons)
    .flatMap(lesson => lesson.activities)
    .filter(activity => activity.type === "exercise");

  assert.equal(exercises.length, 362);
  for (const activity of exercises) {
    assert(activity.title.trim(), `${activity.id} needs an outcome title`);
    assert(activity.instruction.trim(), `${activity.id} needs an outcome instruction`);

    const backticked = [...activity.instruction.matchAll(/`([^`]+)`/g)].map(match => match[1]);
    const authoredRecipes = activity.script.commandGroups.map(group => group.display.trim()).filter(Boolean);
    for (const recipe of authoredRecipes) {
      assert(
        !backticked.includes(recipe),
        `${activity.id} exposes canonical command ${recipe} in its instruction`,
      );
    }
    assert(
      !/^(?:use|press|type|execute|run)\b/i.test(activity.instruction),
      `${activity.id} starts with a procedural recipe`,
    );
  }
});

test("presentation manifest covers the catalog with valid worlds, characters, and assets", () => {
  const validation = validatePresentationManifest(presentation, {
    unitCatalog,
    characterIds: Object.keys(characterManifest.characters),
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.valid, true);
  assert.deepEqual(Object.keys(presentation.worlds), [
    "moonroot-ruins",
    "starwater-sanctuary",
    "archive-of-echoes",
    "brass-meridian",
  ]);
  assert.deepEqual(Object.keys(presentation.units), unitCatalog.units.map(item => item.id));

  const landmarkIds = new Set();
  for (const catalogUnit of unitCatalog.units) {
    const resolved = resolveUnitPresentation(presentation, catalogUnit.id);
    assert(resolved, `${catalogUnit.id} must resolve a presentation`);
    assert.equal(resolved.unit.id, catalogUnit.id);
    assert.equal(resolved.world.id, resolved.unit.worldId);
    assert.equal(
      resolved.unit.completion.storyImage,
      `assets/worlds/story/units/${catalogUnit.id}.webp`,
    );
    assert(characterManifest.characters[resolved.unit.guideCharacterId], `${catalogUnit.id} guide must exist`);
    assert(!landmarkIds.has(resolved.unit.landmark.id), `${resolved.unit.landmark.id} must belong to one unit`);
    landmarkIds.add(resolved.unit.landmark.id);
    assert.equal(
      resolved.unit.landmark.assets.dormant,
      `assets/worlds/landmarks/${resolved.unit.landmark.id}-dormant.webp`,
    );
    assert.equal(
      resolved.unit.landmark.assets.restored,
      `assets/worlds/landmarks/${resolved.unit.landmark.id}-restored.webp`,
    );
  }

  for (const unitId of ["modal-model", "cursor-movement", "entering-changing-text", "operator-grammar"]) {
    const resolved = resolveUnitPresentation(presentation, unitId);
    assert(resolved.scene, `${unitId} must select one registered scene`);
    assert.equal(resolved.scene.id, resolved.unit.sceneId);
    assert.deepEqual(Object.keys(resolved.scene.profiles), ["tall", "compact", "wide"]);
    assert.deepEqual(Object.keys(resolved.scene.patchRegions), ["phase-a", "phase-b", "phase-c"]);
    for (const profile of ["tall", "compact", "wide"]) {
      const baseProfile = unitId === "cursor-movement" && profile === "wide" ? "compact" : profile;
      assert.match(
        resolved.scene.profiles[profile].base,
        new RegExp(`^assets/worlds/moonroot-ruins/scenes/${resolved.scene.id}/${baseProfile}/base\\.webp$`),
      );
      for (const patchId of ["phase-a", "phase-b", "phase-c", "landmark-dormant", "landmark-restored"]) {
        assert.match(
          resolved.scene.profiles[profile].patches[patchId],
          new RegExp(`/${profile}/${patchId}\\.webp$`),
        );
      }
    }
  }
  assert.equal(presentation.worlds["moonroot-ruins"].props, undefined);
  assert.equal(presentation.worlds["moonroot-ruins"].backdrops, undefined);

  for (const [unitId, sceneId] of [
    ["cursor-movement", "wayfinder-crossroads"],
    ["modal-model", "mode-lantern-grounds"],
    ["entering-changing-text", "scribes-spring"],
    ["operator-grammar", "grammar-gate-court"],
  ]) {
    const variants = resolveUnitPresentation(presentation, unitId).scene.remoteVariants;
    assert.deepEqual(variants.profiles, ["tall", "compact", "wide"]);
    assert.equal(variants.registrationProfile, "compact");
    assert.equal(variants.timing.initialDelayMs, 2_500);
    assert.equal(variants.timing.fadeMs, 1_200);
    assert.equal(variants.timing.holdMs, 6_500);
    assert.equal(variants.timing.gapMs, 4_000);
    assert.equal(variants.siteIds.length, 10);
    assert.equal(remoteVariantPaths(variants).length, 50);
    assert.equal(variants.format, "webp");
    assert.match(remoteVariantPaths(variants)[0], new RegExp(`${sceneId}/variants/.*-c01\\.webp$`));
  }
  for (const unitId of Object.keys(presentation.units)) {
    const variants = resolveUnitPresentation(presentation, unitId).scene.remoteVariants;
    assert.equal(remoteVariantPaths(variants).length, 50, `${unitId} must expose every approved complete-board variant`);
    assert.match(variants.assetRoot, /\/variants$/);
    assert.equal(
      registeredSceneProfileForBoard("wide", resolveUnitPresentation(presentation, unitId).scene),
      "compact",
    );
    assert.equal(
      registeredSceneProfileForBoard("tall", resolveUnitPresentation(presentation, unitId).scene),
      "compact",
    );
  }
});

test("every character calibrates reaction media to its idle silhouette", () => {
  for (const [characterId, character] of Object.entries(characterManifest.characters)) {
    assert.equal(
      typeof character.reaction_scale_correction,
      "number",
      `${characterId} must define a reaction scale correction`,
    );
    assert(
      character.reaction_scale_correction >= 0.85
        && character.reaction_scale_correction <= 0.95,
      `${characterId} reaction scale correction must stay within the calibrated range`,
    );
  }
});

test("registered scene profiles follow the rendered board aspect ratio", () => {
  assert.equal(boardProfileForBounds({ width: 89, height: 100 }), "tall");
  assert.equal(boardProfileForBounds({ width: 90, height: 100 }), "compact");
  assert.equal(boardProfileForBounds({ width: 158, height: 100 }), "compact");
  assert.equal(boardProfileForBounds({ width: 159, height: 100 }), "wide");
  assert.equal(boardProfileForBounds({ width: 240, height: 100 }), "wide");
  assert.equal(boardProfileForBounds({ width: 241, height: 100 }), "shallow");
  assert.equal(sceneProfileForBoard("shallow"), "wide");
  assert.equal(sceneProfileForBoard("tall"), "tall");
});

test("presentation manifest preserves the approved unit story table", () => {
  const storyRows = Object.values(presentation.units).map(item => ({
    id: item.id,
    guide: item.guideCharacterId,
    world: item.worldId,
    landmark: item.landmark.id,
    action: item.completion.action,
    copy: item.completion.copy,
    nextSpeaker: item.completion.nextHook.speaker || null,
    nextHook: item.completion.nextHook.copy,
  }));
  assert.deepEqual(storyRows, [
    {
      id: "modal-model", guide: "nix", world: "moonroot-ruins", landmark: "mode-lantern",
      action: "Nix lifts the lantern; four nested rings settle into distinct colors",
      copy: "The Mode Lantern wakes. One key can hold more than one meaning—and now the Wilds remember how to listen.",
      nextSpeaker: null, nextHook: "A path glimmers beyond camp.",
    },
    {
      id: "cursor-movement", guide: "vela", world: "moonroot-ruins", landmark: "wayfinder",
      action: "Vela turns the central compass; four paths align",
      copy: "Vela aligns the Wayfinder. North, south, east, and west settle back into place.",
      nextSpeaker: null, nextHook: "The path ends at a page of broken words.",
    },
    {
      id: "entering-changing-text", guide: "tatter", world: "moonroot-ruins", landmark: "scribes-spring",
      action: "Tatter repairs a split channel; luminous ink begins to flow",
      copy: "Tatter opens the Scribe’s Spring. The Wilds can accept new words and reshape old ones again.",
      nextSpeaker: null, nextHook: "A sealed gate waits for both an action and a range.",
    },
    {
      id: "operator-grammar", guide: "cinder", world: "moonroot-ruins", landmark: "grammar-gate",
      action: "Cinder joins two halves of a mechanism; the gate opens",
      copy: "Cinder joins action to range. The Grammar Gate opens, and the first road out of Moonroot is restored.",
      nextSpeaker: null, nextHook: "Starlight flickers beyond the gate.",
    },
    {
      id: "precision-motions-search", guide: "orin", world: "starwater-sanctuary", landmark: "starneedle",
      action: "Orin focuses a floating lens; distant points illuminate",
      copy: "Orin focuses the Starneedle. Distant signs and exact characters become visible across the dark.",
      nextSpeaker: null, nextHook: "The signal points inward, toward structures hidden in plain sight.",
    },
    {
      id: "text-objects", guide: "bramble", world: "starwater-sanctuary", landmark: "nested-garden",
      action: "Bramble touches the outer arch; nested arches bloom from outside inward",
      copy: "Bramble wakes the Nested Garden. Words, quotes, brackets, and blocks reveal the shapes they contain.",
      nextSpeaker: null, nextHook: "Three panes of light rise from the water.",
    },
    {
      id: "visual-selection", guide: "prism", world: "starwater-sanctuary", landmark: "prism-crossing",
      action: "Prism aligns three glass panes: ribbon, row, and rectangle",
      copy: "Prism aligns the three panes. Character, line, and block become distinct paths through the same code.",
      nextSpeaker: null, nextHook: "Behind the final pane, a sealed archive begins to glow.",
    },
    {
      id: "registers-putting", guide: "mica", world: "archive-of-echoes", landmark: "memory-archive",
      action: "Mica places a captured crystal into a drawer; several drawers illuminate",
      copy: "Mica reopens the Memory Archive. What is captured can be kept, chosen, and placed where it belongs.",
      nextSpeaker: null, nextHook: "One memory points to a beacon far beyond the shelves.",
    },
    {
      id: "long-range-navigation", guide: "luma", world: "archive-of-echoes", landmark: "far-beacons",
      action: "Luma sends a thread of light between two distant beacons",
      copy: "Luma reconnects the Far Beacons. The Wilds can cross great distances—and return without losing their place.",
      nextSpeaker: null, nextHook: "Across the causeway, a stopped clock begins to tick.",
    },
    {
      id: "repeatable-editing", guide: "tock", world: "archive-of-echoes", landmark: "echo-clock",
      action: "Tock starts one wheel; its motion propagates through matching wheels",
      copy: "Tock restarts the Echo Clock. A well-shaped change can now travel farther than a single moment.",
      nextSpeaker: null, nextHook: "The echo reaches a brass city beneath the ridge.",
    },
    {
      id: "command-line-ranges-line-operations", guide: "cinder", world: "brass-meridian", landmark: "meridian-table",
      action: "Cinder places two endpoints; a current follows the exact route between them",
      copy: "Cinder sets the Meridian Table. Lines and ranges become routes that the command current can follow.",
      nextSpeaker: null, nextHook: "A broken loom is repeating the wrong pattern.",
    },
    {
      id: "substitution-practical-regex", guide: "puddle", world: "brass-meridian", landmark: "mirror-loom",
      action: "Puddle retunes a lens; only matching threads transform",
      copy: "Puddle retunes the Mirror Loom. Patterns can be found, tested, and transformed without touching what does not match.",
      nextSpeaker: null, nextHook: "The repaired thread leads into a silent foundry.",
    },
    {
      id: "macros", guide: "tock", world: "brass-meridian", landmark: "echo-foundry",
      action: "Tock records one movement into a cylinder; three mechanisms replay it",
      copy: "Tock records the first true echo. The Foundry can repeat a complete sequence without forgetting a step.",
      nextSpeaker: null, nextHook: "Only the World Engine remains dark.",
    },
    {
      id: "global-normal-automation", guide: "cairn", world: "brass-meridian", landmark: "meridian-engine",
      action: "Cairn connects the restored systems; energy crosses all four worlds",
      copy: "Cairn opens the Meridian Engine. Range, pattern, repetition, and judgment move together—and the Wilds answer again.",
      nextSpeaker: "Nix", nextHook: "The language is alive. What you restore next is up to you.",
    },
  ]);
});

test("presentation manifest preserves the approved introduction and ending", () => {
  assert.deepEqual(presentation.story, {
    writingPenAsset: "assets/worlds/story/ui/flying-pen.png",
    intro: [
      {
        id: "connected-wilds",
        asset: "assets/worlds/story/intro/connected-wilds.webp",
        copy: "Long ago, the Wilds answered to a precise language. Every motion had a destination; every change knew its range.",
      },
      {
        id: "interrupted-command",
        asset: "assets/worlds/story/intro/interrupted-wilds.webp",
        copy: "Then an unfinished command crossed the land. Paths shifted, memories scattered, and the great mechanisms fell silent.",
      },
      {
        id: "nix-at-the-threshold",
        asset: "assets/worlds/story/intro/nix-at-the-threshold.webp",
        speaker: "Nix",
        copy: "The language was not lost—only forgotten. Learn it with us, and the Wilds will remember.",
      },
    ],
    ending: {
      asset: "assets/worlds/story/ending/restored-wilds.webp",
      speaker: "Nix",
      copy: "The language is alive. What you restore next is up to you.",
    },
  });
});

test("presentation loading falls back cleanly when the optional manifest is missing or invalid", async () => {
  const response = (data, { ok = true, status = 200 } = {}) => ({
    ok,
    status,
    json: async () => structuredClone(data),
  });
  const missing = await loadUnitCatalogWithPresentation({
    catalogUrl: "catalog",
    presentationUrl: "presentation",
    fetchImpl: async url => url === "catalog" ? response(unitCatalog) : response(null, { ok: false, status: 404 }),
  });
  assert.equal(missing.unitCatalog.units.length, 14);
  assert.equal(missing.presentation, null);

  const invalidPresentation = structuredClone(presentation);
  invalidPresentation.units["modal-model"].worldId = "renamed-moonroot";
  const invalid = await loadUnitCatalogWithPresentation({
    catalogUrl: "catalog",
    presentationUrl: "presentation",
    fetchImpl: async url => response(url === "catalog" ? unitCatalog : invalidPresentation),
  });
  assert.equal(invalid.presentation, null);
  assert(
    invalid.presentationErrors.includes('units.modal-model.worldId references missing world "renamed-moonroot"'),
    "a broken world reference should identify the unit and missing world",
  );
});

test("numbered unit catalog is ordered and internally linked", () => {
  assert.deepEqual(units.map(item => item.data.unitNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
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
        const setupKeys = activity.scenario.initial.setup.steps.map(step => typeof step === "string" ? step : step.key);
        const seedsHiddenEditorState = setupKeys.some(key => ["\"", "m", "q", "/", "?"].includes(key));
        assert(
          activity.scenario.initial.mode !== "normal" || activity.editor?.viewportRows || seedsHiddenEditorState,
          `${activity.id} should not seed an unnecessary Normal state`,
        );
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

test("runnable activities reserve every authored editor row before execution", () => {
  assert.deepEqual(schema.$defs.editorConfig.properties.requiredRows, {
    type: "integer",
    minimum: 1,
    maximum: 12,
    description: "Reserve at least this many logical rows when authored transient states need more space than initial, target, or checkpoints reveal.",
  });
  assert.deepEqual(schema.$defs.editorConfig.allOf, [{ not: { required: ["requiredRows", "viewportRows"] } }]);

  const growing = [];
  for (const { data } of units) {
    for (const lesson of data.lessons) {
      for (const activity of lesson.activities.filter(item => item.type === "demo" || item.type === "exercise")) {
        const requiredRows = activity.editor?.requiredRows;
        if (requiredRows !== undefined) {
          assert(Number.isInteger(requiredRows) && requiredRows >= 1 && requiredRows <= 12, `${activity.id} requiredRows`);
          assert.equal(activity.editor.viewportRows, undefined, `${activity.id} cannot combine requiredRows and viewportRows`);
        }
        if (activity.editor?.viewportRows) continue;
        const authoredStates = [
          ["initial", activity.scenario.initial.lines],
          ["target", activity.scenario.target.lines],
          ...(activity.script.checkpoints || []).filter(checkpoint => checkpoint.lines)
            .map(checkpoint => [`checkpoint ${checkpoint.afterStep}`, checkpoint.lines]),
        ];
        const plannedRows = plannedRowsOf(activity);
        for (const [label, lines] of authoredStates) {
          assert(lines.length <= plannedRows, `${activity.id} ${label} exceeds its ${plannedRows}-row plan`);
        }
        if (plannedRows > activity.scenario.initial.lines.length) growing.push(`${data.id}/${activity.id}`);
      }
    }
  }

  assert.equal(growing.length, 33);
  for (const id of [
    "entering-changing-text/open-middle-line-demo",
    "entering-changing-text/open-beta-above",
    "entering-changing-text/open-before-final-row",
    "entering-changing-text/open-header-and-footer",
  ]) assert(growing.includes(id), `${id} must reserve its final buffer size`);
});

test("unit continuation follows the next published catalog unit", () => {
  const current = { unitNumber: 1 };
  assert.equal(findNextSequentialUnit(units.map(item => item.data), current), cursorUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), cursorUnit), changingUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), changingUnit), operatorUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), operatorUnit), precisionUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), precisionUnit), textObjectUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), textObjectUnit), visualUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), visualUnit), registerUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), registerUnit), navigationUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), navigationUnit)?.id, unit.id);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), unit), rangeUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), rangeUnit), substitutionUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), substitutionUnit), macroUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), macroUnit), automationUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), automationUnit), null);
});

test("unit catalog groups implemented units into curriculum arcs", () => {
  assert.equal(unitCatalog.schemaVersion, 2);
  assert.deepEqual(unitCatalog.arcs, [
    { id: "foundations", arcNumber: 1, title: "Foundations", unitNumbers: [1, 2, 3, 4, 5, 6] },
    { id: "fluency-tracks", arcNumber: 2, title: "Fluency tracks", unitNumbers: [7, 8, 9, 10] },
    { id: "automation", arcNumber: 3, title: "Automation", unitNumbers: [11, 12, 13, 14] },
  ]);
  assert.deepEqual(unitCatalog.units.map(item => item.unitNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
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

test("Unit 9 preserves the long-range-navigation curriculum and deterministic viewport contract", () => {
  assert.deepEqual(navigationUnit.curriculumDefinition, {
    unit: "9. Long-range navigation",
    commandsAndConcepts: "`H M L`; `zt zz zb`; `Ctrl-f`, `Ctrl-b`, `Ctrl-d`, `Ctrl-u`, `Ctrl-e`, `Ctrl-y`; `m{char}`; `'` and backtick jumps; special marks such as `'.`, ```.```, `'^`, ```^```, `'[`, `']`; `Ctrl-o`, `Ctrl-i`; `g;`, `g,`; `gi`, `gv`; advanced bracket/section motions",
    prerequisites: "Units 1–6",
    learningOutcome: "Move through a large edit without losing important locations, and return to prior jumps, changes, insertions, or selections",
    representativeExercises: "Inspect a distant definition and return; revisit the last change; center a target line; mark two sites and shuttle between them",
    priorityAndPortability: "Core through marks, jump/change lists, and viewport commands. Code-section motions are advanced and syntax-dependent",
  });
  assert.deepEqual(navigationUnit.prerequisiteSkillIds, [
    "modal-model", "cursor-movement", "entering-changing-text", "operator-grammar", "precision-motions-search", "text-objects",
  ]);
  assert.equal(navigationUnit.lessons.length, 11);
  assert.deepEqual(navigationUnit.coverage.map(item => item.concept), [
    "H M L",
    "zt zz zb",
    "page and half-page movement",
    "one-line viewport scrolling",
    "named marks and quote/backtick jumps",
    "previous context and jump list",
    "last change insertion and selection",
    "previous operated range marks",
    "g; and g, change list",
    "advanced bracket and section motions",
    "integrated long-range navigation",
  ]);

  const activities = navigationUnit.lessons.flatMap(lesson => lesson.activities);
  const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  const ids = new Set(activities.map(activity => activity.id));
  assert.equal(runnable.length, 51);
  for (const lesson of navigationUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  for (const entry of navigationUnit.reference) {
    for (const ref of entry.exampleActivityRefs) assert(ids.has(ref), `${entry.id} references missing ${ref}`);
  }
  for (const activity of runnable) {
    assert.equal(activity.editor?.viewportRows, 7, `${activity.id} must use the seven-row viewport`);
    assert(activity.scenario.initial.lines.length >= 24 && activity.scenario.initial.lines.length <= 36, `${activity.id} needs a realistic long buffer`);
    assert(activity.scenario.initial.setup, `${activity.id} must reconstruct its navigation state`);
    assert.equal(activity.scenario.initial.viewport.bottomLine - activity.scenario.initial.viewport.topLine, 6, `${activity.id} initial viewport`);
    assert.equal(activity.scenario.target.viewport.bottomLine - activity.scenario.target.viewport.topLine, 6, `${activity.id} target viewport`);
    assert.deepEqual(activity.scenario.target.lines, activity.scenario.initial.lines, `${activity.id} must be navigation-only`);
    assert.equal(activity.provenance.nativeValidation, "passed");
    assert.equal(activity.provenance.browserConformance, "passed");
    const finalCheckpoint = activity.script.checkpoints.at(-1);
    assert.equal(finalCheckpoint.afterStep, keysOf(activity).length);
    assert.deepEqual(finalCheckpoint.lines, activity.scenario.target.lines);
    assert.deepEqual(finalCheckpoint.cursor, activity.scenario.target.cursor);
    assert.deepEqual(finalCheckpoint.viewport, activity.scenario.target.viewport);
  }
  const authoredCommands = runnable.flatMap(keysOf).join("");
  assert(!authoredCommands.includes("#"), "specialized preprocessor motions stay outside Unit 9");
  assert(!navigationUnit.reference.some(entry => /comment|preprocessor/i.test(entry.title)), "specialized comment motions stay outside Unit 9");
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

test("Unit 11 preserves the command-line ranges curriculum and complete lesson flow", () => {
  assert.deepEqual(rangeUnit.curriculumDefinition, {
    unit: "11. Command-line ranges and line operations",
    commandsAndConcepts: "`:`; addresses `.`, `$`, numbers, marks, search addresses; `%`; ranges with `,` and `;`; offsets; visual range `'<,'>`; `:delete`, `:yank`, `:put`, `:copy`/`:t`, `:move`/`:m`, `:join`, `:sort`; safe undo and preview habits",
    prerequisites: "Units 1–6",
    learningOutcome: "Read and construct a range, then apply a deterministic line operation to it",
    representativeExercises: "Move a helper below another function; copy a fixture; delete matching line numbers; sort selected imports; join a range",
    priorityAndPortability: "Core automation. Command availability and undo grouping can vary in reimplementations, so the app defines and tests its supported behavior",
  });
  assert.deepEqual(rangeUnit.prerequisiteSkillIds, [
    "modal-model", "cursor-movement", "entering-changing-text", "operator-grammar", "precision-motions-search", "text-objects",
  ]);
  assert.equal(rangeUnit.lessons.length, 8);
  const activities = rangeUnit.lessons.flatMap(lesson => lesson.activities);
  const runnableActivities = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnableActivities.length, 32);
  for (const activity of runnableActivities) {
    assert.equal(activity.provenance.nativeValidation, "passed", `${activity.id} native validation`);
    assert.equal(activity.provenance.browserConformance, "passed", `${activity.id} browser conformance`);
    assert.equal(activity.provenance.browserConformance, "passed", `${activity.id} browser conformance`);
    const checkpoint = activity.script.checkpoints.at(-1);
    assert.equal(checkpoint.afterStep, keysOf(activity).length, `${activity.id} final checkpoint step`);
    assert.deepEqual(checkpoint.lines, activity.scenario.target.lines, `${activity.id} final checkpoint text`);
    assert.deepEqual(checkpoint.cursor, activity.scenario.target.cursor, `${activity.id} final checkpoint cursor`);
  }
  assert.deepEqual(rangeUnit.coverage.map(item => item.concept), [
    "line addresses and percent range",
    "comma semicolon and offsets",
    "mark and search addresses",
    "delete yank and put",
    "copy t move and m",
    "join and sort",
    "visual range",
    "safe integrated line workflows",
  ]);
  for (const lesson of rangeUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  const ids = new Set(activities.map(activity => activity.id));
  for (const entry of rangeUnit.reference) {
    for (const ref of entry.exampleActivityRefs) assert(ids.has(ref), `${entry.id} references missing ${ref}`);
  }
});

test("Unit 12 preserves the substitution curriculum and complete lesson flow", () => {
  assert.deepEqual(substitutionUnit.curriculumDefinition, {
    unit: "12. Substitution and practical regex",
    commandsAndConcepts: "`:s/pattern/replacement/flags`; line, numeric, visual, and `%` ranges; flags `g c i I n`; empty/reused pattern or replacement; alternate delimiters; `. * \\+ \\? \\{m,n}`; `^ $`; classes and negation; Vim classes such as `\\d`, `\\w`, `\\s`; groups `\\(…\\)`; alternation `\\|`; word boundaries `\\< \\>`; captures; `\\zs \\ze`; very magic `\\v`; replacement `&`, `\\0`–`\\9`, `\\r`, case conversion, and `\\=` expressions",
    prerequisites: "Unit 5 search; Unit 11 ranges",
    learningOutcome: "Perform safe local and buffer-wide substitutions, capture structure, preview impact, and know when regex is too brittle",
    representativeExercises: "Rename exact tokens; swap captured fields; edit only part of a match; normalize declarations; confirm replacements; count matches without changing them",
    priorityAndPortability: "Core through captures and confirmation. `\\zs`, `\\ze`, case conversion, and expression replacement are advanced",
  });
  assert.deepEqual(substitutionUnit.prerequisiteSkillIds, ["precision-motions-search", "command-line-ranges-line-operations"]);
  assert.equal(substitutionUnit.lessons.length, 8);
  const activities = substitutionUnit.lessons.flatMap(lesson => lesson.activities);
  const runnableActivities = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnableActivities.length, 32);
  assert.equal(runnableActivities.filter(activity => activity.type === "exercise").length, 24);
  for (const activity of runnableActivities) {
    assert.equal(activity.provenance.nativeValidation, "passed", `${activity.id} native validation`);
    const checkpoint = activity.script.checkpoints.at(-1);
    assert.equal(checkpoint.afterStep, keysOf(activity).length, `${activity.id} final checkpoint step`);
    assert.deepEqual(checkpoint.lines, activity.scenario.target.lines, `${activity.id} final checkpoint text`);
    assert.deepEqual(checkpoint.cursor, activity.scenario.target.cursor, `${activity.id} final checkpoint cursor`);
  }
  assert.deepEqual(substitutionUnit.coverage.map(item => item.concept), [
    "substitution sentence", "scope the lines", "control match flags", "preview and confirm",
    "reuse and delimiters", "practical patterns", "capture structure", "precision and judgment",
  ]);
  for (const lesson of substitutionUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  const ids = new Set(activities.map(activity => activity.id));
  for (const entry of substitutionUnit.reference) {
    for (const ref of entry.exampleActivityRefs) assert(ids.has(ref), `${entry.id} references missing ${ref}`);
  }
  const advancedTheory = activities.find(activity => activity.id === "advanced-regex-boundary").body;
  assert.match(advancedTheory, /not executable in Vim Wilds yet/);
  const runnableKeys = runnableActivities.flatMap(keysOf).join("");
  assert(!runnableKeys.includes("\\="), "expression replacements remain theory-only");
  assert(!/\\[uUlLE]/.test(runnableKeys), "replacement case conversion remains theory-only");
});

test("Unit 13 preserves the macro curriculum and complete lesson flow", () => {
  assert.deepEqual(macroUnit.curriculumDefinition, {
    unit: "13. Macros",
    commandsAndConcepts: "`q{register}…q`; `@{register}`; `@@`; counts such as `10@a`; append with `qA`; inspect, put, and edit macro text; stable anchors; deliberate final cursor position; stopping on failed motion/search; optional recursion",
    prerequisites: "Units 4, 5, 8, and 10",
    learningOutcome: "Record a robust transformation, replay it safely, inspect or repair it, and state the assumptions that make it valid",
    representativeExercises: "Comment irregular calls; restructure repeated object entries; record on one row and apply to selected instances; repair a macro with a bad final motion",
    priorityAndPortability: "Core automation. Recursive macros are optional and never required for normal progression",
  });
  assert.deepEqual(macroUnit.prerequisiteSkillIds, ["operator-grammar", "precision-motions-search", "registers-putting", "repeatable-editing"]);
  assert.equal(macroUnit.lessons.length, 8);
  const activities = macroUnit.lessons.flatMap(lesson => lesson.activities);
  const exercises = activities.filter(activity => activity.type === "exercise");
  const runnableActivities = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(exercises.length, 24);
  assert.equal(runnableActivities.length, 32);
  assert.deepEqual(macroUnit.coverage.map(item => item.concept), [
    "record and replay named macros",
    "@@ and counted macro replay",
    "stable macro anchors",
    "deliberate final cursor position",
    "stop on failed motion or search",
    "append with qA",
    "inspect put and repair macro text",
    "selective macro application and tool choice",
  ]);
  const ids = new Set(activities.map(activity => activity.id));
  for (const lesson of macroUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  for (const entry of macroUnit.reference) {
    for (const ref of entry.exampleActivityRefs) assert(ids.has(ref), `${entry.id} references missing ${ref}`);
  }
  const languages = new Map();
  for (const activity of runnableActivities) languages.set(activity.languageId, (languages.get(activity.languageId) || 0) + 1);
  assert(languages.size >= 12);
  assert((languages.get("python") || 0) >= 3);
  assert.equal(activities.find(activity => activity.id === "count-ten-csv-rows").editor.viewportRows, 7);
  assert.match(activities.find(activity => activity.id === "macros-unit-summary").body, /Recursive macros exist, but they remain optional/);
});

test("Unit 14 preserves the Global-Normal curriculum and complete lesson flow", () => {
  assert.deepEqual(automationUnit.curriculumDefinition, {
    unit: "14. Global and Normal automation",
    commandsAndConcepts: "`:normal`, `:normal!`; range and visual application; `:global`/`:g`; `:vglobal`/`:v`; global delete, substitute, normal commands, and macros; combined predicates and transformations",
    prerequisites: "Units 11–13",
    learningOutcome: "Apply Normal-mode edits across a controlled line set and choose the lowest-risk automation mechanism",
    representativeExercises: "Run a text-object edit on selected lines; delete debug lines; modify only declarations matching a predicate; execute a macro over matches",
    priorityAndPortability: "Core advanced automation. The distinction between mapped and unmapped Normal commands is explained, while mappings themselves stay out of scope",
  });
  assert.deepEqual(automationUnit.prerequisiteSkillIds, [
    "command-line-ranges-line-operations", "substitution-practical-regex", "macros",
  ]);
  assert.equal(automationUnit.lessons.length, 8);
  const activities = automationUnit.lessons.flatMap(lesson => lesson.activities);
  const runnableActivities = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnableActivities.length, 32);
  assert.equal(runnableActivities.filter(activity => activity.type === "exercise").length, 24);
  assert.deepEqual(automationUnit.coverage.map(item => item.concept), [
    "range application with :normal", ":normal! and visual application", ":global delete", ":vglobal inversion",
    "global substitution", "global Normal commands", "global macro execution", "combined automation and tool choice",
  ]);
  for (const lesson of automationUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  const ids = new Set(activities.map(activity => activity.id));
  for (const entry of automationUnit.reference) {
    for (const ref of entry.exampleActivityRefs) assert(ids.has(ref), `${entry.id} references missing ${ref}`);
  }
  for (const activity of runnableActivities) {
    assert.equal(activity.provenance.nativeValidation, "passed", `${activity.id} native validation`);
    assert.equal(activity.provenance.browserConformance, "passed", `${activity.id} browser conformance`);
    const checkpoint = activity.script.checkpoints.at(-1);
    assert.equal(checkpoint.afterStep, keysOf(activity).length, `${activity.id} final checkpoint step`);
    assert.deepEqual(checkpoint.lines, activity.scenario.target.lines, `${activity.id} final checkpoint text`);
    assert.deepEqual(checkpoint.cursor, activity.scenario.target.cursor, `${activity.id} final checkpoint cursor`);
  }
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

const navigationRunnable = navigationUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");
const nativeViewportActivityIds = new Set(navigationUnit.lessons.slice(0, 4)
  .flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise")
  .map(activity => activity.id));

for (const activity of navigationRunnable) {
  test(`native Vim Unit 9 content: ${activity.id}`, () => {
    const setup = activity.scenario.initial.setup;
    const setupKeys = (setup?.steps || []).map(step => typeof step === "string" ? step : step.key);
    const cursor = setup?.cursor || activity.scenario.initial.cursor;
    const keys = keysOf(activity);
    const setupState = runNativeVim({ initialCode: activity.scenario.initial.lines, cursor, keys: setupKeys });
    assert.deepEqual(setupState.code, activity.scenario.initial.lines, `${activity.id} setup must restore learner-visible text`);
    assert.deepEqual(setupState.cursor, activity.scenario.initial.cursor, `${activity.id} setup cursor`);

    const options = { initialCode: activity.scenario.initial.lines, cursor, setupKeys, keys };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    // H/M/L, paging, and viewport scrolling require a rendered window. Their
    // exact seven-row positions are owned by the browser conformance suite.
    if (!nativeViewportActivityIds.has(activity.id)) {
      assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    }
    if (activity.scenario.target.mode !== "visual") assert.equal(result.mode, activity.scenario.target.mode);

    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      if (checkpoint.cursor && !nativeViewportActivityIds.has(activity.id)) {
        assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      }
    }
  });
}

const rangeRunnable = rangeUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of rangeRunnable) {
  test(`native Vim Unit 11 content: ${activity.id}`, () => {
    const setup = activity.scenario.initial.setup;
    const setupKeys = (setup?.steps || []).map(step => typeof step === "string" ? step : step.key);
    const cursor = setup?.cursor || activity.scenario.initial.cursor;
    const keys = keysOf(activity);
    const registerNames = Object.keys(activity.scenario.target.registers || {});
    if (setup) {
      const setupState = runNativeVim({ initialCode: activity.scenario.initial.lines, cursor, keys: setupKeys });
      assert.deepEqual(setupState.code, activity.scenario.initial.lines, `${activity.id} setup text`);
      assert.deepEqual(setupState.cursor, activity.scenario.initial.cursor, `${activity.id} setup cursor`);
    }
    const options = { initialCode: activity.scenario.initial.lines, cursor, setupKeys, keys, registerNames };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);
    assert.deepEqual(result.registers, activity.scenario.target.registers || {});
    for (const checkpoint of activity.script.checkpoints) {
      const checkpointNames = Object.keys(checkpoint.registers || {});
      const checkpointResult = runNativeVim({
        ...options,
        keys: keys.slice(0, checkpoint.afterStep),
        registerNames: checkpointNames,
      });
      assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
      assert.deepEqual(checkpointResult.registers, checkpoint.registers || {}, `${activity.id} checkpoint ${checkpoint.afterStep} registers`);
    }
  });
}

const substitutionRunnable = substitutionUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of substitutionRunnable) {
  test(`native Vim Unit 12 content: ${activity.id}`, () => {
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
    const checkpoint = activity.script.checkpoints.at(-1);
    const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
    assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} final checkpoint text`);
    assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} final checkpoint cursor`);
    assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} final checkpoint mode`);
  });
}

const macroRunnable = macroUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of macroRunnable) {
  test(`native Vim Unit 13 content: ${activity.id}`, () => {
    const setup = activity.scenario.initial.setup;
    const setupKeys = (setup?.steps || []).map(step => typeof step === "string" ? step : step.key);
    const cursor = setup?.cursor || activity.scenario.initial.cursor;
    const keys = keysOf(activity);
    const registerNames = Object.keys(activity.scenario.target.registers || {});
    if (setup) {
      const setupState = runNativeVim({ initialCode: activity.scenario.initial.lines, cursor, keys: setupKeys });
      assert.deepEqual(setupState.code, activity.scenario.initial.lines, `${activity.id} setup text`);
      assert.deepEqual(setupState.cursor, activity.scenario.initial.cursor, `${activity.id} setup cursor`);
    }
    const options = { initialCode: activity.scenario.initial.lines, cursor, setupKeys, keys, registerNames };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);
    assert.deepEqual(result.registers, activity.scenario.target.registers || {});
    for (const checkpoint of activity.script.checkpoints) {
      const checkpointNames = Object.keys(checkpoint.registers || {});
      const checkpointResult = runNativeVim({
        ...options,
        keys: keys.slice(0, checkpoint.afterStep),
        registerNames: checkpointNames,
      });
      assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
      assert.deepEqual(checkpointResult.registers, checkpoint.registers || {}, `${activity.id} checkpoint ${checkpoint.afterStep} registers`);
    }
  });
}

const automationRunnable = automationUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of automationRunnable) {
  test(`native Vim Unit 14 content: ${activity.id}`, () => {
    const setup = activity.scenario.initial.setup;
    const setupKeys = (setup?.steps || []).map(step => typeof step === "string" ? step : step.key);
    const cursor = setup?.cursor || activity.scenario.initial.cursor;
    const keys = keysOf(activity);
    if (setup) {
      const setupState = runNativeVim({ initialCode: activity.scenario.initial.lines, cursor, keys: setupKeys });
      assert.deepEqual(setupState.code, activity.scenario.initial.lines, `${activity.id} setup text`);
      assert.deepEqual(setupState.cursor, activity.scenario.initial.cursor, `${activity.id} setup cursor`);
    }
    const options = { initialCode: activity.scenario.initial.lines, cursor, setupKeys, keys };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);
    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
      assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
    }
  });
}

test("Unit 13 failure guards stop before later macro keys", () => {
  const byId = new Map(macroRunnable.map(activity => [activity.id, activity]));
  assert.deepEqual(byId.get("failed-semicolon-demo").scenario.target.lines, ["ab", "no delimiter", "c;d", "e;f"]);
  assert.deepEqual(byId.get("failed-search-python").scenario.target.lines, ["header", "ARGET one", "plain_tail"]);
  assert.equal(byId.get("append-colon-demo").scenario.target.registers.a.text, "0f:r=j");
  assert.equal(byId.get("repair-colon-macro").scenario.target.registers.a.text, "0f:r=j");
});

test("native Vim method-boundary fixture covers all four directions", () => {
  const lines = navigationRunnable.find(activity => activity.id === "method-start-mix").scenario.initial.lines;
  for (const fixture of [
    { keys: ["[", "m"], cursor: [12, 13] },
    { keys: ["]", "m"], cursor: [19, 10] },
    { keys: ["[", "M"], cursor: [10, 2] },
    { keys: ["]", "M"], cursor: [17, 2] },
  ]) {
    assert.deepEqual(runNativeVim({ initialCode: lines, cursor: [15, 10], keys: fixture.keys }).cursor, fixture.cursor);
  }
});

test("native Vim accepts gj and gk as logical-line equivalents without wrapping", () => {
  const initialCode = ["alpha", "bravo", "charlie"];
  const down = runNativeVim({ initialCode, cursor: [0, 2], keys: ["g", "j"] });
  const up = runNativeVim({ initialCode, cursor: [2, 2], keys: ["g", "k"] });
  assert.deepEqual(down.cursor, [1, 2]);
  assert.deepEqual(up.cursor, [1, 2]);
});

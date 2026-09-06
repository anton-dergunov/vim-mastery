import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import {
  loadUnitCatalogWithPresentation,
  resolveUnitPresentation,
  validatePresentationManifest,
} from "../presentation-data.js";
import { findNextSequentialUnit } from "../unit-navigation.js";
import { unitDigest } from "../mastery-progress.js";
import {
  boardProfileForBounds,
  registeredSceneProfileForBoard,
  remoteVariantPaths,
  sceneProfileForBoard,
  sceneProfileForPolicy,
} from "../world-presentation.js";
import { runNativeVim } from "./native-vim-runner.mjs";

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const unit = readJson("../content/units/11-repeatable-editing.json");
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
const positionUnit = units.find(item => item.data.id === "position-memory").data;
const viewportUnit = units.find(item => item.data.id === "viewport-control").data;
const rangeUnit = units.find(item => item.data.id === "command-line-ranges-line-operations").data;
const substitutionUnit = units.find(item => item.data.id === "substitution-practical-regex").data;
const macroUnit = units.find(item => item.data.id === "macros").data;
const automationUnit = units.find(item => item.data.id === "global-normal-automation").data;
const capstoneUnit = units.find(item => item.data.id === "real-code-workflow-capstones").data;
const masteryUnit = units.find(item => item.data.id === "mastery-loops").data;
const unitCatalog = readJson("../content/unit-index.json");
const masteryIndex = readJson("../content/mastery-index.json");
const registry = readJson("../content/language-profiles.json");
const schema = readJson("../content/unit-content.schema.json");
const presentation = readJson("../content/presentation.json");
const presentationSchema = readJson("../content/presentation.schema.json");
const referenceCatalog = readJson("../content/reference.json");
const referenceSchema = readJson("../content/reference.schema.json");
const characterManifest = readJson("../assets/characters/manifest.json");
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const activities = unit.lessons.flatMap(lesson => lesson.activities);
const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
const activityById = new Map(activities.map(activity => [activity.id, activity]));
const profileById = new Map(registry.profiles.map(profile => [profile.id, profile]));
const keysOf = activity => activity.script.steps.map(step => typeof step === "string" ? step : step.key);
// Phases used to escalate by reskinning one key stream into another language,
// which trains recognition of a shape rather than the decision that picks it.
// The single legitimate repeat is a guided demo and the `mix` exercise in the
// same lesson that asks the learner to recall it unaided; a `challenge` that
// replays anything, or a repeat across lessons, is the bug this guards.
const assertCanonicalsAreDistinct = unitData => {
  const owners = new Map();
  for (const lesson of unitData.lessons) {
    for (const activity of lesson.activities) {
      if (activity.type !== "demo" && activity.type !== "exercise") continue;
      const stream = keysOf(activity).join(" ");
      const owner = owners.get(stream);
      const recallsItsDemo = owner
        && owner.lesson === lesson.id
        && owner.activity.type === "demo"
        && activity.type === "exercise"
        && activity.phase === "mix";
      assert(
        !owner || recallsItsDemo,
        `${unitData.id}/${activity.id} repeats the canonical of ${owner?.activity.id}`,
      );
      if (!owner) owners.set(stream, { lesson: lesson.id, activity });
    }
  }
};

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
  assert.equal(unit.unitNumber, 11);
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

test("the reference catalog is a deck manifest, not a curriculum", () => {
  assert.equal(referenceSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(referenceSchema.$id, "https://vimwilds.local/schemas/reference.schema.json");
  assert.equal(referenceSchema.additionalProperties, false);
  assert.deepEqual(referenceSchema.$defs.deck.properties.role.enum, ["opening", "deck"]);
  assert.equal(referenceCatalog.schemaVersion, 1);
  assert.match(referenceCatalog.contentVersion, /^\d+\.\d+\.\d+$/);

  const deckIds = referenceCatalog.decks.map(deck => deck.id);
  assert.deepEqual(deckIds, ["orientation", "survival", "host-reality", "orientation-only"]);
  assert.equal(new Set(deckIds).size, deckIds.length);
  assert.equal(referenceCatalog.decks.filter(deck => deck.role === "opening").length, 1);

  const cardIds = new Set();
  for (const deck of referenceCatalog.decks) {
    for (const field of ["kicker", "title", "summary"]) {
      assert(typeof deck[field] === "string" && deck[field].trim(), `${deck.id}.${field} is required`);
    }
    assert(idPattern.test(deck.id), `${deck.id} must be a kebab-case ID`);
    assert(deck.cards.length >= 1);
    for (const card of deck.cards) {
      assert(idPattern.test(card.id), `${card.id} must be a kebab-case ID`);
      assert(!cardIds.has(card.id), `duplicate reference card ID ${card.id}`);
      cardIds.add(card.id);
      assert(
        (card.body?.length || 0) > 0 || (card.rows?.length || 0) > 0,
        `${card.id} must carry prose, rows, or both`,
      );
      for (const row of card.rows || []) {
        assert(typeof row.command === "string" && row.command.trim());
        assert(typeof row.vim === "string" && row.vim.trim());
      }
      // A card of commands has to say something about an embedding editor,
      // either per row or once for the whole card.
      if (card.rows) {
        assert(
          card.rows.every(row => row.host) || typeof card.hostNote === "string",
          `${card.id} must carry a host column or a hostNote`,
        );
      }
    }
  }

  // Cards are reference, never progression: nothing here may look like an
  // activity the player could be scored on.
  const serialized = JSON.stringify(referenceCatalog);
  for (const forbidden of ["scenario", "script", "checkpoints", "practiceMode", "phase"]) {
    assert(!serialized.includes(`"${forbidden}"`), `reference cards must not carry ${forbidden}`);
  }
});

test("the host column names an example editor and the Vim column never does", () => {
  const hosts = /VS Code|VSCodeVim|vscode-neovim|JetBrains|Zed|Cursor|Sublime|Emacs/;
  let namedHosts = 0;
  for (const deck of referenceCatalog.decks) {
    for (const card of deck.cards) {
      for (const row of card.rows || []) {
        // Terminal Vim is the baseline the curriculum teaches; naming a host in
        // that column would make the reference behavior sound editor-specific.
        assert(!hosts.test(row.vim), `${card.id}: the Vim column must describe Vim, not a host`);
        if (row.host && hosts.test(row.host)) namedHosts += 1;
      }
    }
  }
  assert(namedHosts >= 5, "the host column should name a concrete editor as an example");
});

test("the reference surface registers the Mosslight Landing board", () => {
  const surface = presentation.reference;
  assert.equal(surface.worldId, "moonroot-ruins");
  assert.equal(surface.sceneId, "mosslight-landing");
  assert.equal(surface.scene.id, surface.sceneId);
  assert(presentation.worlds[surface.worldId], "the reference world must be registered");
  for (const profile of ["tall", "compact", "wide"]) {
    assert.match(
      surface.scene.profiles[profile].base,
      /^assets\/worlds\/moonroot-ruins\/scenes\/mosslight-landing\/[a-z]+\/base\.webp$/,
    );
  }
  // The board is not a unit: it registers no phases, patch regions, or landmark
  // states, and the standalone schema is what says so.
  assert.deepEqual(
    Object.keys(surface.scene).sort(),
    ["id", "profiles", "remoteVariants"],
  );
  assert.equal(remoteVariantPaths(surface.scene.remoteVariants).length, 50);
  assert.equal(
    presentationSchema.$defs.standaloneScene.required.includes("phasePatches"),
    false,
  );
});

test("reaction manifest preserves the four-second idle-ramp contract", () => {
  const variants = Object.values(characterManifest.characters)
    .flatMap(character => Object.values(character.reactions || {}))
    .filter(Array.isArray)
    .flat();

  assert.equal(variants.length, 216);
  for (const reaction of variants) {
    assert.equal(reaction.frames, 55, `${reaction.src} must include the seven-frame idle ramp`);
    assert.equal(reaction.fps, 12);
    assert.equal(reaction.duration_seconds, 4);
    assert.equal(reaction.loop, 1);
    assert(Array.isArray(reaction.canvas_size));
    assert.equal(reaction.canvas_size.length, 2);
    assert(reaction.css_scale >= 1);
  }
});

test("every practice prompt describes outcomes without revealing its canonical recipe", () => {
  const exercises = units.flatMap(({ data }) => data.lessons)
    .flatMap(lesson => lesson.activities)
    .filter(activity => activity.type === "exercise");

  assert.equal(exercises.length, 454);
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
    if (["viewport-control", "real-code-workflow-capstones", "mastery-loops"].includes(catalogUnit.id)
      && resolved.unit.completion.storyArtStatus === "pending-bespoke-approval") {
      assert.match(resolved.unit.completion.storyImage, /\/tall\/base\.webp$/);
    } else {
      assert.equal(resolved.unit.completion.storyArtStatus, undefined);
      assert.equal(resolved.unit.completion.storyImage, `assets/worlds/story/units/${catalogUnit.id}.webp`);
    }
    assert(characterManifest.characters[resolved.unit.guideCharacterId], `${catalogUnit.id} guide must exist`);
    assert(!landmarkIds.has(resolved.unit.landmark.id), `${resolved.unit.landmark.id} must belong to one unit`);
    landmarkIds.add(resolved.unit.landmark.id);
    assert.deepEqual(Object.keys(resolved.unit.landmark), ["id"]);
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
    assert.equal(remoteVariantPaths(variants).length, 50, `${unitId} must expose every approved scene variant`);
    assert(["complete-board", "transparent-patch"].includes(variants.mode || "complete-board"));
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
  const viewportVariants = resolveUnitPresentation(presentation, "viewport-control").scene.remoteVariants;
  assert.equal(viewportVariants.mode, "transparent-patch");
  assert.match(viewportVariants.assetRoot, /beacon-glass-gallery\/variants$/);
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
  const scene = resolveUnitPresentation(presentation, "viewport-control").scene;
  assert.equal(sceneProfileForPolicy("tall", scene, "static"), "tall");
  assert.equal(sceneProfileForPolicy("tall", scene, "practice"), "compact");
  assert.equal(sceneProfileForPolicy("compact", scene, "practice"), "compact");
  assert.equal(sceneProfileForPolicy("wide", scene, "practice"), "wide");
  assert.equal(sceneProfileForPolicy("shallow", scene, "practice"), "wide");
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
      id: "position-memory", guide: "luma", world: "archive-of-echoes", landmark: "far-beacons",
      action: "Luma sends a thread of light between two distant beacons",
      copy: "Luma reconnects the Far Beacons. The Wilds can cross great distances—and return without losing their place.",
      nextSpeaker: null, nextHook: "Beyond the reconnected span, a fogged gallery lens hides the far shore.",
    },
    {
      id: "viewport-control", guide: "luma", world: "archive-of-echoes", landmark: "beacon-glass",
      action: "Luma wipes the lens of the beacon glass; the fog lifts and the far shore resolves",
      copy: "Luma clears the beacon glass. The Wilds can look far ahead, or close at hand, without moving a step.",
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
      action: "Cairn connects the restored systems; a steady current reaches all four worlds",
      copy: "Cairn opens the Meridian Engine. Range, pattern, repetition, and judgment move together through every restored road.",
      nextSpeaker: "Brikk", nextHook: "The great systems run again. Bring me the jobs they were never shaped for.",
    },
    {
      id: "real-code-workflow-capstones", guide: "brikk", world: "brass-meridian", landmark: "menders-bench",
      action: "Brikk settles four differently shaped jobs into one service kit; a single cyan current tests each assembly in turn",
      copy: "At Menders' Confluence, every restored skill becomes part of one dependable craft.",
      nextSpeaker: "Brikk", nextHook: "The repairs hold. Fen is waiting at the relay, where every route returns and begins again.",
    },
    {
      id: "mastery-loops", guide: "fen", world: "brass-meridian", landmark: "keepers-relay",
      action: "Fen sends one test current around every return loop; it pauses at the relay, then divides cleanly among the open routes",
      copy: "The Keeper’s Relay remembers through use: return, combine, maintain, and choose again.",
      nextSpeaker: "Nix", nextHook: "The routes are open. Come and see what the Wilds remember.",
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
      id: "restored-wilds",
      title: "The Wilds are alive",
      progressLabel: "All four worlds restored",
      ariaLabel: "The four restored Vim Wilds celebrating together",
      asset: "assets/worlds/story/ending/restored-wilds.webp",
      speaker: "Nix",
      copy: "The language is alive. What you restore next is up to you.",
    },
  });
});

test("all 17 completion images are valid and distinct on either side of the approval gate", () => {
  const pending = [];
  const hashes = new Map();
  for (const unitPresentation of Object.values(presentation.units)) {
    const source = new URL(`../${unitPresentation.completion.storyImage}`, import.meta.url);
    const digest = createHash("sha256").update(readFileSync(source)).digest("hex");
    assert(!hashes.has(digest), `${unitPresentation.id} duplicates ${hashes.get(digest)}`);
    hashes.set(digest, unitPresentation.id);
    if (unitPresentation.completion.storyArtStatus) pending.push(unitPresentation.id);
  }
  assert.equal(hashes.size, 17);
  assert(
    pending.length === 0
      || JSON.stringify(pending) === JSON.stringify(["viewport-control", "real-code-workflow-capstones", "mastery-loops"]),
    "the three bespoke endings must be pending together or promoted together",
  );
});

test("every unit ending keeps a distinct lossless master beside its runtime image", () => {
  // The review tree these masters are copied from is gitignored, so the file
  // under assets/ is the only backed-up original. A promotion that installs the
  // WebP alone leaves the master behind - which is how Unit 10 spent three
  // commits holding a byte-identical copy of Unit 9's placeholder art.
  const hashes = new Map();
  for (const unitPresentation of Object.values(presentation.units)) {
    const master = new URL(`../assets/worlds/story/units/${unitPresentation.id}.png`, import.meta.url);
    assert(existsSync(master), `${unitPresentation.id} has no lossless master`);
    const bytes = readFileSync(master);
    assert.equal(
      bytes.subarray(0, 8).toString("hex"),
      "89504e470d0a1a0a",
      `${unitPresentation.id} master is not a PNG`,
    );
    assert.equal(bytes.toString("ascii", 12, 16), "IHDR", `${unitPresentation.id} master has no image header`);
    assert.deepEqual(
      [bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
      [1792, 2400],
      `${unitPresentation.id} master is not a 1792x2400 portrait source`,
    );
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert(!hashes.has(digest), `${unitPresentation.id} master duplicates ${hashes.get(digest)}`);
    hashes.set(digest, unitPresentation.id);
  }
  assert.equal(hashes.size, 17);
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
  assert.equal(missing.unitCatalog.units.length, 17);
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
  assert.deepEqual(units.map(item => item.data.unitNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
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
  assert.deepEqual(schema.$defs.editorConfig.allOf, [
    { not: { required: ["requiredRows", "viewportRows"] } },
    { if: { required: ["viewportDependent"] }, then: { required: ["viewportRows"] } },
  ]);

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

  assert.equal(growing.length, 35);
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
  assert.equal(findNextSequentialUnit(units.map(item => item.data), registerUnit), positionUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), positionUnit), viewportUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), viewportUnit)?.id, unit.id);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), unit), rangeUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), rangeUnit), substitutionUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), substitutionUnit), macroUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), macroUnit), automationUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), automationUnit), capstoneUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), capstoneUnit), masteryUnit);
  assert.equal(findNextSequentialUnit(units.map(item => item.data), masteryUnit), null);
});

test("every concept carries a globally unique id", () => {
  // The mastery layer keys a learner's persisted progress by these ids. A
  // slug of the free-text `concept` cannot serve: `@:`, `&` and `:~` all
  // reduce to nothing, and two units name "Visual Character, Visual Line, and
  // Visual Block" identically. An array index cannot serve either, because
  // inserting a concept would silently remap stored progress onto its
  // neighbour. So the id is authored, and it has to be unique across units.
  const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const seen = new Map();
  for (const { data } of units) {
    for (const entry of data.coverage) {
      assert(entry.id, `${data.id} has a coverage entry without an id: ${entry.concept}`);
      assert.match(entry.id, idPattern);
      assert(!seen.has(entry.id), `${entry.id} is claimed by both ${seen.get(entry.id)} and ${data.id}`);
      seen.set(entry.id, data.id);
    }
  }
  assert.equal(seen.size, 138);
  assert.deepEqual(schema.$defs.coverageEntry.required, ["id", "concept", "explain", "demonstrate", "isolate", "mix", "challenge"]);
  assert.deepEqual(schema.$defs.coverageEntry.properties.id, { $ref: "#/$defs/id" });
});

test("catalog counts agree with the unit files they describe", () => {
  // Both counts are regenerated by the build and hand-maintained in the
  // checked-in catalog, so nothing but this test stops the two drifting apart.
  // The mastery map reads conceptCount to render a unit before that unit's
  // JSON has been fetched, which is what makes it wrong rather than merely
  // stale when it disagrees.
  for (const entry of unitCatalog.units) {
    const source = units.find(item => item.data.id === entry.id);
    assert(source, `catalog lists ${entry.id}, which has no unit file`);
    assert.equal(entry.lessonCount, source.data.lessons.length, `${entry.id} lessonCount is stale`);
    assert.equal(entry.conceptCount, source.data.coverage.length, `${entry.id} conceptCount is stale`);
    // The contents dialog renders every unit from this catalog alone, and the
    // unit files are 150-350KB each, so the graph has to be mirrored here to be
    // usable at all. Same bargain as the counts above, same guard.
    assert.deepEqual(entry.prerequisiteSkillIds, source.data.prerequisiteSkillIds, `${entry.id} required graph is stale`);
    assert.deepEqual(entry.recommendedSkillIds, source.data.recommendedSkillIds, `${entry.id} recommended graph is stale`);
    assert.equal(existsSync(new URL(`../${entry.path}`, import.meta.url)), true, `${entry.id} path does not exist`);
    assert.equal(source.data.unitNumber, entry.unitNumber, `${entry.id} unitNumber disagrees with its file`);
  }
});

test("the prerequisite graph resolves, discriminates, and cannot cycle", () => {
  const catalogById = new Map(unitCatalog.units.map(entry => [entry.id, entry]));
  for (const { data } of units) {
    const required = data.prerequisiteSkillIds;
    const recommended = data.recommendedSkillIds;
    assert(Array.isArray(required), `${data.id} has no prerequisiteSkillIds`);
    assert(Array.isArray(recommended), `${data.id} has no recommendedSkillIds`);
    for (const [label, list] of [["required", required], ["recommended", recommended]]) {
      assert.equal(new Set(list).size, list.length, `${data.id} repeats a ${label} prerequisite`);
      for (const id of list) {
        assert(catalogById.has(id), `${data.id} ${label} prerequisite "${id}" is not a unit`);
        assert.notEqual(id, data.id, `${data.id} lists itself as a ${label} prerequisite`);
        // Edges point strictly backwards, which is what makes a cycle
        // unrepresentable rather than merely absent today.
        assert(
          catalogById.get(id).unitNumber < data.unitNumber,
          `${data.id} ${label} prerequisite "${id}" is not an earlier unit`,
        );
      }
    }
    for (const id of recommended) {
      assert(!required.includes(id), `${data.id} lists "${id}" as both required and recommended`);
    }
  }
});

test("the graph declares direct edges only", () => {
  // A cumulative list cannot express an order, which is the whole reason the
  // lists were narrowed. Naming an ancestor of an edge you already name adds no
  // information and quietly reintroduces the flat graph.
  const byId = new Map(units.map(item => [item.data.id, item.data]));
  const closure = (unitId, seen = new Set()) => {
    for (const id of byId.get(unitId)?.prerequisiteSkillIds || []) {
      if (seen.has(id)) continue;
      seen.add(id);
      closure(id, seen);
    }
    return seen;
  };
  for (const { data } of units) {
    for (const id of data.prerequisiteSkillIds) {
      const inherited = closure(id);
      for (const other of data.prerequisiteSkillIds) {
        assert(
          other === id || !inherited.has(other),
          `${data.id} names "${other}" although "${id}" already requires it`,
        );
      }
    }
  }
});

test("no two units in one arc share a prerequisite list", () => {
  // The acceptance criterion for the narrowing. Asserted rather than reasoned
  // about, because "essentially the same six-unit list" is exactly how the flat
  // graph survived four restructuring sessions.
  const byId = new Map(unitCatalog.units.map(entry => [entry.id, entry]));
  for (const arc of unitCatalog.arcs) {
    const members = unitCatalog.units.filter(entry => arc.unitNumbers.includes(entry.unitNumber));
    const seen = new Map();
    for (const entry of members) {
      const key = JSON.stringify([[...entry.prerequisiteSkillIds].sort(), [...entry.recommendedSkillIds].sort()]);
      assert(
        !seen.has(key),
        `Arc ${arc.arcNumber}: ${entry.id} and ${seen.get(key)} declare identical prerequisites`,
      );
      seen.set(key, entry.id);
    }
    assert.equal(seen.size, members.length);
    for (const entry of members) assert(byId.has(entry.id));
  }
});

test("every unit surfaces a portability note that links to the host-reality card", () => {
  // The note is authored in the catalog rather than derived from
  // `priorityAndPortability`, which is an internal design record: it says things
  // like "marked advanced" and several entries run to four sentences.
  const deck = referenceCatalog.decks.find(item => item.id === "host-reality");
  assert(deck, "the host-reality deck the notes link to has gone missing");
  assert(deck.cards.length, "host-reality has no cards");
  for (const entry of unitCatalog.units) {
    const note = entry.editorNote;
    assert(typeof note === "string" && note.trim(), `${entry.id} has no editorNote`);
    assert(note.length <= 240, `${entry.id} editorNote is ${note.length} characters, over the 240 budget`);
    assert(!note.includes("marked advanced"), `${entry.id} editorNote leaks authoring language`);
  }
});

test("every activity reference inside a unit resolves", () => {
  // `routes`, `remediationRef`, `coverage` and `exampleActivityRefs` are already
  // covered elsewhere; `demoRef` was the one theory-to-demonstration link
  // nothing checked, and it is the link a renumbering is most likely to break.
  let checked = 0;
  for (const { data } of units) {
    const ids = new Set(data.lessons.flatMap(lesson => lesson.activities).map(activity => activity.id));
    for (const lesson of data.lessons) {
      for (const activity of lesson.activities) {
        if (!activity.demoRef) continue;
        checked += 1;
        assert(ids.has(activity.demoRef), `${data.id}/${activity.id} points at missing demo ${activity.demoRef}`);
      }
    }
  }
  assert.equal(checked, 140);
});

test("id-shaped content fields obey the schema's id pattern", () => {
  // Nothing validates the content against the schema at runtime, so a value
  // that breaks the schema's own `$defs/id` can sit in the tree unnoticed --
  // which is how `G-motion` and `counted-G` survived in Unit 2.
  assert.equal(schema.$defs.id.pattern, "^[a-z0-9]+(?:-[a-z0-9]+)*$");
  for (const { data } of units) {
    for (const lesson of data.lessons) {
      assert.match(lesson.id, idPattern);
      for (const activity of lesson.activities) {
        assert.match(activity.id, idPattern);
        const vocabulary = [
          ...(activity.skills ? [...activity.skills.primary, ...activity.skills.supporting] : []),
          ...(activity.verification ? activity.verification.requiredEvidence : []),
        ];
        for (const id of vocabulary) {
          assert.match(id, idPattern, `${data.id}/${activity.id} uses non-id "${id}"`);
        }
      }
    }
    for (const entry of data.coverage) assert.match(entry.id, idPattern);
    for (const entry of data.reference) assert.match(entry.id, idPattern);
  }
});

test("the curriculum table and the unit files say the same thing", () => {
  // `docs/lesson-content-design.md` requires every unit to preserve its
  // curriculum row verbatim in `curriculumDefinition`, and four renumbering
  // sessions left the doc behind in ways nothing detected: Units 13-15 still
  // named pre-renumbering prerequisites and Unit 3's row predated its own
  // Insert-mode lessons. This is the check that makes the invariant real.
  //
  // Pipes are normalised on both sides because a markdown table cell cannot
  // distinguish a literal `|` from an escaped one: Unit 2 means a bare pipe and
  // Unit 13 means a regex `\|`, and both are written `\|` here. The comparison
  // is lossy in exactly that one character and exact in every other.
  const table = readFileSync(new URL("../docs/curriculum-and-progression.md", import.meta.url), "utf8");
  const fields = ["unit", "commandsAndConcepts", "prerequisites", "learningOutcome", "representativeExercises", "priorityAndPortability"];
  const normalise = value => value.replaceAll("\\|", "|");
  const rows = new Map();
  for (const line of table.split("\n")) {
    const match = /^\| (\d+)\. /.exec(line);
    if (!match) continue;
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map(cell => cell.trim());
    assert.equal(cells.length, fields.length, `curriculum row ${match[1]} has ${cells.length} cells`);
    rows.set(Number(match[1]), cells);
  }
  assert.deepEqual([...rows.keys()].sort((left, right) => left - right), units.map(item => item.data.unitNumber));
  for (const { data } of units) {
    const cells = rows.get(data.unitNumber);
    fields.forEach((field, index) => {
      assert.equal(
        normalise(cells[index]),
        normalise(data.curriculumDefinition[field]),
        `Unit ${data.unitNumber} ${field} differs between the curriculum table and the unit file`,
      );
    });
  }
});

test("the graph covers every cross-unit dependency the activities reveal", () => {
  // `skills` is a 451-id vocabulary that resolves to no registry, so it cannot
  // be a reference check. It can still be evidence: whichever unit first claims
  // a skill as `primary` owns it, and a later unit leaning on that skill has a
  // real dependency. This is a floor under the graph, not a definition of it --
  // several units redefine the vocabulary locally and so produce no evidence at
  // all. It is what stops a future edit quietly dropping a live edge.
  const byId = new Map(units.map(item => [item.data.id, item.data]));
  const ordered = [...units].map(item => item.data).sort((left, right) => left.unitNumber - right.unitNumber);
  const owner = new Map();
  for (const data of ordered) {
    for (const lesson of data.lessons) {
      for (const activity of lesson.activities) {
        for (const id of activity.skills?.primary || []) {
          if (!owner.has(id)) owner.set(id, data.id);
        }
      }
    }
  }
  const closure = (unitId, seen = new Set()) => {
    for (const id of byId.get(unitId)?.prerequisiteSkillIds || []) {
      if (seen.has(id)) continue;
      seen.add(id);
      closure(id, seen);
    }
    return seen;
  };
  let corroborated = 0;
  for (const data of ordered) {
    const roots = [...data.prerequisiteSkillIds, ...data.recommendedSkillIds];
    const reachable = new Set(roots);
    for (const root of roots) for (const id of closure(root)) reachable.add(id);
    for (const lesson of data.lessons) {
      for (const activity of lesson.activities) {
        if (!activity.skills) continue;
        for (const id of [...activity.skills.primary, ...activity.skills.supporting]) {
          const source = owner.get(id);
          if (!source || byId.get(source).unitNumber >= data.unitNumber) continue;
          corroborated += 1;
          assert(
            reachable.has(source),
            `${data.id}/${activity.id} uses "${id}" from ${source}, which its graph never reaches`,
          );
        }
      }
    }
  }
  assert(corroborated > 100, `only ${corroborated} cross-unit skill uses found; the evidence scan has broken`);
});

test("the mastery index is a faithful digest of the unit files", () => {
  // A checked-in file the build regenerates: the same contract unit-index.json
  // already lives under. It exists so the mastery map can state every
  // concept's progress without parsing three megabytes of unit JSON, and it is
  // wrong rather than merely stale the moment it disagrees with its source.
  const digests = units
    .map(item => unitDigest(item.data))
    .sort((left, right) => left.unitNumber - right.unitNumber);
  assert.deepEqual(masteryIndex, { schemaVersion: 1, units: digests });
  const cited = new Set(digests.flatMap(unit => unit.activities.map(activity => activity.id)));
  for (const unit of digests) {
    for (const entry of unit.coverage) {
      for (const bucket of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
        for (const ref of entry[bucket]) assert(cited.has(ref), `${entry.id} cites ${ref}, which the digest omits`);
      }
    }
  }
});

test("unit catalog groups implemented units into curriculum arcs", () => {
  assert.equal(unitCatalog.schemaVersion, 2);
  assert.deepEqual(unitCatalog.arcs, [
    { id: "foundations", arcNumber: 1, title: "Foundations", unitNumbers: [1, 2, 3, 4, 5, 6] },
    { id: "fluency-tracks", arcNumber: 2, title: "Fluency tracks", unitNumbers: [7, 8, 9, 10, 11] },
    { id: "automation", arcNumber: 3, title: "Automation", unitNumbers: [12, 13, 14, 15] },
    { id: "integration", arcNumber: 4, title: "Integration and lifelong practice", unitNumbers: [16, 17] },
  ]);
  assert.deepEqual(unitCatalog.units.map(item => item.unitNumber), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
  const assigned = unitCatalog.units.map(item => unitCatalog.arcs.filter(arc => arc.unitNumbers.includes(item.unitNumber)).length);
  assert(assigned.every(count => count === 1), "each implemented unit must belong to exactly one arc");
});

test("Unit 7 curriculum definition is preserved verbatim", () => {
  assert.deepEqual(visualUnit.curriculumDefinition, {
    unit: "7. Visual selection",
    commandsAndConcepts: "`v`, `V`, `Ctrl-v`; `o`, `O`; `gv`; selection operations `d c y x r ~ u U > < = gq`; Visual Block `I A c d x r` and its ragged right edge `$`; selection increment `Ctrl-a` and `g Ctrl-a`",
    prerequisites: "Unit 4; Unit 6 recommended",
    learningOutcome: "Select character, line, and rectangular ranges; modify them, including lines that end in different columns; and decide when selection is clearer than operator-motion",
    representativeExercises: "Indent lines; replace a column marker; prepend text to several rows; reselect and correct the last selection; append past ragged line endings; renumber a reordered list",
    priorityAndPortability: "Core. `Ctrl-v` is semantically important even when a host reserves that chord; the app teaches Vim behavior",
  });
  assert.deepEqual(visualUnit.prerequisiteSkillIds, ["operator-grammar"]);
  assert.deepEqual(visualUnit.recommendedSkillIds, ["text-objects"]);
  assert.equal(visualUnit.lessons.length, 11);
});

test("Unit 8 preserves the focused registers-and-putting curriculum", () => {
  assert.deepEqual(registerUnit.curriculumDefinition, {
    unit: "8. Registers and putting",
    commandsAndConcepts: "Unnamed `\"\"`; yank `\"0`; numbered `\"1`–`\"9`; named `\"a`–`\"z`; append with `\"A`–`\"Z`; black-hole `\"_`; small delete `\"-`; clipboard `\"+`; read-only `\".` `\":` `\"/`; `p P gp gP`; `:registers` as inspection; command-line `Ctrl-r{register}`; Insert-mode `Ctrl-r{register}`",
    prerequisites: "Unit 6, especially `y d c p`; Unit 7 recommended",
    learningOutcome: "Preserve yanks, select storage deliberately, reuse multiple snippets, understand why delete/change affects later puts, and read back what Vim already recorded instead of retyping it",
    representativeExercises: "Delete without overwriting a yank; paste the previous yank after another edit; collect lines into a named register; reuse a confirmed search pattern in a substitution; choose where to put text and where the cursor should land",
    priorityAndPortability: "Core through named, black-hole, and read-only registers. The useful but host-dependent `\"+` clipboard is emulated inside each Vim Wilds exercise and never touches the device clipboard. Numbered recovery, small-delete recovery, and `gp`/`gP` stay on the path marked advanced rather than removed. Insert-mode `Ctrl-r` is native Vim; a host editor that embeds Vim may claim that Ctrl chord by default, so check the host you are in",
  });
  assert.deepEqual(registerUnit.prerequisiteSkillIds, ["text-objects"]);
  assert.deepEqual(registerUnit.recommendedSkillIds, ["visual-selection"]);
  assert.equal(registerUnit.lessons.length, 12);
  assert.equal(registerUnit.lessons.flatMap(lesson => lesson.activities).filter(activity => activity.type === "demo" || activity.type === "exercise").length, 56);
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
    "read-only registers",
    "Insert-mode register insertion",
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

// The two halves of the old long-range-navigation unit share one contract: every
// activity is navigation-only, runs on a long buffer behind a fixed seven-row
// window, and reconstructs the marks or history it depends on during setup.
function assertNavigationContract(data, expectedRunnable) {
  const activities = data.lessons.flatMap(lesson => lesson.activities);
  const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  const ids = new Set(activities.map(activity => activity.id));
  assert.equal(runnable.length, expectedRunnable);
  for (const lesson of data.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
  }
  for (const entry of data.reference) {
    for (const ref of entry.exampleActivityRefs) assert(ids.has(ref), `${entry.id} references missing ${ref}`);
  }
  for (const item of data.coverage) {
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      for (const ref of item[phase]) assert(ids.has(ref), `${item.concept} references missing ${ref}`);
    }
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
  return runnable;
}

test("Unit 9 preserves the position-memory curriculum and deterministic viewport contract", () => {
  assert.deepEqual(positionUnit.curriculumDefinition, {
    unit: "9. Position memory",
    commandsAndConcepts: "`m{char}`; `'` and backtick jumps; special marks such as `'.`, ```.```, `'^`, ```^```, `'[`, `']`; `Ctrl-o`, `Ctrl-i`; `g;`, `g,`; `gi`, `gv`; advanced bracket/section motions",
    prerequisites: "Unit 3; Unit 4 recommended",
    learningOutcome: "Leave a position, work somewhere else, and return to it — by mark, by jump, by change, by insertion, or by selection",
    representativeExercises: "Mark two sites and shuttle between them; inspect a distant definition and return; revisit the last change; resume the last insertion",
    priorityAndPortability: "Core through marks, the jump list, and the change list. Bracket marks and code-section motions are advanced, and the section motions read boundaries out of file syntax. All are native Vim; a host editor that embeds Vim may claim `Ctrl-o` and `Ctrl-i` for its own navigation, so check the host you are in",
  });
  assert.deepEqual(positionUnit.prerequisiteSkillIds, ["entering-changing-text"]);
  assert.deepEqual(positionUnit.recommendedSkillIds, ["operator-grammar"]);
  assert.equal(positionUnit.lessons.length, 6);
  assert.deepEqual(positionUnit.coverage.map(item => item.concept), [
    "named marks and quote/backtick jumps",
    "previous context and jump list",
    "last change insertion and selection",
    "previous operated range marks",
    "g; and g, change list",
    "advanced bracket and section motions",
  ]);
  // The unit ends on a summary, which is what renders the continuation into
  // Unit 10; without one the progression stops here.
  assert.equal(positionUnit.lessons.at(-1).activities.at(-1).type, "summary");

  const runnable = assertNavigationContract(positionUnit, 31);
  const authoredCommands = runnable.flatMap(keysOf).join("");
  assert(!authoredCommands.includes("#"), "specialized preprocessor motions stay outside Unit 9");
  assert(!positionUnit.reference.some(entry => /comment|preprocessor/i.test(entry.title)), "specialized comment motions stay outside Unit 9");
});

test("Unit 10 preserves the viewport-control curriculum and deterministic viewport contract", () => {
  assert.deepEqual(viewportUnit.curriculumDefinition, {
    unit: "10. Viewport control",
    commandsAndConcepts: "`H M L`; `zt zz zb`; `Ctrl-f`, `Ctrl-b`, `Ctrl-d`, `Ctrl-u`, `Ctrl-e`, `Ctrl-y`; combining a framing command with a stored position",
    prerequisites: "Unit 9",
    learningOutcome: "Move the window rather than the cursor: reach a visible landmark, frame the line you are working on, and travel a long file without losing context",
    representativeExercises: "Center a target line; jump to the last visible row; page through a long file and return; reveal the next rows without moving the cursor",
    priorityAndPortability: "Core through `H M L`, `zt zz zb`, and `Ctrl-d`/`Ctrl-u`. One-row scrolling with `Ctrl-e`/`Ctrl-y` is advanced. All are native Vim; a host editor that embeds Vim may claim the Ctrl chords by default, so check the host you are in",
  });
  assert.deepEqual(viewportUnit.prerequisiteSkillIds, ["position-memory"]);
  assert.deepEqual(viewportUnit.recommendedSkillIds, []);
  assert.equal(viewportUnit.lessons.length, 5);
  assert.deepEqual(viewportUnit.coverage.map(item => item.concept), [
    "H M L",
    "zt zz zb",
    "page and half-page movement",
    "one-line viewport scrolling",
    "integrated position and viewport control",
  ]);
  assertNavigationContract(viewportUnit, 20);
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

test("Unit 11 curriculum definition is preserved verbatim", () => {
  assert.deepEqual(unit.curriculumDefinition, {
    unit: "11. Repeatable editing",
    commandsAndConcepts: "Deliberate `.`, `;`/`,` plus `.`, `n`/`N` plus `.`, `@:`, `&`, `:~`; count vs repeat; repeat-friendly cursor placement",
    prerequisites: "Unit 4; Units 5 and 8 recommended",
    learningOutcome: "Design one change that can be replayed across nearby or searched instances, and recognize when repeat is the wrong tool",
    representativeExercises: "Change one field and repeat on later rows; search for a token and apply the same edit; compare `3dd` with repeated `dd`; rerun a recent Ex change",
    priorityAndPortability: "Core. `@:`, `&`, and `:~` bridge into Arc 3 and appear only after basic Command-line use",
  });
});

test("Unit 12 preserves the command-line ranges curriculum and complete lesson flow", () => {
  assert.deepEqual(rangeUnit.curriculumDefinition, {
    unit: "12. Command-line ranges and line operations",
    commandsAndConcepts: "`:`; addresses `.`, `$`, numbers, marks, search addresses; `%`; ranges with `,` and `;`; offsets; visual range `'<,'>`; `:delete`, `:yank`, `:put`, `:copy`/`:t`, `:move`/`:m`, `:join`, `:sort` with the `n`, `u`, and `/pat/` flags; safe undo and preview habits",
    prerequisites: "Unit 2; Unit 9 recommended",
    learningOutcome: "Read and construct a range, then apply a deterministic line operation to it",
    representativeExercises: "Move a helper below another function; copy a fixture; delete matching line numbers; sort selected imports; join a range",
    priorityAndPortability: "Core automation. Command availability and undo grouping can vary in reimplementations, so the app defines and tests its supported behavior",
  });
  assert.deepEqual(rangeUnit.prerequisiteSkillIds, ["cursor-movement"]);
  assert.deepEqual(rangeUnit.recommendedSkillIds, ["position-memory"]);
  assert.equal(rangeUnit.lessons.length, 8);
  const activities = rangeUnit.lessons.flatMap(lesson => lesson.activities);
  const runnableActivities = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnableActivities.length, 35);
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

  // `:sort` and `:sort!` alone leave out the two variants people actually reach
  // for and the one that ignores a prefix. Each flag is asserted through the
  // canonical it is taught by, so retargeting an exercise cannot quietly drop it.
  const sortCanonicals = new Map(runnableActivities.map(activity => [activity.id, keysOf(activity).join("")]));
  assert.equal(sortCanonicals.get("sort-numeric-range"), ":2,9sort nEnter");
  assert.equal(sortCanonicals.get("dedupe-sorted-range"), ":2,9sort uEnter");
  assert.equal(sortCanonicals.get("sort-on-pattern"), ":2,9sort /.*-/Enter");

  // The comma-versus-semicolon contrast is the point of `compose-ranges`, and it
  // has to be an answer rather than only a claim in the theory and the demo.
  const semicolonExercise = activities.find(activity => activity.id === "semicolon-relative-delete");
  assert.equal(semicolonExercise.type, "exercise");
  assert(keysOf(semicolonExercise).join("").includes(";"), "the semicolon contrast must be exercised");
});

test("Unit 13 preserves the substitution curriculum and complete lesson flow", () => {
  assert.deepEqual(substitutionUnit.curriculumDefinition, {
    unit: "13. Substitution and practical regex",
    commandsAndConcepts: "`:s/pattern/replacement/flags`; line, numeric, visual, and `%` ranges; flags `g c i I n`; empty/reused pattern or replacement; alternate delimiters; `. * \\+ \\? \\{m,n}`; `^ $`; classes and negation; Vim classes such as `\\d`, `\\w`, `\\s`; groups `\\(…\\)`; alternation `\\|`; word boundaries `\\< \\>`; captures; `\\zs \\ze`; very magic `\\v`; replacement `&`, `\\0`–`\\9`, `\\r`, case conversion, and `\\=` expressions",
    prerequisites: "Unit 5 search; Unit 12 ranges; Unit 11 recommended",
    learningOutcome: "Perform safe local and buffer-wide substitutions, capture structure, preview impact, and know when regex is too brittle",
    representativeExercises: "Rename exact tokens; swap captured fields; edit only part of a match; normalize declarations; confirm replacements; count matches without changing them",
    priorityAndPortability: "Core through captures and confirmation. `\\zs`, `\\ze`, case conversion, and expression replacement are advanced",
  });
  assert.deepEqual(substitutionUnit.prerequisiteSkillIds, ["precision-motions-search", "command-line-ranges-line-operations"]);
  assert.deepEqual(substitutionUnit.recommendedSkillIds, ["repeatable-editing"]);
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

test("Unit 14 preserves the macro curriculum and complete lesson flow", () => {
  assert.deepEqual(macroUnit.curriculumDefinition, {
    unit: "14. Macros",
    commandsAndConcepts: "`q{register}…q`; `@{register}`; `@@`; counts such as `10@a`; append with `qA`; inspect, put, and edit macro text; stable anchors over irregular rows; deliberate final cursor position; stopping on failed motion/search; recognizing when a macro is the wrong tool; optional recursion",
    prerequisites: "Units 8 and 11; Unit 5 recommended",
    learningOutcome: "Record a robust transformation, replay it safely, inspect or repair it, state the assumptions that make it valid, and recognize the uniform case where a smaller tool wins",
    representativeExercises: "Comment irregular calls; restructure repeated object entries; record on one row and apply to selected instances; repair a macro with a bad final motion; let a malformed row stop a counted replay",
    priorityAndPortability: "Core automation. Recursive macros are optional and never required for normal progression",
  });
  assert.deepEqual(macroUnit.prerequisiteSkillIds, ["registers-putting", "repeatable-editing"]);
  assert.deepEqual(macroUnit.recommendedSkillIds, ["precision-motions-search"]);
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
  assert.equal(activities.find(activity => activity.id === "count-scattered-csv").editor.viewportRows, 7);
  assert.match(activities.find(activity => activity.id === "macros-unit-summary").body, /Recursive macros exist, but they remain optional/);
  // The unit now has to admit when a macro is the wrong tool, so the closing
  // lesson pairs the macro-wins choice with a case a substitution owns.
  assert.match(activities.find(activity => activity.id === "macros-unit-summary").body, /uniform and adjacent/);
  assert.equal(activities.find(activity => activity.id === "choose-normal-over-macro").correctOptionId, "substitute");
});

test("Unit 14 teaches macros at a scale and irregularity that justify recording", () => {
  const runnableActivities = macroUnit.lessons.flatMap(lesson => lesson.activities)
    .filter(activity => activity.type === "demo" || activity.type === "exercise");
  const exercises = runnableActivities.filter(activity => activity.type === "exercise");

  // What justifies recording a macro is the number of rows the replay
  // transforms, not the length of the file those rows sit in. This used to
  // assert a twelve-line minimum, which padded nineteen of these activities with
  // rows their macros never touch; the count below is the property that rule was
  // reaching for, and it costs the learner no screen space to satisfy.
  const transformedRows = activity => {
    const { lines: before } = activity.scenario.initial;
    const { lines: after } = activity.scenario.target;
    return Array.from({ length: Math.max(before.length, after.length) })
      .filter((_, index) => before[index] !== after[index]).length;
  };
  for (const activity of runnableActivities) {
    if (keysOf(activity).includes("@")) {
      assert(transformedRows(activity) >= 3, `${activity.id} replays a macro over ${transformedRows(activity)} rows`);
    }

    // Seven rows is the phone ceiling. There is deliberately no minimum: a
    // buffer is as long as its own macro needs, and an activity whose work
    // already fits on screen takes no window at all.
    const rows = activity.editor?.viewportRows;
    const lines = activity.scenario.initial.lines.length;
    if (rows === undefined) {
      assert(lines <= 7, `${activity.id} shows ${lines} rows at once`);
      assert.equal(activity.scenario.initial.viewport, undefined, `${activity.id} asserts a window it has not fixed`);
      continue;
    }
    assert(rows <= 7, `${activity.id} window is ${rows} rows`);
    assert(lines > rows, `${activity.id} windows ${lines} lines into ${rows} rows for nothing`);
    assert.deepEqual(
      activity.scenario.initial.viewport,
      { topLine: 0, bottomLine: rows - 1 },
      `${activity.id} must open on its authored window`,
    );
    assert.equal(activity.editor.viewportDependent, undefined, `${activity.id} windows for presentation only`);
    assert(activity.scenario.initial.cursor[0] < rows, `${activity.id} must start inside its window`);
  }

  // Phases used to escalate by reskinning the same key stream into another
  // language. No two activities may share a canonical again.
  const streams = new Map();
  for (const activity of runnableActivities) {
    const stream = keysOf(activity).join(" ");
    assert(!streams.has(stream), `${activity.id} repeats the canonical of ${streams.get(stream)}`);
    streams.set(stream, activity.id);
  }

  // `0f:` used to be the answer nearly every time, which trained skeleton
  // matching instead of structural analysis.
  const findColon = exercises.filter(activity => keysOf(activity).join("").includes("0f:"));
  assert(findColon.length <= exercises.length / 4, `0f: appears in ${findColon.length} of ${exercises.length} exercises`);

  // Failure is only instructive when a row genuinely breaks the macro, so a
  // counted replay has to stop with work visibly left undone.
  const guarded = runnableActivities.filter(activity => {
    const changed = activity.scenario.target.lines.filter((line, index) => line !== activity.scenario.initial.lines[index]);
    const trailingUnchanged = activity.scenario.target.lines.slice(activity.scenario.target.cursor[0] + 1)
      .some((line, index) => line === activity.scenario.initial.lines[activity.scenario.target.cursor[0] + 1 + index]);
    return changed.length && trailingUnchanged && /\d@a/.test(activity.script.commandGroups.map(group => group.display).join(" "));
  });
  assert(guarded.length >= 4, "the unit must keep counted replays that stop before untouched rows");
});

test("Unit 15 preserves the Global-Normal curriculum and complete lesson flow", () => {
  assert.deepEqual(automationUnit.curriculumDefinition, {
    unit: "15. Global and Normal automation",
    commandsAndConcepts: "`:normal`, `:normal!`; range and visual application; `:global`/`:g`; `:vglobal`/`:v`; global delete, substitute, normal commands, and macros; `:copy`/`:move` relocation by predicate; previewing a predicate before it runs; undo grouping; combined predicates and transformations",
    prerequisites: "Units 13 and 14",
    learningOutcome: "Apply Normal-mode edits across a controlled line set, relocate matching lines, and choose the lowest-risk automation mechanism",
    representativeExercises: "Run a text-object edit on selected lines; delete debug lines; modify only declarations matching a predicate; execute a macro over matches; gather matching lines at a chosen address",
    priorityAndPortability: "Core advanced automation. The distinction between mapped and unmapped Normal commands is explained, while mappings themselves stay out of scope",
  });
  assert.deepEqual(automationUnit.prerequisiteSkillIds, ["substitution-practical-regex", "macros"]);
  assert.deepEqual(automationUnit.recommendedSkillIds, []);
  assert.equal(automationUnit.lessons.length, 9);
  const activities = automationUnit.lessons.flatMap(lesson => lesson.activities);
  const runnableActivities = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnableActivities.length, 38);
  assert.equal(runnableActivities.filter(activity => activity.type === "exercise").length, 29);
  assert.deepEqual(automationUnit.coverage.map(item => item.concept), [
    "range application with :normal", ":normal! and visual application", ":global delete", ":vglobal inversion",
    "global substitution", "global Normal commands", "global macro execution", ":global collect and reorder",
    "combined automation and tool choice",
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

test("Unit 16 preserves the capstone curriculum and its choose-then-compare shape", () => {
  assert.deepEqual(capstoneUnit.curriculumDefinition, {
    unit: "16. Real-code workflow capstones",
    commandsAndConcepts: "No new command families. Choosing between a structural change, a bounded range, a protected move, a repeat, and a substitution; matching the reach of an edit to the number and ambiguity of its sites; taking a range from a boundary the file already states; protecting text across intervening deletes; comparing a chosen solution with a working alternative by clarity, setup cost, repeatability, and risk",
    prerequisites: "Units 7 and 15, which between them reach Units 1–15; Unit 9 recommended",
    learningOutcome: "Complete a staged edit on realistic code by selecting a mechanism before touching the keys, and justify the selection against an alternative that also works",
    representativeExercises: "Repair an argument list with a text object, a till-motion, and a protected move; rename a local through five uses and the same token through a longer file; restore a joined chain, a reflowed paragraph, and a numbered list; anchor a recording so an irregular row stops or is skipped; count and confirm a pattern before committing it; relocate two snippets across deletes that would overwrite them; edit only the lines a predicate selects; return to each correction site by position rather than by pattern",
    priorityAndPortability: "Integration rather than instruction. Every command here is already taught in Units 1\u201315 and every capstone closes by comparing its solution with a mechanism that also reaches the target",
  });
  assert.deepEqual(capstoneUnit.lessons.map(lesson => lesson.id), [
    "call-site-surgery", "string-and-name-repair", "shape-the-block", "irregular-structure-macros",
    "search-driven-cleanup", "move-without-losing-it", "predicate-batch-editing", "review-and-correct",
  ]);
  assert.deepEqual(capstoneUnit.coverage.map(item => item.concept), [
    "choosing between structural, range, register, and repeat edits at call sites",
    "matching rename reach to occurrence count and ambiguity",
    "choosing the boundary that already describes a formatting fix",
    "anchoring a recording to structure so irregular rows stop or skip predictably",
    "escalating from counting to repeating to confirming before committing a pattern",
    "protecting text in transit across intervening deletes",
    "addressing lines by predicate rather than position across a windowed file",
    "returning to a correction site by position rather than by pattern",
  ]);

  // A capstone is not a lesson with a quiz bolted on. It states the job, asks
  // for the mechanism before any keys are pressed, works through staged
  // targets, and only then runs the alternative it turned down.
  for (const lesson of capstoneUnit.lessons) {
    // Without the opt-in the runtime sorts every choice and demonstration into
    // the lesson's closing group, which would put the mechanism question after
    // the work it is supposed to precede.
    assert.equal(lesson.flow, "authored", `${lesson.id} must keep its authored order`);
    const [brief, decision] = lesson.activities;
    assert.equal(brief.type, "theory", `${lesson.id} must open with its job brief`);
    assert.equal(decision.type, "choice", `${lesson.id} must ask for the mechanism before any keys`);
    assert(decision.options.length >= 3, `${lesson.id} must offer real alternatives`);
    assert(decision.remediationRef, `${lesson.id} choice needs a remediation route`);

    const contrast = lesson.activities.filter(activity => activity.type === "demo");
    assert.equal(contrast.length, 1, `${lesson.id} must run exactly one rejected alternative`);
    assert.equal(brief.demoRef, contrast[0].id, `${lesson.id} brief must point at its comparison`);

    const closing = lesson.activities.at(-1);
    assert.equal(closing.type, "summary", `${lesson.id} must close on its rationale`);
    // The rationale compares alternatives on judgement, not on key count. A
    // capstone that argues from brevity has missed the curriculum's point.
    assert(!/keystroke|fewer keys|shortest/i.test(closing.body), `${lesson.id} rationale argues from key count`);

    const staged = lesson.activities.filter(activity => activity.type === "exercise");
    assert(staged.length >= 3, `${lesson.id} needs several staged targets`);
    assert.equal(staged.at(-1).phase, "challenge", `${lesson.id} must end its stages unaided`);
    assert.deepEqual(staged.at(-1).hints, [], `${lesson.id} final stage must withhold hints`);
  }

  for (const activity of capstoneUnit.lessons.flatMap(lesson => lesson.activities)
    .filter(activity => activity.type === "demo" || activity.type === "exercise")) {
    assert.equal(activity.provenance.nativeValidation, "passed", `${activity.id} native validation`);
    assert.equal(activity.provenance.browserConformance, "passed", `${activity.id} browser conformance`);
  }
});

test("the authored lesson flow stays opt-in and is used only where order carries meaning", () => {
  assert.deepEqual(schema.$defs.lesson.properties.flow.const, "authored");
  const optedIn = [];
  for (const { data } of units) {
    for (const lesson of data.lessons) {
      if (lesson.flow === undefined) continue;
      optedIn.push(`${data.id}/${lesson.id}`);
      // Anything stranded between two stages would be silently hoisted to the
      // opening, so the flag only makes sense for lessons without one.
      const practices = lesson.activities.map((activity, index) => (activity.type === "exercise" ? index : -1)).filter(index => index >= 0);
      for (const [index, activity] of lesson.activities.entries()) {
        assert(
          activity.type === "exercise" || index < practices.at(0) || index > practices.at(-1),
          `${lesson.id} strands ${activity.id} between its stages`,
        );
      }
    }
  }
  assert.deepEqual(optedIn, capstoneUnit.lessons.map(lesson => `real-code-workflow-capstones/${lesson.id}`));
});

test("Unit 16 introduces no command that Units 1-15 have not already taught", () => {
  const tokensOf = data => {
    const tokens = new Set();
    for (const lesson of data.lessons) {
      for (const activity of lesson.activities) {
        if (!activity.script) continue;
        for (const step of activity.script.steps) tokens.add(typeof step === "string" ? step : step.key);
        for (const step of activity.scenario.initial.setup?.steps || []) tokens.add(typeof step === "string" ? step : step.key);
      }
    }
    return tokens;
  };
  const taught = new Set();
  for (const { data } of units.filter(item => item.data.unitNumber < 16)) {
    for (const token of tokensOf(data)) taught.add(token);
  }
  const introduced = [...tokensOf(capstoneUnit)].filter(token => !taught.has(token));
  assert.deepEqual(introduced, [], "a capstone that introduces a command has failed");
});

test("Unit 17 is a reusable Mastery wrapper rather than a padded command lesson", () => {
  assert.equal(masteryUnit.surface, "mastery");
  assert.equal(masteryUnit.unitNumber, 17);
  assert.deepEqual(masteryUnit.coverage, []);
  assert.deepEqual(masteryUnit.reference, []);
  assert.deepEqual(
    masteryUnit.lessons.flatMap(lesson => lesson.activities).map(activity => activity.id),
    ["mastery-loop-brief"],
  );
  assert.match(masteryUnit.lessons[0].activities[0].body, /first circuit closes this chapter/i);
  assert.deepEqual(schema.properties.surface.enum, ["lesson", "mastery"]);
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
  assert.deepEqual(cursorUnit.recommendedSkillIds, []);
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
    commandsAndConcepts: "`i I a A o O`; counts with Insert commands (`3i`, `5o`); `x X`; `r R`; `s S`; `J gJ`; `u`, `Ctrl-r`; `~`, `g~`, `gu`, `gU`; `Ctrl-a`, `Ctrl-x`; Insert-mode `Ctrl-w`, `Ctrl-u`, `Ctrl-o`",
    prerequisites: "Unit 2",
    learningOutcome: "Choose a precise entry/change command, undo safely, and perform common local transformations",
    representativeExercises: "Append an argument; open a line; build a divider with a counted insert; replace a delimiter; join a wrapped statement; change case; increment a version number",
    priorityAndPortability: "Core, with `gJ` and numeric changes introduced after the everyday commands; Replace mode is marked advanced. The Insert-mode command keys are native Vim; a host editor that embeds Vim may claim those Ctrl chords by default, so check the host you are in",
  });
  assert.deepEqual(changingUnit.prerequisiteSkillIds, ["cursor-movement"]);
  assert.deepEqual(changingUnit.recommendedSkillIds, []);
  assert.equal(changingUnit.releaseStatus, "authoring");
  assert.equal(changingUnit.lessons.length, 12);
  assert.deepEqual(changingUnit.coverage.map(item => item.concept), [
    "i I a A", "o O", "counted insert and open", "x X r", "s S", "R", "u and Ctrl-r",
    "Insert-mode Ctrl-w, Ctrl-u, and Ctrl-o", "J and gJ",
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
    prerequisites: "Unit 3",
    learningOutcome: "Compose operators with motions, predict the affected range, put text, and make a change deliberately repeatable",
    representativeExercises: "Delete two words; change to line end; duplicate a line; indent a block by motion; reflow a paragraph; repeat a prepared change",
    priorityAndPortability: "Core. Host formatting may affect `=` and `gq`, so exercises use deterministic app behavior",
  });
  assert.deepEqual(operatorUnit.prerequisiteSkillIds, ["entering-changing-text"]);
  assert.deepEqual(operatorUnit.recommendedSkillIds, []);
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
    commandsAndConcepts: "`f F t T ; ,`; `/ ? n N`; `* # g* g#`; `d/pat` `y/pat` `c?pat`; `gn gN`; `%`; `(`, `)`, `{`, `}`",
    prerequisites: "Unit 2; Unit 4 recommended",
    learningOutcome: "Select the smallest reliable motion for nearby punctuation, repeated text, matching delimiters, sentences, and paragraphs",
    representativeExercises: "Delete until a quote; repeat a comma find; change the next search match; delete up to the next match; jump between brackets; move by paragraphs in prose or comments",
    priorityAndPortability: "Core. Search and pair matching remain text-based rather than IDE-semantic, and sentence motions are marked optional",
  });
  assert.deepEqual(precisionUnit.prerequisiteSkillIds, ["cursor-movement"]);
  assert.deepEqual(precisionUnit.recommendedSkillIds, ["operator-grammar"]);
  assert.equal(precisionUnit.releaseStatus, "authoring");
  assert.equal(precisionUnit.lessons.length, 10);
  assert.deepEqual(precisionUnit.coverage.map(item => item.concept), [
    "f F t T", "; and ,", "/ ? n N", "* # g* g#", "operator plus search range", "gn and gN", "% matching delimiters",
    "{ and } paragraph motions", "( and ) sentence motions", "integrated precision motion and search",
  ]);
  const activities = precisionUnit.lessons.flatMap(lesson => lesson.activities);
  const runnable = activities.filter(activity => activity.type === "demo" || activity.type === "exercise");
  assert.equal(runnable.length, 42);
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
    prerequisites: "Unit 4; Unit 5 recommended",
    learningOutcome: "Choose inside versus around and apply any learned operator to a structural object",
    representativeExercises: "Change a quoted value; delete function arguments; replace an object literal; nest a list block; remove a tag element with its markup; finish an item retrieved by search",
    priorityAndPortability: "Core. Tag and angle-bracket objects are exercised only where the buffer makes their boundaries unambiguous, and angle-bracket objects are marked advanced",
  });
  assert.deepEqual(textObjectUnit.prerequisiteSkillIds, ["operator-grammar"]);
  assert.deepEqual(textObjectUnit.recommendedSkillIds, ["precision-motions-search"]);
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
  assert.equal(visualRunnable.length, 58);
  assert.deepEqual(visualUnit.coverage.map(item => item.concept), [
    "Visual Character, Visual Line, and Visual Block",
    "Visual selection d c y x r operations",
    "Visual Line operations",
    "o and O selection endpoints",
    "gv reselection",
    "selection case, shift, reindent, and gq",
    "Visual Block c d x r",
    "Visual Block I and A",
    "Visual Block ragged right edge with $",
    "Selection increment with Ctrl-a and g Ctrl-a",
    "Visual selection versus operator-motion",
  ]);
  const activityIds = new Set(visualActivities.map(activity => activity.id));
  const exercises = visualActivities.filter(activity => activity.type === "exercise");
  const exerciseChallenges = exercises.filter(activity => activity.phase === "challenge");
  const choiceChallenges = visualActivities.filter(activity => activity.type === "choice" && activity.phase === "challenge");
  assert.equal(exercises.length, 45);
  assert.equal(exerciseChallenges.length, 11);
  assert.equal(choiceChallenges.length, 11);
  for (const lesson of visualUnit.lessons) {
    const phases = new Set(lesson.activities.map(activity => activity.phase));
    for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
      assert(phases.has(phase), `${lesson.id} is missing ${phase}`);
    }
    assert(
      lesson.activities.some(activity => activity.type === "exercise" && activity.phase === "challenge"),
      `${lesson.id} is missing an executable challenge`,
    );
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

  assertCanonicalsAreDistinct(visualUnit);

  for (const activity of exerciseChallenges) {
    assert(["v", "V", "Ctrl-v"].includes(keysOf(activity)[0]), `${activity.id} does not choose a Visual shape`);
  }
  assert.equal(new Set(exerciseChallenges.map(activity => activity.languageId)).size, 6);
  assert.equal(exerciseChallenges.filter(activity => activity.languageId === "python").length, 3);

  const nonCodeProfiles = new Set(["prose", "log", "csv", "markdown"]);
  assert.equal(exercises.filter(activity => nonCodeProfiles.has(activity.languageId)).length, 16);

  const activityById = new Map(visualActivities.map(activity => [activity.id, activity]));
  assert.deepEqual(keysOf(activityById.get("integrated-column-marker")), ["Ctrl-v", "2", "j", "r", "=", "0", "v", "e", "U"]);
  assert.deepEqual(keysOf(activityById.get("integrated-reselect-correction")), ["V", "2", "j", "~", "g", "v", "U"]);
  assert.deepEqual(keysOf(activityById.get("integrated-character-edit")), ["v", "t", ",", "c", "a", "c", "t", "i", "v", "e", "Escape", "j", "V", "d"]);
  assert.deepEqual(keysOf(activityById.get("visual-strategy-demo")), ["v", "e", "U", "V", "j", ">"]);
  assert.deepEqual(keysOf(activityById.get("line-indent-branch-challenge")), ["V", "j", ">", "G", "V", "<"]);
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
  assertCanonicalsAreDistinct(registerUnit);
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

const navigationRunnable = [positionUnit, viewportUnit].flatMap(data =>
  data.lessons.flatMap(lesson => lesson.activities)
    .filter(activity => activity.type === "demo" || activity.type === "exercise")
    .map(activity => ({ unitNumber: data.unitNumber, activity })));
// Every runnable in Unit 10 moves the window rather than the buffer, so its
// cursor is a property of the rendered seven-row frame that headless Vim does
// not reproduce. The browser conformance suite owns those positions.
const nativeViewportActivityIds = new Set(viewportUnit.lessons
  .flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise")
  .map(activity => activity.id));

for (const { unitNumber, activity } of navigationRunnable) {
  test(`native Vim Unit ${unitNumber} content: ${activity.id}`, () => {
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
  test(`native Vim Unit 12 content: ${activity.id}`, () => {
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
  test(`native Vim Unit 13 content: ${activity.id}`, () => {
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
  test(`native Vim Unit 14 content: ${activity.id}`, () => {
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
  test(`native Vim Unit 15 content: ${activity.id}`, () => {
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

const capstoneRunnable = capstoneUnit.lessons.flatMap(lesson => lesson.activities)
  .filter(activity => activity.type === "demo" || activity.type === "exercise");

for (const activity of capstoneRunnable) {
  test(`native Vim Unit 16 content: ${activity.id}`, () => {
    const setup = activity.scenario.initial.setup;
    const setupKeys = (setup?.steps || []).map(step => typeof step === "string" ? step : step.key);
    const cursor = setup?.cursor || activity.scenario.initial.cursor;
    const keys = keysOf(activity);
    const registerNames = [...new Set([
      ...Object.keys(activity.scenario.target.registers || {}),
      ...activity.script.checkpoints.flatMap(checkpoint => Object.keys(checkpoint.registers || {})),
    ])];
    if (setup) {
      const setupState = runNativeVim({ initialCode: activity.scenario.initial.lines, cursor, keys: setupKeys, registerNames });
      assert.deepEqual(setupState.code, activity.scenario.initial.lines, `${activity.id} setup text`);
      assert.deepEqual(setupState.cursor, activity.scenario.initial.cursor, `${activity.id} setup cursor`);
    }
    const options = {
      initialCode: activity.scenario.initial.lines,
      cursor,
      setupKeys,
      keys,
      registerNames,
      textWidth: activity.editor?.textWidth,
      viewportRows: activity.editor?.viewportRows,
    };
    const result = runNativeVim(options);
    assert.deepEqual(result.code, activity.scenario.target.lines);
    assert.deepEqual(result.cursor, activity.scenario.target.cursor);
    assert.equal(result.mode, activity.scenario.target.mode);
    for (const [name, expected] of Object.entries(activity.scenario.target.registers || {})) {
      assert.deepEqual(result.registers[name], expected, `${activity.id} target register ${name}`);
    }
    for (const checkpoint of activity.script.checkpoints) {
      const checkpointResult = runNativeVim({ ...options, keys: keys.slice(0, checkpoint.afterStep) });
      if (checkpoint.lines) assert.deepEqual(checkpointResult.code, checkpoint.lines, `${activity.id} checkpoint ${checkpoint.afterStep} text`);
      assert.deepEqual(checkpointResult.cursor, checkpoint.cursor, `${activity.id} checkpoint ${checkpoint.afterStep} cursor`);
      // A pending Visual selection does not survive headless replay, so those
      // checkpoints are authored from the browser's reading and verified there;
      // every other mode is asserted against native Vim here. Unit 7 draws the
      // same line for the same reason.
      if (!checkpoint.mode.startsWith("visual")) {
        assert.equal(checkpointResult.mode, checkpoint.mode, `${activity.id} checkpoint ${checkpoint.afterStep} mode`);
      }
      for (const [name, expected] of Object.entries(checkpoint.registers || {})) {
        assert.deepEqual(checkpointResult.registers[name], expected, `${activity.id} checkpoint ${checkpoint.afterStep} register ${name}`);
      }
    }
  });
}

test("Unit 14 failure guards stop before later macro keys", () => {
  const byId = new Map(macroRunnable.map(activity => [activity.id, activity]));

  // The find has nothing to reach on the malformed row, so the run ends there
  // and the eight rows below it keep their original separator.
  const stopped = byId.get("failed-semicolon-demo");
  assert.deepEqual(stopped.scenario.target.lines.slice(7, 10), ["team=core", "zone a", "site;hq"]);
  assert.deepEqual(stopped.scenario.target.cursor, [8, 0]);

  // A search-advancing macro stops the same way once nothing matches, which is
  // what makes a generous count safe.
  const exhausted = byId.get("failed-search-python");
  assert.equal(exhausted.scenario.target.lines.filter(line => line.startsWith("  # print")).length, 4);
  assert.equal(exhausted.scenario.target.lines.filter(line => /^ {2}print/.test(line)).length, 0);

  assert.equal(byId.get("append-advance-demo").scenario.target.registers.a.text, "f-r_j0");
  assert.equal(byId.get("append-shell-pipes").scenario.target.registers.a.text, "f|r=$xj0");
  assert.equal(byId.get("repair-delimiter-macro").scenario.target.registers.a.text, "f;r:j0");
  assert.equal(byId.get("repair-final-motion").scenario.target.registers.a.text, "f,r;j0");
});

test("native Vim method-boundary fixture covers all four directions", () => {
  const lines = navigationRunnable.find(item => item.activity.id === "method-start-mix").activity.scenario.initial.lines;
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

test("material off the core path is marked rather than removed", () => {
  // Nothing leaves the curriculum for being rare. A lesson that is advanced or
  // host-dependent keeps its full five-phase cycle and carries a `track` plus a
  // one-sentence `trackNote` explaining the weight. The fixed lead phrases make
  // every marked lesson greppable from the content as well as from the schema.
  const leadPhrases = {
    advanced: "Advanced and less commonly used:",
    optional: "Optional — depends on configuration or file type:",
  };
  assert.deepEqual(schema.$defs.lesson.properties.track.enum, ["core", "advanced", "optional"]);
  assert.equal(schema.$defs.lesson.properties.trackNote.type, "string");
  assert.deepEqual(schema.$defs.lesson.if, { required: ["track"] });
  assert.deepEqual(schema.$defs.lesson.then, { required: ["trackNote"] });

  let marked = 0;
  for (const { data } of units) {
    for (const lesson of data.lessons) {
      if (lesson.track === undefined) {
        assert.equal(lesson.trackNote, undefined, `${data.id}/${lesson.id} has a trackNote without a track`);
        continue;
      }
      // Core is the default and is expressed by absence, so writing it out
      // would make the badge and the grep both meaningless.
      assert(lesson.track !== "core", `${data.id}/${lesson.id} must omit track rather than declare "core"`);
      assert(leadPhrases[lesson.track], `${data.id}/${lesson.id} has unknown track ${lesson.track}`);
      assert(
        lesson.trackNote?.startsWith(leadPhrases[lesson.track]),
        `${data.id}/${lesson.id} trackNote must open with "${leadPhrases[lesson.track]}"`,
      );
      // A marked lesson is still a full lesson: the phase contract applies.
      const phases = new Set(lesson.activities.map(activity => activity.phase));
      for (const phase of ["explain", "demonstrate", "isolate", "mix", "challenge"]) {
        assert(phases.has(phase), `${data.id}/${lesson.id} is marked ${lesson.track} but is missing ${phase}`);
      }
      marked += 1;
    }
  }
  assert(marked > 0, "the marker exists to be used");
});

test("viewport dependence is declared wherever a semantic viewport is asserted", () => {
  assert.deepEqual(schema.$defs.editorConfig.properties.viewportDependent, {
    type: "boolean",
    description: "Declare that this activity's correctness depends on the visible row count, because it asserts a semantic viewport in scenario.target or script.checkpoints. Presentation-only viewport activities frame a long buffer without asserting one and must omit this flag.",
  });

  // An activity is viewport-dependent exactly when it asserts a viewport: those
  // assertions are what a larger desktop editor would silently break. Comparing
  // the declared flag against that derived signal catches a missing flag and a
  // stray assertion on a presentation-only activity alike.
  for (const { data } of units) {
    for (const lesson of data.lessons) {
      for (const activity of lesson.activities) {
        const assertsViewport = Boolean(activity.scenario?.target?.viewport)
          || (activity.script?.checkpoints || []).some(checkpoint => checkpoint.viewport);
        const declared = Boolean(activity.editor?.viewportDependent);
        assert.equal(declared, assertsViewport, `${data.id}/${activity.id} declares viewportDependent ${declared} but asserts viewport ${assertsViewport}`);
        if (declared) {
          assert(activity.editor?.viewportRows, `${data.id}/${activity.id} declares viewportDependent without viewportRows`);
        }
      }
    }
  }
});

test("viewport activities keep every buffer line inside the fixed window", () => {
  // `.has-viewport .cm-scroller` hides overflow, so a line wider than the slab
  // is clipped with no way to reveal its tail. Measured at 360x740: a 306px
  // scroller less the 26px gutter and 18px of padding leaves 261px, and the
  // 14px monospace advance is 8.65px, so 30 columns is the authoring limit.
  //
  const maximumColumns = 30;
  for (const { data } of units) {
    for (const lesson of data.lessons) {
      for (const activity of lesson.activities) {
        if (!activity.editor?.viewportRows) continue;
        const authored = [
          activity.scenario?.initial?.lines,
          activity.scenario?.target?.lines,
          ...(activity.script?.checkpoints || []).map(checkpoint => checkpoint.lines),
        ].filter(Array.isArray);
        for (const lines of authored) {
          for (const line of lines) {
            assert(line.length <= maximumColumns, `${data.id}/${activity.id} viewport line exceeds ${maximumColumns} columns: ${line.length}`);
          }
        }
      }
    }
  }
});

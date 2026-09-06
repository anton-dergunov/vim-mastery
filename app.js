import { findNextSequentialUnit } from "./unit-navigation.js";
import { canonicalKeyToken, VimEngine, resetVimEngineState } from "./vim-engine.js";
import { appUrl, appVersion, remoteMediaUrls } from "./app-version.js";
import {
  loadUnitCatalogWithPresentation,
  resolveReferencePresentation,
  resolveUnitPresentation,
} from "./presentation-data.js";
import {
  buildConceptIndex,
  buildFocusedPlan,
  buildMixedPlan,
  buildToolChoicePlan,
  conceptState,
  eligibleConcepts,
  isMaintenanceDue,
  readMasteryState,
  recordCompletion,
  summarizeUnit,
  togglePinnedConcept,
  writeMasteryState,
} from "./mastery-progress.js";
import { StoryTransitions } from "./story-transitions.js";
import { WorldPresentationRenderer } from "./world-presentation.js";
import { CharacterReactions } from "./character-reactions.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const urlParams = new URLSearchParams(window.location.search);
const sessionStateKey = "vim-wilds.session.v1";
// The opening deck is not story state. Keeping it out of vim-wilds.story.v1
// stops a story replay from looking like curriculum progress, and stops the
// opening from replaying when someone rewatches the intro.
const referenceStateKey = "vim-wilds.reference.v1";
// Free practice is not progress either. Its own key keeps a scratchpad flag
// from ever reading as curriculum state to a restore or a migration.
const practiceStateKey = "vim-wilds.practice.v1";
// Mastery owns the only record of what a learner has finished. It is kept out
// of the session key because the two mean opposite things: the session key is a
// position and moves in both directions, while these records only accumulate.
let masteryState = readMasteryState(window.localStorage);
const allowedThemes = new Set(["auto", "moonroot", "ember", "glass", "deepwater"]);
const keyboardVisibilityValues = new Set(["visible", "hidden"]);
const vimEffectValues = new Set(["enabled", "disabled"]);
const decorativeMediaValues = new Set(["enabled", "disabled"]);
const practicePolicyValues = Object.freeze({
  guided: "guided-sequence",
  recall: "recall-sequence",
  explore: "explore",
  free: "free",
});

function readSavedSession() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(sessionStateKey) || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function readReferenceState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(referenceStateKey) || "null");
    return { orientationSeen: saved?.orientationSeen === true };
  } catch {
    return { orientationSeen: false };
  }
}

function readPracticeState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(practiceStateKey) || "null");
    return { noticeSeen: saved?.noticeSeen === true };
  } catch {
    return { noticeSeen: false };
  }
}

const savedSession = readSavedSession();
const referenceState = readReferenceState();
const practiceState = readPracticeState();
const [languageProfiles, referenceCatalog, catalogData] = await Promise.all([
  fetch(appUrl("content/language-profiles.json")).then(response => {
    if (!response.ok) throw new Error(`Language profiles request failed (${response.status})`);
    return response.json();
  }),
  fetch(appUrl("content/reference.json")).then(response => {
    if (!response.ok) throw new Error(`Reference deck request failed (${response.status})`);
    return response.json();
  }),
  loadUnitCatalogWithPresentation({
    catalogUrl: appUrl("content/unit-index.json"),
    presentationUrl: appUrl("content/presentation.json"),
  }),
]);
const { unitCatalog } = catalogData;
const units = unitCatalog.units.sort((left, right) => left.unitNumber - right.unitNumber);
const curriculumArcs = [...(unitCatalog.arcs || [])].sort((left, right) => left.arcNumber - right.arcNumber);
const unitsById = new Map(units.map(candidate => [candidate.id, candidate]));

// The catalog declares direct edges only, so anything that wants the real
// upstream set has to walk them. Unit 14 names Unit 11, which names Unit 4: a
// learner who has finished none of the three should hear about all three, not
// just the one edge Unit 14 happens to spell out.
function requiredUnitClosure(unitId, seen = new Set()) {
  for (const id of unitsById.get(unitId)?.prerequisiteSkillIds || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    requiredUnitClosure(id, seen);
  }
  return seen;
}

function unitNumberList(unitIds) {
  const numbers = [...unitIds]
    .map(id => unitsById.get(id))
    .filter(Boolean)
    .sort((left, right) => left.unitNumber - right.unitNumber)
    .map(candidate => candidate.unitNumber);
  if (!numbers.length) return "";
  if (numbers.length === 1) return `Unit ${numbers[0]}`;
  return `Units ${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}
const requestedUnitId = urlParams.get("unit") || (urlParams.has("activity") ? null : savedSession.unitId);
const selectedUnit = units.find(candidate => candidate.id === requestedUnitId) || units[0];
const unit = await fetch(appUrl(selectedUnit.path)).then(response => {
  if (!response.ok) throw new Error(`Unit request failed (${response.status})`);
  return response.json();
});
const unitPresentation = resolveUnitPresentation(catalogData.presentation, unit.id);

const elements = {
  phone: $("#phone"),
  modePill: $("#nextModePill"),
  resetButton: $("#nextResetButton"),
  lessonLabel: $("#lessonLabel"),
  tocButton: $("#tocButton"),
  settingsButton: $("#settingsButton"),
  activityIntro: $("#activityIntro"),
  activityKicker: $("#activityKicker"),
  activityTitle: $("#activityTitle"),
  activityInstruction: $("#activityInstruction"),
  hintButton: $("#hintButton"),
  exploreButton: $("#exploreButton"),
  world: $("#world"),
  worldBackdrop: $("#worldBackdrop"),
  worldAmbient: $("#worldAmbient"),
  worldRemoteVariantLayer: $("#worldRemoteVariantLayer"),
  worldGrid: $("#worldGrid"),
  characterLayer: $("#characterLayer"),
  completionHost: $("#completionHost"),
  helpCard: $("#helpCard"),
  exOutput: $("#exOutput"),
  exOutputLines: $("#exOutputLines"),
  helpClose: $("#helpClose"),
  hintSteps: $("#hintSteps"),
  activityControls: $("#activityControls"),
  keyboardPanel: $(".keyboard-panel"),
  commandTray: $("#nextCommandTray"),
  commandText: $("#nextCommandText"),
  guidance: $("#nextGuidance"),
  commandExplanation: $("#commandExplanation"),
  statusPrimary: $("#statusPrimary"),
  statusSecondary: $("#statusSecondary"),
  statusKey: $("#statusKey"),
  keyboard: $("#keyboard"),
  tocDialog: $("#tocDialog"),
  tocLessons: $("#tocLessons"),
  settingsDialog: $("#settingsDialog"),
  keyboardOptions: $("#keyboardOptions"),
  vimEffectOptions: $("#vimEffectOptions"),
  backdropOptions: $("#backdropOptions"),
  characterOptions: $("#characterOptions"),
  themeOptions: $("#themeOptions"),
  replayStoryButton: $("#replayStoryButton"),
  storyDialog: $("#storyDialog"),
  referenceDialog: $("#referenceDialog"),
  referenceVisual: $("#referenceVisual"),
  referenceBackdrop: $("#referenceBackdrop"),
  referenceAmbient: $("#referenceAmbient"),
  referenceVariantLayer: $("#referenceVariantLayer"),
  referenceKicker: $("#referenceKicker"),
  referenceProgress: $("#referenceProgress"),
  referenceTitle: $("#referenceTitle"),
  referenceCardBody: $("#referenceCardBody"),
  referenceActions: $("#referenceActions"),
  practiceLeaveButton: $("#practiceLeaveButton"),
  practiceFilesButton: $("#practiceFilesButton"),
  practiceFilesDialog: $("#practiceFilesDialog"),
  practiceFileList: $("#practiceFileList"),
  practiceNoticeDialog: $("#practiceNoticeDialog"),
  masteryDialog: $("#masteryDialog"),
  masteryBody: $("#masteryBody"),
  currentVersion: $("#currentVersion"),
  updateStatus: $("#updateStatus"),
  restartUpdateButton: $("#restartUpdateButton"),
};

const presentations = [
  { theme: "glass", codeSide: "left" },
  { theme: "deepwater", codeSide: "right" },
  { theme: "moonroot", codeSide: "left" },
  { theme: "ember", codeSide: "right" },
];

const themeColors = {
  moonroot: ["#071d18", "#1c533d", "#77e0a3", "#a77bff", "#ffc866"],
  ember: ["#20120e", "#683420", "#f59a61", "#ff7468", "#ffd06c"],
  glass: ["#0b1722", "#234f68", "#78dbea", "#b89cff", "#ffe08b"],
  deepwater: ["#07151d", "#123f4e", "#55bfd0", "#888cff", "#f6bd63"],
};

const lessons = unit.lessons.map((lesson, lessonIndex) => ({ ...lesson, lessonIndex }));
const contextualizeActivity = (activity, lesson, activityIndex, extra = {}) => ({
  ...activity,
  ...extra,
  lessonId: lesson.id,
  lessonTitle: lesson.title,
  lessonTrack: lesson.track,
  lessonTrackNote: lesson.trackNote,
  lessonIndex: lesson.lessonIndex,
  authoredActivityIndex: activityIndex,
});
const activityFlowFor = lesson => {
  const authored = lesson.activities.map((activity, activityIndex) => contextualizeActivity(activity, lesson, activityIndex));
  const practices = authored.filter(activity => activity.type === "exercise");
  const guided = practices.filter(activity => (activity.delivery || "guided-then-recall") !== "recall")
    .map(activity => ({ ...activity, practiceMode: "guided", sourceActivityId: activity.id }));
  const recall = practices.filter(activity => (activity.delivery || "guided-then-recall") !== "guided")
    .map(activity => ({ ...activity, id: `${activity.id}-recall`, practiceMode: "recall", sourceActivityId: activity.id }));
  // A lesson that teaches a new command introduces everything first and closes
  // with its question and summary. A capstone runs the other way round: it asks
  // which tool fits before any keys are pressed, and only once the work is done
  // does it run the alternative it turned down. Opting in keeps that authored
  // position instead of sorting every non-practice activity to the front.
  if (lesson.flow === "authored") {
    const firstPractice = authored.findIndex(activity => activity.type === "exercise");
    const lastPractice = authored.findLastIndex(activity => activity.type === "exercise");
    const opening = authored.filter((activity, index) => activity.type !== "exercise" && index < lastPractice);
    const closing = authored.filter((activity, index) => activity.type !== "exercise" && index > lastPractice);
    return [...opening, ...guided, ...recall, ...closing];
  }
  const leadIn = authored.filter(activity => !["exercise", "choice", "summary"].includes(activity.type));
  const closing = authored.filter(activity => ["choice", "summary"].includes(activity.type));
  return [...leadIn, ...guided, ...recall, ...closing];
};
const activities = lessons.flatMap(activityFlowFor).map((activity, activityIndex) => ({ ...activity, activityIndex }));
const exercises = activities.filter(activity => activity.type === "exercise" && activity.practiceMode === "guided");
const languageNames = new Map(languageProfiles.profiles.map(profile => [profile.id, profile.displayName]));

let characterAssets = {
  nix: {
    name: "Nix",
    role: "guide",
    idle: "assets/characters/nix/idle.png",
    animations: { "joyful-hop": { src: "assets/characters/nix/animations/joyful-hop.webp", css_scale: 1.375 } },
  },
};
const characterAssignments = new Map();
let successMedia = null;
let serviceWorkerRegistration = null;

function storedThemePreference() {
  return allowedThemes.has(savedSession.themePreference) ? savedSession.themePreference : "auto";
}

function defaultKeyboardVisibility() {
  // This deliberately describes the viewport experience, not whether a
  // physical keyboard happens to be attached. Touch-first devices start with
  // the on-screen keyboard; conventional desktop pointers start without it.
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches ? "hidden" : "visible";
}

function storedKeyboardVisibility() {
  return keyboardVisibilityValues.has(savedSession.keyboardVisibility)
    ? savedSession.keyboardVisibility
    : defaultKeyboardVisibility();
}

function storedVimEffects() {
  return savedSession.vimEffects === "disabled" ? "disabled" : "enabled";
}

function storedDecorativeMedia(name) {
  return savedSession[name] === "disabled" ? "disabled" : "enabled";
}

const state = {
  activityIndex: 0,
  progress: 0,
  history: [],
  modifiers: new Set(),
  physicalShift: false,
  capsLock: false,
  complete: false,
  choiceResult: null,
  editorSnapshot: null,
  setupDrift: null,
  playbackStep: 0,
  playbackTimer: null,
  playbackMode: null,
  playbackStops: [],
  themePreference: storedThemePreference(),
  keyboardVisibility: storedKeyboardVisibility(),
  vimEffects: storedVimEffects(),
  generatedBackdrops: storedDecorativeMedia("generatedBackdrops"),
  characters: storedDecorativeMedia("characters"),
  practicePolicyOverride: null,
  exploreTargetReached: false,
  freePractice: null,
  masterySession: null,
  hintLevel: 0,
  consecutiveMistakes: 0,
  recallFeedback: null,
  errorTimer: null,
  remediationReturnId: null,
  semanticEffects: [],
};

function persistSession() {
  try {
    window.localStorage.setItem(sessionStateKey, JSON.stringify({
      unitId: unit.id,
      // The saved id is the lesson position, never whatever surface is on
      // screen. Free practice must not be able to write an id that no
      // `activities` lookup can resolve on the next launch.
      activityId: activities[state.activityIndex]?.id,
      themePreference: state.themePreference,
      keyboardVisibility: state.keyboardVisibility,
      vimEffects: state.vimEffects,
      generatedBackdrops: state.generatedBackdrops,
      characters: state.characters,
      savedAt: new Date().toISOString(),
    }));
  } catch {}
}

let vimEngine = null;
let executionMeasurementFrame = null;
let executionMeasurementSignature = null;

function currentActivity() {
  // Mastery wins over free practice so the two surfaces can never overlap, and
  // both win over the lesson position, which stays exactly where it was.
  return masteryActivity() || state.freePractice?.activity || activities[state.activityIndex];
}

function masteryActivity() {
  const session = state.masterySession;
  return session ? session.queue[session.index] || null : null;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function characterKey(activity) {
  return activity?.sourceActivityId || activity?.id;
}

function assignCharacters() {
  characterAssignments.clear();
  const characterIds = shuffle(Object.keys(characterAssets));
  const keys = [...new Set(activities.map(characterKey))];
  keys.forEach((key, index) => {
    const characterId = characterIds[index % characterIds.length];
    const animationIds = Object.keys(characterAssets[characterId].animations);
    const animationId = animationIds[Math.floor(Math.random() * animationIds.length)];
    characterAssignments.set(key, { characterId, animationId });
  });
}

function characterAssignment(activity = currentActivity()) {
  return characterAssignments.get(characterKey(activity)) || { characterId: "nix", animationId: "joyful-hop" };
}

async function loadCharacterAssets() {
  if (state.characters !== "enabled") {
    document.documentElement.dataset.charactersReady = "disabled";
    return;
  }
  try {
    const response = await fetch(appUrl("assets/characters/manifest.json"));
    if (!response.ok) throw new Error(`manifest request failed (${response.status})`);
    const manifest = await response.json();
    characterAssets = Object.fromEntries(Object.entries(manifest.characters).map(([id, character]) => [id, character]));
    assignCharacters();
    document.documentElement.dataset.charactersReady = "true";
    const assignment = characterAssignment();
    const character = characterAssets[assignment.characterId] || characterAssets.nix;
    const image = $(".nix", elements.characterLayer);
    if (image && character) {
      image.dataset.character = assignment.characterId;
      image.dataset.animation = assignment.animationId;
      image.src = localAssetUrl(character.idle);
      image.alt = `${character.name}, ${character.role}`;
      image.__characterAsset = character;
    }
    preloadSuccessMedia();
  } catch (error) {
    document.documentElement.dataset.charactersReady = "fallback";
    console.warn("Using the Nix-only character fallback:", error);
  }
}

function localAssetUrl(path) {
  return appUrl(path);
}

function releaseSuccessMedia() {
  if (successMedia?.objectUrl) URL.revokeObjectURL(successMedia.objectUrl);
  successMedia?.controller?.abort();
  successMedia = null;
}

async function fetchOptionalMedia(sources, options) {
  let lastError = null;
  for (const source of sources) {
    try {
      const response = await fetch(source, options);
      if (response.ok) return response;
      lastError = new Error(`Optional media request failed (${response.status})`);
    } catch (error) {
      if (error.name === "AbortError" || options.signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error("Optional media request failed");
}

function preloadSuccessMedia(activity = currentActivity()) {
  if (state.characters !== "enabled") {
    releaseSuccessMedia();
    return;
  }
  if (isFreePractice()) return;
  if (!activity || !(isPractice(activity) || activity.type === "choice") || activity.inspection) return;
  const assignment = characterAssignment(activity);
  const asset = characterAssets[assignment.characterId] || characterAssets.nix;
  const animation = asset?.animations?.[assignment.animationId];
  if (!animation?.src) return;
  const sources = remoteMediaUrls(animation.src);
  const sourceKey = sources.join("|");
  if (successMedia?.sourceKey === sourceKey) return;
  releaseSuccessMedia();
  const controller = new AbortController();
  successMedia = { sourceKey, status: "loading", controller, objectUrl: null };
  fetchOptionalMedia(sources, { cache: "no-store", mode: "cors", signal: controller.signal })
    .then(response => response.blob())
    .then(blob => {
      if (successMedia?.sourceKey !== sourceKey) return;
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectUrl;
      return image.decode().then(() => {
        if (successMedia?.sourceKey !== sourceKey) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        successMedia.objectUrl = objectUrl;
        successMedia.status = "ready";
      });
    })
    .catch(error => {
      if (error.name === "AbortError" || successMedia?.sourceKey !== sourceKey) return;
      successMedia.status = "fallback";
    });
}

function isRunnable(activity = currentActivity()) {
  return activity?.type === "demo" || activity?.type === "exercise";
}

function hasEditor(activity = currentActivity()) {
  return isRunnable(activity) || Boolean(activity?.inspection);
}

function initialStateFor(activity = currentActivity()) {
  return activity?.scenario?.initial || activity?.inspection?.initial || null;
}

function plannedEditorRows(activity = currentActivity()) {
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

function isPractice(activity = currentActivity()) {
  return activity?.type === "exercise";
}

function isDemo(activity = currentActivity()) {
  return activity?.type === "demo";
}

function isFreePractice() {
  return state.freePractice !== null;
}

function freePracticeSample() {
  return state.freePractice?.sample || null;
}

function isMasterySession() {
  return state.masterySession !== null;
}

/**
 * One name for "which surface is on screen". The header, the leave controls and
 * the exported state all used to branch on a single free-practice boolean; a
 * second boolean beside it would make each of those unreadable.
 */
function surfaceKind() {
  if (isMasterySession()) return "mastery";
  if (isFreePractice()) return "free-practice";
  return "lesson";
}

/**
 * A scratchpad is an exercise as far as input is concerned, and nothing else.
 * `type: "exercise"` is load-bearing: it is what keeps the touch keyboard, the
 * physical keydown path, the latched modifiers and Caps Lock working without a
 * second implementation. The empty `commandGroups`, the `lessonIndex` and the
 * Normal `mode` exist so the shared presentation, console and mount helpers
 * cannot dereference something undefined.
 */
function freePracticeActivity(sample) {
  return {
    id: "free-practice",
    type: "exercise",
    practiceMode: "free",
    lessonIndex: 0,
    title: sample.fileName,
    instruction: "",
    languageId: sample.languageId,
    hints: [],
    script: { steps: [], commandGroups: [] },
    scenario: { initial: { lines: sample.lines, cursor: [0, 0], mode: "normal" } },
  };
}

function basePracticePolicy(activity = currentActivity()) {
  return activity?.practiceMode === "recall" ? practicePolicyValues.recall : practicePolicyValues.guided;
}

function practicePolicy(activity = currentActivity()) {
  if (!isPractice(activity)) return null;
  if (isFreePractice() && activity === currentActivity()) return practicePolicyValues.free;
  if (activity === currentActivity() && state.practicePolicyOverride === practicePolicyValues.explore) {
    return practicePolicyValues.explore;
  }
  return basePracticePolicy(activity);
}

function isExplore(activity = currentActivity()) {
  return practicePolicy(activity) === practicePolicyValues.explore;
}

function scriptKeys(activity = currentActivity()) {
  return activity.script.steps.map(step => typeof step === "string" ? step : step.key);
}

function languageLabel(activity) {
  return languageNames.get(activity.languageId) || activity.languageId;
}

function vibrate(pattern = 7) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * CommonMark closes a code span on a run of backticks the same length as the
 * run that opened it, which is how authored copy spells a command that itself
 * contains a backtick: ```a`` for the mark jump, `` `da` `` for the text
 * object. Matching only single backticks split those into an empty chip, a
 * chip holding the wrong text, and a loose backtick.
 */
function renderInline(value) {
  const source = String(value ?? "");
  // Two capture groups, so split emits text, fence, code, text, fence, code...
  return source.split(/(`+)([\s\S]+?)\1(?!`)/g).map((part, index) => {
    if (index % 3 === 1) return "";
    if (index % 3 === 2) return `<code>${escapeHtml(stripCodeSpanPadding(part))}</code>`;
    const escaped = escapeHtml(part);
    const bold = escaped.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    return bold.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  }).join("");
}

/**
 * The spaces that keep a fence away from its content are separators, not text:
 * `` `a `` means the two characters `a. One space at each end goes, and only
 * when both are there and something is left over.
 */
function stripCodeSpanPadding(code) {
  return code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim()
    ? code.slice(1, -1)
    : code;
}

function displayKeyToken(token) {
  const labels = { Escape: "Esc", Enter: "Enter", " ": "Space", Tab: "Tab" };
  return labels[token] || token;
}

function renderKeycap(token, className = "") {
  const extraClass = className ? ` ${className}` : "";
  return `<kbd class="command-key${extraClass}">${escapeHtml(displayKeyToken(token))}</kbd>`;
}

function renderHistory(tokens) {
  return tokens.length
    ? tokens.map(token => renderKeycap(token)).join("")
    : '<span class="ghost">waiting…</span>';
}

function presentationFor(activity = currentActivity()) {
  return presentations[activity.lessonIndex % presentations.length];
}

function functionalThemeFor(activity = currentActivity()) {
  return unitPresentation?.world.autoThemeId || presentationFor(activity).theme;
}

function setTheme(theme) {
  const activeTheme = state.themePreference !== "auto" ? state.themePreference : theme;
  allowedThemes.forEach(candidate => {
    if (candidate !== "auto") elements.world.classList.remove(`theme-${candidate}`);
  });
  elements.world.classList.add(`theme-${activeTheme}`);
  elements.world.classList.toggle("complete", state.complete);
  const [dark, mid, bright, magic, warm] = themeColors[activeTheme];
  elements.phone.style.setProperty("--theme-dark", dark);
  elements.phone.style.setProperty("--theme-mid", mid);
  elements.phone.style.setProperty("--theme-bright", bright);
  elements.phone.style.setProperty("--theme-magic", magic);
  elements.phone.style.setProperty("--theme-warm", warm);
}

const worldRenderer = new WorldPresentationRenderer({
  world: elements.world,
  backdropLayer: elements.worldBackdrop,
  ambientLayer: elements.worldAmbient,
  remoteVariantLayer: elements.worldRemoteVariantLayer,
  assetUrl: localAssetUrl,
  remoteAssetUrls: remoteMediaUrls,
});

// The reference surface is a second board, not a second world: the renderer is
// parameterised by element handles, so pointing one at the dialog's own layers
// gives the deck the Mosslight Landing backdrop, its ambient drift, and the
// reduced-motion and offline handling the lesson board already has.
const referenceRenderer = new WorldPresentationRenderer({
  world: elements.referenceVisual,
  backdropLayer: elements.referenceBackdrop,
  ambientLayer: elements.referenceAmbient,
  remoteVariantLayer: elements.referenceVariantLayer,
  assetUrl: localAssetUrl,
  remoteAssetUrls: remoteMediaUrls,
});
const referencePresentation = resolveReferencePresentation(catalogData.presentation);
const referenceDecks = new Map((referenceCatalog?.decks || []).map(deck => [deck.id, deck]));
const openingDeck = (referenceCatalog?.decks || []).find(deck => deck.role === "opening") || null;
let referenceRendererStarted = false;
const referenceSession = { deckId: null, cardIndex: 0, opening: false, unitId: null };

// `unit.reference` has been authored, schema-validated, and cross-checked
// against activity ids since the curriculum began, and rendered nowhere. Until
// it has a surface, "demote to reference" is deletion under another name.
// One cache for whole unit files. The reference surface wanted their
// `reference` arrays and a mastery drill wants their activities, and fetching
// the same file twice for the two of them would be the only difference.
const unitDataCache = new Map([[unit.id, unit]]);

async function unitData(unitId) {
  if (unitDataCache.has(unitId)) return unitDataCache.get(unitId);
  const candidate = units.find(item => item.id === unitId);
  if (!candidate) return null;
  const response = await fetch(appUrl(candidate.path));
  if (!response.ok) throw new Error(`Unit request failed (${response.status})`);
  const data = await response.json();
  unitDataCache.set(unitId, data);
  return data;
}

async function unitReferenceEntries(unitId) {
  return (await unitData(unitId))?.reference || [];
}

function renderUnitReferenceEntries(unitId, entries) {
  if (!entries.length) return '<p class="reference-empty">This unit has no reference entries.</p>';
  return `<div class="reference-rows">${entries.map(entry => {
    const examples = (entry.exampleActivityRefs || []).map(activityRef => {
      const local = activities.find(item => item.id === activityRef || item.sourceActivityId === activityRef);
      return local
        ? `<button type="button" data-reference-activity="${escapeHtml(activityRef)}">${escapeHtml(activityRef)}</button>`
        : `<a href="${escapeHtml(activityHref(unitId, activityRef))}">${escapeHtml(activityRef)}</a>`;
    }).join("");
    return `<div class="reference-row single">
      <div class="reference-row-command"><code>${escapeHtml(entry.command)}</code></div>
      <div class="reference-row-cell reference-row-vim"><p>${renderInline(entry.purpose)}</p></div>
      ${(entry.notes || []).length ? `<ul class="reference-notes">${entry.notes.map(note => `<li>${renderInline(note)}</li>`).join("")}</ul>` : ""}
      ${examples ? `<div class="reference-examples"><span class="reference-cell-label">Seen in</span>${examples}</div>` : ""}
    </div>`;
  }).join("")}</div>`;
}

function activityHref(unitId, activityId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("unit", unitId);
  url.searchParams.set("activity", activityId);
  return `${url.pathname}${url.search}`;
}

async function openUnitReference(unitId) {
  const candidate = units.find(item => item.id === unitId);
  if (!candidate) throw new RangeError(`Unknown unit "${unitId}"`);
  referenceSession.deckId = null;
  referenceSession.cardIndex = 0;
  referenceSession.opening = false;
  referenceSession.unitId = unitId;
  elements.referenceDialog.dataset.deckId = `unit-${unitId}`;
  elements.referenceKicker.textContent = `Unit ${candidate.unitNumber}`;
  elements.referenceProgress.textContent = "";
  elements.referenceTitle.innerHTML = renderInline(candidate.title);
  elements.referenceCardBody.innerHTML = '<p class="reference-lede">Loading…</p>';
  elements.referenceActions.innerHTML = '<button class="note-action" type="button" data-reference-action="close">Done</button>';
  showReferenceSurface();
  const entries = await unitReferenceEntries(unitId);
  if (referenceSession.unitId !== unitId) return;
  elements.referenceCardBody.innerHTML = renderUnitReferenceEntries(unitId, entries);
  elements.referenceCardBody.scrollTop = 0;
}

function referenceCard() {
  const deck = referenceDecks.get(referenceSession.deckId);
  return deck?.cards[referenceSession.cardIndex] || null;
}

function persistReferenceState() {
  try {
    window.localStorage.setItem(referenceStateKey, JSON.stringify(referenceState));
  } catch {
    // A blocked or full store only costs a repeated opening, never correctness.
  }
}

function renderReferenceRows(card) {
  const columns = card.columns || {};
  const vimHeading = columns.vim || "In Vim";
  const hostHeading = columns.host || "In an editor's Vim mode";
  const twoColumn = card.rows.some(row => row.host);
  const rows = card.rows.map(row => `<div class="reference-row${row.host ? "" : " single"}">
      <div class="reference-row-command"><code>${escapeHtml(row.command)}</code>${row.affects ? `<span class="reference-row-affects">${renderInline(row.affects)}</span>` : ""}</div>
      <div class="reference-row-cell reference-row-vim"><span class="reference-cell-label">${escapeHtml(vimHeading)}</span><p>${renderInline(row.vim)}</p></div>
      ${row.host ? `<div class="reference-row-cell reference-row-host"><span class="reference-cell-label">${escapeHtml(hostHeading)}</span><p>${renderInline(row.host)}</p></div>` : ""}
    </div>`).join("");
  const heading = twoColumn
    ? `<div class="reference-row-heading" aria-hidden="true"><span></span><span>${escapeHtml(vimHeading)}</span><span>${escapeHtml(hostHeading)}</span></div>`
    : "";
  return `<div class="reference-rows">${heading}${rows}</div>`;
}

function renderReferenceCard() {
  const deck = referenceDecks.get(referenceSession.deckId);
  const card = referenceCard();
  if (!deck || !card) return;
  elements.referenceKicker.textContent = deck.kicker;
  elements.referenceProgress.textContent = deck.cards.length > 1
    ? `${referenceSession.cardIndex + 1} of ${deck.cards.length}`
    : "";
  elements.referenceTitle.innerHTML = renderInline(card.title);
  elements.referenceCardBody.innerHTML = [
    card.lede ? `<p class="reference-lede">${renderInline(card.lede)}</p>` : "",
    (card.body || []).map(paragraph => `<p>${renderInline(paragraph)}</p>`).join(""),
    card.rows ? renderReferenceRows(card) : "",
    card.hostNote ? `<p class="reference-host-note">${renderInline(card.hostNote)}</p>` : "",
    (card.notes || []).length
      ? `<ul class="reference-notes">${card.notes.map(note => `<li>${renderInline(note)}</li>`).join("")}</ul>`
      : "",
  ].join("");
  elements.referenceCardBody.scrollTop = 0;

  const last = referenceSession.cardIndex === deck.cards.length - 1;
  const authored = last ? (card.actions || []) : [];
  const back = referenceSession.cardIndex > 0
    ? '<button class="note-action secondary-action" type="button" data-reference-action="previous">Back</button>'
    : "";
  const authoredMarkup = authored.map(action => `<button class="note-action${action.kind === "secondary" ? " secondary-action" : ""}" type="button" data-reference-action="authored" data-reference-authored="${escapeHtml(action.id)}">${renderInline(action.label)}</button>`).join("");
  const advance = last
    ? (authored.length
        ? ""
        : `<button class="note-action" type="button" data-reference-action="close">${referenceSession.opening ? "Start Unit 1" : "Done"}</button>`)
    : '<button class="note-action" type="button" data-reference-action="next">Next</button>';
  const skip = referenceSession.opening && !last
    ? '<button class="note-action secondary-action" type="button" data-reference-action="close">Skip</button>'
    : "";
  elements.referenceActions.innerHTML = `${back}${skip}${authoredMarkup}${advance}`;
}

function openReferenceDeck(deckId, { opening = false } = {}) {
  const deck = referenceDecks.get(deckId);
  if (!deck) throw new RangeError(`Unknown reference deck "${deckId}"`);
  referenceSession.deckId = deckId;
  referenceSession.cardIndex = 0;
  referenceSession.opening = opening;
  elements.referenceDialog.dataset.deckId = deckId;
  elements.referenceDialog.dataset.opening = String(opening);
  renderReferenceCard();
  showReferenceSurface();
  return deck;
}

// Open first: a closed <dialog> has no layout, so the renderer would measure a
// zero-height board and pick the wrong scene profile.
function showReferenceSurface() {
  elements.referenceVisual.dataset.simpleBackground = String(state.generatedBackdrops === "disabled");
  if (!elements.referenceDialog.open) elements.referenceDialog.showModal();
  if (!referencePresentation) return;
  if (!referenceRendererStarted) {
    referenceRenderer.start();
    referenceRendererStarted = true;
  }
  referenceRenderer.setPresentation(referencePresentation, { unitId: "reference" });
  referenceRenderer.updateLayout(true);
  referenceRenderer.syncRemoteVariants();
}

function closeReferenceDeck() {
  if (referenceSession.opening && !referenceState.orientationSeen) {
    referenceState.orientationSeen = true;
    persistReferenceState();
    renderTableOfContents();
  }
  referenceSession.opening = false;
  referenceSession.unitId = null;
  referenceRenderer.cancelRemoteVariants({ clearLayer: true });
  if (elements.referenceDialog.open) elements.referenceDialog.close();
}

function stepReferenceCard(delta) {
  const deck = referenceDecks.get(referenceSession.deckId);
  if (!deck) return;
  const next = referenceSession.cardIndex + delta;
  if (next < 0 || next >= deck.cards.length) return;
  referenceSession.cardIndex = next;
  renderReferenceCard();
}

function handleReferenceAuthoredAction(actionId) {
  if (actionId === "open-survival") {
    // The opening is finished either way: the learner made a choice about it.
    if (!referenceState.orientationSeen) {
      referenceState.orientationSeen = true;
      persistReferenceState();
      renderTableOfContents();
    }
    referenceSession.opening = false;
    openReferenceDeck("survival");
    return;
  }
  closeReferenceDeck();
}

// Free practice ------------------------------------------------------------
// Fetched lazily and cached the way a non-current unit's reference entries are.
// Most sessions never open the scratchpad, and twenty buffers do not belong in
// front of first paint. The service worker precaches the file, so the first
// ever open still works offline.
let practiceSamplesPromise = null;
let practiceNoticeReturnsToPicker = false;
const practiceSampleIndex = new Map();

function practiceSampleCatalog() {
  practiceSamplesPromise ||= fetch(appUrl("content/practice-samples.json"))
    .then(response => {
      if (!response.ok) throw new Error(`Practice samples request failed (${response.status})`);
      return response.json();
    })
    .then(data => {
      data.samples.forEach(sample => practiceSampleIndex.set(sample.id, sample));
      return data.samples;
    });
  return practiceSamplesPromise;
}

function randomPracticeSample(samples, excludeId = null) {
  // Excluding the open file is what makes a second "Surprise me" always change
  // something.
  const pool = samples.filter(sample => sample.id !== excludeId);
  const choices = pool.length ? pool : samples;
  return choices[Math.floor(Math.random() * choices.length)];
}

function persistPracticeState() {
  try {
    window.localStorage.setItem(practiceStateKey, JSON.stringify(practiceState));
  } catch {
    // A blocked or full store only costs a repeated notice, never correctness.
  }
}

function openPracticeNotice({ fromPicker = false } = {}) {
  practiceNoticeReturnsToPicker = fromPicker;
  if (fromPicker && elements.practiceFilesDialog.open) elements.practiceFilesDialog.close();
  if (!elements.practiceNoticeDialog.open) elements.practiceNoticeDialog.showModal();
}

async function startFreePractice(sampleId = null) {
  const samples = await practiceSampleCatalog();
  const sample = (sampleId && practiceSampleIndex.get(sampleId))
    || randomPracticeSample(samples, state.freePractice?.sample?.id || null);
  clearPlayback();
  elements.tocDialog?.close();
  if (elements.practiceFilesDialog.open) elements.practiceFilesDialog.close();
  state.freePractice = { sample, activity: freePracticeActivity(sample) };
  elements.phone.dataset.surface = "free-practice";
  // The scenic layers are hidden for as long as this surface is up, so their
  // remote variant streaming is pure wasted bandwidth. Same pair the reference
  // surface uses.
  worldRenderer.cancelRemoteVariants({ clearLayer: true });
  resetActivity({ vibrateReset: false });
  // Entering writes nothing to the session key. That is what makes "no
  // progression state changes on entry" true by construction.
  if (!practiceState.noticeSeen) openPracticeNotice();
  return sample;
}

function exitFreePractice() {
  if (!isFreePractice()) return;
  state.freePractice = null;
  delete elements.phone.dataset.surface;
  resetActivity({ vibrateReset: false });
  worldRenderer.syncRemoteVariants();
}

async function openPracticeFiles() {
  elements.tocDialog?.close();
  elements.practiceFileList.innerHTML = '<p class="practice-loading">Loading…</p>';
  if (!elements.practiceFilesDialog.open) elements.practiceFilesDialog.showModal();
  const samples = await practiceSampleCatalog();
  elements.practiceFileList.innerHTML = samples.map(sample => `
    <button type="button" data-practice-sample="${escapeHtml(sample.id)}">
      <strong>${escapeHtml(sample.fileName)}</strong>
      <small>${renderInline(sample.summary)}</small>
      <span>${escapeHtml(languageLabel(sample))} · ${sample.lines.length} lines</span>
    </button>`).join("");
}

// The retention layer. Two content files feed it and neither is fetched at
// launch: most sessions are a lesson, and the mastery map and the field notes
// are both a deliberate detour. The service worker precaches both, so the first
// open still works offline.
let masteryIndexPromise = null;
let fieldNotesPromise = null;
const fieldNoteIndex = new Map();

function masteryConceptIndex() {
  masteryIndexPromise ||= fetch(appUrl("content/mastery-index.json"))
    .then(response => {
      if (!response.ok) throw new Error(`Mastery index request failed (${response.status})`);
      return response.json();
    })
    .then(data => buildConceptIndex(data.units));
  return masteryIndexPromise;
}

function fieldNoteCatalog() {
  fieldNotesPromise ||= fetch(appUrl("content/field-notes.json"))
    .then(response => {
      if (!response.ok) throw new Error(`Field notes request failed (${response.status})`);
      return response.json();
    })
    .then(data => {
      data.notes.forEach(note => fieldNoteIndex.set(note.id, note));
      return data.notes;
    });
  return fieldNotesPromise;
}

function persistMasteryState() {
  writeMasteryState(window.localStorage, masteryState);
  // The contents dialog shows no mastery state, so completing an exercise has
  // nothing to redraw there. Only the map itself, and only while it is open.
  if (elements.masteryDialog?.open) void renderMasteryDialog();
}

/**
 * The one writer of curriculum progress.
 *
 * Recording is keyed by the *authored* activity id, never by the id a drill or
 * a recall clone runs under, so replaying an exercise from the mastery surface
 * credits the same concept the lesson did. Free practice records nothing at
 * all: it has no target, so there is nothing it could have completed.
 */
function recordActivityCompletion(activity = currentActivity()) {
  if (!activity || isFreePractice() || activity.fieldNote || activity.masterySummary) return;
  const activityId = activity.masteryOrigin?.activityId || activity.sourceActivityId || activity.id;
  if (!activityId) return;
  masteryState = recordCompletion(masteryState, { activityId, at: Math.floor(Date.now() / 1000) });
  persistMasteryState();
}

const masterySurfaceLabels = {
  focused: "Focused drill",
  mixed: "Mixed review",
  "tool-choice": "Tool choice",
  "field-note": "Field notes",
};

function masteryLabel() {
  const session = state.masterySession;
  if (!session) return "";
  return session.title || masterySurfaceLabels[session.kind] || "Mastery";
}

/**
 * Strips every field that could navigate back into the curriculum.
 *
 * `routes`, `remediationRef` and `demoRef` all resolve through `goToActivity`,
 * which moves the saved lesson position. Leaving one on a queued activity is
 * the one way a mastery session could lower the learner's progress, so they
 * come off here rather than being guarded at each render site.
 */
function contextualizeMasteryActivity(activity, lesson, source, step) {
  const { routes, remediationRef, demoRef, ...safe } = activity;
  const recall = step.practiceMode === "recall";
  return {
    ...safe,
    // Namespaced so a queued activity can never collide with one of the 818
    // authored ids, which keeps the console measurement cache honest.
    id: `mastery:${source.id}:${activity.id}${recall ? ":recall" : ""}`,
    sourceActivityId: activity.id,
    practiceMode: step.practiceMode || undefined,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    lessonTrack: undefined,
    lessonTrackNote: undefined,
    // Pinned for the whole session. `presentationFor` indexes by this, and a
    // mixed queue that changed it every step would restyle the board on each
    // advance for no reason the learner could read.
    lessonIndex: 0,
    masteryOrigin: {
      unitId: source.id,
      unitNumber: source.unitNumber,
      unitTitle: source.title,
      activityId: activity.id,
    },
  };
}

async function resolveMasteryQueue(plan) {
  const sources = new Map();
  for (const unitId of new Set(plan.steps.map(step => step.unitId))) {
    const data = await unitData(unitId);
    if (data) sources.set(unitId, data);
  }
  return plan.steps.map(step => {
    const source = sources.get(step.unitId);
    if (!source) return null;
    for (const lesson of source.lessons) {
      const activity = lesson.activities.find(item => item.id === step.activityId);
      if (activity) return contextualizeMasteryActivity(activity, lesson, source, step);
    }
    return null;
  }).filter(Boolean);
}

/**
 * The queue's own last card. Reaching it is how a session ends: its Next button
 * runs the same `nextActivity` path every other activity uses, which then walks
 * off the end of the queue and leaves the surface.
 */
function masterySessionSummary(kind, count) {
  const bodies = {
    focused: "That is every drill this topic has. Its progress state has not moved backwards, and it never will.",
    mixed: "Retrieving one command is easier than choosing between several. That is what this mode is for.",
    "tool-choice": "Naming the mechanism before touching the keys is the habit these questions build.",
    "field-note": "Reading is not practice. What these notes buy you is knowing the mechanism exists when you next need it.",
  };
  return {
    id: `mastery-summary-${kind}`,
    type: "summary",
    phase: "summary",
    lessonIndex: 0,
    masterySummary: true,
    title: "Session complete",
    body: bodies[kind] || "Session complete.",
    takeaways: [`${count} ${count === 1 ? "item" : "items"} in this session.`],
  };
}

async function startMasterySession(kind, plan, { title = null } = {}) {
  const queue = plan.kind === "field-note" ? plan.steps : await resolveMasteryQueue(plan);
  if (!queue.length) return null;
  clearPlayback();
  elements.masteryDialog?.close();
  elements.tocDialog?.close();
  state.freePractice = null;
  state.practicePolicyOverride = null;
  state.remediationReturnId = null;
  state.masterySession = {
    kind,
    title,
    index: 0,
    queue: [...queue, masterySessionSummary(kind, queue.length)],
    conceptIds: plan.conceptIds || [],
  };
  elements.phone.dataset.surface = "mastery";
  // Entering writes nothing to the session key. That is what keeps "mastery
  // never lowers progression" true by construction rather than by care.
  resetActivity({ vibrateReset: false });
  return state.masterySession;
}

function advanceMasteryQueue() {
  const session = state.masterySession;
  if (!session) return;
  if (session.index + 1 >= session.queue.length) {
    const completesMasteryChapter = unit.surface === "mastery"
      && session.kind === "mixed"
      && !storyTransitions.hasCompletedUnitStory(unit.id);
    exitMasterySession();
    if (completesMasteryChapter) {
      storyTransitions.showUnitAtBoundary(unit.id, null);
      return;
    }
    openMastery();
    return;
  }
  session.index += 1;
  resetActivity({ vibrateReset: false });
}

function exitMasterySession() {
  if (!isMasterySession()) return;
  state.masterySession = null;
  delete elements.phone.dataset.surface;
  resetActivity({ vibrateReset: false });
}

async function startFocusedDrill(conceptId) {
  const index = await masteryConceptIndex();
  const concept = index.byId.get(conceptId);
  if (!concept) throw new RangeError(`Unknown concept "${conceptId}"`);
  const plan = buildFocusedPlan(concept);
  return plan ? startMasterySession("focused", plan, { title: concept.concept }) : null;
}

async function startMixedReview(conceptIds = null) {
  const index = await masteryConceptIndex();
  const pool = conceptIds
    ? conceptIds.map(id => index.byId.get(id)).filter(Boolean)
    : reviewPool(index);
  const plan = buildMixedPlan(pool);
  return plan ? startMasterySession("mixed", plan) : null;
}

async function startToolChoice() {
  const index = await masteryConceptIndex();
  const plan = buildToolChoicePlan(reviewPool(index));
  return plan ? startMasterySession("tool-choice", plan) : null;
}

/**
 * Mixed and tool-choice sessions draw only from what the learner has actually
 * applied. A pinned focus list narrows that further without widening it: a
 * learner may say which of their learned topics to work on, not skip ahead to
 * one they have not met.
 */
function reviewPool(index) {
  const eligible = eligibleConcepts(index, masteryState.completions);
  const pinned = eligible.filter(concept => masteryState.pinned.includes(concept.id));
  return pinned.length >= 2 ? pinned : eligible;
}

async function startFieldNote(noteId) {
  const notes = await fieldNoteCatalog();
  const note = fieldNoteIndex.get(noteId) || notes[0];
  if (!note) return null;
  const steps = note.activities.map((activity, activityIndex) => ({
    ...activity,
    lessonIndex: 0,
    lessonTitle: note.title,
    fieldNote: { id: note.id, title: note.title },
    // The limitation is stated once, on the note's opening card. Repeating it
    // on every screen is how a disclaimer becomes something nobody reads.
    noteLimitation: activityIndex === 0 ? note.limitation : null,
  }));
  return startMasterySession("field-note", { kind: "field-note", steps }, { title: note.title });
}

async function toggleMasteryPin(conceptId) {
  masteryState = togglePinnedConcept(masteryState, conceptId);
  persistMasteryState();
  await renderMasteryDialog();
}

function conceptStateLabel(conceptState_) {
  return { unseen: "Unseen", learning: "Learning", practiced: "Practiced", integrated: "Integrated" }[conceptState_];
}

async function renderMasteryDialog() {
  const index = await masteryConceptIndex();
  const notes = await fieldNoteCatalog();
  const now = Math.floor(Date.now() / 1000);
  const completions = masteryState.completions;
  const eligible = eligibleConcepts(index, completions);
  const pool = reviewPool(index);

  const conceptRow = concept => {
    const conceptStateName = conceptState(concept, completions);
    const due = isMaintenanceDue(concept, completions, now);
    const pinned = masteryState.pinned.includes(concept.id);
    // Replaying what you have practised and testing out of what you have not
    // are different intents, so they get different labels. The review pool is
    // deliberately *not* widened to match — see `isEligibleForReview`.
    const replayable = conceptStateName !== "unseen" && conceptStateName !== "learning";
    const drillLabel = replayable ? "Drill" : "Test out";
    const drillHint = replayable
      ? "Replay this topic with the prompt withheld"
      : "Try this topic now, before the lesson";
    return `<div class="mastery-concept">
      <div class="mastery-concept-head">
        <strong>${renderInline(concept.concept)}</strong>
        <span class="mastery-chip state-${conceptStateName}">${conceptStateLabel(conceptStateName)}</span>
        ${due ? '<span class="mastery-chip maintenance">Due for a refresh</span>' : ""}
      </div>
      <div class="mastery-concept-actions">
        <button type="button" data-mastery-drill="${escapeHtml(concept.id)}"${replayable ? "" : ' class="mastery-test-out"'} title="${escapeHtml(drillHint)}">${drillLabel}</button>
        <button type="button" class="mastery-pin${pinned ? " pinned" : ""}" data-mastery-pin="${escapeHtml(concept.id)}" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>
      </div>
    </div>`;
  };

  const unitSections = units.map(candidate => {
    const summary = summarizeUnit(index, candidate.id, completions, now);
    if (!summary.total) return "";
    const applied = summary.counts.practiced + summary.counts.integrated;
    const concepts = index.concepts.filter(concept => concept.unitId === candidate.id);
    return `<details class="mastery-unit">
      <summary>
        <span>Unit ${candidate.unitNumber}</span>
        <strong>${renderInline(candidate.title)}</strong>
        <small>${applied} of ${summary.total} practised${summary.maintenanceDue ? ` · ${summary.maintenanceDue} due` : ""}</small>
      </summary>
      <div class="mastery-unit-concepts">${concepts.map(conceptRow).join("")}</div>
    </details>`;
  }).join("");

  const pinnedCount = eligible.filter(concept => masteryState.pinned.includes(concept.id)).length;
  const mixedReady = pool.length >= 2;
  const noteButtons = notes.map(note => `<button type="button" data-mastery-note="${escapeHtml(note.id)}">
      <strong>${renderInline(note.title)}</strong>
      <small>${renderInline(note.summary)}</small>
    </button>`).join("");

  const chapterPending = unit.surface === "mastery" && !storyTransitions.hasCompletedUnitStory(unit.id);
  elements.masteryBody.innerHTML = `
    <p class="mastery-intro">${chapterPending
      ? "Complete one mixed review to close Keeper’s circuit. That first circuit advances the story once; every Mastery session remains reusable afterward."
      : "Finishing a chapter and keeping a skill are different things. Nothing here advances the story or unlocks a unit; it replays work you have already done."}</p>
    <p class="mastery-caveat">A drill replays an exercise you have met, with the prompt withheld. A test out runs the same exercises for a topic you have not reached yet, and passing one counts. Larger buffers, distractors and varied cursor placement are authoring work that has not been done.</p>
    <section class="mastery-sessions" aria-labelledby="masterySessionsTitle">
      <h3 id="masterySessionsTitle">Sessions</h3>
      <div class="mastery-session-actions">
        <button type="button" data-mastery-mixed ${mixedReady ? "" : "disabled"}>
          <strong>Mixed review</strong>
          <small>${mixedReady
            ? `Interleaves ${Math.min(pool.length, 5)} of your ${pinnedCount >= 2 ? "pinned" : "practised"} topics.`
            : "Needs two practised topics. Finish an isolated exercise in two of them."}</small>
        </button>
        <button type="button" data-mastery-tool-choice ${pool.length ? "" : "disabled"}>
          <strong>Tool choice</strong>
          <small>${pool.length ? "Name the mechanism before touching the keys." : "Opens once you have practised a topic."}</small>
        </button>
      </div>
    </section>
    <section class="mastery-notes" aria-labelledby="masteryNotesTitle">
      <h3 id="masteryNotesTitle">Field notes</h3>
      <p>Batch and command-line Vim. These are briefings, not drills — the app runs one buffer, so the multi-file commands they describe cannot be practised here.</p>
      <div class="mastery-note-actions">${noteButtons}</div>
    </section>
    <section class="mastery-topics" aria-labelledby="masteryTopicsTitle">
      <h3 id="masteryTopicsTitle">Topics</h3>
      <p>Every topic you have applied stays directly replayable. Pin the ones you want mixed review to draw from.</p>
      <div class="mastery-units">${unitSections}</div>
    </section>`;
}

async function openMastery() {
  elements.tocDialog?.close();
  elements.masteryBody.innerHTML = '<p class="practice-loading">Loading…</p>';
  if (!elements.masteryDialog.open) elements.masteryDialog.showModal();
  await renderMasteryDialog();
}

function showOpeningReference() {
  if (!openingDeck || referenceState.orientationSeen || !isDefaultArrival) return false;
  openReferenceDeck(openingDeck.id, { opening: true });
  return true;
}

// A default arrival: no art review, no deep link into an activity, no jump into
// a later unit. The story intro and the opening deck share it, so neither one
// interrupts someone who asked for a specific screen.
const isDefaultArrival = !urlParams.has("preview")
  && !urlParams.has("reference")
  && !urlParams.has("practice")
  && !urlParams.has("activity")
  && (!urlParams.has("unit") || urlParams.get("unit") === units[0].id);

const storyTransitions = new StoryTransitions({
  root: elements.storyDialog,
  presentation: catalogData.presentation,
  units,
  currentUnitId: unit.id,
  shouldShowIntro: isDefaultArrival,
  onNavigate: navigateToUnit,
  onOpenContents: openTableOfContents,
  onIntroFinished: ({ replay }) => {
    if (!replay) showOpeningReference();
  },
  onStateChange: renderTableOfContents,
  assetUrl: localAssetUrl,
});

const characterReactions = new CharacterReactions({
  layer: elements.characterLayer,
  assetUrl: localAssetUrl,
  reducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
});

function renderRoutes(routes = []) {
  if (!routes.length) return "";
  return `<div class="note-routes">${routes.map(route => `<button class="note-action${route.emphasis === "secondary" ? " secondary-action" : ""}" type="button" data-route="${escapeHtml(route.activityRef)}">${renderInline(route.label)}</button>`).join("")}</div>`;
}

function nextSequentialUnit() {
  return findNextSequentialUnit(units, unit);
}

function renderUnitContinuation(activity) {
  const nextUnit = nextSequentialUnit();
  const primaryAction = nextUnit
    ? `<button class="note-action" type="button" data-action="next">Continue to Unit ${nextUnit.unitNumber} →</button>`
    : `<button class="note-action" type="button" data-action="next">Complete Unit ${unit.unitNumber} →</button>`;
  return `<div class="unit-continuation">${primaryAction}${renderRoutes(activity.routes)}</div>`;
}

function modeDisplayName(mode) {
  return ({
    normal: "Normal",
    insert: "Insert",
    replace: "Replace",
    "operator-pending": "Operator-pending",
    visual: "Visual Character",
    "visual-line": "Visual Line",
    "visual-block": "Visual Block",
    "command-line": "Command-line",
  })[mode] || mode;
}

function modePillName(mode) {
  return ({
    "operator-pending": "Op-pending",
    visual: "Visual Char",
    "command-line": "Command",
  })[mode] || modeDisplayName(mode);
}

function renderTheoryPresentation(presentation) {
  if (!presentation) return "";
  if (presentation.kind === "mode-compass") {
    return `<div class="mode-compass" aria-label="Vim mode compass">
      <div class="mode-home"><strong>Normal</strong><small>home base</small></div>
      <div class="mode-spokes">${presentation.transitions.filter(item => item.mode !== "normal").map(item => `
        <div class="mode-spoke mode-${escapeHtml(item.mode)}">
          <span>${escapeHtml(item.enterKeys.join(" / "))}</span><strong>${escapeHtml(modeDisplayName(item.mode))}</strong>
          <small>${escapeHtml(item.purpose)}</small><em>${escapeHtml(item.exitKeys.join(" / "))} ↩</em>
        </div>`).join("")}</div>
    </div>`;
  }
  return `<div class="command-forge" aria-label="Command assembly">${presentation.parts.map((part, index) => `
    ${index ? '<span class="forge-plus" aria-hidden="true">+</span>' : ""}
    <div class="forge-part role-${part.role}"><kbd>${escapeHtml(part.keys)}</kbd><strong>${escapeHtml(part.role)}</strong><small>${escapeHtml(part.meaning)}</small></div>`).join("")}</div>`;
}

// A lesson off the core path is marked, never removed: `track` says how far off
// and `trackNote` says why, so a learner meets the material with its weight
// attached instead of not meeting it at all.
const trackLabels = { core: "Core", advanced: "Advanced", optional: "Optional" };

function renderTrackBadge(track) {
  if (!track || track === "core") return "";
  return `<span class="track-badge track-${escapeHtml(track)}">${escapeHtml(trackLabels[track] || track)}</span>`;
}

function renderTrackNote(activity) {
  if (!activity.lessonTrack || activity.lessonTrack === "core" || !activity.lessonTrackNote) return "";
  return `<p class="track-note track-${escapeHtml(activity.lessonTrack)}">${renderInline(activity.lessonTrackNote)}</p>`;
}

/**
 * A field note says once, on its opening card, what it cannot do. Repeating it
 * on every screen of the note is how a disclaimer stops being read, and it
 * costs board height the 360px layout does not have.
 */
function renderNoteLimitation(activity) {
  return activity.noteLimitation
    ? `<p class="field-note-limitation"><strong>A briefing, not a drill.</strong> ${renderInline(activity.noteLimitation)}</p>`
    : "";
}

function renderFieldNote(activity) {
  if (activity.type === "theory") {
    // A queued or synthesized activity belongs to no lesson in this unit, so
    // there is no "last theory before the demo" for it to be. Field notes carry
    // no demoRef anyway; this keeps the lookup from dereferencing a lesson that
    // does not describe the card on screen.
    const lessonTheories = activity.masteryOrigin || activity.fieldNote
      ? []
      : lessons[activity.lessonIndex].activities.filter(item => item.type === "theory");
    const isFinalTheory = lessonTheories.at(-1)?.id === activity.id;
    const action = state.remediationReturnId
      ? '<button class="note-action" type="button" data-action="return-remediation">Back to quick check →</button>'
      : activity.routes?.length ? renderRoutes(activity.routes) : isFinalTheory && activity.demoRef
      ? `<button class="note-action" type="button" data-action="show-demo" data-demo="${activity.demoRef}">Show example →</button>`
      : unit.surface === "mastery"
        ? '<button class="note-action" type="button" data-action="next">Open Mastery →</button>'
        : '<button class="note-action" type="button" data-action="next">Next →</button>';
    const isFirstTheory = lessonTheories[0]?.id === activity.id;
    return `<article class="field-note" aria-label="Theory">
      <span class="field-note-kicker">Field note · explain</span>
      ${isFirstTheory ? renderTrackNote(activity) : ""}
      <h2>${renderInline(activity.title)}</h2>
      <p>${renderInline(activity.body)}</p>
      ${renderTheoryPresentation(activity.presentation)}
      ${activity.grammar ? `<div class="theory-reference"><strong>Command pattern</strong><pre class="grammar">${escapeHtml(activity.grammar.replaceAll(" · ", "\n"))}</pre></div>` : ""}
      ${activity.contrast ? `<p class="contrast"><strong>Key difference:</strong> ${renderInline(activity.contrast)}</p>` : ""}
      ${renderNoteLimitation(activity)}
      ${action}
    </article>`;
  }
  if (activity.type === "choice") {
    const answeredCorrectly = state.choiceResult === activity.correctOptionId;
    const choices = activity.options.map(option => {
      const selected = state.choiceResult === option.id;
      const resultClass = selected ? (option.id === activity.correctOptionId ? " correct" : " incorrect") : "";
      return `<button class="choice-option${selected ? " selected" : ""}${resultClass}" data-choice="${option.id}" type="button" aria-pressed="${selected}">${renderInline(option.label)}</button>`;
    }).join("");
    const result = state.choiceResult
      ? `<div class="choice-feedback ${answeredCorrectly ? "correct" : "incorrect"}" role="status" aria-live="polite"><strong>${answeredCorrectly ? "Correct." : "Not quite."}</strong><p>${renderInline(activity.explanation)}</p></div>`
      : "";
    const remediation = state.choiceResult && !state.complete && activity.remediationRef
      ? `<button class="note-action secondary-action remediation-action" type="button" data-remediation="${escapeHtml(activity.remediationRef)}">Review this idea</button>` : "";
    const next = state.complete ? '<button class="note-action" type="button" data-action="next">Next →</button>' : "";
    return `<article class="field-note choice-note" aria-label="Tool choice challenge">
      <span class="field-note-kicker">Challenge · choose</span><h2>${renderInline(activity.title)}</h2>
      <p>${renderInline(activity.prompt)}</p>${renderNoteLimitation(activity)}<div class="choice-options">${choices}</div>${result}${remediation}${next}
    </article>`;
  }
  return `<article class="field-note summary-note" aria-label="Lesson summary">
    <span class="field-note-kicker">Lesson summary</span><h2>${renderInline(activity.title)}</h2>
    <p>${renderInline(activity.body)}</p><ul>${activity.takeaways.map(takeaway => `<li>${renderInline(takeaway)}</li>`).join("")}</ul>
    ${activity.activityIndex === activities.length - 1
      ? renderUnitContinuation(activity)
      : activity.routes?.length ? renderRoutes(activity.routes) : '<button class="note-action" type="button" data-action="next">Next →</button>'}
  </article>`;
}

function renderActivityIntro() {
  const activity = currentActivity();
  const show = isRunnable(activity) && !isFreePractice();
  elements.activityIntro.hidden = !show;
  if (!show) return;
  const practiceLabel = isExplore(activity)
    ? "Explore"
    : activity.masteryOrigin
      ? activity.practiceMode === "recall" ? "Drill · recall" : "Drill"
    : activity.practiceMode === "guided" ? "Guided practice" : activity.practiceMode === "recall" ? "Recall practice" : "Demo";
  const origin = activity.masteryOrigin
    ? `<span class="activity-origin">Unit ${activity.masteryOrigin.unitNumber}</span>`
    : "";
  elements.activityKicker.innerHTML = `<span class="activity-kind">${escapeHtml(practiceLabel)}</span>${origin}<span class="activity-language">${escapeHtml(languageLabel(activity))}</span>`;
  elements.activityTitle.innerHTML = renderInline(activity.title);
  elements.activityInstruction.innerHTML = renderInline(activity.instruction);
  elements.hintButton.hidden = !isPractice(activity);
  elements.exploreButton.hidden = !isPractice(activity);
  elements.exploreButton.textContent = isExplore(activity) ? "Exit" : "Explore";
  elements.exploreButton.classList.toggle("active", isExplore(activity));
  elements.exploreButton.setAttribute("aria-pressed", String(isExplore(activity)));
}

function applyWorldPresentation(activity, presentation) {
  // Every unit now has a registered scene. Simple backgrounds retain that
  // unit-specific base board; they do not revive the retired world-tile art.
  const simpleBackground = state.generatedBackdrops === "disabled";
  elements.world.dataset.simpleBackground = String(simpleBackground);
  elements.referenceVisual.dataset.simpleBackground = String(simpleBackground);
  const layeredWorld = worldRenderer.setPresentation(unitPresentation, {
    unitId: unit.id,
    phase: activity.phase || (activity.type === "summary" ? "summary" : "explain"),
    landmarkState: "dormant",
    // Reading and decision cards use the naturally framed static board. During
    // hands-on work, portrait and compact boards opt into the compact-registered
    // animation; wide and shallow boards retain their purpose-built wide art.
    variantPolicy: isRunnable(activity) ? "practice" : "static",
  });
  return layeredWorld;
}

function renderCharacterLayer(activity, presentation) {
  const assignment = characterAssignment(activity);
  const character = characterAssets[assignment.characterId] || characterAssets.nix;
  const characterSide = "left";
  const shouldShowCharacter = state.characters === "enabled"
    && (isPractice(activity) || activity.type === "choice")
    && !activity.inspection;
  const characterMarkup = shouldShowCharacter
    ? `<img class="nix ${characterSide}" data-character="${assignment.characterId}" data-animation="${assignment.animationId}" src="${localAssetUrl(character.idle)}" alt="${escapeHtml(`${character.name}, ${character.role}`)}">`
    : "";
  elements.characterLayer.dataset.side = characterMarkup ? characterSide : "none";
  elements.characterLayer.innerHTML = characterMarkup;
  const image = $(".nix", elements.characterLayer);
  if (image) image.__characterAsset = character;
  characterReactions.setActivity(activity);
  characterReactions.apply("idle");
}

function refreshWorldPresentation() {
  const activity = currentActivity();
  const presentation = presentationFor(activity);
  const layeredWorld = applyWorldPresentation(activity, presentation);
  if (layeredWorld) worldRenderer.considerUnitReveal();
}

function completionRendersInWorld() {
  return isPractice() && state.complete && state.keyboardVisibility === "hidden";
}

function completionPanelMarkup(activity, { inWorld = false } = {}) {
  const feedback = activity.feedback || {};
  return `<section class="completion-panel${inWorld ? " in-world" : ""}" role="status">
    <span>${activity.practiceMode === "recall" ? "Recall complete" : "Guided practice complete"}</span>
    <strong>${renderInline(feedback.success || "Practice complete.")}</strong>
    <p>${renderInline(feedback.why || "Continue when you are ready.")}</p>
    <button class="primary-action" data-action="next" type="button">Next →</button>
  </section>`;
}

function renderCompletionHost() {
  elements.completionHost.innerHTML = completionRendersInWorld()
    ? completionPanelMarkup(currentActivity(), { inWorld: true })
    : "";
}

function renderWorld() {
  const activity = currentActivity();
  const presentation = presentationFor(activity);
  if (!hasEditor(activity)) {
    vimEngine?.destroy();
    vimEngine = null;
    resetVimEngineState();
  }
  setTheme(functionalThemeFor(activity));
  const layeredWorld = isFreePractice() ? null : applyWorldPresentation(activity, presentation);
  const viewportRows = activity.editor?.viewportRows;
  const plannedRows = plannedEditorRows(activity);
  const editorRows = viewportRows || plannedRows;
  const expandedRowsClass = editorRows > 6 ? " has-expanded-rows" : "";
  const editorPadding = viewportRows ? 18 : 24;
  const editorStyle = `--editor-rows:${editorRows};--editor-height:${editorRows * 24 + editorPadding}px${viewportRows ? `;--viewport-rows:${viewportRows}` : ""}`;
  const content = isFreePractice()
    // No viewport rows and no authored height: the free practice slab is sized
    // by the surface rather than by the buffer, and its scroller is the one
    // place in the product where CodeMirror scrolls natively so Vim can keep
    // the cursor in view across a sixty-line file.
    ? `<div class="editor-stack free-practice-stack">
          <div class="code-slab next-code-slab"><div class="code-body" id="editorMount" aria-label="Free practice editor"></div></div>
        </div>`
    : isRunnable(activity)
    ? `<div class="editor-stack${viewportRows ? " has-viewport" : ""}${expandedRowsClass}" data-planned-rows="${editorRows}" style="${editorStyle}">
          <div class="code-slab next-code-slab"><div class="code-body" id="editorMount" aria-label="Vim lesson editor"></div>${viewportRows ? '<div class="buffer-position" aria-hidden="true"><span class="buffer-cue buffer-cue-top">▲</span><span class="buffer-track"><i></i></span><span class="buffer-cue buffer-cue-bottom">▼</span></div>' : ""}</div>
          ${isDemo(activity) ? '<div class="demo-controls" id="demoControls" aria-label="Demo controls"></div>' : ""}
        </div>`
    : activity.inspection
      ? `<div class="inspection-layout">
          <div class="code-slab inspection-code-slab"><div class="code-body" id="editorMount" aria-label="Vim inspection editor"></div></div>
          <div class="inspection-choice">${renderFieldNote(activity)}</div>
        </div>`
    : `<div class="field-note-wrap side-${presentation.codeSide}">${renderFieldNote(activity)}</div>`;
  elements.worldGrid.innerHTML = content;
  if (isFreePractice()) {
    elements.characterLayer.dataset.side = "none";
    elements.characterLayer.innerHTML = "";
    elements.completionHost.innerHTML = "";
  } else {
    renderCharacterLayer(activity, presentation);
    renderCompletionHost();
  }
  if (hasEditor(activity)) mountEditor();
  if (layeredWorld) worldRenderer.considerUnitReveal();
}

function mountEditor() {
  vimEngine?.destroy();
  resetVimEngineState();
  const activity = currentActivity();
  const initial = initialStateFor(activity);
  const startCursor = initial.setup?.cursor || initial.cursor;
  vimEngine = new VimEngine({
    parent: $("#editorMount", elements.worldGrid),
    text: initial.lines.join("\n"),
    cursor: startCursor,
    language: activity.languageId,
    wrapColumns: activity.editor?.wrapColumns,
    textWidth: activity.editor?.textWidth,
    viewportRows: activity.editor?.viewportRows,
    visualizeWhitespace: activity.editor?.visualizeWhitespace,
    onEvent: handleEngineEvent,
    onEffect: handleSemanticEffect,
    effectsEnabled: () => state.vimEffects === "enabled",
  });
  for (const step of initial.setup?.steps || []) {
    const key = typeof step === "string" ? step : step.key;
    vimEngine.sendKey(key, { bypassLock: true, source: "setup" });
  }
  state.editorSnapshot = vimEngine.getSnapshot();
  renderBufferPosition();
  // A fresh editor retires any message screen the previous activity left open,
  // the same way a reset retires the impact readout.
  renderExOutput();
  const setupMatches = state.editorSnapshot.text === initial.lines.join("\n")
    && state.editorSnapshot.mode === initial.mode
    && state.editorSnapshot.cursorPosition[0] === initial.cursor[0]
    && state.editorSnapshot.cursorPosition[1] === initial.cursor[1]
    && (!initial.viewport || (state.editorSnapshot.viewport.topLine === initial.viewport.topLine
      && state.editorSnapshot.viewport.bottomLine === initial.viewport.bottomLine));
  // Authored `initial.viewport` is an assertion, not an instruction: the real
  // scroll comes from replaying `setup.steps`. Recording the drift makes that
  // contract testable instead of console-only.
  state.setupDrift = setupMatches ? null : {
    activityId: activity.id,
    expected: {
      cursor: initial.cursor,
      mode: initial.mode,
      viewport: initial.viewport || null,
    },
    actual: {
      cursor: state.editorSnapshot.cursorPosition,
      mode: state.editorSnapshot.mode,
      viewport: state.editorSnapshot.viewport,
    },
  };
  if (!setupMatches) console.warn(`Initial editor setup drifted for ${activity.id}`, state.editorSnapshot, initial);
  vimEngine.setLocked(!isPractice(activity));
  if (state.complete && activity.inspection?.revealRange) vimEngine.showPreviewRange(activity.inspection.revealRange);
  if (!window.matchMedia("(pointer: coarse)").matches) vimEngine.focus();
}

function modeLabel() {
  const activity = currentActivity();
  if (activity.type === "choice" && activity.questionKind === "mode-identification" && !state.complete) return "Identify";
  if (activity.type === "choice" && activity.questionKind === "mode-identification" && state.complete) return modePillName(state.editorSnapshot?.mode || activity.inspection?.initial.mode);
  if (state.complete) return "Complete";
  if (!isRunnable()) return currentActivity().type === "theory" ? "Theory" : "Review";
  const mode = state.editorSnapshot?.mode || "normal";
  return modePillName(mode);
}

function renderMode() {
  const label = modeLabel();
  elements.modePill.textContent = label;
  const actualMode = state.editorSnapshot?.mode || "normal";
  const kind = /complete/i.test(label) ? "complete" : /identify/i.test(label) ? "identify" : actualMode;
  elements.modePill.className = `mode-pill mode-${kind}`.trim();
  elements.world.dataset.mode = actualMode;
}

function activeCommandGroup(activity = currentActivity(), step = state.playbackStep) {
  return activity.script?.commandGroups.find(group => step >= group.from && step < group.to)
    || activity.script?.commandGroups.at(-1);
}

function executionAssembly(steps, step, done) {
  const parts = [];
  for (let index = 0; index < steps.length; index += 1) {
    const item = steps[index];
    if (typeof item !== "object") continue;
    const next = steps[index + 1];
    const isTextObjectPrefix = item.kind === "command"
      && ["inside", "around"].includes(item.cue)
      && typeof next === "object"
      && next.kind === "text-object";
    if (isTextObjectPrefix) {
      parts.push({
        key: `${item.key}${next.key}`,
        kind: "text-object",
        cue: `${item.cue} ${next.cue || "object"}`,
        active: done || index + 1 < step,
      });
      index += 1;
      continue;
    }
    if (!["count", "operator", "motion", "text-object"].includes(item.kind)) continue;
    parts.push({ key: item.key, kind: item.kind, cue: item.cue, active: done || index < step });
  }
  return parts;
}

function executionContent(activity, step, history, complete = false, preview = {}) {
  const keys = scriptKeys(activity);
  const group = activeCommandGroup(activity, step);
  const done = complete || step >= keys.length;
  const policy = preview.policy === undefined ? practicePolicy(activity) : preview.policy;
  const recallFeedback = preview.recallFeedback === undefined ? state.recallFeedback : preview.recallFeedback;
  const exploreTargetReached = preview.exploreTargetReached === undefined ? state.exploreTargetReached : preview.exploreTargetReached;
  const impact = preview.impact === undefined
    ? (shouldReportImpact() ? impactMessage() : "")
    : preview.impact;
  const explore = policy === practicePolicyValues.explore;
  const recall = policy === practicePolicyValues.recall && !done;
  const reveal = recall && recallFeedback === "reveal";
  const retry = recall && recallFeedback === "retry";
  if (explore) {
    return {
      explanation: exploreTargetReached
        ? "Target reached. Keep experimenting, undo, or reset whenever you like."
        : "Explore mode: use any Vim commands. The target will be detected if you reach it.",
      history,
      primary: "Explore",
      secondary: exploreTargetReached ? "Target reached" : "Target open",
      stepStatus: false,
      key: null,
      assembly: [],
      impact,
    };
  }
  return {
    explanation: recall && !reveal
      ? activity.instruction
      : group?.explanation || "Follow the authored command sequence.",
    history,
    primary: done ? (activity.type === "demo" ? "Demo" : "Practice") : activity.type === "demo" ? "Step" : retry ? "Try" : reveal ? "Next" : recall ? "Recall" : "Next",
    secondary: done ? "Complete" : activity.type === "demo" ? `${step + 1} / ${keys.length}` : retry ? "Again" : reveal ? "A clue" : recall ? "From\nmemory" : "",
    stepStatus: !done && activity.type === "demo",
    key: done || (recall && !reveal) ? null : keys[step],
    assembly: executionAssembly(activity.script.steps, step, done),
    impact,
  };
}

function applyExecutionContent(root, content) {
  const assembly = content.assembly.length
    ? `<div class="execution-assembly" style="--assembly-count:${content.assembly.length}">${content.assembly.map(part => `<span class="assembly-part role-${part.kind}${part.active ? " active" : ""}"><kbd>${escapeHtml(part.key)}</kbd><small>${escapeHtml(part.cue || part.kind)}</small></span>`).join("")}</div>`
    : "";
  $(".command-explanation", root).innerHTML = `${renderInline(content.explanation)}${assembly}`;
  const history = $(".command-text", root);
  history.innerHTML = renderHistory(content.history);
  history.scrollTop = history.scrollHeight;
  const impact = $(".impact-readout", root);
  impact.textContent = content.impact || "";
  // The readout takes the whole row when it is present so it never has to
  // ellipsize beside the label at 360px.
  $(".command-history-label", root).classList.toggle("has-impact", Boolean(content.impact));
  $(".status-primary", root).textContent = content.primary;
  $(".status-secondary", root).textContent = content.secondary;
  root.classList.toggle("is-step-status", content.stepStatus);
  const key = $(".status-key", root);
  key.innerHTML = content.key ? renderKeycap(content.key, "status-command-key") : "";
  key.hidden = !content.key;
}

function executionMeasurementContents(activity) {
  const keys = scriptKeys(activity);
  const contents = [];
  const addSequence = (policy, recallFeedback = null) => {
    for (let step = 0; step <= keys.length; step += 1) {
      contents.push(executionContent(activity, step, keys.slice(0, step), step >= keys.length, {
        policy,
        recallFeedback,
        impact: "",
      }));
    }
  };
  // The readout shares the reserved history-label row, but measuring a
  // representative message keeps the console height stable if it ever wraps.
  const addImpactVariant = policy => contents.push(executionContent(activity, 0, keys.slice(0, 1), false, {
    policy,
    impact: "99 substitutions on 99 lines",
  }));
  if (isDemo(activity)) {
    addSequence(null);
    addImpactVariant(null);
  } else {
    const policy = basePracticePolicy(activity);
    addSequence(policy);
    if (policy === practicePolicyValues.recall) {
      addSequence(policy, "retry");
      addSequence(policy, "reveal");
    }
    contents.push(executionContent(activity, 0, keys, false, {
      policy: practicePolicyValues.explore,
      exploreTargetReached: false,
    }));
    contents.push(executionContent(activity, 0, keys, false, {
      policy: practicePolicyValues.explore,
      exploreTargetReached: true,
      impact: "",
    }));
    addImpactVariant(basePracticePolicy(activity));
  }
  return contents;
}

function executionConsoleMeasurementSignature(activity = currentActivity()) {
  const trayWidth = Math.round(elements.commandTray.getBoundingClientRect().width * 10) / 10;
  return `${activity.id}:${innerWidth}x${Math.round(window.visualViewport?.height || innerHeight)}:${trayWidth}`;
}

function measureExecutionConsole() {
  executionMeasurementFrame = null;
  const activity = currentActivity();
  if (!isRunnable(activity) || isFreePractice()) return;
  const signature = executionConsoleMeasurementSignature(activity);
  const probe = elements.commandTray.cloneNode(true);
  probe.removeAttribute("id");
  probe.removeAttribute("aria-live");
  probe.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
  probe.querySelectorAll("[aria-live], [role=status]").forEach(node => {
    node.removeAttribute("aria-live");
    node.removeAttribute("role");
  });
  probe.classList.remove("hidden");
  probe.classList.add("execution-measure");
  probe.style.width = `${elements.commandTray.getBoundingClientRect().width}px`;
  elements.phone.append(probe);
  let requiredHeight = 0;
  executionMeasurementContents(activity).forEach(content => {
    applyExecutionContent(probe, content);
    requiredHeight = Math.max(requiredHeight, Math.ceil(probe.scrollHeight), Math.ceil(probe.getBoundingClientRect().height));
  });
  probe.remove();
  elements.phone.style.setProperty("--execution-console-height", `${requiredHeight}px`);
  executionMeasurementSignature = signature;
}

function scheduleExecutionConsoleMeasurement({ force = false } = {}) {
  if (!isRunnable() || isFreePractice()) return;
  if (!force && executionMeasurementSignature === executionConsoleMeasurementSignature()) return;
  if (executionMeasurementFrame) return;
  executionMeasurementFrame = window.requestAnimationFrame(measureExecutionConsole);
}

function renderCommand() {
  const activity = currentActivity();
  if (!isRunnable(activity) || isFreePractice()) {
    elements.commandExplanation.textContent = "";
    elements.commandTray.classList.add("hidden");
    return;
  }
  elements.commandTray.classList.remove("hidden");
  const step = isDemo(activity) ? state.playbackStep : state.progress;
  applyExecutionContent(elements.commandTray, executionContent(activity, step, state.history, state.complete));
  scheduleExecutionConsoleMeasurement();
}

function renderHeader() {
  const activity = currentActivity();
  const surface = surfaceKind();
  const lesson = surface === "lesson";
  const free = surface === "free-practice";
  elements.lessonLabel.textContent = lesson ? activity.lessonTitle : surface === "mastery" ? masteryLabel() : activity.title;
  elements.resetButton.hidden = !isRunnable(activity);
  // Toggling the attribute, not a class, removes the inactive controls from the
  // accessibility tree so a role lookup can only ever match one of each pair.
  // The leave control is shared by both detours; only the file picker is free
  // practice's alone.
  [[elements.tocButton, !lesson], [elements.settingsButton, !lesson],
    [elements.practiceLeaveButton, lesson], [elements.practiceFilesButton, !free],
    [$('[data-layout-action="toc"]'), !lesson], [$('[data-layout-action="settings"]'), !lesson],
    [$('[data-layout-action="practice-leave"]'), lesson], [$('[data-layout-action="practice-files"]'), !free],
  ].forEach(([button, hidden]) => button?.toggleAttribute("hidden", hidden));
  renderTableOfContents();
}

function renderHints() {
  const hints = isPractice() && !isFreePractice() ? currentActivity().hints : [];
  elements.hintSteps.innerHTML = hints.slice(0, state.hintLevel).map((hint, index) => `<div class="hint-step"><kbd>Hint ${index + 1}</kbd><small>${renderInline(hint)}</small></div>`).join("");
}

function renderActivityControls() {
  const activity = currentActivity();
  const completionInWorld = completionRendersInWorld();
  elements.keyboardPanel.classList.remove("controls-only");
  elements.keyboardPanel.classList.toggle("empty-panel", !isRunnable(activity) || completionInWorld);
  elements.keyboardPanel.classList.toggle("completed", isPractice(activity) && state.complete);
  elements.keyboardPanel.classList.toggle("completion-in-world", completionInWorld);
  elements.keyboardPanel.classList.toggle("keyboard-hidden-by-user", isPractice(activity) && !state.complete && state.keyboardVisibility === "hidden");
  elements.phone.classList.toggle("keyboard-visible", isPractice(activity) && state.keyboardVisibility === "visible");
  elements.phone.classList.toggle("keyboard-hidden", isPractice(activity) && state.keyboardVisibility === "hidden");
  elements.keyboard.classList.toggle("hidden", !isPractice(activity));
  elements.keyboard.toggleAttribute("inert", isPractice(activity) && state.complete);
  if (isPractice(activity) && state.complete) elements.keyboard.setAttribute("aria-hidden", "true");
  else elements.keyboard.removeAttribute("aria-hidden");
  if (isDemo(activity)) {
    const done = state.playbackStep >= scriptKeys(activity).length;
    const playing = Boolean(state.playbackTimer);
    const playLabel = playing ? "Pause" : done ? "Reset" : "Play";
    const action = done ? "reset" : "play-toggle";
    const demoControls = $("#demoControls", elements.worldGrid);
    if (demoControls) demoControls.innerHTML = `
      <button data-action="back" type="button" ${state.playbackStep === 0 || playing ? "disabled" : ""}>← Back</button>
      <button data-action="${action}" type="button">${playLabel}</button>
      <button data-action="step" type="button" ${done || playing ? "disabled" : ""}>Step</button>
      <button class="primary-action" data-action="next" type="button">Next →</button>`;
    elements.activityControls.innerHTML = "";
    return;
  }
  if (isPractice(activity) && state.complete) {
    elements.activityControls.innerHTML = completionInWorld ? "" : completionPanelMarkup(activity);
    return;
  }
  if (isPractice(activity) && state.recallFeedback === "reveal" && activity.remediationRef) {
    elements.activityControls.innerHTML = `<button class="review-idea-action" type="button" data-remediation="${escapeHtml(activity.remediationRef)}">Review this idea</button>`;
    return;
  }
  elements.activityControls.innerHTML = "";
}

function renderKeyboardOptions() {
  const selected = $(`input[name="keyboard-visibility"][value="${state.keyboardVisibility}"]`, elements.keyboardOptions);
  if (selected) selected.checked = true;
}

function renderVimEffectOptions() {
  const selected = $(`input[name="vim-effects"][value="${state.vimEffects}"]`, elements.vimEffectOptions);
  if (selected) selected.checked = true;
}

function renderDecorativeMediaOptions() {
  const backdrop = $(`input[name="generated-backdrops"][value="${state.generatedBackdrops}"]`, elements.backdropOptions);
  const characters = $(`input[name="characters"][value="${state.characters}"]`, elements.characterOptions);
  if (backdrop) backdrop.checked = true;
  if (characters) characters.checked = true;
}

function renderModifiers() {
  const shiftActive = state.modifiers.has("Shift") || state.physicalShift;
  $$('[data-mod]', elements.keyboard).forEach(button => {
    button.classList.toggle("latched", state.modifiers.has(button.dataset.mod));
    button.setAttribute("aria-pressed", String(state.modifiers.has(button.dataset.mod)));
  });
  const capsButton = $('.key[data-key="CapsLock"]', elements.keyboard);
  capsButton?.classList.toggle("latched", state.capsLock);
  capsButton?.setAttribute("aria-pressed", String(state.capsLock));
  elements.keyboard.classList.toggle("shift-layer", shiftActive);
  elements.keyboard.classList.toggle("letter-uppercase", shiftActive !== state.capsLock);
}

function renderAll() {
  renderHeader();
  renderActivityIntro();
  renderWorld();
  renderMode();
  renderHints();
  renderModifiers();
  renderCommand();
  renderActivityControls();
  renderKeyboardOptions();
  renderVimEffectOptions();
  renderDecorativeMediaOptions();
  preloadSuccessMedia();
}

function activityTypeLabel(type) {
  return ({ theory: "Theory", demo: "Demo", exercise: "Exercise", choice: "Choice", summary: "Summary" })[type] || type;
}

// Skipping ahead stays possible on purpose. `docs/curriculum-and-progression.md`
// promises that skipping "never permanently locks later material", so this
// warns, points at the way to earn the skipped topics back, and then gets out
// of the way. It never disables the button beside it.
function prerequisiteNotice(candidate, completedUnitIds) {
  // A practice surface requires nothing: Unit 17 replays whatever exists, and
  // its own copy already says it needs two practised topics.
  if (candidate.surface === "mastery") return "";
  const byNumber = (left, right) => left.unitNumber - right.unitNumber;
  const required = [...requiredUnitClosure(candidate.id)].map(id => unitsById.get(id)).filter(Boolean).sort(byNumber);
  const unmet = required.filter(item => !completedUnitIds.has(item.id));
  const recommended = (candidate.recommendedSkillIds || [])
    .map(id => unitsById.get(id))
    .filter(item => item && !completedUnitIds.has(item.id))
    .sort(byNumber);
  const softLine = recommended.length
    ? `<p class="toc-unit-recommended">${unitNumberList(recommended.map(item => item.id))} would make this easier, but ${recommended.length > 1 ? "they are" : "it is"} not required.</p>`
    : "";
  if (!unmet.length) return softLine;
  // Name what this unit itself asks for before anything further upstream. The
  // closure is honest but starts at Unit 1, and "you have not finished the modal
  // model" is not the sentence that tells a learner what to do next.
  const direct = unmet.filter(item => candidate.prerequisiteSkillIds.includes(item.id));
  const lead = (direct.length ? direct : unmet).slice(0, 2);
  const others = unmet.length - lead.length;
  const named = lead.map(item => `${renderInline(item.title)} (Unit ${item.unitNumber})`).join(" or ");
  const rest = others ? `, and ${others} earlier ${others === 1 ? "unit" : "units"}` : "";
  return `<div class="toc-unit-warning" role="note">
    <p class="toc-unit-warning-head"><span aria-hidden="true">⚠</span> Reaches back to ${unitNumberList(required.map(item => item.id))}</p>
    <p>You have not finished ${named}${rest}. Nothing is locked — open this now, or test out of what you skipped.</p>
    <button type="button" data-mastery-open>Test out a topic</button>
  </div>${softLine}`;
}

function renderTableOfContents() {
  // The lesson position, not the surface: free practice must not blank the
  // open lesson in the contents.
  const current = activities[state.activityIndex];
  const lessonMarkup = lessons.map((lesson, lessonIndex) => {
    const lessonActivities = activities.filter(activity => activity.lessonId === lesson.id);
    const rows = lessonActivities.map((activity, activityIndex) => {
      const globalIndex = activities.indexOf(activity);
      const isCurrent = globalIndex === state.activityIndex;
      return `<button class="toc-activity${isCurrent ? " current" : ""}" type="button" data-activity-index="${globalIndex}" ${isCurrent ? 'aria-current="page"' : ""}>
        <span class="toc-number">${lessonIndex + 1}.${activityIndex + 1}</span>
        <span class="toc-activity-title">${renderInline(activity.title)}</span>
        <span class="activity-type type-${activity.practiceMode || activity.type}">${activity.practiceMode ? escapeHtml(activity.practiceMode) : activityTypeLabel(activity.type)}</span>
      </button>`;
    }).join("");
    return `<details class="toc-lesson" ${lesson.id === current.lessonId ? "open" : ""}>
      <summary><span>${lessonIndex + 1}</span><strong>${renderInline(lesson.title)}</strong>${renderTrackBadge(lesson.track)}<small>${lessonActivities.length} activities</small></summary>
      <div class="toc-activities">${rows}</div>
    </details>`;
  }).join("");
  // Finishing a chapter is a story event; keeping a skill is a mastery state.
  // They are deliberately read from different stores and shown in different
  // places, because conflating them is how "completed" starts to mean nothing.
  const completedStoryIds = new Set(storyTransitions.getState().completedUnitStoryIds);
  // Every unit carries the note, because the point of it is that a learner who
  // has not opened a unit yet still finds out its commands may be claimed by
  // the editor they are sitting in. The card is linked rather than quoted: it
  // is one table and it would swamp seventeen summaries.
  const editorNote = candidate => {
    if (!candidate.editorNote) return "";
    const card = referenceDecks.has("host-reality")
      ? '<button type="button" data-reference-deck="host-reality">Chords an editor may claim →</button>'
      : "";
    return `<div class="toc-unit-editor">
      <p><span class="toc-unit-editor-label">In your editor</span>${renderInline(candidate.editorNote)}</p>
      ${card}
    </div>`;
  };
  const renderUnit = candidate => {
    const isCurrent = candidate.id === unit.id;
    const finished = completedStoryIds.has(candidate.id);
    const marker = finished ? '<span class="toc-unit-complete" title="Chapter finished">✓</span>' : "";
    const summary = `<span>Unit ${candidate.unitNumber}</span><strong>${renderInline(candidate.title)}</strong>${marker}<small>${candidate.lessonCount} lessons</small>`;
    const content = isCurrent
      ? lessonMarkup
      : `<div class="toc-unit-launch">${prerequisiteNotice(candidate, completedStoryIds)}<p>Open this unit when you are ready to begin.</p><button type="button" data-unit-id="${escapeHtml(candidate.id)}">Open Unit ${candidate.unitNumber} →</button></div>`;
    return `<details class="toc-unit" ${isCurrent ? "open" : ""}><summary>${summary}</summary><div class="toc-unit-lessons">${editorNote(candidate)}${content}</div></details>`;
  };
  const assignedUnits = new Set();
  const arcMarkup = curriculumArcs.map((arc, arcIndex) => {
    const arcUnits = units.filter(candidate => arc.unitNumbers.includes(candidate.unitNumber));
    if (!arcUnits.length) return "";
    arcUnits.forEach(candidate => assignedUnits.add(candidate.id));
    const headingId = `toc-arc-${arc.arcNumber}-${arc.id}`;
    return `<section class="toc-arc" aria-labelledby="${escapeHtml(headingId)}">
      ${arcIndex ? '<div class="toc-arc-divider" aria-hidden="true"><span>❦</span></div>' : ""}
      <h3 class="toc-arc-heading" id="${escapeHtml(headingId)}"><span>Arc ${arc.arcNumber}</span><strong>${renderInline(arc.title)}</strong></h3>
      <div class="toc-arc-units">${arcUnits.map(renderUnit).join("")}</div>
    </section>`;
  }).join("");
  const ungroupedUnits = units.filter(candidate => !assignedUnits.has(candidate.id));
  const ungroupedMarkup = ungroupedUnits.length
    ? `<section class="toc-arc" aria-labelledby="toc-arc-other"><h3 class="toc-arc-heading" id="toc-arc-other"><span>Course</span><strong>More units</strong></h3><div class="toc-arc-units">${ungroupedUnits.map(renderUnit).join("")}</div></section>`
    : "";
  const endingReplayButton = storyTransitions.getState().endingSeen
    ? '<button type="button" data-story-replay-ending>Replay finale</button>'
    : "";
  const replayButtons = units
    .filter(candidate => completedStoryIds.has(candidate.id))
    .map(candidate => `<button type="button" data-story-replay-unit="${escapeHtml(candidate.id)}">Unit ${candidate.unitNumber}: ${renderInline(candidate.title)}</button>`)
    .join("");
  const storyArchive = `<section class="toc-story-archive" aria-labelledby="tocStoryTitle">
    <h3 id="tocStoryTitle">Story archive</h3>
    <div class="toc-story-actions">
      <button type="button" data-story-replay-intro>Replay introduction</button>
      ${replayButtons}
      ${endingReplayButton}
    </div>
  </section>`;
  const referenceDeckButtons = (referenceCatalog?.decks || [])
    .map(deck => `<button type="button" data-reference-deck="${escapeHtml(deck.id)}"><strong>${renderInline(deck.title)}</strong><small>${renderInline(deck.summary)}</small></button>`)
    .join("");
  const unitReferenceButtons = units
    .map(candidate => `<button type="button" data-reference-unit="${escapeHtml(candidate.id)}">${candidate.unitNumber}. ${renderInline(candidate.title)}</button>`)
    .join("");
  const referenceSection = referenceDeckButtons
    ? `<section class="toc-reference" aria-labelledby="tocReferenceTitle">
      <h3 id="tocReferenceTitle">Reference</h3>
      <p>Cards, not lessons: nothing here is scored, unlocked, or practiced.</p>
      <div class="toc-reference-actions">${referenceDeckButtons}</div>
      <h4 class="toc-reference-subheading">Commands by unit</h4>
      <div class="toc-reference-units">${unitReferenceButtons}</div>
    </section>`
    : "";
  const practiceSection = `<section class="toc-practice" aria-labelledby="tocPracticeTitle">
    <h3 id="tocPracticeTitle">Free practice</h3>
    <p>A scratchpad on a real file. Nothing here is scored or unlocked, and it is open before Unit 1.</p>
    <div class="toc-practice-actions">
      <button type="button" data-practice-random><strong>Open a scratch file</strong><small>A random file, no goal, no judgment.</small></button>
      <button type="button" data-practice-browse><strong>Browse the files</strong><small>Twenty buffers across sixteen languages.</small></button>
    </div>
  </section>`;
  const masterySection = `<section class="toc-mastery" aria-labelledby="tocMasteryTitle">
    <h3 id="tocMasteryTitle">Mastery</h3>
    <p>Replay a topic, mix several together, or read the field notes on batch and command-line Vim. Nothing here advances a chapter.</p>
    <div class="toc-mastery-actions">
      <button type="button" data-mastery-open><strong>Open the mastery map</strong><small>Every topic, its state, and a drill for each.</small></button>
    </div>
  </section>`;
  // Free practice stays first: it is the one entry that asks nothing of the
  // learner and is open before Unit 1. Mastery follows it, because it only
  // means anything once something has been completed.
  elements.tocLessons.innerHTML = practiceSection + masterySection + referenceSection + storyArchive + arcMarkup + ungroupedMarkup;
}

function storyPreviewHref(parameters) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("preview", "story");
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function renderStoryReviewIndex() {
  const introLinks = catalogData.presentation.story.intro
    .map((panel, index) => `<a href="${escapeHtml(storyPreviewHref({ story: "intro", panel: panel.id }))}">Panel ${index + 1}: ${escapeHtml(panel.id)}</a>`)
    .join("");
  const unitLinks = units.map(candidate => {
    const links = Array.from({ length: 5 }, (_, index) => {
      const candidateNumber = String(index + 1);
      const href = storyPreviewHref({
        story: "unit-ending",
        unit: candidate.id,
        candidate: candidateNumber,
      });
      return `<a href="${escapeHtml(href)}">Candidate ${candidateNumber}</a>`;
    }).join("");
    return `<details class="toc-unit story-review-unit" open>
      <summary><span>Unit ${candidate.unitNumber}</span><strong>${renderInline(candidate.title)}</strong></summary>
      <div class="story-review-links">${links}</div>
    </details>`;
  }).join("");
  const finaleHref = storyPreviewHref({ story: "finale" });
  elements.tocLessons.innerHTML = `<section class="toc-story-archive story-review-index" aria-labelledby="storyReviewTitle">
    <h3 id="storyReviewTitle">Story scene review</h3>
    <p>Each link opens that scene immediately. No lesson completion or saved progress is required.</p>
    <div class="story-review-links">${introLinks}<a href="${escapeHtml(finaleHref)}">Final restored Wilds</a></div>
  </section>${unitLinks}`;
  elements.tocDialog.showModal();
}

function renderThemeOptions() {
  const input = $(`input[name="theme"][value="${state.themePreference}"]`, elements.themeOptions);
  if (input) input.checked = true;
}

function clearPlayback() {
  if (state.playbackTimer) window.clearTimeout(state.playbackTimer);
  state.playbackTimer = null;
  state.playbackMode = null;
}

function resetActivity({ vibrateReset = true } = {}) {
  clearPlayback();
  state.progress = 0;
  state.history = [];
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

function goToActivity(index, { preserveRemediation = false } = {}) {
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

function navigateToUnit(unitId) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("unit", unitId);
  nextUrl.searchParams.delete("activity");
  window.location.assign(nextUrl);
}

function openTableOfContents() {
  renderTableOfContents();
  elements.tocDialog.showModal();
}

function nextActivity() {
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

function goToActivityId(id, options) {
  const index = activities.findIndex(activity => activity.id === id || activity.sourceActivityId === id);
  if (index >= 0) goToActivity(index, options);
}

function goToRemediation(id) {
  state.remediationReturnId = currentActivity().id;
  goToActivityId(id, { preserveRemediation: true });
}

function returnFromRemediation() {
  const returnId = state.remediationReturnId;
  if (!returnId) return;
  state.remediationReturnId = null;
  goToActivityId(returnId);
}

function isTargetSnapshot(snapshot) {
  // Free practice has no target. Answering here keeps the predicate honest
  // instead of making every caller check first.
  const target = currentActivity().scenario?.target;
  if (!target) return false;
  const registersMatch = Object.entries(target.registers || {}).every(([name, expected]) => {
    const actual = snapshot.registers?.[name];
    return actual?.text === expected.text && actual.type === expected.type;
  });
  const viewportMatches = !target.viewport
    || (snapshot.viewport?.topLine === target.viewport.topLine && snapshot.viewport?.bottomLine === target.viewport.bottomLine);
  return snapshot.text === target.lines.join("\n")
    && snapshot.mode === target.mode
    && snapshot.cursorPosition[0] === target.cursor[0]
    && snapshot.cursorPosition[1] === target.cursor[1]
    && registersMatch
    && viewportMatches;
}

/**
 * A demo checkpoint's affected range is the more specific signal, so it wins
 * over the live pattern's match lines whenever one is authored.
 */
function renderEditorMarks(range = null) {
  if (!vimEngine) return;
  if (range) vimEngine.showPreviewRange(range);
  else vimEngine.showMatchLines();
}

/**
 * Vim answers `:g/pat/p` by painting the matched lines over the buffer and
 * waiting for a key. This is that screen. It is transient by construction: the
 * engine retires `exOutput` on the next keystroke, exactly as it retires the
 * impact readout, so rendering straight from the snapshot is the whole
 * lifecycle.
 */
function renderExOutput() {
  const output = state.editorSnapshot?.exOutput;
  const open = Boolean(output?.lines?.length);
  if (open) {
    const width = String(output.lines.at(-1).number).length;
    elements.exOutputLines.innerHTML = output.lines.map(({ number, text }) => {
      const gutter = output.numbered ? `<b style="min-width:${width}ch">${number}</b>` : "";
      // An empty line still has to occupy a row, exactly as Vim prints a space.
      return `<span class="ex-output-line">${gutter}<span>${escapeHtml(text) || " "}</span></span>`;
    }).join("");
    elements.exOutputLines.scrollTop = 0;
  } else {
    elements.exOutputLines.innerHTML = "";
  }
  elements.exOutput.classList.toggle("open", open);
  elements.exOutput.setAttribute("aria-hidden", String(!open));
}

/**
 * Vim's message screen is dismissed by any key. Keys that reach the engine
 * retire the output on their own; this covers the ones that never get there —
 * a wrong key in a guided lesson, and a reset.
 */
function dismissExOutput() {
  if (!elements.exOutput.classList.contains("open")) return;
  vimEngine?.clearExOutput();
  if (state.editorSnapshot) state.editorSnapshot = { ...state.editorSnapshot, exOutput: null };
  renderExOutput();
}

function renderBufferPosition() {
  const rail = $(".buffer-position", elements.worldGrid);
  const viewport = state.editorSnapshot?.viewport;
  if (!rail || !viewport) return;
  const visibleLines = viewport.bottomLine - viewport.topLine + 1;
  const thumb = $(".buffer-track i", rail);
  // Both the thumb and the match ticks map a buffer line to the same fraction
  // of the track, so a tick inside the thumb means that line is on screen.
  const rowHeight = 100 / viewport.totalLines;
  rail.classList.toggle("has-above", viewport.topLine > 0);
  rail.classList.toggle("has-below", viewport.bottomLine < viewport.totalLines - 1);
  thumb.style.height = `${visibleLines * rowHeight}%`;
  thumb.style.top = `${viewport.topLine * rowHeight}%`;
  renderMatchMap(rail, viewport);
}

function renderMatchMap(rail, viewport) {
  const track = $(".buffer-track", rail);
  const matches = state.editorSnapshot?.matchLines || [];
  track.querySelectorAll(".match-tick").forEach(tick => tick.remove());
  rail.classList.toggle("has-matches", matches.length > 0);
  const rowHeight = 100 / viewport.totalLines;
  for (const line of matches) {
    const tick = document.createElement("span");
    tick.className = "match-tick";
    tick.style.top = `${line * rowHeight}%`;
    tick.style.height = `${rowHeight}%`;
    track.append(tick);
  }
}

/**
 * Vim prints a buffer-level report after a command. Reproducing it is what
 * makes an edit legible when most of the lines it touched are off-screen.
 */
function impactMessage(snapshot = state.editorSnapshot) {
  const impact = snapshot?.impact;
  if (!impact) return "";
  if (impact.substitutions) {
    const substitutions = `${impact.substitutions} substitution${impact.substitutions === 1 ? "" : "s"}`;
    const lines = `${impact.substitutionLines} line${impact.substitutionLines === 1 ? "" : "s"}`;
    return `${substitutions} on ${lines}`;
  }
  const delta = impact.lineDelta || 0;
  if (delta) {
    const count = Math.abs(delta);
    return `${count} ${delta > 0 ? "more" : "fewer"} line${count === 1 ? "" : "s"}`;
  }
  const changed = impact.changedLines || 0;
  return changed ? `${changed} line${changed === 1 ? "" : "s"} changed` : "";
}

/**
 * A single-line edit needs no readout. Report only when the effect spans more
 * than one line or reaches past the visible window, which is a superset of
 * Vim's `'report'` threshold.
 */
function shouldReportImpact(snapshot = state.editorSnapshot) {
  const impact = snapshot?.impact;
  if (!impact) return false;
  const touchedLines = impact.substitutions
    ? impact.substitutionLines
    : Math.abs(impact.lineDelta || 0) || impact.changedLines || 0;
  if (touchedLines > 1) return true;
  const viewport = snapshot?.viewport;
  return (snapshot?.matchLines || []).some(line => viewport && (line < viewport.topLine || line > viewport.bottomLine));
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

function handleEngineEvent(event) {
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

function handleSemanticEffect(event) {
  state.semanticEffects.push({
    ...event,
    unitId: unit.id,
    activityId: currentActivity().id,
  });
  if (state.semanticEffects.length > 80) state.semanticEffects.splice(0, state.semanticEffects.length - 80);
}

function clearPracticeError() {
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

function flashError(token, button) {
  elements.commandTray.classList.remove("error");
  void elements.commandTray.offsetWidth;
  elements.commandTray.classList.add("error");
  window.setTimeout(() => elements.commandTray.classList.remove("error"), 300);
  if (!isPractice()) return;
  // Nothing is wrong in a scratchpad: there is no expected key to have missed.
  if (isFreePractice()) return;
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

function processToken(token, button) {
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

function stepDemo() {
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

function backDemo() {
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

function playDemo(interval) {
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

function setHelp(open) {
  const canHelp = isPractice() && !isFreePractice();
  if (open && canHelp) {
    state.hintLevel = Math.min(currentActivity().hints.length, state.hintLevel + 1);
    renderHints();
  }
  elements.helpCard.classList.toggle("open", Boolean(open && canHelp));
  elements.helpCard.setAttribute("aria-hidden", String(!(open && canHelp)));
  if (open) vimEngine?.clearEffects();
  elements.hintButton?.setAttribute("aria-expanded", String(Boolean(open && canHelp)));
  $$(".key", elements.keyboard).forEach(button => button.classList.remove("hinted"));
  if (open && canHelp) {
    scriptKeys().forEach(token => requiredButtons(token).forEach(button => button.classList.add("hinted")));
    vibrate(5);
  }
  // The hint control receives browser focus on tap. Restore the practice
  // editor immediately so physical Vim input remains uninterrupted.
  if (canHelp) vimEngine?.focus();
}

function playSuccessCharacter({ allowExplore = false } = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (state.characters !== "enabled") return;
  const character = $(".nix", elements.characterLayer);
  const asset = characterAssets[character?.dataset.character || ""];
  const animation = asset?.animations?.[character?.dataset.animation || ""];
  if (!character || !animation?.src || successMedia?.status !== "ready" || !successMedia.objectUrl) return;
  const celebrating = character.cloneNode();
  celebrating.src = successMedia.objectUrl;
  celebrating.alt = `${asset.name}, celebrating`;
  celebrating.style.setProperty("--success-canvas-scale", String(animation.css_scale || 1));
  let started = false;
  const startTransition = () => {
    if (started || (!state.complete && !(allowExplore && state.exploreTargetReached)) || !character.isConnected) return;
    started = true;
    celebrating.classList.add("celebrating", "transitioning-in");
    character.classList.add("transitioning-out");
    character.setAttribute("aria-hidden", "true");
    character.after(celebrating);
    window.setTimeout(() => character.remove(), 420);
  };
  celebrating.decode().then(startTransition, startTransition);
}

function keyButtonsFor(value) {
  return $$(".key", elements.keyboard).filter(button => button.dataset.key === value || button.dataset.shift === value);
}

function modifierButtonsFor(value) {
  return $$('[data-mod]', elements.keyboard).filter(button => button.dataset.mod === value);
}

function requiredButtons(token) {
  const result = [];
  if (token.startsWith("Ctrl-")) return [...modifierButtonsFor("Ctrl"), ...keyButtonsFor(token.slice(5))];
  const exact = keyButtonsFor(token);
  result.push(...exact);
  if (token.length === 1 && (token !== token.toLowerCase() || exact.some(button => button.dataset.shift === token))) result.push(...modifierButtonsFor("Shift"));
  return result;
}

function flashKey(button) {
  if (!button) return;
  button.classList.add("pressed");
  window.setTimeout(() => button.classList.remove("pressed"), 110);
}

function toggleModifier(modifier) {
  if (!isPractice()) return;
  if (state.modifiers.has(modifier)) state.modifiers.delete(modifier);
  else state.modifiers.add(modifier);
  renderModifiers();
  vibrate(5);
}

function emitFromButton(button) {
  if (button.dataset.mod) return toggleModifier(button.dataset.mod);
  if (button.dataset.key === "CapsLock") {
    if (!isPractice()) return;
    state.capsLock = !state.capsLock;
    renderModifiers();
    return;
  }
  if (!isPractice()) return;
  let value = button.dataset.key;
  const shiftActive = state.modifiers.has("Shift");
  if (/^[a-z]$/.test(value)) value = shiftActive !== state.capsLock ? value.toUpperCase() : value;
  else if (shiftActive) value = button.dataset.shift || value;
  const chordModifiers = ["Ctrl", "Alt", "Shift"].filter(modifier => state.modifiers.has(modifier));
  let token = value;
  if (chordModifiers.some(modifier => modifier !== "Shift")) token = canonicalKeyToken(`${chordModifiers.join("+")}+${value.toLowerCase()}`);
  state.modifiers.clear();
  renderModifiers();
  processToken(token, button);
}

function processChoice(id) {
  const activity = currentActivity();
  if (activity.type !== "choice" || state.complete) return;
  state.choiceResult = id;
  if (id === activity.correctOptionId) completeActivity();
  else renderAll();
}

function handleActivityAction(action) {
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

elements.keyboard.addEventListener("pointerdown", event => {
  const button = event.target.closest(".key");
  if (!button) return;
  event.preventDefault();
  flashKey(button);
  emitFromButton(button);
});

document.addEventListener("keydown", event => {
  if (event.vimWildsPrompt) return;
  if (elements.storyDialog?.open) return;
  if (elements.practiceFilesDialog?.open || elements.practiceNoticeDialog?.open) return;
  if (elements.masteryDialog?.open) return;
  if (isPractice() && state.complete && state.keyboardVisibility === "hidden") {
    event.preventDefault();
    event.stopImmediatePropagation();
    nextActivity();
    return;
  }
  if (event.target.closest?.("select, button:not(.key)")) return;
  const modifierMap = { Control: "Ctrl", Shift: "Shift", Alt: "Alt" };
  if (event.key === "CapsLock") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (isPractice()) state.capsLock = event.getModifierState("CapsLock");
    renderModifiers();
    return;
  }
  if (modifierMap[event.key]) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Shift" && isPractice()) state.physicalShift = true;
    renderModifiers();
    return;
  }
  if (event.repeat) return;
  if (!isPractice()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  event.preventDefault();
  // Physical keys are interpreted through processToken below. Do not also let
  // CodeMirror's native key handlers see the same event; search prompts would
  // otherwise consume Enter twice and advance to an extra match.
  event.stopImmediatePropagation();
  let token = event.key;
  if (!event.ctrlKey && !event.altKey && event.shiftKey && token.length === 1) {
    const physicalKey = keyButtonsFor(token.toLowerCase()).find(button => button.dataset.key === token.toLowerCase());
    if (physicalKey?.dataset.shift) token = physicalKey.dataset.shift;
  }
  if (event.ctrlKey || event.altKey) {
    const modifiers = [event.ctrlKey && "Ctrl", event.altKey && "Alt"].filter(Boolean);
    token = canonicalKeyToken(`${modifiers.join("+")}+${event.key.toLowerCase()}`);
  }
  const matching = token.startsWith("Ctrl-") ? keyButtonsFor(token.slice(5))[0] : keyButtonsFor(token)[0] || keyButtonsFor(event.key)[0] || keyButtonsFor(event.key.toLowerCase())[0];
  if (!matching) {
    flashError(token);
    return;
  }
  flashKey(matching);
  processToken(token);
}, true);

document.addEventListener("keyup", event => {
  if (event.key === "Shift") {
    state.physicalShift = false;
    renderModifiers();
  }
  if (event.vimWildsPrompt || !vimEngine?.ownsPrompt()) return;
  // The keydown was already interpreted here and never reached the adapter's
  // prompt input. Its keyup still would, and the adapter re-parses the prompt
  // on every keyup: for a `:s` command that reparse rewrites the last-search
  // register from the half-typed command, wiping the pattern `Ctrl-r/` is
  // about to insert. Touch input never produces these events, so this only
  // ever broke the physical keyboard.
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

// Demo controls advance the editor through a transient CodeMirror prompt.
// Keep touch/pointer activation from moving focus to the button: the adapter
// closes its prompt on blur, even though the next authored key belongs there.
elements.worldGrid.addEventListener("pointerdown", event => {
  if (event.target.closest(".demo-controls button")) event.preventDefault();
});

elements.worldGrid.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "help") setHelp(!elements.helpCard.classList.contains("open"));
  if (action === "show-demo") {
    const index = activities.findIndex(activity => activity.id === event.target.closest("[data-demo]").dataset.demo);
    if (index >= 0) goToActivity(index);
  }
  if (!["help", "show-demo"].includes(action)) handleActivityAction(action);
  const choice = event.target.closest("[data-choice]")?.dataset.choice;
  if (choice) processChoice(choice);
  const remediation = event.target.closest("[data-remediation]")?.dataset.remediation;
  if (remediation) goToRemediation(remediation);
  const route = event.target.closest("[data-route]")?.dataset.route;
  if (route) goToActivityId(route);
  const unitId = event.target.closest("button[data-unit-id]")?.dataset.unitId;
  if (unitId) navigateToUnit(unitId);
});
elements.completionHost.addEventListener("click", event => {
  handleActivityAction(event.target.closest("[data-action]")?.dataset.action);
});
const editorPointerEvents = ["pointerdown", "mousedown", "dblclick", "selectstart", "contextmenu"];
editorPointerEvents.forEach(type => elements.worldGrid.addEventListener(type, event => {
  if (!event.target.closest?.(".cm-content, .cm-gutters")) return;
  event.preventDefault();
  event.stopPropagation();
}, true));
elements.helpClose.addEventListener("click", () => setHelp(false));
// A tap is the touch equivalent of the any-key dismissal.
elements.exOutput.addEventListener("click", () => {
  dismissExOutput();
  vimEngine?.focus();
});
elements.resetButton.addEventListener("click", () => resetActivity());
elements.hintButton?.addEventListener("click", () => setHelp(!elements.helpCard.classList.contains("open")));
elements.tocButton?.addEventListener("click", () => {
  openTableOfContents();
});
elements.settingsButton?.addEventListener("click", () => {
  renderKeyboardOptions();
  renderVimEffectOptions();
  renderDecorativeMediaOptions();
  renderThemeOptions();
  elements.settingsDialog.showModal();
});
elements.restartUpdateButton?.addEventListener("click", applyUpdate);
elements.replayStoryButton?.addEventListener("click", () => {
  elements.settingsDialog.close();
  storyTransitions.showIntro({ replay: true });
});
elements.keyboardOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="keyboard-visibility"]')?.value;
  if (!keyboardVisibilityValues.has(value)) return;
  state.keyboardVisibility = value;
  persistSession();
  if (state.complete) renderCompletionHost();
  renderActivityControls();
  scheduleExecutionConsoleMeasurement();
});
elements.vimEffectOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="vim-effects"]')?.value;
  if (!vimEffectValues.has(value)) return;
  state.vimEffects = value;
  persistSession();
  if (value === "disabled") vimEngine?.clearEffects();
});
elements.backdropOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="generated-backdrops"]')?.value;
  if (!decorativeMediaValues.has(value)) return;
  state.generatedBackdrops = value;
  persistSession();
  refreshWorldPresentation();
});
elements.characterOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="characters"]')?.value;
  if (!decorativeMediaValues.has(value)) return;
  state.characters = value;
  persistSession();
  if (value === "disabled") {
    releaseSuccessMedia();
    document.documentElement.dataset.charactersReady = "disabled";
  }
  renderCharacterLayer(currentActivity(), presentationFor(currentActivity()));
  if (value === "enabled") void loadCharacterAssets();
});
elements.referenceDialog?.addEventListener("click", event => {
  const action = event.target.closest("[data-reference-action]")?.dataset.referenceAction;
  if (action === "next") stepReferenceCard(1);
  if (action === "previous") stepReferenceCard(-1);
  if (action === "close") closeReferenceDeck();
  if (action === "authored") {
    handleReferenceAuthoredAction(event.target.closest("[data-reference-authored]")?.dataset.referenceAuthored);
  }
  const activityRef = event.target.closest("[data-reference-activity]")?.dataset.referenceActivity;
  if (activityRef) {
    closeReferenceDeck();
    goToActivityId(activityRef);
  }
});
// Escape closes a <dialog> without a click, so the opening still has to record
// that it was shown; otherwise it reappears on the next launch.
elements.referenceDialog?.addEventListener("cancel", event => {
  event.preventDefault();
  closeReferenceDeck();
});

elements.practiceLeaveButton?.addEventListener("click", () => leaveCurrentSurface());
elements.masteryDialog?.addEventListener("click", event => {
  const drill = event.target.closest("[data-mastery-drill]")?.dataset.masteryDrill;
  if (drill) return void startFocusedDrill(drill);
  const pin = event.target.closest("[data-mastery-pin]")?.dataset.masteryPin;
  if (pin) return void toggleMasteryPin(pin);
  const note = event.target.closest("[data-mastery-note]")?.dataset.masteryNote;
  if (note) return void startFieldNote(note);
  if (event.target.closest("[data-mastery-mixed]")) return void startMixedReview();
  if (event.target.closest("[data-mastery-tool-choice]")) return void startToolChoice();
});

function leaveCurrentSurface() {
  if (isMasterySession()) exitMasterySession();
  else exitFreePractice();
}
elements.practiceFilesButton?.addEventListener("click", () => void openPracticeFiles());
elements.practiceFilesDialog?.addEventListener("click", event => {
  if (event.target.closest("[data-practice-notice]")) return openPracticeNotice({ fromPicker: true });
  if (event.target.closest("[data-practice-random]")) return void startFreePractice();
  const sampleId = event.target.closest("[data-practice-sample]")?.dataset.practiceSample;
  if (sampleId) void startFreePractice(sampleId);
});
// `close` covers the button, Escape and the backdrop in one place. The
// reference deck intercepts `cancel` instead only because it has renderer
// teardown that a plain close would skip.
elements.practiceFilesDialog?.addEventListener("close", () => {
  if (!elements.practiceNoticeDialog.open) vimEngine?.focus();
});
elements.practiceNoticeDialog?.addEventListener("close", () => {
  if (!practiceState.noticeSeen) {
    practiceState.noticeSeen = true;
    persistPracticeState();
  }
  if (practiceNoticeReturnsToPicker) {
    practiceNoticeReturnsToPicker = false;
    void openPracticeFiles();
    return;
  }
  vimEngine?.focus();
});

$(".landscape-controls")?.addEventListener("click", event => {
  const action = event.target.closest("[data-layout-action]")?.dataset.layoutAction;
  if (action === "practice-leave") leaveCurrentSurface();
  if (action === "practice-files") void openPracticeFiles();
  if (action === "toc") openTableOfContents();
  if (action === "reset") resetActivity();
  if (action === "settings") {
    renderKeyboardOptions();
    renderVimEffectOptions();
    renderDecorativeMediaOptions();
    renderThemeOptions();
    elements.settingsDialog.showModal();
  }
});
elements.tocLessons?.addEventListener("click", event => {
  if (event.target.closest("[data-practice-random]")) {
    elements.tocDialog.close();
    void startFreePractice();
    return;
  }
  if (event.target.closest("[data-practice-browse]")) {
    elements.tocDialog.close();
    void openPracticeFiles();
    return;
  }
  if (event.target.closest("[data-mastery-open]")) {
    elements.tocDialog.close();
    void openMastery();
    return;
  }
  const referenceDeck = event.target.closest("[data-reference-deck]")?.dataset.referenceDeck;
  if (referenceDeck) {
    elements.tocDialog.close();
    openReferenceDeck(referenceDeck);
    return;
  }
  const referenceUnit = event.target.closest("[data-reference-unit]")?.dataset.referenceUnit;
  if (referenceUnit) {
    elements.tocDialog.close();
    void openUnitReference(referenceUnit);
    return;
  }
  if (event.target.closest("[data-story-replay-intro]")) {
    elements.tocDialog.close();
    storyTransitions.showIntro({ replay: true });
    return;
  }
  if (event.target.closest("[data-story-replay-ending]")) {
    elements.tocDialog.close();
    storyTransitions.showEnding({ replay: true });
    return;
  }
  const storyUnit = event.target.closest("[data-story-replay-unit]")?.dataset.storyReplayUnit;
  if (storyUnit) {
    elements.tocDialog.close();
    storyTransitions.showUnit(storyUnit, { replay: true });
    return;
  }
  const button = event.target.closest("[data-activity-index]");
  if (button) goToActivity(Number(button.dataset.activityIndex));
  const unitButton = event.target.closest("button[data-unit-id]");
  if (unitButton) navigateToUnit(unitButton.dataset.unitId);
});
elements.themeOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="theme"]')?.value;
  if (!allowedThemes.has(value)) return;
  state.themePreference = value;
  persistSession();
  setTheme(functionalThemeFor());
});
$$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => {
  $("#" + button.dataset.closeDialog)?.close();
}));
$$('.app-dialog').forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));
elements.activityControls.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  handleActivityAction(action);
  const remediation = event.target.closest("[data-remediation]")?.dataset.remediation;
  if (remediation) goToRemediation(remediation);
  const route = event.target.closest("[data-route]")?.dataset.route;
  if (route) goToActivityId(route);
});
elements.exploreButton?.addEventListener("click", () => {
  handleActivityAction(isExplore() ? "exit-explore" : "explore");
});

window.addEventListener("resize", () => {
  elements.phone.style.removeProperty("--execution-console-height");
  executionMeasurementSignature = null;
  scheduleExecutionConsoleMeasurement({ force: true });
});
document.fonts?.ready.then(() => {
  executionMeasurementSignature = null;
  scheduleExecutionConsoleMeasurement({ force: true });
});

function showUpdateReady(registration) {
  serviceWorkerRegistration = registration;
  elements.settingsButton?.classList.add("update-ready");
  elements.settingsButton?.setAttribute("aria-label", "Open settings — update ready");
  $("[data-layout-action=\"settings\"]")?.classList.add("update-ready");
  elements.restartUpdateButton.hidden = false;
  elements.updateStatus.textContent = "A newer build has downloaded and is ready to restart.";
}

function registerServiceWorker() {
  elements.currentVersion.textContent = `Build ${appVersion}`;
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    elements.updateStatus.textContent = "Development build — updates come from the local Vite server.";
    return;
  }
  const checkForUpdate = async () => {
    try { await serviceWorkerRegistration?.update(); } catch {}
  };
  navigator.serviceWorker.register(appUrl("service-worker.js"), { scope: appUrl("") }).then(registration => {
    serviceWorkerRegistration = registration;
    if (registration.waiting && navigator.serviceWorker.controller) showUpdateReady(registration);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdateReady(registration);
      });
    });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    });
  }).catch(error => {
    elements.updateStatus.textContent = "Offline support could not be enabled for this browser.";
    console.warn("Service worker registration failed.", error);
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

function applyUpdate() {
  serviceWorkerRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
}

async function masteryStateSnapshot() {
  const index = await masteryConceptIndex();
  const now = Math.floor(Date.now() / 1000);
  const session = state.masterySession;
  return {
    active: isMasterySession(),
    kind: session?.kind || null,
    title: session ? masteryLabel() : null,
    index: session?.index ?? null,
    length: session ? session.queue.length : 0,
    // The queued activity's authored id, not the namespaced one it runs under.
    queue: session ? session.queue.map(activity => activity.masteryOrigin?.activityId || activity.id) : [],
    conceptIds: session?.conceptIds || [],
    dialogOpen: Boolean(elements.masteryDialog?.open),
    chapterUnitId: unit.surface === "mastery" ? unit.id : null,
    chapterComplete: unit.surface === "mastery" && storyTransitions.hasCompletedUnitStory(unit.id),
    pinned: [...masteryState.pinned],
    completions: Object.keys(masteryState.completions),
    concepts: index.concepts.map(concept => ({
      id: concept.id,
      unitId: concept.unitId,
      concept: concept.concept,
      // The achieved state and the refresh marker are two separate facts. A
      // state that could fall back down would show a learner their own
      // progress decaying through no action of theirs.
      state: conceptState(concept, masteryState.completions),
      maintenanceDue: isMaintenanceDue(concept, masteryState.completions, now),
    })),
    units: units.map(candidate => summarizeUnit(index, candidate.id, masteryState.completions, now)),
  };
}

window.VimWilds = Object.freeze({
  openMastery,
  closeMastery: () => elements.masteryDialog?.close(),
  startMasteryDrill: startFocusedDrill,
  startMixedReview,
  startToolChoice,
  startFieldNote,
  exitMastery: exitMasterySession,
  masteryState: masteryStateSnapshot,
  fieldNotes: () => fieldNoteCatalog().then(notes => notes.map(note => ({ id: note.id, title: note.title, limitation: note.limitation }))),
  units: units.map(candidate => ({ id: candidate.id, unitNumber: candidate.unitNumber, title: candidate.title })),
  unit: { id: unit.id, unitNumber: unit.unitNumber, title: unit.title },
  activities,
  exercises,
  emit: processToken,
  goTo(index) {
    if (!Number.isInteger(index) || index < 0 || index >= exercises.length) throw new RangeError("Invalid exercise index");
    goToActivity(activities.indexOf(exercises[index]));
  },
  goToActivity,
  solveCurrent() {
    if (isDemo()) while (stepDemo());
    else if (isPractice()) scriptKeys().slice(state.progress).forEach(processToken);
  },
  replayIntroStory() {
    return storyTransitions.showIntro({ replay: true });
  },
  replayEndingStory() {
    return storyTransitions.showEnding({ replay: true });
  },
  previewIntroArt(candidate) {
    const id = String(candidate).replace(/^candidate-?/, "").padStart(2, "0");
    if (!["05", "07", "10", "14"].includes(id)) throw new RangeError("Available intro-art reviews: 05, 07, 10, 14");
    return storyTransitions.showIntro({
      replay: true,
      reviewAsset: `artifacts/world-generation/wp11/intro-connected/candidate-${id}.png`,
    });
  },
  showUnitStory(unitId) {
    return storyTransitions.showUnit(unitId, { replay: true });
  },
  openReference(deckId) {
    return openReferenceDeck(deckId);
  },
  openUnitReference(unitId) {
    return openUnitReference(unitId);
  },
  closeReference() {
    closeReferenceDeck();
  },
  referenceState() {
    const deck = referenceDecks.get(referenceSession.deckId);
    return {
      open: elements.referenceDialog.open === true,
      deckId: referenceSession.deckId,
      unitId: referenceSession.unitId,
      cardId: referenceCard()?.id || null,
      cardIndex: referenceSession.cardIndex,
      cardCount: deck?.cards.length || 0,
      opening: referenceSession.opening,
      orientationSeen: referenceState.orientationSeen,
    };
  },
  openFreePractice(sampleId) {
    return startFreePractice(sampleId || null);
  },
  closeFreePractice() {
    exitFreePractice();
  },
  practiceSamples() {
    return practiceSampleCatalog().then(samples => samples.map(sample => ({
      id: sample.id,
      fileName: sample.fileName,
      languageId: sample.languageId,
      lineCount: sample.lines.length,
    })));
  },
  freePracticeState() {
    const sample = freePracticeSample();
    return {
      active: isFreePractice(),
      sampleId: sample?.id || null,
      fileName: sample?.fileName || null,
      languageId: sample?.languageId || null,
      lineCount: sample?.lines.length || 0,
      noticeSeen: practiceState.noticeSeen,
      pickerOpen: elements.practiceFilesDialog.open === true,
      noticeOpen: elements.practiceNoticeDialog.open === true,
    };
  },
  getState() {
    const snapshot = state.editorSnapshot || vimEngine?.getSnapshot();
    const ranges = snapshot?.ranges || [];
    const hasSelection = snapshot?.anchor !== snapshot?.head;
    const selection = snapshot?.mode === "visual-block" && ranges.length > 1 ? {
      kind: "block",
      from: ranges[0].from,
      to: [ranges.at(-1).to[0], ranges.at(-1).to[1] - 1],
    } : hasSelection ? {
      kind: "linear",
      from: ranges[0]?.from || snapshot.anchorPosition,
      to: ranges[0]?.to || snapshot.cursorPosition,
    } : null;
    return {
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      activityIndex: state.activityIndex,
      activityId: currentActivity().id,
      activityType: currentActivity().type,
      lessonId: currentActivity().lessonId,
      surface: surfaceKind(),
      // Both indexes address this unit's lesson flow. A drill can queue an
      // activity from any unit, so reporting a position in that flow would be
      // reporting a number that means nothing; gate them rather than let a
      // test read -1 as a location.
      exerciseIndex: isPractice() && surfaceKind() === "lesson" ? exercises.findIndex(exercise => exercise.sourceActivityId === currentActivity().sourceActivityId) : -1,
      exerciseId: isPractice() && surfaceKind() === "lesson" ? currentActivity().sourceActivityId : null,
      sourceActivityId: currentActivity().sourceActivityId || currentActivity().id,
      practiceMode: currentActivity().practiceMode || null,
      practicePolicy: practicePolicy(),
      progress: state.progress,
      playbackStep: state.playbackStep,
      history: [...state.history],
      complete: state.complete,
      exploreTargetReached: state.exploreTargetReached,
      code: snapshot?.text.split("\n") || [],
      cursor: snapshot?.cursorPosition || [0, 0],
      registers: snapshot?.registers || {},
      viewport: snapshot?.viewport || null,
      viewportDependent: Boolean(currentActivity().editor?.viewportDependent),
      matchLines: snapshot?.matchLines || [],
      impact: snapshot?.impact || null,
      exOutput: snapshot?.exOutput || null,
      impactMessage: shouldReportImpact(snapshot) ? impactMessage(snapshot) : "",
      setupDrift: state.setupDrift || null,
      selection,
      mode: state.complete ? "Complete" : (snapshot?.mode || "normal"),
      modifiers: [...state.modifiers],
      capsLock: state.capsLock,
      vimEffects: state.vimEffects,
      generatedBackdrops: state.generatedBackdrops,
      characters: state.characters,
      characterReaction: characterReactions.state,
      guidance: elements.guidance.textContent,
      story: storyTransitions.getState(),
    };
  },
  getEffects() {
    return structuredClone(state.semanticEffects);
  },
});

const requestedActivity = urlParams.get("activity") || (urlParams.has("unit") ? null : savedSession.activityId);
const requestedIndex = activities.findIndex(activity => activity.id === requestedActivity || activity.sourceActivityId === requestedActivity);
if (requestedIndex >= 0) state.activityIndex = requestedIndex;

assignCharacters();
worldRenderer.start();
renderAll();
renderThemeOptions();
storyTransitions.start();

const requestedReferenceDeck = urlParams.get("reference");
if (requestedReferenceDeck && referenceDecks.has(requestedReferenceDeck)) {
  openReferenceDeck(requestedReferenceDeck);
} else if (storyTransitions.getState().introSeen && !elements.storyDialog.open) {
  // The story only fires once. Someone who saw it before this deck existed
  // still gets the opening, on the same terms: once, and skippable.
  showOpeningReference();
}

if (urlParams.get("preview") === "story-index") {
  renderStoryReviewIndex();
} else if (urlParams.get("preview") === "story") {
  const requestedStory = urlParams.get("story");
  if (requestedStory === "intro") {
    const panels = catalogData.presentation?.story?.intro || [];
    const requestedPanel = urlParams.get("panel") || "1";
    const numericPanel = Number.parseInt(requestedPanel, 10);
    const panelIndex = Number.isInteger(numericPanel) && String(numericPanel) === requestedPanel
      ? numericPanel - 1
      : panels.findIndex(panel => panel.id === requestedPanel);
    storyTransitions.showIntro({ panelIndex: Math.max(0, panelIndex), replay: true });
  } else if (requestedStory === "unit-ending" || requestedStory === "unit") {
    const candidateNumber = Math.max(1, Math.min(5, Number.parseInt(urlParams.get("candidate") || "1", 10) || 1));
    const candidate = String(candidateNumber).padStart(2, "0");
    storyTransitions.showUnit(unit.id, {
      replay: true,
      reviewAsset: `artifacts/world-generation/wp11/story-review-v2/unit-endings/${unit.id}-restoration-3x4/candidate-${candidate}.png`,
    });
  } else if (requestedStory === "finale" || requestedStory === "ending") {
    storyTransitions.showEnding({ replay: true });
  }
}
if (urlParams.has("practice")) await startFreePractice(urlParams.get("practice") || null);
void loadCharacterAssets();
persistSession();
registerServiceWorker();

if (urlParams.get("preview") === "complete") {
  if (isDemo()) while (stepDemo());
  else if (isPractice()) scriptKeys().forEach(processToken);
}

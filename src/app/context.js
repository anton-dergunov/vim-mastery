/* What every part of the app shares: the content loaded at launch, the DOM
 * handles, and the mutable session state.
 *
 * It imports no other app module. Its top-level awaits therefore finish before
 * any feature module runs, and every feature can read what it exports at any
 * time.
 */

import {
  loadUnitCatalogWithPresentation,
  resolveUnitPresentation,
} from "../world/presentation-data.js";
import { appUrl } from "./version.js";
import { $ } from "./dom.js";

export const urlParams = new URLSearchParams(window.location.search);
const sessionStateKey = "vim-wilds.session.v1";
export const allowedThemes = new Set(["auto", "moonroot", "ember", "glass", "deepwater"]);
export const keyboardVisibilityValues = new Set(["visible", "hidden"]);
export const vimEffectValues = new Set(["enabled", "disabled"]);
export const decorativeMediaValues = new Set(["enabled", "disabled"]);
export const entryLevelValues = new Set(["new", "basics", "experienced"]);

function readSavedSession() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(sessionStateKey) || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

export const savedSession = readSavedSession();
export const [languageProfiles, referenceCatalog, catalogData] = await Promise.all([
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
export const units = unitCatalog.units.sort((left, right) => left.unitNumber - right.unitNumber);
export const curriculumArcs = [...(unitCatalog.arcs || [])].sort((left, right) => left.arcNumber - right.arcNumber);
export const unitsById = new Map(units.map(candidate => [candidate.id, candidate]));
const requestedUnitId = urlParams.get("unit") || (urlParams.has("activity") ? null : savedSession.unitId);
const selectedUnit = units.find(candidate => candidate.id === requestedUnitId) || units[0];
export const unit = await fetch(appUrl(selectedUnit.path)).then(response => {
  if (!response.ok) throw new Error(`Unit request failed (${response.status})`);
  return response.json();
});
export const unitPresentation = resolveUnitPresentation(catalogData.presentation, unit.id);

export const elements = {
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
  entryLevelDialog: $("#entryLevelDialog"),
  entryQuestionOptions: $("#entryQuestionOptions"),
  entryStartButton: $("#entryStartButton"),
  entryLevelOptions: $("#entryLevelOptions"),
  entryLandingButton: $("#entryLandingButton"),
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
  practiceFeedbackButton: $("#practiceFeedbackButton"),
  practiceFilesDialog: $("#practiceFilesDialog"),
  practiceFileList: $("#practiceFileList"),
  practiceNoticeDialog: $("#practiceNoticeDialog"),
  masteryDialog: $("#masteryDialog"),
  masteryBody: $("#masteryBody"),
  currentVersion: $("#currentVersion"),
  updateStatus: $("#updateStatus"),
  restartUpdateButton: $("#restartUpdateButton"),
  feedbackButton: $("#feedbackButton"),
  feedbackSettingsButton: $("#feedbackSettingsButton"),
  feedbackDialog: $("#feedbackDialog"),
  feedbackPlace: $("#feedbackPlace"),
  feedbackPending: $("#feedbackPending"),
  feedbackNote: $("#feedbackNote"),
  feedbackCategories: $("#feedbackCategories"),
  feedbackShotStatus: $("#feedbackShotStatus"),
  feedbackShotPreview: $("#feedbackShotPreview"),
  feedbackShotAttach: $("#feedbackShotAttach"),
  feedbackShotRemove: $("#feedbackShotRemove"),
  feedbackShotInput: $("#feedbackShotInput"),
  feedbackBuffer: $("#feedbackBuffer"),
  feedbackDetails: $("#feedbackDetails"),
  feedbackBufferNote: $("#feedbackBufferNote"),
  feedbackBufferClear: $("#feedbackBufferClear"),
  feedbackPreview: $("#feedbackPreview"),
  feedbackStatus: $("#feedbackStatus"),
  feedbackSend: $("#feedbackSend"),
  feedbackSave: $("#feedbackSave"),
  feedbackCopy: $("#feedbackCopy"),
};

export const lessons = unit.lessons.map((lesson, lessonIndex) => ({ ...lesson, lessonIndex }));
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
export const activities = lessons.flatMap(activityFlowFor).map((activity, activityIndex) => ({ ...activity, activityIndex }));
export const exercises = activities.filter(activity => activity.type === "exercise" && activity.practiceMode === "guided");
export const languageNames = new Map(languageProfiles.profiles.map(profile => [profile.id, profile.displayName]));

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

function storedEntryLevel() {
  // null is "never asked", the way `orientationSeen: false` is. It behaves as
  // "new to Vim", which is both today's behavior and the level the curriculum
  // document names as the default.
  return entryLevelValues.has(savedSession.entryLevel) ? savedSession.entryLevel : null;
}

export const state = {
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
  entryLevel: storedEntryLevel(),
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
  rejectedKeys: [],
};

export function persistSession() {
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
      entryLevel: state.entryLevel,
      savedAt: new Date().toISOString(),
    }));
  } catch {}
}

// `unit.reference` has been authored, schema-validated, and cross-checked
// against activity ids since the curriculum began, and rendered nowhere. Until
// it has a surface, "demote to reference" is deletion under another name.
// One cache for whole unit files. The reference surface wanted their
// `reference` arrays and a mastery drill wants their activities, and fetching
// the same file twice for the two of them would be the only difference.
const unitDataCache = new Map([[unit.id, unit]]);

export async function unitData(unitId) {
  if (unitDataCache.has(unitId)) return unitDataCache.get(unitId);
  const candidate = units.find(item => item.id === unitId);
  if (!candidate) return null;
  const response = await fetch(appUrl(candidate.path));
  if (!response.ok) throw new Error(`Unit request failed (${response.status})`);
  const data = await response.json();
  unitDataCache.set(unitId, data);
  return data;
}

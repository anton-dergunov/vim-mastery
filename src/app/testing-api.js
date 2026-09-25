/* window.VimWilds: the interface the browser suite drives. AGENTS.md requires
 * it to survive refactors.
 */

import { activities, elements, exercises, state, unit, units } from "./context.js";
import {
  currentActivity,
  freePracticeSample,
  isDemo,
  isFreePractice,
  isPractice,
  practicePolicy,
  scriptKeys,
  surfaceKind,
} from "./activity.js";
import { goToActivity } from "./navigation.js";
import { characterReactions } from "../lesson/characters.js";
import { stepDemo } from "../lesson/demo.js";
import { processToken } from "../lesson/practice.js";
import { vimEngine } from "../editor/mount.js";
import { impactMessage, shouldReportImpact } from "../editor/readouts.js";
import { storyTransitions } from "../dialogs/story.js";
import { entryLandingUnit } from "../dialogs/entry-level.js";
import {
  closeReferenceDeck,
  openReferenceDeck,
  openUnitReference,
  referenceCard,
  referenceDecks,
  referenceSession,
  referenceState,
} from "../dialogs/reference.js";
import {
  exitFreePractice,
  practiceSampleCatalog,
  practiceState,
  startFreePractice,
} from "../surfaces/free-practice.js";
import {
  exitMasterySession,
  fieldNoteCatalog,
  masteryStateSnapshot,
  openMastery,
  startFieldNote,
  startFocusedDrill,
  startMixedReview,
  startToolChoice,
} from "../surfaces/mastery.js";
import { feedback } from "./feedback.js";

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
      fileName: currentActivity().fileName || "",
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
      entryLevel: state.entryLevel,
      entryUnitId: entryLandingUnit(state.entryLevel).id,
      characterReaction: characterReactions.state,
      guidance: elements.guidance.textContent,
      story: storyTransitions.getState(),
    };
  },
  getEffects() {
    return structuredClone(state.semanticEffects);
  },
  // AGENTS.md requires this interface to survive refactors. The hooks read
  // `feedback` at call time because the surface is built below, once the
  // snapshot these reports are made from exists.
  feedback: Object.freeze({
    open: () => feedback?.open(),
    close: () => elements.feedbackDialog?.close(),
    report: () => feedback?.currentReport(),
    isOpen: () => Boolean(feedback?.isOpen()),
  }),
});

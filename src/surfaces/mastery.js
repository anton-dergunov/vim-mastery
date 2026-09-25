/* Mastery: the record of completed work, the drills and reviews built from it,
 * field notes, and the mastery map.
 */

import { appUrl } from "../app/version.js";
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
} from "../progress/mastery.js";
import { escapeHtml, renderInline } from "../app/html.js";
import { elements, state, unit, unitData, units } from "../app/context.js";
import { currentActivity, isFreePractice, isMasterySession } from "../app/activity.js";
import { resetActivity } from "../app/navigation.js";
import { clearPlayback } from "../lesson/demo.js";
import { storyTransitions } from "../dialogs/story.js";

// Mastery owns the only record of what a learner has finished. It is kept out
// of the session key because the two mean opposite things: the session key is a
// position and moves in both directions, while these records only accumulate.
let masteryState = readMasteryState(window.localStorage);

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

export function fieldNoteCatalog() {
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
export function recordActivityCompletion(activity = currentActivity()) {
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

export function masteryLabel() {
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

export function advanceMasteryQueue() {
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

export function exitMasterySession() {
  if (!isMasterySession()) return;
  state.masterySession = null;
  delete elements.phone.dataset.surface;
  resetActivity({ vibrateReset: false });
}

export async function startFocusedDrill(conceptId) {
  const index = await masteryConceptIndex();
  const concept = index.byId.get(conceptId);
  if (!concept) throw new RangeError(`Unknown concept "${conceptId}"`);
  const plan = buildFocusedPlan(concept);
  return plan ? startMasterySession("focused", plan, { title: concept.concept }) : null;
}

export async function startMixedReview(conceptIds = null) {
  const index = await masteryConceptIndex();
  const pool = conceptIds
    ? conceptIds.map(id => index.byId.get(id)).filter(Boolean)
    : reviewPool(index);
  const plan = buildMixedPlan(pool);
  return plan ? startMasterySession("mixed", plan) : null;
}

export async function startToolChoice() {
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

export async function startFieldNote(noteId) {
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

export async function openMastery() {
  elements.tocDialog?.close();
  elements.masteryBody.innerHTML = '<p class="practice-loading">Loading…</p>';
  if (!elements.masteryDialog.open) elements.masteryDialog.showModal();
  await renderMasteryDialog();
}
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

export async function masteryStateSnapshot() {
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

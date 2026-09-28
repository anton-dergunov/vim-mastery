/* Mastery: the record of completed work, the drills and reviews built from it,
 * field notes, and the mastery map the course map's Practice tab shows.
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
import { curriculumArcs, elements, persistSession, state, unit, unitData, units } from "../app/context.js";
import { currentActivity, isFreePractice, isMasterySession } from "../app/activity.js";
import { resetActivity } from "../app/navigation.js";
import { clearPlayback } from "../lesson/demo.js";
import { storyTransitions } from "../dialogs/story.js";
import { courseMapTab, openTableOfContents } from "../dialogs/contents.js";

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
  // The course list shows no mastery state, so completing an exercise has
  // nothing to redraw there. Only the Practice tab, and only while it shows.
  if (courseMapTab() === "practice") void renderMasteryMap();
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
}

function conceptStateLabel(conceptState_) {
  return { unseen: "Unseen", learning: "Learning", practiced: "Practiced", integrated: "Integrated" }[conceptState_];
}

const arcHeading = arc => `<h4 class="mastery-arc"><span>Arc ${arc.arcNumber}</span> ${renderInline(arc.title)}</h4>`;

/**
 * The mastery map, drawn into the course map's Practice tab.
 *
 * Topics come in two arrangements the learner switches between: by what to do
 * next (due, learning, kept, not started), or under the course's own arcs and
 * units. Either way every row carries the same state, due marker, drill or
 * test out, and pin. Redrawing keeps open groups open and the scroll where it
 * was, because a pin or a finished drill redraws the tab under the learner.
 */
export async function renderMasteryMap() {
  const target = elements.tocPractice;
  if (!target) return;
  if (!target.childElementCount) target.innerHTML = '<p class="practice-loading">Loading…</p>';
  const index = await masteryConceptIndex();
  const now = Math.floor(Date.now() / 1000);
  const completions = masteryState.completions;
  const eligible = eligibleConcepts(index, completions);
  const pool = reviewPool(index);
  const arrangement = state.masteryArrangement;
  const unitNumbers = new Map(units.map(candidate => [candidate.id, candidate.unitNumber]));

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
    return `<div class="mastery-concept${due ? " is-due" : ""}">
      <div class="mastery-concept-head">
        ${arrangement === "next" ? `<span class="mastery-concept-unit">Unit ${unitNumbers.get(concept.unitId) ?? ""}</span>` : ""}
        <strong>${renderInline(concept.concept)}</strong>
        <span class="mastery-chips">
          <span class="mastery-chip state-${conceptStateName}">${conceptStateLabel(conceptStateName)}</span>
          ${due ? '<span class="mastery-chip maintenance">Due for a refresh</span>' : ""}
        </span>
      </div>
      <div class="mastery-concept-actions">
        <button type="button" data-mastery-drill="${escapeHtml(concept.id)}"${replayable ? "" : ' class="mastery-test-out"'} title="${escapeHtml(drillHint)}">${drillLabel}</button>
        <button type="button" class="mastery-pin${pinned ? " pinned" : ""}" data-mastery-pin="${escapeHtml(concept.id)}" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>
      </div>
    </div>`;
  };

  const byUnit = () => curriculumArcs.map(arc => {
    const sections = units.filter(candidate => arc.unitNumbers.includes(candidate.unitNumber)).map(candidate => {
      const summary = summarizeUnit(index, candidate.id, completions, now);
      if (!summary.total) return "";
      const applied = summary.counts.practiced + summary.counts.integrated;
      const concepts = index.concepts.filter(concept => concept.unitId === candidate.id);
      return `<details class="mastery-unit${summary.maintenanceDue ? " has-due" : ""}" data-mastery-group="unit-${escapeHtml(candidate.id)}">
        <summary>
          <span>Unit ${candidate.unitNumber}</span>
          <strong>${renderInline(candidate.title)}</strong>
          <small>${applied} of ${summary.total} practised${summary.maintenanceDue ? ` · <b>${summary.maintenanceDue} due</b>` : ""}</small>
          <span class="mastery-meter" aria-hidden="true"><i style="width:${Math.round(applied / summary.total * 100)}%"></i></span>
        </summary>
        <div class="mastery-unit-concepts">${concepts.map(conceptRow).join("")}</div>
      </details>`;
    }).join("");
    return sections ? `${arcHeading(arc)}${sections}` : "";
  }).join("");

  const byNextStep = () => {
    const rows = index.concepts.map(concept => ({
      concept,
      stateName: conceptState(concept, completions),
      due: isMaintenanceDue(concept, completions, now),
    }));
    const groups = [
      { id: "due", title: "Due for a refresh", note: "Integrated a while ago. A short drill keeps them.", items: rows.filter(row => row.due), open: true },
      { id: "learning", title: "Learning", note: "Met in a lesson, not yet applied on your own.", items: rows.filter(row => !row.due && row.stateName === "learning"), open: true },
      { id: "kept", title: "Practiced and integrated", note: "Replay any of these whenever you like.", items: rows.filter(row => !row.due && ["practiced", "integrated"].includes(row.stateName)), open: false },
      { id: "unseen", title: "Not started yet", note: "Test out of a topic before its lesson. Passing counts.", items: rows.filter(row => row.stateName === "unseen"), open: false },
    ].filter(group => group.items.length);
    return groups.map(group => `<details class="mastery-group mastery-group-${group.id}" data-mastery-group="${group.id}"${group.open ? " open" : ""}>
      <summary><strong>${group.title}</strong><small>${group.items.length}</small></summary>
      <p class="mastery-group-note">${group.note}</p>
      <div class="mastery-unit-concepts">${group.items.map(row => conceptRow(row.concept)).join("")}</div>
    </details>`).join("");
  };

  const pinnedCount = eligible.filter(concept => masteryState.pinned.includes(concept.id)).length;
  const mixedReady = pool.length >= 2;
  const dueCount = index.concepts.filter(concept => isMaintenanceDue(concept, completions, now)).length;
  const chapterPending = unit.surface === "mastery" && !storyTransitions.hasCompletedUnitStory(unit.id);

  const open = new Set([...target.querySelectorAll("details[data-mastery-group]")]
    .filter(details => details.open).map(details => details.dataset.masteryGroup));
  const closed = new Set([...target.querySelectorAll("details[data-mastery-group]")]
    .filter(details => !details.open).map(details => details.dataset.masteryGroup));
  const scrollTop = target.scrollTop;
  target.innerHTML = `
    <p class="mastery-intro">${chapterPending
      ? "Complete one mixed review to close Keeper’s circuit. That first circuit advances the story once; every Mastery session remains reusable afterward."
      : "<strong>Drills and reviews of what you have met.</strong> Every result is kept. Nothing here advances the story or unlocks a unit."}</p>
    <section class="mastery-sessions" aria-labelledby="masterySessionsTitle">
      <h3 id="masterySessionsTitle">Sessions</h3>
      <div class="mastery-session-actions">
        <button type="button" class="mastery-session-primary" data-mastery-mixed ${mixedReady ? "" : "disabled"}>
          <strong>Mixed review</strong>
          <small>${mixedReady
            ? `Interleaves ${Math.min(pool.length, 5)} of your ${pinnedCount >= 2 ? "pinned" : "practised"} topics.${dueCount ? ` ${dueCount} ${dueCount === 1 ? "is" : "are"} due for a refresh.` : ""}`
            : "Needs two practised topics. Finish an isolated exercise in two of them."}</small>
        </button>
        <button type="button" data-mastery-tool-choice ${pool.length ? "" : "disabled"}>
          <strong>Tool choice</strong>
          <small>${pool.length ? "Name the mechanism before touching the keys." : "Opens once you have practised a topic."}</small>
        </button>
      </div>
    </section>
    <section class="mastery-topics" aria-labelledby="masteryTopicsTitle">
      <div class="mastery-topics-head">
        <h3 id="masteryTopicsTitle">Topics</h3>
        <div class="mastery-arrange" role="group" aria-label="Arrange topics">
          <button type="button" data-mastery-arrange="next" aria-pressed="${arrangement === "next"}">By next step</button>
          <button type="button" data-mastery-arrange="unit" aria-pressed="${arrangement === "unit"}">By unit</button>
        </div>
      </div>
      <p class="mastery-caveat">A drill replays an exercise you have met, with the prompt withheld. A test out runs the same exercises for a topic you have not reached yet, and passing one counts. Pin the topics you want mixed review to draw from. Larger buffers, distractors and varied cursor placement are authoring work that has not been done.</p>
      <div class="mastery-units">${arrangement === "unit" ? byUnit() : byNextStep()}</div>
    </section>
    <div class="mastery-scratchpad">
      <button type="button" class="mastery-scratchpad-open" data-practice-random>
        <span aria-hidden="true">✎</span>
        <span><strong>Scratchpad</strong><small>A real file, no goal. Nothing here is scored or unlocked, and it is open before Unit 1.</small></span>
      </button>
      <button type="button" class="mastery-scratchpad-browse" data-practice-browse>Browse files</button>
    </div>`;
  target.querySelectorAll("details[data-mastery-group]").forEach(details => {
    if (open.has(details.dataset.masteryGroup)) details.open = true;
    if (closed.has(details.dataset.masteryGroup)) details.open = false;
  });
  target.scrollTop = scrollTop;
}

// The map is the course map's Practice tab now. Every way in — Unit 17's
// "Open Mastery", the end of a session, "Test out a topic" beside a
// prerequisite warning — lands there.
export async function openMastery() {
  openTableOfContents({ tab: "practice" });
  await renderMasteryMap();
}
elements.tocPractice?.addEventListener("click", event => {
  const drill = event.target.closest("[data-mastery-drill]")?.dataset.masteryDrill;
  if (drill) return void startFocusedDrill(drill);
  const pin = event.target.closest("[data-mastery-pin]")?.dataset.masteryPin;
  if (pin) return void toggleMasteryPin(pin);
  const arrangement = event.target.closest("[data-mastery-arrange]")?.dataset.masteryArrange;
  if (arrangement && arrangement !== state.masteryArrangement) {
    state.masteryArrangement = arrangement;
    persistSession();
    elements.tocPractice.scrollTop = 0;
    return void renderMasteryMap();
  }
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
    dialogOpen: courseMapTab() === "practice",
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

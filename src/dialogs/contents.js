/* The contents dialog: units by arc, their lessons, and the ways into free
 * practice, mastery, the reference, and the story archive.
 */

import { escapeHtml, renderInline } from "../app/html.js";
import {
  activities,
  curriculumArcs,
  elements,
  lessons,
  referenceCatalog,
  state,
  unit,
  units,
  unitsById,
} from "../app/context.js";
import { goToActivity, navigateToUnit } from "../app/navigation.js";
import { renderTrackBadge } from "../lesson/notes.js";
import { storyTransitions } from "./story.js";
import { openReferenceDeck, openUnitReference, referenceDecks } from "./reference.js";
import { openPracticeFiles, startFreePractice } from "../surfaces/free-practice.js";
import { openMastery } from "../surfaces/mastery.js";

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

export function renderTableOfContents() {
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

export function openTableOfContents() {
  renderTableOfContents();
  elements.tocDialog.showModal();
}
elements.tocButton?.addEventListener("click", () => {
  openTableOfContents();
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

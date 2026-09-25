/* Markup for the reading cards: theory, choices, summaries, and field notes.
 */

import { escapeHtml, renderInline } from "../app/html.js";
import { activities, lessons, state, unit } from "../app/context.js";
import { nextSequentialUnit } from "../app/navigation.js";

function renderRoutes(routes = []) {
  if (!routes.length) return "";
  return `<div class="note-routes">${routes.map(route => `<button class="note-action${route.emphasis === "secondary" ? " secondary-action" : ""}" type="button" data-route="${escapeHtml(route.activityRef)}">${renderInline(route.label)}</button>`).join("")}</div>`;
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

export function modePillName(mode) {
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

export function renderTrackBadge(track) {
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

export function renderFieldNote(activity) {
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

/* A first arrival: the opening reference deck, then the question about how
 * much Vim the learner already knows. Settings shows the same options.
 */

import { $$ } from "../app/dom.js";
import {
  curriculumArcs,
  elements,
  entryLevelValues,
  persistSession,
  state,
  unit,
  units,
} from "../app/context.js";
import { navigateToUnit } from "../app/navigation.js";
import { vimEngine } from "../editor/mount.js";
import { isDefaultArrival } from "./story.js";
import { openingDeck, openReferenceDeck, referenceState } from "./reference.js";

// The three levels name arcs, not unit ids. The landing point is read back out
// of the catalog so a renumbering moves it and this table does not.
const entryLevelArcNumbers = Object.freeze({ new: 1, basics: 2, experienced: 3 });

// A confidence level is a suggestion about where to open, and nothing else. It
// resolves to the first unit of its arc; it never marks anything complete and
// never makes anything unavailable.
export function entryLandingUnit(level) {
  const arcNumber = entryLevelArcNumbers[level] || entryLevelArcNumbers.new;
  const arc = curriculumArcs.find(candidate => candidate.arcNumber === arcNumber);
  const first = Math.min(...(arc?.unitNumbers || []));
  return units.find(candidate => candidate.unitNumber === first) || units[0];
}
let entryQuestionPending = false;

export function showOpeningReference() {
  if (!openingDeck || referenceState.orientationSeen || !isDefaultArrival) return false;
  // The entry question rides on the opening deck rather than on
  // `isDefaultArrival` alone. A learner who is already past the first run has
  // answered it by default and changes it in Settings; interrupting them here
  // would also open a modal over every returning-learner session.
  entryQuestionPending = !entryLevelValues.has(state.entryLevel);
  openReferenceDeck(openingDeck.id, { opening: true });
  return true;
}

// Every exit from the deck funnels through `closeReferenceDeck`: its own
// buttons, Escape, and the survival detour, which returns there on Done.
export function showEntryLevelQuestion() {
  if (!entryQuestionPending || elements.referenceDialog.open) return;
  entryQuestionPending = false;
  if (!elements.entryLevelDialog || elements.entryLevelDialog.open) return;
  renderEntryLevelOptions();
  elements.entryLevelDialog.showModal();
}

// One helper for both surfaces: the first-run question and the Settings row
// hold the same three options and must never drift apart. Destinations are
// written from the catalog, so no unit number is spelled out in the markup.
export function renderEntryLevelOptions() {
  const level = entryLevelValues.has(state.entryLevel) ? state.entryLevel : "new";
  $$("[data-entry-destination]").forEach(node => {
    const target = entryLandingUnit(node.dataset.entryDestination);
    node.textContent = `Starts at Unit ${target.unitNumber}, ${target.title}.`;
  });
  $$('input[name="entry-level"], input[name="entry-level-question"]')
    .forEach(input => { input.checked = input.value === level; });
  const landing = entryLandingUnit(level);
  if (elements.entryStartButton) elements.entryStartButton.textContent = `Start Unit ${landing.unitNumber}`;
  if (elements.entryLandingButton) elements.entryLandingButton.textContent = `Open Unit ${landing.unitNumber}`;
}
function handleEntryLevelChange(event) {
  const value = event.target.closest('input[name="entry-level"], input[name="entry-level-question"]')?.value;
  if (!entryLevelValues.has(value)) return;
  state.entryLevel = value;
  persistSession();
  renderEntryLevelOptions();
}
elements.entryQuestionOptions?.addEventListener("change", handleEntryLevelChange);
elements.entryLevelOptions?.addEventListener("change", handleEntryLevelChange);
// `close` is the single hook for the button, Escape and the backdrop, the way
// the free practice notice records that it was shown.
elements.entryLevelDialog?.addEventListener("close", () => {
  if (!entryLevelValues.has(state.entryLevel)) {
    // Dismissing the question is "new to Vim" — today's behavior exactly, and
    // the level the curriculum document names as the default.
    state.entryLevel = "new";
    persistSession();
    renderEntryLevelOptions();
  }
  const landing = entryLandingUnit(state.entryLevel);
  // A suggestion about where to open, applied once. The reload is what makes
  // `?unit=` drop the stale activity id and start at the unit's first activity.
  if (landing.id !== unit.id) {
    navigateToUnit(landing.id);
    return;
  }
  if (document.querySelector("dialog[open]")) return;
  vimEngine?.focus();
});
elements.entryLandingButton?.addEventListener("click", () => {
  const landing = entryLandingUnit(state.entryLevel);
  if (landing.id === unit.id) {
    elements.settingsDialog.close();
    return;
  }
  navigateToUnit(landing.id);
});

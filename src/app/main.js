/* Starts the app: pick the activity to open, render it, and then open whatever
 * the URL or the first-run flow asks for.
 *
 * Each feature registers its own listeners when its module loads. The last
 * three imports are here only for that: nothing else imports them.
 */

import {
  activities,
  catalogData,
  elements,
  persistSession,
  savedSession,
  state,
  unit,
  urlParams,
} from "./context.js";
import { isDemo, isPractice, scriptKeys } from "./activity.js";
import { renderAll } from "./render.js";
import { registerServiceWorker } from "./service-worker.js";
import { worldRenderer } from "../lesson/board.js";
import { assignCharacters, loadCharacterAssets } from "../lesson/characters.js";
import { stepDemo } from "../lesson/demo.js";
import { processToken } from "../lesson/practice.js";
import { storyTransitions } from "../dialogs/story.js";
import { renderThemeOptions } from "../dialogs/settings.js";
import { renderEntryLevelOptions, showOpeningReference } from "../dialogs/entry-level.js";
import { openReferenceDeck, referenceDecks } from "../dialogs/reference.js";
import { startFreePractice } from "../surfaces/free-practice.js";
import "./testing-api.js";
import "./feedback.js";
import "./events.js";

const requestedActivity = urlParams.get("activity") || (urlParams.has("unit") ? null : savedSession.activityId);
const requestedIndex = activities.findIndex(activity => activity.id === requestedActivity || activity.sourceActivityId === requestedActivity);
if (requestedIndex >= 0) state.activityIndex = requestedIndex;

assignCharacters();
worldRenderer.start();
renderAll();
renderThemeOptions();
renderEntryLevelOptions();
storyTransitions.start();

const requestedReferenceDeck = urlParams.get("reference");
if (requestedReferenceDeck && referenceDecks.has(requestedReferenceDeck)) {
  openReferenceDeck(requestedReferenceDeck);
} else if (storyTransitions.getState().introSeen && !elements.storyDialog.open) {
  // The story only fires once. Someone who saw it before this deck existed
  // still gets the opening, on the same terms: once, and skippable.
  showOpeningReference();
}

if (urlParams.get("preview") === "story") {
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
    storyTransitions.showUnit(unit.id, { replay: true });
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

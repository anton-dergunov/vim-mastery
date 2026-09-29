/* The settings dialog.
 */

import { $ } from "../app/dom.js";
import {
  allowedThemes,
  elements,
  persistSession,
  state,
} from "../app/context.js";
import { currentActivity } from "../app/activity.js";
import { renderActivityControls } from "../app/render.js";
import { applyUpdate } from "../app/service-worker.js";
import {
  functionalThemeFor,
  presentationFor,
  refreshWorldPresentation,
  renderCompletionHost,
  setTheme,
} from "../lesson/board.js";
import {
  loadCharacterAssets,
  releaseSuccessMedia,
  renderCharacterLayer,
} from "../lesson/characters.js";
import { scheduleExecutionConsoleMeasurement } from "../lesson/console.js";
import { vimEngine } from "../editor/mount.js";
import { storyTransitions } from "./story.js";
import { renderEntryLevelOptions } from "./entry-level.js";

// The on/off preferences are switches, but the session keeps the two-valued
// strings it always has, so a saved session reads the same either way.
function switchFor(container) {
  return $('input[type="checkbox"]', container);
}

export function renderKeyboardOptions() {
  const input = switchFor(elements.keyboardOptions);
  if (input) input.checked = state.keyboardVisibility === "visible";
}

export function renderVimEffectOptions() {
  const input = switchFor(elements.vimEffectOptions);
  if (input) input.checked = state.vimEffects === "enabled";
}

export function renderDecorativeMediaOptions() {
  const backdrop = switchFor(elements.backdropOptions);
  const characters = switchFor(elements.characterOptions);
  if (backdrop) backdrop.checked = state.generatedBackdrops === "enabled";
  if (characters) characters.checked = state.characters === "enabled";
}

export function renderThemeOptions() {
  const input = $(`input[name="theme"][value="${state.themePreference}"]`, elements.themeOptions);
  if (input) input.checked = true;
}
export function openSettings() {
  renderKeyboardOptions();
  renderVimEffectOptions();
  renderDecorativeMediaOptions();
  renderThemeOptions();
  renderEntryLevelOptions();
  elements.settingsDialog.showModal();
}
elements.settingsButton?.addEventListener("click", openSettings);
elements.restartUpdateButton?.addEventListener("click", applyUpdate);
elements.replayStoryButton?.addEventListener("click", () => {
  elements.settingsDialog.close();
  storyTransitions.showIntro({ replay: true });
});
elements.keyboardOptions?.addEventListener("change", event => {
  const value = event.target.checked ? "visible" : "hidden";
  state.keyboardVisibility = value;
  persistSession();
  if (state.complete) renderCompletionHost();
  renderActivityControls();
  scheduleExecutionConsoleMeasurement();
});
elements.vimEffectOptions?.addEventListener("change", event => {
  const value = event.target.checked ? "enabled" : "disabled";
  state.vimEffects = value;
  persistSession();
  if (value === "disabled") vimEngine?.clearEffects();
});
elements.backdropOptions?.addEventListener("change", event => {
  const value = event.target.checked ? "enabled" : "disabled";
  state.generatedBackdrops = value;
  persistSession();
  refreshWorldPresentation();
});
elements.characterOptions?.addEventListener("change", event => {
  const value = event.target.checked ? "enabled" : "disabled";
  state.characters = value;
  persistSession();
  if (value === "disabled") {
    releaseSuccessMedia();
    document.documentElement.dataset.charactersReady = "disabled";
  }
  renderCharacterLayer(currentActivity(), presentationFor(currentActivity()));
  if (value === "enabled") void loadCharacterAssets();
});
elements.themeOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="theme"]')?.value;
  if (!allowedThemes.has(value)) return;
  state.themePreference = value;
  persistSession();
  setTheme(functionalThemeFor());
});

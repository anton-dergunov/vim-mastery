/* The settings dialog.
 */

import { $ } from "../app/dom.js";
import {
  allowedThemes,
  decorativeMediaValues,
  elements,
  keyboardVisibilityValues,
  persistSession,
  state,
  vimEffectValues,
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

export function renderKeyboardOptions() {
  const selected = $(`input[name="keyboard-visibility"][value="${state.keyboardVisibility}"]`, elements.keyboardOptions);
  if (selected) selected.checked = true;
}

export function renderVimEffectOptions() {
  const selected = $(`input[name="vim-effects"][value="${state.vimEffects}"]`, elements.vimEffectOptions);
  if (selected) selected.checked = true;
}

export function renderDecorativeMediaOptions() {
  const backdrop = $(`input[name="generated-backdrops"][value="${state.generatedBackdrops}"]`, elements.backdropOptions);
  const characters = $(`input[name="characters"][value="${state.characters}"]`, elements.characterOptions);
  if (backdrop) backdrop.checked = true;
  if (characters) characters.checked = true;
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
elements.themeOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="theme"]')?.value;
  if (!allowedThemes.has(value)) return;
  state.themePreference = value;
  persistSession();
  setTheme(functionalThemeFor());
});

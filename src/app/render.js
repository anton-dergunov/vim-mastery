/* renderAll, and the chrome around the board: the header, the activity intro,
 * the mode pill, and the controls under the editor.
 */

import { $ } from "./dom.js";
import { escapeHtml, renderInline } from "./html.js";
import { elements, state } from "./context.js";
import {
  currentActivity,
  isDemo,
  isExplore,
  isFreePractice,
  isPractice,
  isRunnable,
  languageLabel,
  scriptKeys,
  surfaceKind,
} from "./activity.js";
import { modePillName } from "../lesson/notes.js";
import { completionPanelMarkup, completionRendersInWorld, renderWorld } from "../lesson/board.js";
import { preloadSuccessMedia } from "../lesson/characters.js";
import { renderCommand } from "../lesson/console.js";
import { renderHints } from "../lesson/practice.js";
import { renderModifiers } from "../keyboard/keyboard.js";
import { renderTableOfContents } from "../dialogs/contents.js";
import {
  renderDecorativeMediaOptions,
  renderKeyboardOptions,
  renderVimEffectOptions,
} from "../dialogs/settings.js";
import { masteryLabel } from "../surfaces/mastery.js";

function renderActivityIntro() {
  const activity = currentActivity();
  const show = isRunnable(activity) && !isFreePractice();
  elements.activityIntro.hidden = !show;
  if (!show) return;
  const practiceLabel = isExplore(activity)
    ? "Explore"
    : activity.masteryOrigin
      ? activity.practiceMode === "recall" ? "Drill · recall" : "Drill"
    : activity.practiceMode === "guided" ? "Guided practice" : activity.practiceMode === "recall" ? "Recall practice" : "Demo";
  const origin = activity.masteryOrigin
    ? `<span class="activity-origin">Unit ${activity.masteryOrigin.unitNumber}</span>`
    : "";
  elements.activityKicker.innerHTML = `<span class="activity-kind">${escapeHtml(practiceLabel)}</span>${origin}<span class="activity-language">${escapeHtml(languageLabel(activity))}</span>`;
  elements.activityTitle.innerHTML = renderInline(activity.title);
  elements.activityInstruction.innerHTML = renderInline(activity.instruction);
  elements.hintButton.hidden = !isPractice(activity);
  elements.exploreButton.hidden = !isPractice(activity);
  elements.exploreButton.textContent = isExplore(activity) ? "Exit" : "Explore";
  elements.exploreButton.classList.toggle("active", isExplore(activity));
  elements.exploreButton.setAttribute("aria-pressed", String(isExplore(activity)));
}

function modeLabel() {
  const activity = currentActivity();
  if (activity.type === "choice" && activity.questionKind === "mode-identification" && !state.complete) return "Identify";
  if (activity.type === "choice" && activity.questionKind === "mode-identification" && state.complete) return modePillName(state.editorSnapshot?.mode || activity.inspection?.initial.mode);
  if (state.complete) return "Complete";
  if (!isRunnable()) return currentActivity().type === "theory" ? "Theory" : "Review";
  const mode = state.editorSnapshot?.mode || "normal";
  return modePillName(mode);
}

export function renderMode() {
  const label = modeLabel();
  elements.modePill.textContent = label;
  const actualMode = state.editorSnapshot?.mode || "normal";
  const kind = /complete/i.test(label) ? "complete" : /identify/i.test(label) ? "identify" : actualMode;
  elements.modePill.className = `mode-pill mode-${kind}`.trim();
  elements.world.dataset.mode = actualMode;
}

function renderHeader() {
  const activity = currentActivity();
  const surface = surfaceKind();
  const lesson = surface === "lesson";
  const free = surface === "free-practice";
  elements.lessonLabel.textContent = lesson ? activity.lessonTitle : surface === "mastery" ? masteryLabel() : activity.title;
  elements.resetButton.hidden = !isRunnable(activity);
  // Toggling the attribute, not a class, removes the inactive controls from the
  // accessibility tree so a role lookup can only ever match one of each pair.
  // The leave control is shared by both detours; the file picker and the report
  // flag are free practice's alone. The flag is here rather than floating over
  // the board because on this one surface the buffer fills the board.
  [[elements.tocButton, !lesson], [elements.settingsButton, !lesson],
    [elements.practiceLeaveButton, lesson], [elements.practiceFilesButton, !free],
    [elements.practiceFeedbackButton, !free],
    [$('[data-layout-action="toc"]'), !lesson], [$('[data-layout-action="settings"]'), !lesson],
    [$('[data-layout-action="practice-leave"]'), lesson], [$('[data-layout-action="practice-files"]'), !free],
    [$('[data-layout-action="practice-feedback"]'), !free],
  ].forEach(([button, hidden]) => button?.toggleAttribute("hidden", hidden));
  renderTableOfContents();
}

export function renderActivityControls() {
  const activity = currentActivity();
  const completionInWorld = completionRendersInWorld();
  elements.keyboardPanel.classList.toggle("empty-panel", !isRunnable(activity) || completionInWorld);
  elements.keyboardPanel.classList.toggle("completed", isPractice(activity) && state.complete);
  elements.keyboardPanel.classList.toggle("completion-in-world", completionInWorld);
  elements.keyboardPanel.classList.toggle("keyboard-hidden-by-user", isPractice(activity) && !state.complete && state.keyboardVisibility === "hidden");
  elements.phone.classList.toggle("keyboard-visible", isPractice(activity) && state.keyboardVisibility === "visible");
  elements.phone.classList.toggle("keyboard-hidden", isPractice(activity) && state.keyboardVisibility === "hidden");
  elements.keyboard.classList.toggle("hidden", !isPractice(activity));
  elements.keyboard.toggleAttribute("inert", isPractice(activity) && state.complete);
  if (isPractice(activity) && state.complete) elements.keyboard.setAttribute("aria-hidden", "true");
  else elements.keyboard.removeAttribute("aria-hidden");
  if (isDemo(activity)) {
    const done = state.playbackStep >= scriptKeys(activity).length;
    const playing = Boolean(state.playbackTimer);
    const playLabel = playing ? "Pause" : done ? "Reset" : "Play";
    const action = done ? "reset" : "play-toggle";
    const demoControls = $("#demoControls", elements.worldGrid);
    if (demoControls) demoControls.innerHTML = `
      <button data-action="back" type="button" ${state.playbackStep === 0 || playing ? "disabled" : ""}>← Back</button>
      <button data-action="${action}" type="button">${playLabel}</button>
      <button data-action="step" type="button" ${done || playing ? "disabled" : ""}>Step</button>
      <button class="primary-action" data-action="next" type="button">Next →</button>`;
    elements.activityControls.innerHTML = "";
    return;
  }
  if (isPractice(activity) && state.complete) {
    elements.activityControls.innerHTML = completionInWorld ? "" : completionPanelMarkup(activity);
    return;
  }
  if (isPractice(activity) && state.recallFeedback === "reveal" && activity.remediationRef) {
    elements.activityControls.innerHTML = `<button class="review-idea-action" type="button" data-remediation="${escapeHtml(activity.remediationRef)}">Review this idea</button>`;
    return;
  }
  elements.activityControls.innerHTML = "";
}

export function renderAll() {
  renderHeader();
  renderActivityIntro();
  renderWorld();
  renderMode();
  renderHints();
  renderModifiers();
  renderCommand();
  renderActivityControls();
  renderKeyboardOptions();
  renderVimEffectOptions();
  renderDecorativeMediaOptions();
  preloadSuccessMedia();
}

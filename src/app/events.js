/* Listeners for controls no single feature owns: the board, the controls under
 * it, the landscape rail, and every dialog's close affordances.
 */

import { $, $$ } from "./dom.js";
import { activities, elements } from "./context.js";
import { isExplore } from "./activity.js";
import {
  goToActivity,
  goToActivityId,
  goToRemediation,
  handleActivityAction,
  leaveCurrentSurface,
  navigateToUnit,
  resetActivity,
} from "./navigation.js";
import { processChoice, setHelp } from "../lesson/practice.js";
import { vimEngine } from "../editor/mount.js";
import { dismissExOutput } from "../editor/readouts.js";
import { openTableOfContents } from "../dialogs/contents.js";
import { openSettings } from "../dialogs/settings.js";
import { openPracticeFiles } from "../surfaces/free-practice.js";
import { feedback } from "./feedback.js";

// Demo controls advance the editor through a transient CodeMirror prompt.
// Keep touch/pointer activation from moving focus to the button: the adapter
// closes its prompt on blur, even though the next authored key belongs there.
elements.worldGrid.addEventListener("pointerdown", event => {
  if (event.target.closest(".demo-controls button")) event.preventDefault();
});

elements.worldGrid.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "help") setHelp(!elements.helpCard.classList.contains("open"));
  if (action === "show-demo") {
    const index = activities.findIndex(activity => activity.id === event.target.closest("[data-demo]").dataset.demo);
    if (index >= 0) goToActivity(index);
  }
  if (!["help", "show-demo"].includes(action)) handleActivityAction(action);
  const choice = event.target.closest("[data-choice]")?.dataset.choice;
  if (choice) processChoice(choice);
  const remediation = event.target.closest("[data-remediation]")?.dataset.remediation;
  if (remediation) goToRemediation(remediation);
  const route = event.target.closest("[data-route]")?.dataset.route;
  if (route) goToActivityId(route);
  const unitId = event.target.closest("button[data-unit-id]")?.dataset.unitId;
  if (unitId) navigateToUnit(unitId);
});
elements.completionHost.addEventListener("click", event => {
  handleActivityAction(event.target.closest("[data-action]")?.dataset.action);
});
const editorPointerEvents = ["pointerdown", "mousedown", "dblclick", "selectstart", "contextmenu"];
editorPointerEvents.forEach(type => elements.worldGrid.addEventListener(type, event => {
  if (!event.target.closest?.(".cm-content, .cm-gutters")) return;
  event.preventDefault();
  event.stopPropagation();
}, true));
elements.helpClose.addEventListener("click", () => setHelp(false));
// A tap is the touch equivalent of the any-key dismissal.
elements.exOutput.addEventListener("click", () => {
  dismissExOutput();
  vimEngine?.focus();
});
elements.resetButton.addEventListener("click", () => resetActivity());
elements.hintButton?.addEventListener("click", () => setHelp(!elements.helpCard.classList.contains("open")));

elements.practiceLeaveButton?.addEventListener("click", () => leaveCurrentSurface());

$(".landscape-controls")?.addEventListener("click", event => {
  const action = event.target.closest("[data-layout-action]")?.dataset.layoutAction;
  if (action === "practice-leave") leaveCurrentSurface();
  if (action === "practice-files") void openPracticeFiles();
  if (action === "practice-feedback") void feedback?.open();
  if (action === "toc") openTableOfContents();
  if (action === "reset") resetActivity();
  if (action === "settings") openSettings();
});
$$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => {
  $("#" + button.dataset.closeDialog)?.close();
}));
// The feedback sheet is excluded: it is the only dialog holding text someone
// has typed, and a stray tap outside it must not discard a half-written report.
$$('.app-dialog:not(.feedback-dialog)').forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));
elements.activityControls.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  handleActivityAction(action);
  const remediation = event.target.closest("[data-remediation]")?.dataset.remediation;
  if (remediation) goToRemediation(remediation);
  const route = event.target.closest("[data-route]")?.dataset.route;
  if (route) goToActivityId(route);
});
elements.exploreButton?.addEventListener("click", () => {
  handleActivityAction(isExplore() ? "exit-explore" : "explore");
});

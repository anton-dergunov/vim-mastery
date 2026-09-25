/* Connects the feedback sheet to the app: the context a report records, and
 * which sheet it was filed from.
 */

import { createFeedbackSurface } from "../feedback/ui.js";
import { appVersion } from "./version.js";
import { $$ } from "./dom.js";
import { elements, state, unit } from "./context.js";
import { currentActivity } from "./activity.js";
import { vimEngine } from "../editor/mount.js";
import { storyTransitions } from "../dialogs/story.js";
import {
  activityHref,
  referenceCard,
  referenceDecks,
  referenceSession,
} from "../dialogs/reference.js";
import { masteryLabel } from "../surfaces/mastery.js";

export let feedback = null;

/* Feedback is wired after the testing interface exists, so the report reads the
 * same snapshot the browser suite asserts against rather than a second, subtly
 * different one. */
feedback = createFeedbackSurface({
  elements,
  getContext: () => ({
    state: window.VimWilds.getState(),
    effects: state.semanticEffects,
    appVersion,
    href: window.location.href,
    // The URL never changes as activities advance, so a bare href would point
    // at wherever the session started. This names the activity being reported.
    deepLink: new URL(activityHref(unit.id, currentActivity().sourceActivityId || currentActivity().id), window.location.href).href,
    commandLine: vimEngine?.commandLine ?? null,
    rejectedKeys: [...state.rejectedKeys],
    attempt: {
      hintLevel: state.hintLevel,
      consecutiveMistakes: state.consecutiveMistakes,
      recallFeedback: state.recallFeedback,
    },
  }),
  // A dialog button that keeps focus silently kills physical input, so the
  // editor has to be given it back on every close — but only when the sheet was
  // the last thing open. Stacked over another dialog, the editor is inert
  // beneath a modal, and reaching for it would strand focus instead of letting
  // the browser return it to the control that opened the sheet.
  onClose: () => {
    if (document.querySelector("dialog[open]")) return;
    vimEngine?.focus();
  },
});

/* Names the sheet a report was filed from, so the reviewer can tell a complaint
 * about a reference card from one about the lesson behind it. Every detail here
 * is read from state that already exists — none of it is recorded for feedback.
 */
function feedbackOrigin(kind) {
  switch (kind) {
    case "contents":
      return { id: "contents", label: "Contents", detail: null, node: elements.tocDialog };
    case "mastery":
      return { id: "mastery", label: "Mastery", detail: masteryLabel() || null, node: elements.masteryDialog };
    case "practice-files":
      return { id: "practice-files", label: "File list", detail: null, node: elements.practiceFilesDialog };
    case "story": {
      const active = storyTransitions.getState().active;
      const detail = active && [
        active.kind,
        active.unitId,
        active.panelIndex === undefined ? null : `panel ${active.panelIndex + 1}`,
      ].filter(Boolean).join(" · ");
      return { id: "story", label: "Story", detail: detail || null, node: elements.storyDialog };
    }
    case "reference": {
      const deck = referenceDecks.get(referenceSession.deckId);
      const detail = [
        referenceSession.deckId,
        referenceCard()?.id,
        deck && `card ${referenceSession.cardIndex + 1} of ${deck.cards.length}`,
      ].filter(Boolean).join(" · ");
      return { id: "reference", label: "Reference", detail: detail || null, node: elements.referenceDialog };
    }
    default:
      return null;
  }
}

// Delegated the same way [data-close-dialog] is, because these controls are
// static markup and the map above is built once at module load.
$$("[data-feedback-open]").forEach(button => button.addEventListener("click", () => {
  void feedback?.open(feedbackOrigin(button.dataset.feedbackOpen));
}));

elements.feedbackButton?.addEventListener("click", () => void feedback?.open());
// No origin: this reports the free practice board, which the ordinary context
// already describes, and the board is what the picture should show.
elements.practiceFeedbackButton?.addEventListener("click", () => void feedback?.open());
elements.feedbackSettingsButton?.addEventListener("click", () => {
  // Settings is the one sheet that reports the lesson behind it rather than
  // itself, so it closes first and the capture happens against the board.
  elements.settingsDialog.close();
  void feedback?.open();
});

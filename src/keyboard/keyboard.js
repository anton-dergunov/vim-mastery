/* Input: the on-screen keyboard, its latched modifiers, and physical keys.
 *
 * The capture-phase keydown handler below swallows every key unless a dialog is
 * named in its bail-out list, so a new dialog with a text field must be added
 * there.
 */

import { canonicalKeyToken } from "../editor/vim-engine.js";
import { $, $$, vibrate } from "../app/dom.js";
import { elements, state } from "../app/context.js";
import { isPractice } from "../app/activity.js";
import { nextActivity } from "../app/navigation.js";
import { flashError, processToken } from "../lesson/practice.js";
import { vimEngine } from "../editor/mount.js";

export function renderModifiers() {
  const shiftActive = state.modifiers.has("Shift") || state.physicalShift;
  $$('[data-mod]', elements.keyboard).forEach(button => {
    button.classList.toggle("latched", state.modifiers.has(button.dataset.mod));
    button.setAttribute("aria-pressed", String(state.modifiers.has(button.dataset.mod)));
  });
  const capsButton = $('.key[data-key="CapsLock"]', elements.keyboard);
  capsButton?.classList.toggle("latched", state.capsLock);
  capsButton?.setAttribute("aria-pressed", String(state.capsLock));
  elements.keyboard.classList.toggle("shift-layer", shiftActive);
  elements.keyboard.classList.toggle("letter-uppercase", shiftActive !== state.capsLock);
}

function keyButtonsFor(value) {
  return $$(".key", elements.keyboard).filter(button => button.dataset.key === value || button.dataset.shift === value);
}

function modifierButtonsFor(value) {
  return $$('[data-mod]', elements.keyboard).filter(button => button.dataset.mod === value);
}

export function requiredButtons(token) {
  const result = [];
  if (token.startsWith("Ctrl-")) return [...modifierButtonsFor("Ctrl"), ...keyButtonsFor(token.slice(5))];
  const exact = keyButtonsFor(token);
  result.push(...exact);
  if (token.length === 1 && (token !== token.toLowerCase() || exact.some(button => button.dataset.shift === token))) result.push(...modifierButtonsFor("Shift"));
  return result;
}

function flashKey(button) {
  if (!button) return;
  button.classList.add("pressed");
  window.setTimeout(() => button.classList.remove("pressed"), 110);
}

function toggleModifier(modifier) {
  if (!isPractice()) return;
  if (state.modifiers.has(modifier)) state.modifiers.delete(modifier);
  else state.modifiers.add(modifier);
  renderModifiers();
  vibrate(5);
}

function emitFromButton(button) {
  if (button.dataset.mod) return toggleModifier(button.dataset.mod);
  if (button.dataset.key === "CapsLock") {
    if (!isPractice()) return;
    state.capsLock = !state.capsLock;
    renderModifiers();
    return;
  }
  if (!isPractice()) return;
  let value = button.dataset.key;
  const shiftActive = state.modifiers.has("Shift");
  if (/^[a-z]$/.test(value)) value = shiftActive !== state.capsLock ? value.toUpperCase() : value;
  else if (shiftActive) value = button.dataset.shift || value;
  const chordModifiers = ["Ctrl", "Alt", "Shift"].filter(modifier => state.modifiers.has(modifier));
  let token = value;
  if (chordModifiers.some(modifier => modifier !== "Shift")) token = canonicalKeyToken(`${chordModifiers.join("+")}+${value.toLowerCase()}`);
  state.modifiers.clear();
  renderModifiers();
  processToken(token, button);
}

elements.keyboard.addEventListener("pointerdown", event => {
  const button = event.target.closest(".key");
  if (!button) return;
  event.preventDefault();
  flashKey(button);
  emitFromButton(button);
});

document.addEventListener("keydown", event => {
  if (event.vimWildsPrompt) return;
  if (elements.storyDialog?.open) return;
  if (elements.practiceFilesDialog?.open || elements.practiceNoticeDialog?.open) return;
  if (elements.masteryDialog?.open) return;
  // Radios, not text: the escape hatch below covers select and button only, so
  // without these the handler swallows Escape — leaving the sheet undismissable
  // by keyboard — and eats the arrows that move between options. Settings has
  // no autofocus either, so its Escape arrives with the dialog itself as the
  // target and is swallowed even before anything is focused.
  if (elements.entryLevelDialog?.open) return;
  if (elements.settingsDialog?.open) return;
  // The feedback form holds the only free-text fields in the product. Without
  // this bail-out the capture handler below eats every character: swallowed
  // outright in a theory activity, and typed into the Vim buffer in an
  // exercise. The escape hatch further down only covers select and button.
  if (elements.feedbackDialog?.open) return;
  if (isPractice() && state.complete && state.keyboardVisibility === "hidden") {
    event.preventDefault();
    event.stopImmediatePropagation();
    nextActivity();
    return;
  }
  if (event.target.closest?.("select, button:not(.key)")) return;
  const modifierMap = { Control: "Ctrl", Shift: "Shift", Alt: "Alt" };
  if (event.key === "CapsLock") {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (isPractice()) state.capsLock = event.getModifierState("CapsLock");
    renderModifiers();
    return;
  }
  if (modifierMap[event.key]) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.key === "Shift" && isPractice()) state.physicalShift = true;
    renderModifiers();
    return;
  }
  if (event.repeat) return;
  if (!isPractice()) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  event.preventDefault();
  // Physical keys are interpreted through processToken below. Do not also let
  // CodeMirror's native key handlers see the same event; search prompts would
  // otherwise consume Enter twice and advance to an extra match.
  event.stopImmediatePropagation();
  let token = event.key;
  if (!event.ctrlKey && !event.altKey && event.shiftKey && token.length === 1) {
    const physicalKey = keyButtonsFor(token.toLowerCase()).find(button => button.dataset.key === token.toLowerCase());
    if (physicalKey?.dataset.shift) token = physicalKey.dataset.shift;
  }
  if (event.ctrlKey || event.altKey) {
    const modifiers = [event.ctrlKey && "Ctrl", event.altKey && "Alt"].filter(Boolean);
    token = canonicalKeyToken(`${modifiers.join("+")}+${event.key.toLowerCase()}`);
  }
  const matching = token.startsWith("Ctrl-") ? keyButtonsFor(token.slice(5))[0] : keyButtonsFor(token)[0] || keyButtonsFor(event.key)[0] || keyButtonsFor(event.key.toLowerCase())[0];
  if (!matching) {
    flashError(token);
    return;
  }
  flashKey(matching);
  processToken(token);
}, true);

document.addEventListener("keyup", event => {
  if (elements.feedbackDialog?.open) return;
  if (event.key === "Shift") {
    state.physicalShift = false;
    renderModifiers();
  }
  if (event.vimWildsPrompt || !vimEngine?.ownsPrompt()) return;
  // The keydown was already interpreted here and never reached the adapter's
  // prompt input. Its keyup still would, and the adapter re-parses the prompt
  // on every keyup: for a `:s` command that reparse rewrites the last-search
  // register from the half-typed command, wiping the pattern `Ctrl-r/` is
  // about to insert. Touch input never produces these events, so this only
  // ever broke the physical keyboard.
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

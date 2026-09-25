/* Owns the editor instance for the activity on screen.
 */

import { resetVimEngineState, VimEngine } from "./vim-engine.js";
import { $ } from "../app/dom.js";
import { elements, state } from "../app/context.js";
import { currentActivity, initialStateFor, isPractice } from "../app/activity.js";
import { handleEngineEvent, handleSemanticEffect } from "../lesson/practice.js";
import { renderBufferPosition, renderExOutput } from "./readouts.js";

export let vimEngine = null;

export function unmountEditor() {
  vimEngine?.destroy();
  vimEngine = null;
  resetVimEngineState();
}

export function mountEditor() {
  vimEngine?.destroy();
  resetVimEngineState();
  const activity = currentActivity();
  const initial = initialStateFor(activity);
  const startCursor = initial.setup?.cursor || initial.cursor;
  vimEngine = new VimEngine({
    parent: $("#editorMount", elements.worldGrid),
    text: initial.lines.join("\n"),
    cursor: startCursor,
    language: activity.languageId,
    fileName: activity.fileName,
    wrapColumns: activity.editor?.wrapColumns,
    textWidth: activity.editor?.textWidth,
    viewportRows: activity.editor?.viewportRows,
    visualizeWhitespace: activity.editor?.visualizeWhitespace,
    onEvent: handleEngineEvent,
    onEffect: handleSemanticEffect,
    effectsEnabled: () => state.vimEffects === "enabled",
  });
  for (const step of initial.setup?.steps || []) {
    const key = typeof step === "string" ? step : step.key;
    vimEngine.sendKey(key, { bypassLock: true, source: "setup" });
  }
  state.editorSnapshot = vimEngine.getSnapshot();
  renderBufferPosition();
  // A fresh editor retires any message screen the previous activity left open,
  // the same way a reset retires the impact readout.
  renderExOutput();
  const setupMatches = state.editorSnapshot.text === initial.lines.join("\n")
    && state.editorSnapshot.mode === initial.mode
    && state.editorSnapshot.cursorPosition[0] === initial.cursor[0]
    && state.editorSnapshot.cursorPosition[1] === initial.cursor[1]
    && (!initial.viewport || (state.editorSnapshot.viewport.topLine === initial.viewport.topLine
      && state.editorSnapshot.viewport.bottomLine === initial.viewport.bottomLine));
  // Authored `initial.viewport` is an assertion, not an instruction: the real
  // scroll comes from replaying `setup.steps`. Recording the drift makes that
  // contract testable instead of console-only.
  state.setupDrift = setupMatches ? null : {
    activityId: activity.id,
    expected: {
      cursor: initial.cursor,
      mode: initial.mode,
      viewport: initial.viewport || null,
    },
    actual: {
      cursor: state.editorSnapshot.cursorPosition,
      mode: state.editorSnapshot.mode,
      viewport: state.editorSnapshot.viewport,
    },
  };
  if (!setupMatches) console.warn(`Initial editor setup drifted for ${activity.id}`, state.editorSnapshot, initial);
  vimEngine.setLocked(!isPractice(activity));
  if (state.complete && activity.inspection?.revealRange) vimEngine.showPreviewRange(activity.inspection.revealRange);
  if (!window.matchMedia("(pointer: coarse)").matches) vimEngine.focus();
}

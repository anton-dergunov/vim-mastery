/* Page runner: the browser half of the route audit. The audit injects this
 * module into the app's own play page, so the engine renders inside the same
 * editor markup and CSS the lesson uses; viewport and wrap motions depend on
 * that layout. It replays key paths and reports the state each one reaches.
 */

import { resetVimEngineState, VimEngine } from "/editor/vim-engine.js";
import { matchesTarget } from "/lesson/target.js";

let host = null;
let exercise = null;
let live = null;

const keyOf = step => (typeof step === "string" ? step : step.key);

// Clone the lesson's own editor stack for the activity on screen and hide the
// original, so audit engines get exactly the geometry the learner sees.
function prepare(config) {
  live?.destroy();
  live = null;
  exercise = config;
  host?.stack.remove();
  const original = document.querySelector(".editor-stack");
  if (!original) throw new Error("no editor stack on the page");
  const stack = original.cloneNode(true);
  stack.querySelector("#editorMount")?.replaceChildren();
  stack.querySelector("#editorMount")?.removeAttribute("id");
  original.style.display = "none";
  original.after(stack);
  host = { stack, body: stack.querySelector(".code-body") };
}

function hiddenState(engine) {
  const vim = engine.cm?.state?.vim;
  const global = engine.cm?.constructor?.Vim?.getVimGlobalState_?.();
  const edit = vim?.lastEditInputState;
  const query = vim?.searchState_?.getQuery?.();
  return JSON.stringify({
    find: global?.lastCharacterSearch
      ? [global.lastCharacterSearch.selectedCharacter, global.lastCharacterSearch.forward, global.lastCharacterSearch.increment]
      : null,
    search: query ? String(query) : null,
    edit: edit
      ? [edit.operator, edit.motion, edit.repeatOverride, edit.registerName, JSON.stringify(edit.motionArgs || null), JSON.stringify(edit.operatorArgs || null)]
      : null,
    insert: global?.macroModeState?.lastInsertModeChanges?.changes?.join?.("") ?? null,
  });
}

function createEngine() {
  const initial = exercise.scenario.initial;
  const engine = new VimEngine({
    parent: host.body,
    text: initial.lines.join("\n"),
    cursor: initial.setup?.cursor || initial.cursor,
    language: exercise.languageId,
    fileName: exercise.fileName,
    wrapColumns: exercise.editor?.wrapColumns,
    textWidth: exercise.editor?.textWidth,
    viewportRows: exercise.editor?.viewportRows,
    visualizeWhitespace: exercise.editor?.visualizeWhitespace,
    onEvent() {},
    effectsEnabled: () => false,
  });
  // A learner's first key arrives long after the editor has been laid out.
  // Measure now, or half-page scrolls and window motions (`Ctrl-d`, `M`) read
  // an editor that has no height yet.
  engine.view.measure();
  return engine;
}

function offsetOf(lines, [row, column]) {
  return lines.slice(0, row).reduce((total, line) => total + line.length + 1, 0) + column;
}

// Creating an editor costs most of a replay, so the search reuses one and
// puts it back to the exercise's start: leave whatever mode or prompt the last
// path ended in, drop the adapter's global and per-editor state, clear the
// bridge's own command-line state, re-apply the editor's options, and restore
// the text, cursor, and scroll.
// `checkReset` compares this against a fresh editor.
function resetEngine(engine) {
  const initial = exercise.scenario.initial;
  engine.abortCommandLine?.();
  engine.sendKey("Escape", { bypassLock: true, source: "fixture" });
  engine.sendKey("Escape", { bypassLock: true, source: "fixture" });
  resetVimEngineState();
  engine.cm.state.vim = null;
  // A key rebuilds the per-editor state the next line needs.
  engine.sendKey("Escape", { bypassLock: true, source: "fixture" });
  // `nopcre` lives in the per-editor state just dropped. Without it the
  // adapter parses searches as JavaScript regex, and `*` on punctuation finds
  // matches a fresh editor (and so the lesson) does not.
  engine.executeEx("set nopcre");
  if (exercise.editor?.textWidth !== undefined) engine.cm.setOption("textwidth", exercise.editor.textWidth);
  Object.assign(engine, {
    mode: "normal",
    subMode: "",
    commandLine: null,
    commandPrefix: null,
    lastExCommand: null,
    lastSubstitution: null,
    lastSearchQuery: null,
    lastImpact: null,
    lastExOutput: null,
    matchPattern: null,
    awaitingColonRegister: false,
    awaitingCommandLineRegister: false,
  });
  engine.rememberExCommand(null);
  const text = initial.lines.join("\n");
  const cursor = offsetOf(initial.lines, initial.setup?.cursor || initial.cursor);
  engine.view.dispatch({ changes: { from: 0, to: engine.view.state.doc.length, insert: text }, selection: { anchor: cursor } });
  engine.view.scrollDOM.scrollTop = 0;
  engine.cm.refresh?.();
  // The visible range is stale until measured, and `H`, `M`, `L`, and
  // `Ctrl-e` read it.
  engine.view.measure();
}

function withEngine(keys, visit, { fresh = false } = {}) {
  const initial = exercise.scenario.initial;
  // A named file seats the `"%` register in the constructor, and a fixed
  // viewport or wrap width keeps scroll measurements a reset does not clear,
  // so those exercises always get a fresh editor.
  const reuse = !fresh && !exercise.fileName && !exercise.editor?.viewportRows && !exercise.editor?.wrapColumns;
  let engine;
  // A fresh editor must be the only one in the host, or it lands below the
  // reused one and window motions (`H`, `M`, `L`) measure a clipped window.
  const hidden = !reuse && live ? live.view.dom : null;
  if (hidden) hidden.style.display = "none";
  if (reuse && live) {
    engine = live;
    resetEngine(engine);
  } else {
    resetVimEngineState();
    engine = createEngine();
  }
  try {
    for (const step of initial.setup?.steps || []) engine.sendKey(keyOf(step), { bypassLock: true, source: "setup" });
    return visit(engine, keys);
  } finally {
    if (reuse) live = engine;
    else engine.destroy();
    if (hidden) hidden.style.display = "";
  }
}

function initialText() {
  return exercise.scenario.initial.lines.join("\n");
}

function summarize(engine, error) {
  const snapshot = engine.getSnapshot();
  const pending = Boolean(engine.cm?.state?.vim?.inputState?.operator || engine.cm?.state?.vim?.inputState?.keyBuffer?.length);
  return {
    text: snapshot.text,
    cursor: snapshot.cursorPosition,
    mode: snapshot.mode,
    pending,
    registers: snapshot.registers,
    viewport: { topLine: snapshot.viewport.topLine, bottomLine: snapshot.viewport.bottomLine },
    hidden: hiddenState(engine),
    match: !error && matchesTarget(snapshot, exercise.scenario.target),
    error,
  };
}

window.RouteAudit = {
  prepare,

  // Replay each path from the start state and report where it lands.
  evaluate(paths, options = {}) {
    return paths.map(keys => withEngine(keys, engine => {
      let error = null;
      try {
        for (const key of keys) engine.sendKey(key, { bypassLock: true, source: "fixture" });
      } catch (thrown) {
        error = String(thrown);
      }
      return summarize(engine, error);
    }, options));
  },

  // Paths whose reused-editor replay differs from a fresh editor's.
  checkReset(paths) {
    const reused = window.RouteAudit.evaluate(paths);
    const fresh = window.RouteAudit.evaluate(paths, { fresh: true });
    return paths.filter((_, index) => JSON.stringify(reused[index]) !== JSON.stringify(fresh[index]))
      .map(keys => ({ keys, reused: reused[paths.indexOf(keys)], fresh: fresh[paths.indexOf(keys)] }));
  },

  // Replay a script and record the mode before every key, which is how the
  // grammar tells a command key from typed text.
  trace(keys) {
    return withEngine(keys, engine => {
      const trace = [];
      let error = null;
      try {
        for (const key of keys) {
          const entry = { key, mode: engine.getSnapshot().mode };
          engine.sendKey(key, { bypassLock: true, source: "fixture" });
          entry.text = engine.getSnapshot().text;
          trace.push(entry);
        }
      } catch (thrown) {
        error = String(thrown);
      }
      return { trace, error, start: initialText(), final: summarize(engine, error) };
    }, { fresh: true });
  },
};

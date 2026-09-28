/* Page runner: the browser half of the route audit. The audit injects this
 * module into the app's own play page, so the engine renders inside the same
 * editor markup and CSS the lesson uses; viewport and wrap motions depend on
 * that layout. It replays key paths and reports the state each one reaches.
 */

import { resetVimEngineState, VimEngine } from "/editor/vim-engine.js";
import { matchesTarget } from "/lesson/target.js";

// The adapter's global state (the last character find, the last insert, the
// register map) is reached through its `Vim` object, and the undo history
// through CodeMirror's history field; the engine exports neither. Import them
// by the exact URLs the engine uses, so these are the same module instances
// and not second copies with state of their own.
const engineSource = await (await fetch("/editor/vim-engine.js")).text();
const importAsEngine = name => import(engineSource.match(new RegExp(`from\\s+"([^"]*(?:${name})[^"]*)"`))[1]);
const { Vim } = await importAsEngine("codemirror-vim");
const { historyField } = await importAsEngine("codemirror_commands|@codemirror/commands");
const { Transaction } = await importAsEngine("codemirror_state|@codemirror/state");
const { EditorView } = await importAsEngine("codemirror_view|@codemirror/view");

let host = null;
let exercise = null;
let live = null;
let reuseEditors = true;

const keyOf = step => (typeof step === "string" ? step : step.key);

// Clone the lesson's own editor stack for the activity on screen and hide the
// original, so audit engines get exactly the geometry the learner sees.
function prepare(config, { reuse = true } = {}) {
  live?.destroy();
  live = null;
  exercise = config;
  reuseEditors = reuse;
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

const KEEPS_COLUMN = new Set(["moveByLines", "moveByDisplayLines", "moveByScroll", "moveToColumn", "moveToEol"]);

function hiddenState(engine) {
  const vim = engine.cm?.state?.vim;
  const global = Vim.getVimGlobalState_();
  const edit = vim?.lastEditInputState;
  const query = vim?.searchState_?.getQuery?.();
  return JSON.stringify({
    find: global?.lastCharacterSearch
      ? [global.lastCharacterSearch.selectedCharacter, global.lastCharacterSearch.forward, global.lastCharacterSearch.increment]
      : null,
    search: query ? [String(query), Boolean(vim.searchState_.isReversed?.()), JSON.stringify(vim.searchState_.getOffset?.() ?? null)] : null,
    edit: edit
      ? [edit.operator, edit.motion, edit.repeatOverride, edit.registerName, JSON.stringify(edit.motionArgs || null), JSON.stringify(edit.operatorArgs || null)]
      : null,
    insert: global?.macroModeState?.lastInsertModeChanges?.changes?.join?.("") ?? null,
    // `&` and `@:` repeat what the engine remembers, not the adapter.
    ex: [JSON.stringify(engine.lastSubstitution ?? null), engine.lastExCommand ?? null],
    // The column a run of vertical motions keeps (after `$`, `j` goes to
    // every line's end). The adapter reads it only straight after one of
    // these motions; otherwise the cursor's own column counts. The screen
    // column `gj` keeps is in pixels and moves with layout and horizontal
    // scroll, so it counts only where display lines differ from text lines.
    column: KEEPS_COLUMN.has(vim?.lastMotion?.name)
      ? [vim.lastHPos, exercise.editor?.wrapColumns ? Math.round(vim.lastHSPos) : null]
      : null,
  });
}

function createEngine({ lean = false } = {}) {
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
  if (lean) makeLean(engine);
  return engine;
}

// The adapter focuses the editor when a command line closes, and the editor
// then syncs the DOM selection with every cursor move; even unfocused it reads
// the DOM selection back after each update. That is over half of a replay's
// time, and nothing Vim computes reads the DOM selection, so the search's own
// editor skips it. Fresh editors, which confirm every reported route and the
// reset sample, keep the lesson's behaviour.
//
// The engine also builds two full snapshots per key for its effects and one
// per editor update for its listener. The audit draws no effects and listens
// to nothing, so the search's editor skips those too, and `summarize` takes
// the one snapshot a path needs from the engine's own method.
const quietEffects = { beginKey() {}, recordUpdate() {}, endKey() {}, clear() {}, clearSelection() {}, destroy() {} };
function makeLean(engine) {
  engine.view.focus = () => {};
  engine.view.contentDOM.blur();
  engine.view.docView.updateSelection = () => {};
  engine.effects = quietEffects;
  engine.emit = () => {};
  engine.getSnapshot = () => null;
  // In a fixed viewport the engine measures after every key, which forces a
  // layout. Keys typed into the command line or an insert cannot scroll
  // anything a later key reads before Enter or Escape measures again.
  engine.cm.refresh = () => {
    if (engine.commandLine !== null || engine.cm.state.vim?.insertMode) return;
    engine.view.measure();
  };
}

const snapshotOf = engine => VimEngine.prototype.getSnapshot.call(engine);

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
  // Marks, the jump list, and the change list are bookmarks the editor keeps
  // updating on every change. Dropping the adapter's state orphans them
  // without clearing them, and thousands of replays make each edit slow.
  for (const mark of Object.values(engine.cm.marks)) mark.clear();
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
  // The reset above re-seats `"%` empty; the constructor seats the file name.
  const fileRegister = Vim.getRegisterController().registers["%"];
  if (fileRegister) fileRegister.keyBuffer = [engine.fileName];
  const text = initial.lines.join("\n");
  const cursor = offsetOf(initial.lines, initial.setup?.cursor || initial.cursor);
  // Replace only the part the last path changed, so the editor redraws the
  // few lines that differ rather than the whole buffer.
  const current = engine.view.state.doc.toString();
  let from = 0;
  while (from < current.length && from < text.length && current[from] === text[from]) from += 1;
  let tail = 0;
  while (tail < current.length - from && tail < text.length - from
    && current[current.length - 1 - tail] === text[text.length - 1 - tail]) tail += 1;
  engine.view.dispatch({
    changes: current === text ? [] : { from, to: current.length - tail, insert: text.slice(from, text.length - tail) },
    selection: { anchor: cursor },
    annotations: Transaction.addToHistory.of(false),
    // Setting `scrollTop` alone is undone by the next measure, which keeps
    // the line the last path scrolled to where it was.
    effects: EditorView.scrollIntoView(0, { y: "start" }),
  });
  // A fresh editor has no undo history. Without this, `u` in one path undoes
  // the changes an earlier path made.
  Object.assign(engine.view.state.field(historyField), { done: [], undone: [], prevTime: 0, prevUserEvent: undefined });
  engine.view.scrollDOM.scrollTop = 0;
  engine.view.scrollDOM.scrollLeft = 0;
  // The visible range is stale until measured, and `H`, `M`, `L`, and
  // `Ctrl-e` read it.
  engine.view.measure();
}

function withEngine(keys, visit, { fresh = false } = {}) {
  const initial = exercise.scenario.initial;
  const reuse = !fresh && reuseEditors;
  let engine = null;
  // A fresh editor must be the only one in the host, or it lands below the
  // reused one and window motions (`H`, `M`, `L`) measure a clipped window.
  const hidden = !reuse && live ? live.view.dom : null;
  if (hidden) hidden.style.display = "none";
  // A path that threw can leave the adapter half way through a command (a
  // multi-cursor selection, an open operator), which a reset cannot undo, so
  // that editor is replaced rather than reused.
  if (reuse && live && !live.broken) {
    try {
      resetEngine(live);
      engine = live;
    } catch {
      live.broken = true;
    }
  }
  if (!engine) {
    if (reuse && live) {
      live.destroy();
      live = null;
    }
    resetVimEngineState();
    engine = createEngine({ lean: !fresh });
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
  const snapshot = snapshotOf(engine);
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
        engine.broken = true;
      }
      return summarize(engine, error);
    }, options));
  },

  // Paths whose reused-editor replay differs from a fresh editor's. A path
  // that throws in both is discarded by the search either way.
  checkReset(paths) {
    const reused = window.RouteAudit.evaluate(paths);
    const fresh = window.RouteAudit.evaluate(paths, { fresh: true });
    return paths.map((keys, index) => ({ keys, reused: reused[index], fresh: fresh[index] }))
      .filter(({ reused: left, fresh: right }) => !(left.error && right.error) && JSON.stringify(left) !== JSON.stringify(right));
  },

  // Replay a script and record the mode before every key, which is how the
  // grammar tells a command key from typed text.
  trace(keys) {
    return withEngine(keys, engine => {
      const trace = [];
      let error = null;
      try {
        for (const key of keys) {
          const entry = { key, mode: snapshotOf(engine).mode };
          engine.sendKey(key, { bypassLock: true, source: "fixture" });
          entry.text = snapshotOf(engine).text;
          trace.push(entry);
        }
      } catch (thrown) {
        error = String(thrown);
      }
      return { trace, error, start: initialText(), final: summarize(engine, error) };
    }, { fresh: true });
  },
};

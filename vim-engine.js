import { EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, drawSelection, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Vim, getCM, vim } from "@replit/codemirror-vim";

const specialKeys = {
  Escape: "<Esc>",
  Enter: "<CR>",
  Backspace: "<BS>",
  Tab: "<Tab>",
  " ": "<Space>",
  ArrowLeft: "<Left>",
  ArrowRight: "<Right>",
  ArrowUp: "<Up>",
  ArrowDown: "<Down>",
};

const wildsHighlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: "#d6b5ff" },
  { tag: [tags.string, tags.special(tags.string)], color: "#f2cd80" },
  { tag: tags.comment, color: "#668f77" },
  { tag: tags.number, color: "#88d4dd" },
]));

const setPreviewRange = StateEffect.define();
const previewRangeField = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setPreviewRange)) return effect.value;
    }
    return value.map(transaction.changes);
  },
  provide: field => EditorView.decorations.from(field),
});

export function toVimKey(key) {
  if (specialKeys[key]) return specialKeys[key];
  if (/^<[^>]+>$/.test(key)) return key;

  const legacy = key.match(/^(Ctrl|Alt)-(.*)$/);
  const parts = (legacy ? `${legacy[1]}+${legacy[2]}` : key).split("+");
  const value = parts.pop();
  const modifiers = new Set(parts);
  if (!value) return key;

  const prefix = [
    modifiers.has("Ctrl") && "C-",
    modifiers.has("Alt") && "A-",
    modifiers.has("Meta") && "M-",
    modifiers.has("Shift") && "S-",
  ].filter(Boolean).join("");
  return prefix ? `<${prefix}${specialKeys[value] ? specialKeys[value].slice(1, -1) : value}>` : value;
}

export function canonicalKeyToken(key) {
  const vimKey = toVimKey(key);
  const chord = vimKey.match(/^<((?:C-)?(?:A-)?(?:M-)?(?:S-)?)(.+)>$/);
  if (!chord) return vimKey;
  const modifiers = [
    chord[1].includes("C-") && "Ctrl",
    chord[1].includes("A-") && "Alt",
    chord[1].includes("M-") && "Meta",
    chord[1].includes("S-") && "Shift",
  ].filter(Boolean);
  const value = Object.entries(specialKeys).find(([, token]) => token === `<${chord[2]}>`)?.[0] || chord[2];
  if (!modifiers.length && value !== chord[2]) return value;
  if (modifiers.length === 1 && (modifiers[0] === "Ctrl" || modifiers[0] === "Alt")) {
    return `${modifiers[0]}-${value}`;
  }
  return modifiers.length ? `${modifiers.join("+")}+${value}` : vimKey;
}

function literalText(key) {
  if (key.length === 1) return key;
  if (key === "<Space>") return " ";
  if (key === "<CR>") return "\n";
  return null;
}

function offsetForPosition(text, [row, column]) {
  const lines = text.split("\n");
  return lines.slice(0, row).reduce((offset, line) => offset + line.length + 1, 0) + column;
}

function positionForOffset(doc, offset) {
  const line = doc.lineAt(offset);
  return [line.number - 1, offset - line.from];
}

function normalizeMode(mode, subMode, cm, commandLineOpen) {
  if (commandLineOpen) return "command-line";
  if (mode === "visual") {
    if (subMode === "linewise") return "visual-line";
    if (subMode === "blockwise" || /block/.test(cm?.state?.vim?.mode || "")) return "visual-block";
    return "visual";
  }
  if (mode === "insert" || mode === "replace") return mode;
  if (cm?.state?.vim?.inputState?.operator) return "operator-pending";
  return "normal";
}

/**
 * The one boundary between the lesson UI and CodeMirror Vim. Nothing outside
 * this module reaches into EditorView, getCM, or Vim directly.
 */
export class VimEngine {
  constructor({ parent, text, cursor, language = "plain-text", onEvent }) {
    this.onEvent = onEvent;
    this.mode = "normal";
    this.subMode = "";
    this.locked = false;
    this.commandLine = null;
    this.commandPrefix = null;
    this.lastExCommand = null;
    this.lastSubstitution = null;
    this.lastSearchQuery = null;
    this.awaitingColonRegister = false;

    const start = offsetForPosition(text, cursor);
    this.view = new EditorView({
      state: EditorState.create({
        doc: text,
        selection: EditorSelection.cursor(start),
        extensions: [
          EditorState.allowMultipleSelections.of(true),
          vim(),
          drawSelection(),
          lineNumbers(),
          previewRangeField,
          ...(language === "javascript" || language === "typescript" ? [javascript()] : []),
          wildsHighlighting,
          EditorView.updateListener.of(update => {
            if (update.docChanged) this.emit("change");
            else if (update.selectionSet) this.emit("selection");
          }),
        ],
      }),
      parent,
    });

    this.view.contentDOM.setAttribute("inputmode", "none");
    this.cm = getCM(this.view);
    this.onModeChange = event => {
      this.mode = event.mode || "normal";
      this.subMode = event.subMode || "";
      this.emit("mode");
    };
    this.onVimKey = key => this.emit("key", { key: canonicalKeyToken(key), source: "physical" });
    this.onCommandDone = () => this.emit("command-complete");
    this.cm?.on("vim-mode-change", this.onModeChange);
    this.cm?.on("vim-keypress", this.onVimKey);
    this.cm?.on("vim-command-done", this.onCommandDone);
  }

  getSnapshot() {
    const selection = this.view.state.selection.main;
    const { doc } = this.view.state;
    return {
      text: doc.toString(),
      cursor: selection.head,
      anchor: selection.anchor,
      head: selection.head,
      cursorPosition: positionForOffset(doc, selection.head),
      anchorPosition: positionForOffset(doc, selection.anchor),
      ranges: this.view.state.selection.ranges.map(range => ({
        anchor: positionForOffset(doc, range.anchor),
        head: positionForOffset(doc, range.head),
        from: positionForOffset(doc, range.from),
        to: positionForOffset(doc, range.to),
      })),
      mode: normalizeMode(this.mode, this.subMode, this.cm, this.commandLine !== null),
    };
  }

  sendKey(key, { bypassLock = false, source = "touch" } = {}) {
    if ((this.locked && !bypassLock) || !this.cm) return false;
    const vimKey = toVimKey(key);
    const canonicalKey = canonicalKeyToken(vimKey);

    if (this.commandLine !== null) {
      if (vimKey === "<Esc>") {
        this.closeCommandLine();
      } else if (vimKey === "<BS>") {
        this.commandLine = this.commandLine.slice(0, -1);
      } else if (vimKey === "<CR>") {
        if (this.commandPrefix === ":") {
          this.lastExCommand = this.commandLine;
          if (this.commandLine === "~" && this.lastSubstitution && this.lastSearchQuery !== null) {
            this.executeEx(`s/${this.lastSearchQuery}/${this.lastSubstitution.replacement}/`);
          } else {
            this.rememberSubstitution(this.commandLine);
            this.executeEx(this.commandLine);
          }
          this.closeCommandLine();
        } else {
          const input = this.cm?.state?.dialog?.querySelector("input");
          if (input) {
            input.value = this.commandLine;
            const enterEvent = new KeyboardEvent("keydown", {
              key: "Enter", code: "Enter", bubbles: true, cancelable: true,
            });
            // The Vim bridge checks the legacy keyCode value for dialogs.
            Object.defineProperty(enterEvent, "keyCode", { value: 13 });
            Object.defineProperty(enterEvent, "vimWildsPrompt", { value: true });
            input.dispatchEvent(enterEvent);
          }
          this.lastSearchQuery = this.commandLine;
          this.commandLine = null;
          this.commandPrefix = null;
        }
      } else {
        const text = literalText(vimKey);
        if (text !== null) this.commandLine += text;
      }
      this.syncCommandInput();
      this.emit("key", { key: canonicalKey, source });
      return true;
    }

    // The CodeMirror Vim adapter does not implement Vim's colon register.
    // Keep the authored `@` and `:` tokens visible to the lesson while
    // executing the same saved Ex line in the current line context.
    if (this.awaitingColonRegister) {
      this.awaitingColonRegister = false;
      if (vimKey === ":" && this.lastExCommand !== null) {
        Vim.handleEx(this.cm, this.lastExCommand);
        this.moveCursorToLineStart();
        this.emit("key", { key: canonicalKey, source });
        return true;
      }
    }
    if (vimKey === "@") {
      this.awaitingColonRegister = true;
      this.emit("key", { key: canonicalKey, source });
      return true;
    }
    if (vimKey === "&" && this.lastSubstitution) {
      // `&` repeats the substitution pattern and replacement but intentionally
      // does not inherit flags such as `g`.
      this.executeEx(`s/${this.lastSubstitution.pattern}/${this.lastSubstitution.replacement}/`);
      this.emit("key", { key: canonicalKey, source });
      return true;
    }

    const wasInsert = Boolean(this.cm.state.vim?.insertMode);
    const handled = Vim.multiSelectHandleKey(this.cm, vimKey, source);
    // `handleKey` owns Vim interpretation. In Insert mode, a browser would
    // normally perform the subsequent contenteditable insertion; touch input
    // deliberately skips that browser path, so we apply only that native text
    // insertion through CodeMirror's transaction API.
    if (!handled && wasInsert && this.cm.state.vim?.insertMode) {
      const text = literalText(vimKey);
      if (text !== null) this.cm.replaceSelection(text);
    }
    if ((vimKey === ":" || vimKey === "/" || vimKey === "?") && this.cm.state.dialog) {
      this.commandLine = "";
      this.commandPrefix = vimKey;
    }
    this.emit("key", { key: canonicalKey, source });
    return Boolean(handled);
  }

  syncCommandInput() {
    const input = this.cm?.state?.dialog?.querySelector("input");
    if (input) input.value = this.commandLine || "";
  }

  moveCursorToLineStart() {
    const line = this.view.state.doc.lineAt(this.view.state.selection.main.head);
    this.view.dispatch({ selection: EditorSelection.cursor(line.from) });
  }

  showPreviewRange(range) {
    const from = offsetForPosition(this.view.state.doc.toString(), range.from);
    const to = offsetForPosition(this.view.state.doc.toString(), range.to);
    const decoration = from < to
      ? Decoration.set([Decoration.mark({ class: "cm-preview-range" }).range(from, to)])
      : Decoration.none;
    this.view.dispatch({ effects: setPreviewRange.of(decoration) });
  }

  executeEx(command) {
    Vim.handleEx(this.cm, command);
    this.moveCursorToLineStart();
  }

  rememberSubstitution(command) {
    if (!command.startsWith("s") || command.length < 4) return;
    const delimiter = command[1];
    const parts = command.slice(2).split(delimiter);
    if (parts.length < 3) return;
    const [pattern, replacement, flags] = parts;
    this.lastSubstitution = { pattern, replacement, flags };
  }

  closeCommandLine() {
    const input = this.cm?.state?.dialog?.querySelector("input");
    this.commandLine = null;
    this.commandPrefix = null;
    input?.blur();
  }

  emit(kind, extra = {}) {
    this.onEvent?.({ kind, ...extra, snapshot: this.getSnapshot() });
  }

  setLocked(locked) {
    this.locked = locked;
    this.view.contentDOM.setAttribute("contenteditable", String(!locked));
    this.view.dom.classList.toggle("is-locked", locked);
  }

  focus() {
    if (!this.locked) this.view.focus();
  }

  destroy() {
    this.cm?.off("vim-mode-change", this.onModeChange);
    this.cm?.off("vim-keypress", this.onVimKey);
    this.cm?.off("vim-command-done", this.onCommandDone);
    this.view.destroy();
  }
}

export function resetVimEngineState() {
  // This package exposes global registers and macro state through this reset
  // hook. Keeping it here prevents that implementation detail leaking into UI.
  Vim.resetVimGlobalState_?.();
}

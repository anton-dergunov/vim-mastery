import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, lineNumbers } from "@codemirror/view";
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

function toVimKey(key) {
  if (specialKeys[key]) return specialKeys[key];
  if (key.startsWith("Ctrl-")) return `<C-${key.slice(5)}>`;
  if (key.startsWith("Alt-")) return `<A-${key.slice(4)}>`;
  return key;
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
  return "normal";
}

/**
 * The one boundary between the lesson UI and CodeMirror Vim. Nothing outside
 * this module reaches into EditorView, getCM, or Vim directly.
 */
export class VimEngine {
  constructor({ parent, text, cursor, onEvent }) {
    this.onEvent = onEvent;
    this.mode = "normal";
    this.subMode = "";
    this.locked = false;
    this.commandLine = null;

    const start = offsetForPosition(text, cursor);
    this.view = new EditorView({
      state: EditorState.create({
        doc: text,
        selection: EditorSelection.cursor(start),
        extensions: [
          vim(),
          drawSelection(),
          lineNumbers(),
          javascript(),
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
    this.onVimKey = key => this.emit("key", { key });
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
      mode: normalizeMode(this.mode, this.subMode, this.cm, this.commandLine !== null),
    };
  }

  sendKey(key) {
    if (this.locked || !this.cm) return false;
    const vimKey = toVimKey(key);

    if (this.commandLine !== null) {
      if (vimKey === "<Esc>") {
        this.closeCommandLine();
      } else if (vimKey === "<BS>") {
        this.commandLine = this.commandLine.slice(0, -1);
      } else if (vimKey === "<CR>") {
        Vim.handleEx(this.cm, this.commandLine);
        this.closeCommandLine();
      } else {
        const text = literalText(vimKey);
        if (text !== null) this.commandLine += text;
      }
      this.syncCommandInput();
      this.emit("key", { key });
      return true;
    }

    const wasInsert = Boolean(this.cm.state.vim?.insertMode);
    const handled = Vim.multiSelectHandleKey(this.cm, vimKey, "touch");
    // `handleKey` owns Vim interpretation. In Insert mode, a browser would
    // normally perform the subsequent contenteditable insertion; touch input
    // deliberately skips that browser path, so we apply only that native text
    // insertion through CodeMirror's transaction API.
    if (!handled && wasInsert && this.cm.state.vim?.insertMode) {
      const text = literalText(vimKey);
      if (text !== null) this.cm.replaceSelection(text);
    }
    if (vimKey === ":" && this.cm.state.dialog) this.commandLine = "";
    this.emit("key", { key });
    return Boolean(handled);
  }

  syncCommandInput() {
    const input = this.cm?.state?.dialog?.querySelector("input");
    if (input) input.value = this.commandLine || "";
  }

  closeCommandLine() {
    const input = this.cm?.state?.dialog?.querySelector("input");
    this.commandLine = null;
    input?.blur();
  }

  emit(kind, extra = {}) {
    this.onEvent?.({ kind, ...extra, snapshot: this.getSnapshot() });
  }

  setLocked(locked) {
    this.locked = locked;
    this.view.contentDOM.setAttribute("contenteditable", String(!locked));
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

import { EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import { history } from "@codemirror/commands";
import { Decoration, EditorView, drawSelection, highlightWhitespace, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
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

function snapshotRegisters() {
  const registers = Vim.getRegisterController?.()?.registers || {};
  return Object.fromEntries(Object.entries(registers).map(([name, register]) => [name, {
    text: register.toString(),
    type: register.blockwise ? "blockwise" : register.linewise ? "linewise" : "characterwise",
  }]));
}

function findUnescapedDelimiter(input, start, delimiter) {
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === delimiter && input[index - 1] !== "\\") return index;
  }
  return -1;
}

function lineForMark(cm, name) {
  const marker = cm?.state?.vim?.marks?.[name];
  const position = marker?.find?.() || marker;
  return Number.isInteger(position?.line) ? position.line : undefined;
}

function searchAddress(lines, pattern, origin, backwards) {
  let expression;
  try {
    expression = new RegExp(pattern);
  } catch {
    return undefined;
  }
  for (let distance = 1; distance <= lines.length; distance += 1) {
    const line = (origin + (backwards ? -distance : distance) + lines.length) % lines.length;
    expression.lastIndex = 0;
    if (expression.test(lines[line])) return line;
  }
  return undefined;
}

function parseAddress(input, start, { cm, lines, currentLine }) {
  let index = start;
  while (input[index] === " ") index += 1;
  let line;
  const number = input.slice(index).match(/^\d+/)?.[0];
  if (number) {
    line = Number(number) - 1;
    index += number.length;
  } else if (input[index] === ".") {
    line = currentLine;
    index += 1;
  } else if (input[index] === "$") {
    line = lines.length - 1;
    index += 1;
  } else if (input[index] === "'") {
    const name = input[index + 1];
    line = lineForMark(cm, name);
    if (line === undefined) return null;
    index += 2;
  } else if (input[index] === "/" || input[index] === "?") {
    const delimiter = input[index];
    const end = findUnescapedDelimiter(input, index + 1, delimiter);
    if (end < 0) return null;
    const pattern = input.slice(index + 1, end);
    line = searchAddress(lines, pattern, currentLine, delimiter === "?");
    if (line === undefined) return null;
    index = end + 1;
  } else if (input[index] === "+" || input[index] === "-") {
    line = currentLine;
  } else {
    return null;
  }

  while (input[index] === "+" || input[index] === "-") {
    const direction = input[index] === "+" ? 1 : -1;
    index += 1;
    const offset = input.slice(index).match(/^\d+/)?.[0];
    line += direction * (offset ? Number(offset) : 1);
    index += offset?.length || 0;
  }
  return { line, index };
}

function parseLineOperation(cm, input) {
  const lines = cm.getValue().split("\n");
  const originalCurrent = cm.getCursor().line;
  let index = 0;
  let start = originalCurrent;
  let end = originalCurrent;
  let explicitRange = false;

  if (input[index] === "%") {
    start = 0;
    end = lines.length - 1;
    index += 1;
    explicitRange = true;
  } else {
    const first = parseAddress(input, index, { cm, lines, currentLine: originalCurrent });
    if (first) {
      start = first.line;
      end = first.line;
      index = first.index;
      explicitRange = true;
      if (input[index] === "," || input[index] === ";") {
        const separator = input[index];
        index += 1;
        const second = parseAddress(input, index, {
          cm,
          lines,
          currentLine: separator === ";" ? start : originalCurrent,
        });
        if (!second) return null;
        end = second.line;
        index = second.index;
      }
    }
  }

  const commandText = input.slice(index).trimStart();
  const match = commandText.match(/^(delete|d|yank|y|put|pu|copy|co|t|move|m|join|j|sort)(!?)(.*)$/);
  if (!match) return null;
  const argument = match[3]?.trim() || "";
  const command = match[1];
  if (["delete", "d", "yank", "y", "put", "pu"].includes(command) && argument.length > 1) return null;
  if (["join", "j", "sort"].includes(command) && argument) return null;
  return { lines, start, end, explicitRange, command, bang: match[2] === "!", argument };
}

function offsetForLineStart(lines, line) {
  return lines.slice(0, line).reduce((total, value) => total + value.length + 1, 0);
}

/**
 * The one boundary between the lesson UI and CodeMirror Vim. Nothing outside
 * this module reaches into EditorView, getCM, or Vim directly.
 */
export class VimEngine {
  constructor({ parent, text, cursor, language = "plain-text", wrapColumns, textWidth, viewportRows, visualizeWhitespace = false, onEvent }) {
    if (wrapColumns !== undefined && (!Number.isInteger(wrapColumns) || wrapColumns < 12 || wrapColumns > 80)) {
      throw new RangeError("wrapColumns must be an integer from 12 to 80");
    }
    if (textWidth !== undefined && (!Number.isInteger(textWidth) || textWidth < 20 || textWidth > 80)) {
      throw new RangeError("textWidth must be an integer from 20 to 80");
    }
    if (viewportRows !== undefined && (!Number.isInteger(viewportRows) || viewportRows < 5 || viewportRows > 12)) {
      throw new RangeError("viewportRows must be an integer from 5 to 12");
    }
    if (typeof visualizeWhitespace !== "boolean") throw new TypeError("visualizeWhitespace must be a boolean");
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
    this.viewportRows = viewportRows;

    const start = offsetForPosition(text, cursor);
    this.view = new EditorView({
      state: EditorState.create({
        doc: text,
        selection: EditorSelection.cursor(start),
        extensions: [
          EditorState.allowMultipleSelections.of(true),
          history(),
          indentUnit.of("  "),
          vim(),
          drawSelection(),
          lineNumbers(),
          ...(visualizeWhitespace ? [highlightWhitespace()] : []),
          previewRangeField,
          ...(language === "javascript" || language === "typescript" ? [javascript()] : []),
          ...(language === "html" ? [html()] : []),
          ...(wrapColumns ? [
            EditorView.lineWrapping,
            EditorView.theme({
              ".cm-line": {
                width: `${wrapColumns}ch`,
                maxWidth: `${wrapColumns}ch`,
                boxSizing: "content-box",
                overflowWrap: "anywhere",
              },
            }),
          ] : []),
          ...(viewportRows ? [EditorView.theme({
            ".cm-line, .cm-gutterElement": {
              minHeight: "24px",
              height: "24px",
              lineHeight: "24px",
            },
          })] : []),
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
    this.view.dom.tabIndex = -1;
    this.onNativeInputFocus = event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
      this.disableNativeInput(input);
    };
    this.view.dom.addEventListener("focusin", this.onNativeInputFocus, true);
    this.blockDirectScroll = event => event.preventDefault();
    if (viewportRows) {
      this.view.scrollDOM.addEventListener("wheel", this.blockDirectScroll, { passive: false });
      this.view.scrollDOM.addEventListener("touchmove", this.blockDirectScroll, { passive: false });
    }
    this.cm = getCM(this.view);
    if (textWidth !== undefined) this.cm?.setOption("textwidth", textWidth);
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
    const vimSelection = this.viewportRows && this.cm?.state?.vim?.visualMode ? this.cm.state.vim.sel : null;
    const cursor = vimSelection
      ? Math.max(0, Math.min(doc.length, offsetForPosition(doc.toString(), [vimSelection.head.line, vimSelection.head.ch])))
      : selection.head;
    const anchor = vimSelection
      ? Math.max(0, Math.min(doc.length, offsetForPosition(doc.toString(), [vimSelection.anchor.line, vimSelection.anchor.ch])))
      : selection.anchor;
    return {
      text: doc.toString(),
      cursor,
      anchor,
      head: cursor,
      cursorPosition: positionForOffset(doc, cursor),
      anchorPosition: positionForOffset(doc, anchor),
      ranges: this.view.state.selection.ranges.map(range => ({
        anchor: positionForOffset(doc, range.anchor),
        head: positionForOffset(doc, range.head),
        from: positionForOffset(doc, range.from),
        to: positionForOffset(doc, range.to),
      })),
      mode: normalizeMode(this.mode, this.subMode, this.cm, this.commandLine !== null),
      registers: snapshotRegisters(),
      viewport: this.getViewport(),
    };
  }

  getViewport() {
    const totalLines = this.view.state.doc.lines;
    if (!this.viewportRows) return { topLine: 0, bottomLine: totalLines - 1, totalLines };
    const lineHeight = 24;
    const maximumTop = Math.max(0, totalLines - this.viewportRows);
    const topLine = Math.max(0, Math.min(maximumTop, Math.round(this.view.scrollDOM.scrollTop / lineHeight)));
    return {
      topLine,
      bottomLine: Math.min(totalLines - 1, topLine + this.viewportRows - 1),
      totalLines,
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

    // Keep the authored `@` and `:` tokens visible while preserving the
    // app-owned Ex history bridge. Other registers receive the buffered `@`
    // and their register key together through the adapter's macro engine.
    let pendingAtPrefix = false;
    if (this.awaitingColonRegister) {
      this.awaitingColonRegister = false;
      if (vimKey === ":" && this.lastExCommand !== null) {
        Vim.handleEx(this.cm, this.lastExCommand);
        this.moveCursorToLineStart();
        this.emit("key", { key: canonicalKey, source });
        return true;
      }
      pendingAtPrefix = true;
    }
    if (vimKey === "@" && !pendingAtPrefix) {
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
    if (pendingAtPrefix) Vim.multiSelectHandleKey(this.cm, "@", source);
    const handled = Vim.multiSelectHandleKey(this.cm, vimKey, source);
    // `handleKey` owns Vim interpretation. In Insert mode, a browser would
    // normally perform the subsequent contenteditable insertion; touch input
    // deliberately skips that browser path, so we apply only that native text
    // insertion through CodeMirror's transaction API.
    if (!handled && wasInsert && this.cm.state.vim?.insertMode) {
      const text = literalText(vimKey);
      if (text !== null) {
        if (this.cm.state.overwrite && !text.includes("\n")) this.cm.overWriteSelection(text);
        else this.cm.replaceSelection(text);
      }
    }
    const commandInput = this.view.dom.querySelector(".cm-vim-panel input, .cm-vim-panel textarea");
    if (!wasInsert && (vimKey === ":" || vimKey === "/" || vimKey === "?") && commandInput) {
      // Visual-mode `:` starts with Vim's `'<,'>` range. Preserve that
      // generated prefix so touch input can execute the same command that a
      // physical Vim command line would show.
      this.commandLine = commandInput.value || "";
      this.commandPrefix = vimKey;
    }
    if (this.viewportRows) this.cm.refresh?.();
    this.disableNativeInputs();
    this.emit("key", { key: canonicalKey, source });
    return Boolean(handled);
  }

  disableNativeInput(input) {
    input.readOnly = true;
    input.setAttribute("readonly", "");
    input.setAttribute("aria-readonly", "true");
    input.setAttribute("inputmode", "none");
  }

  disableNativeInputs() {
    this.view.dom.querySelectorAll("input, textarea").forEach(input => this.disableNativeInput(input));
  }

  syncCommandInput() {
    const input = this.view.dom.querySelector(".cm-vim-panel input, .cm-vim-panel textarea");
    if (input) {
      input.value = this.commandLine || "";
      this.disableNativeInput(input);
    }
  }

  moveCursorToLineStart() {
    const line = this.view.state.doc.lineAt(this.view.state.selection.main.head);
    this.view.dispatch({ selection: EditorSelection.cursor(line.from) });
  }

  showPreviewRange(range) {
    if (!range) {
      this.view.dispatch({ effects: setPreviewRange.of(Decoration.none) });
      return;
    }
    const from = offsetForPosition(this.view.state.doc.toString(), range.from);
    const to = offsetForPosition(this.view.state.doc.toString(), range.to);
    const decoration = from < to
      ? Decoration.set([Decoration.mark({ class: "cm-preview-range" }).range(from, to)])
      : Decoration.none;
    this.view.dispatch({ effects: setPreviewRange.of(decoration) });
  }

  executeEx(command) {
    if (this.executeLineOperation(command)) return;
    Vim.handleEx(this.cm, command);
    this.moveCursorToLineStart();
  }

  executeLineOperation(input) {
    const operation = parseLineOperation(this.cm, input);
    if (!operation) return false;
    const { lines, command, argument } = operation;
    let { start, end } = operation;
    const isDestinationOnly = command.startsWith("pu");
    const validSource = start >= 0 && end >= start && end < lines.length;
    if ((!isDestinationOnly && !validSource) || (isDestinationOnly && (end < -1 || end >= lines.length))) return true;

    const controller = Vim.getRegisterController?.();
    const selected = validSource ? lines.slice(start, end + 1) : [];
    const selectedText = `${selected.join("\n")}\n`;
    const setDocument = (nextLines, cursorLine) => {
      const text = nextLines.join("\n");
      const safeLine = Math.max(0, Math.min(nextLines.length - 1, cursorLine));
      const firstNonblank = nextLines[safeLine].search(/\S/);
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: text },
        selection: EditorSelection.cursor(offsetForLineStart(nextLines, safeLine) + Math.max(0, firstNonblank)),
      });
    };

    if (command.startsWith("d")) {
      controller?.pushText(argument[0] || null, "delete", selectedText, true);
      const next = lines.toSpliced(start, selected.length);
      if (!next.length) next.push("");
      const cursorLine = Math.min(start, next.length - 1);
      const firstNonblank = next[cursorLine].search(/\S/);
      const cursor = offsetForLineStart(next, cursorLine) + Math.max(0, firstNonblank);
      const first = this.view.state.doc.line(start + 1);
      const hasFollowingLine = end < lines.length - 1;
      const from = hasFollowingLine || start === 0 ? first.from : this.view.state.doc.line(start).to;
      const to = hasFollowingLine ? this.view.state.doc.line(end + 2).from : this.view.state.doc.length;
      this.view.dispatch({ changes: { from, to, insert: "" }, selection: EditorSelection.cursor(cursor) });
      return true;
    }

    if (command.startsWith("y")) {
      controller?.pushText(argument[0] || null, "yank", selectedText, true);
      return true;
    }

    if (command.startsWith("pu")) {
      const register = controller?.getRegister(argument[0] || '"');
      const text = register?.toString?.() || "";
      if (!text) return true;
      const inserted = text.replace(/\n$/, "").split("\n");
      const destination = end;
      const next = [...lines];
      next.splice(destination + 1, 0, ...inserted);
      setDocument(next, destination + inserted.length);
      return true;
    }

    if (command.startsWith("co") || command === "t") {
      const destinationAddress = parseAddress(argument, 0, { cm: this.cm, lines, currentLine: this.cm.getCursor().line });
      if (!destinationAddress || destinationAddress.index !== argument.length) return true;
      const destination = destinationAddress.line;
      if (destination < -1 || destination >= lines.length) return true;
      const next = [...lines];
      next.splice(destination + 1, 0, ...selected);
      setDocument(next, destination + selected.length);
      return true;
    }

    if (command.startsWith("m")) {
      const destinationAddress = parseAddress(argument, 0, { cm: this.cm, lines, currentLine: this.cm.getCursor().line });
      if (!destinationAddress || destinationAddress.index !== argument.length) return true;
      let destination = destinationAddress.line;
      if (destination < -1 || destination >= lines.length || (destination >= start && destination <= end)) return true;
      const next = [...lines];
      next.splice(start, selected.length);
      if (destination > end) destination -= selected.length;
      next.splice(destination + 1, 0, ...selected);
      setDocument(next, destination + selected.length);
      return true;
    }

    if (command.startsWith("j")) {
      if (!operation.explicitRange) end = Math.min(lines.length - 1, start + 1);
      const joined = lines.slice(start, end + 1).reduce((text, line, index) => {
        if (!index) return line.replace(/\s+$/, "");
        const next = line.replace(/^\s+/, "");
        return `${text}${text && next ? " " : ""}${next}`;
      }, "");
      const next = [...lines];
      next.splice(start, end - start + 1, joined);
      setDocument(next, start);
      return true;
    }

    if (command.startsWith("sor")) {
      const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
      const sorted = [...selected].sort(compare);
      if (operation.bang) sorted.reverse();
      const next = [...lines];
      next.splice(start, selected.length, ...sorted);
      setDocument(next, start);
      return true;
    }

    return false;
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
    // Lessons inject every accepted key through sendKey(), including physical
    // keyboard fallback. Keeping CodeMirror's surface non-editable prevents
    // iOS from opening the native keyboard for an app that supplies its own.
    this.view.contentDOM.setAttribute("contenteditable", "false");
    this.view.dom.classList.toggle("is-locked", locked);
  }

  focus() {
    if (this.locked) return;
    this.disableNativeInputs();
    if (this.commandLine !== null) return;
    this.view.dom.focus({ preventScroll: true });
  }

  destroy() {
    this.view.dom.removeEventListener("focusin", this.onNativeInputFocus, true);
    this.view.scrollDOM.removeEventListener("wheel", this.blockDirectScroll);
    this.view.scrollDOM.removeEventListener("touchmove", this.blockDirectScroll);
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

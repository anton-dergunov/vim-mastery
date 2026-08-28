import { EditorSelection, EditorState, StateEffect, StateField } from "@codemirror/state";
import { history } from "@codemirror/commands";
import { Decoration, EditorView, drawSelection, highlightWhitespace, lineNumbers } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Vim, getCM, vim } from "@replit/codemirror-vim";
import { VimEffectController, vimEffectExtensions } from "./vim-effects.js";

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
    if (input[index] !== delimiter) continue;
    let backslashes = 0;
    for (let previous = index - 1; previous >= start && input[previous] === "\\"; previous -= 1) backslashes += 1;
    if (backslashes % 2 === 0) return index;
  }
  return -1;
}

function parseSubstitution(input) {
  const command = input.match(/(?:^|[,%.'$+\-0-9?\/;>])s(?=[^A-Za-z0-9\s])/);
  if (!command) return null;
  const commandIndex = command.index + command[0].length - 1;
  const delimiter = input[commandIndex + 1];
  if (!delimiter || /[A-Za-z0-9\s]/.test(delimiter)) return null;
  const patternEnd = findUnescapedDelimiter(input, commandIndex + 2, delimiter);
  if (patternEnd < 0) return null;
  const replacementEnd = findUnescapedDelimiter(input, patternEnd + 1, delimiter);
  if (replacementEnd < 0) return null;
  return {
    delimiter,
    pattern: input.slice(commandIndex + 2, patternEnd),
    replacement: input.slice(patternEnd + 1, replacementEnd),
    flags: input.slice(replacementEnd + 1).trim().split(/\s+/)[0] || "",
  };
}

/**
 * Count how many times a substitution would fire on one line. Vim replaces the
 * first match per line unless the `g` flag is present, so the flag decides
 * whether this counts once or exhausts the line.
 */
function countLineMatches(expression, text, global) {
  if (!global) return expression.test(text) ? 1 : 0;
  const scanner = new RegExp(expression.source, "g");
  let count = 0;
  let match = scanner.exec(text);
  while (match !== null) {
    count += 1;
    // A zero-width match would otherwise pin `lastIndex` and loop forever.
    if (match.index === scanner.lastIndex) scanner.lastIndex += 1;
    match = scanner.exec(text);
  }
  return count;
}

function countSubstitutions(expression, lines, start, end, global) {
  let substitutions = 0;
  const matched = [];
  for (let line = Math.max(0, start); line <= Math.min(lines.length - 1, end); line += 1) {
    const count = countLineMatches(expression, lines[line], global);
    if (!count) continue;
    substitutions += count;
    matched.push(line);
  }
  return substitutions ? { substitutions, lines: matched } : null;
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
  if (["join", "j"].includes(command) && argument) return null;
  if (command === "sort" && argument && !parseSortArgument(argument)) return null;
  return { lines, start, end, explicitRange, command, bang: match[2] === "!", argument };
}

function parseRangePrefix(cm, input, { defaultWholeBuffer = false } = {}) {
  const lines = cm.getValue().split("\n");
  const originalCurrent = cm.getCursor().line;
  let index = 0;
  let start = defaultWholeBuffer ? 0 : originalCurrent;
  let end = defaultWholeBuffer ? lines.length - 1 : originalCurrent;
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

  return { lines, start, end, index, explicitRange };
}

function parseNormalOperation(cm, input) {
  const range = parseRangePrefix(cm, input);
  if (!range) return null;
  const commandText = input.slice(range.index).trimStart();
  const match = commandText.match(/^(normal|norm)(!?)[ \t]+([\s\S]+)$/);
  if (!match) return null;
  return { ...range, bang: match[2] === "!", keys: match[3] };
}

function parseGlobalOperation(cm, input) {
  const range = parseRangePrefix(cm, input, { defaultWholeBuffer: true });
  if (!range) return null;
  const commandText = input.slice(range.index).trimStart();
  const match = commandText.match(/^(global|g|vglobal|v)(!?)/);
  if (!match) return null;
  let index = match[0].length;
  const delimiter = commandText[index];
  if (!delimiter || /[A-Za-z0-9\s]/.test(delimiter)) return null;
  const patternEnd = findUnescapedDelimiter(commandText, index + 1, delimiter);
  if (patternEnd < 0) return null;
  const pattern = commandText.slice(index + 1, patternEnd);
  const nestedCommand = commandText.slice(patternEnd + 1).trimStart();
  const inverted = match[1].startsWith("v") || match[2] === "!";
  return { ...range, pattern, nestedCommand, inverted };
}

/**
 * `:sort` takes `[flags] [/pattern/]`. Returning null means the argument is
 * something this engine does not model, and the caller declines the command
 * rather than sorting on a guess.
 */
function parseSortArgument(argument) {
  if (!argument) return { flags: "", pattern: null };
  const patternMatch = argument.match(/\/((?:[^\\/]|\\.)*)\//);
  const flags = (patternMatch ? argument.replace(patternMatch[0], "") : argument).replace(/\s+/g, "");
  if (!/^[niu]*$/.test(flags)) return null;
  if (patternMatch && compileGlobalPattern(patternMatch[1]) === null) return null;
  return { flags, pattern: patternMatch ? patternMatch[1] : null };
}

/**
 * Vim compares a key derived from the flags rather than the whole line: `/pat/`
 * compares the text *following* the match, `i` compares without case, and `n`
 * compares the first decimal number, with numberless lines kept ahead of the
 * rest in their original order. `u` then drops any line that compares equal to
 * the one before it, so it dedupes on the same key the sort used.
 */
function sortLines(selected, argument) {
  const parsed = parseSortArgument(argument);
  if (!parsed) return null;
  const { flags, pattern } = parsed;
  const expression = pattern === null ? null : compileGlobalPattern(pattern);
  const textOf = line => {
    if (!expression) return line;
    const match = expression.exec(line);
    return match ? line.slice(match.index + match[0].length) : line;
  };
  const keyOf = line => {
    const text = textOf(line);
    if (!flags.includes("n")) return flags.includes("i") ? text.toLowerCase() : text;
    const number = /-?\d+/.exec(text);
    return number ? Number(number[0]) : null;
  };
  const keyed = selected.map((line, index) => ({ line, index, key: keyOf(line) }));
  const compare = (left, right) => {
    if (left.key === right.key) return 0;
    // A numeric sort keeps the lines without a number ahead of the rest.
    if (left.key === null) return -1;
    if (right.key === null) return 1;
    return left.key < right.key ? -1 : 1;
  };
  // Ties keep their original order, which is what makes `u` drop the later copy.
  const sorted = [...keyed].sort((left, right) => compare(left, right) || left.index - right.index);
  const kept = flags.includes("u")
    ? sorted.filter((entry, index) => index === 0 || compare(sorted[index - 1], entry) !== 0)
    : sorted;
  return kept.map(entry => entry.line);
}

function compileGlobalPattern(pattern) {
  // Unit 14 uses Vim's practical, line-oriented regex subset. Translate the
  // Vim-only magic spellings while leaving anchors, dots, and classes intact.
  const source = pattern
    .replaceAll("\\<", "\\b")
    .replaceAll("\\>", "\\b")
    .replaceAll("\\+", "+")
    .replaceAll("\\?", "?")
    .replaceAll("\\|", "|")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replace(/\\([/#!;,:])/g, "$1");
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

/**
 * Vim's `:global` marks every matching line first, then runs the command on
 * each mark in turn. `:copy` and `:move` reshape the buffer between those
 * turns, so every pending mark has to be tracked as the lines around it shift.
 * The order reversal of `:g/pat/m0` is a consequence of that tracking, not a
 * special case.
 */
function relocateGlobalMatches(cm, { lines, marks, move, address }) {
  let current = [...lines];
  const pending = [...marks];
  let cursorLine = null;
  for (let index = 0; index < pending.length; index += 1) {
    const mark = pending[index];
    if (mark === null) continue;
    const destination = parseAddress(address, 0, { cm, lines: current, currentLine: mark });
    if (!destination || destination.index !== address.length) return null;
    if (destination.line < -1 || destination.line >= current.length) return null;
    if (move && destination.line === mark) {
      cursorLine = mark;
      continue;
    }
    const next = [...current];
    const text = move ? next.splice(mark, 1)[0] : current[mark];
    let target = destination.line;
    if (move && target > mark) target -= 1;
    next.splice(target + 1, 0, text);
    for (let other = index + 1; other < pending.length; other += 1) {
      let line = pending[other];
      if (line === null) continue;
      if (move) {
        if (line === mark) {
          pending[other] = null;
          continue;
        }
        if (line > mark) line -= 1;
      }
      if (line > target) line += 1;
      pending[other] = line;
    }
    cursorLine = target + 1;
    current = next;
  }
  return cursorLine === null ? null : { lines: current, cursorLine };
}

function offsetForLineStart(lines, line) {
  return lines.slice(0, line).reduce((total, value) => total + value.length + 1, 0);
}

/**
 * The one boundary between the lesson UI and CodeMirror Vim. Nothing outside
 * this module reaches into EditorView, getCM, or Vim directly.
 */
export class VimEngine {
  constructor({
    parent,
    text,
    cursor,
    language = "plain-text",
    wrapColumns,
    textWidth,
    viewportRows,
    visualizeWhitespace = false,
    onEvent,
    onEffect,
    effectsEnabled,
  }) {
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
    // Vim prints a buffer-level report after a command and clears it on the
    // next keystroke. `matchPattern` instead behaves like `hlsearch`: it holds
    // the live pattern and matching lines are rescanned from the current
    // document, so the marks can never point at stale line numbers.
    this.lastImpact = null;
    this.matchPattern = null;
    this.pendingDecorations = null;
    this.decorationFlush = false;
    this.awaitingColonRegister = false;
    this.awaitingCommandLineRegister = false;
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
          ...vimEffectExtensions,
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
            this.effects?.recordUpdate(update);
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
    // The adapter defaults to JavaScript regular expressions. Lessons teach
    // native Vim regex syntax, so every isolated exercise starts in Vim mode.
    Vim.handleEx(this.cm, "set nopcre");
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
    this.effects = new VimEffectController({
      view: this.view,
      onEffect,
      enabled: effectsEnabled,
      reducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
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
    const macroMode = Vim.getVimGlobalState_?.().macroModeState;
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
      mode: normalizeMode(this.mode, this.subMode, this.cm, this.commandLine !== null || Boolean(this.confirmationInput())),
      registers: snapshotRegisters(),
      macro: {
        recording: Boolean(macroMode?.isRecording),
        playing: Boolean(macroMode?.isPlaying),
        register: macroMode?.latestRegister || null,
      },
      viewport: this.getViewport(),
      impact: this.lastImpact,
      matchLines: this.getMatchLines(),
    };
  }

  getMatchLines() {
    if (!this.matchPattern) return [];
    const expression = compileGlobalPattern(this.matchPattern);
    if (!expression) return [];
    const { doc } = this.view.state;
    const lines = [];
    for (let line = 1; line <= doc.lines; line += 1) {
      expression.lastIndex = 0;
      if (expression.test(doc.line(line).text)) lines.push(line - 1);
    }
    return lines;
  }

  setMatchPattern(pattern) {
    this.matchPattern = pattern || null;
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
    // Vim's report lives until the next keystroke, so retire it before this
    // key runs. Commands that produce a new report set it again below.
    this.lastImpact = null;
    this.effects.beginKey({ key: canonicalKey, source, before: this.getSnapshot() });
    const finish = handled => {
      // CodeMirror defers scroll measurement, so flush it before snapshotting
      // or the reported window lags the rendered one. This has to live in
      // finish(): the command-line and confirmation paths return early and
      // would otherwise never measure, which is how an Ex command could scroll
      // the buffer while the position rail still showed the old window.
      if (this.viewportRows) this.cm?.refresh?.();
      const after = this.getSnapshot();
      const pending = Boolean(
        this.cm?.state?.vim?.inputState?.operator
        || this.cm?.state?.vim?.inputState?.keyBuffer?.length
        || this.awaitingColonRegister
        || this.commandLine !== null
        || this.confirmationInput(),
      );
      this.emit("key", { key: canonicalKey, source });
      this.effects.endKey({ after, pending });
      return handled;
    };

    const confirmationInput = this.confirmationInput();
    if (confirmationInput) {
      const promptKey = vimKey === "<Esc>" ? "Escape" : literalText(vimKey);
      if (promptKey !== null) {
        const event = new KeyboardEvent("keydown", {
          key: promptKey,
          code: promptKey.length === 1 ? `Key${promptKey.toUpperCase()}` : promptKey,
          // The adapter listens on the prompt input itself. Do not bubble this
          // synthetic event into the app's physical-key gate and recurse.
          bubbles: false,
          cancelable: true,
        });
        Object.defineProperty(event, "keyCode", { value: promptKey === "Escape" ? 27 : promptKey.toUpperCase().charCodeAt(0) });
        Object.defineProperty(event, "vimWildsPrompt", { value: true });
        confirmationInput.dispatchEvent(event);
        this.disableNativeInputs();
        return finish(true);
      }
    }

    if (this.commandLine !== null) {
      // Vim's command line accepts `Ctrl-r{register}` to insert a register's
      // text. `"/` and `":` make it possible to reuse a pattern that was just
      // confirmed visually instead of retyping it.
      if (this.awaitingCommandLineRegister) {
        this.awaitingCommandLineRegister = false;
        const name = literalText(vimKey);
        const controller = Vim.getRegisterController?.();
        if (name && controller?.isValidRegister?.(name)) {
          this.commandLine += (controller.getRegister(name)?.toString() || "").replace(/\n$/, "");
        }
        this.syncCommandInput();
        return finish(true);
      }
      if (vimKey === "<C-r>") {
        this.awaitingCommandLineRegister = true;
        this.syncCommandInput();
        return finish(true);
      }
      if (vimKey === "<Esc>") {
        this.closeCommandLine();
      } else if (vimKey === "<BS>") {
        this.commandLine = this.commandLine.slice(0, -1);
      } else if (vimKey === "<CR>") {
        if (this.commandPrefix === ":") {
          const command = this.commandLine;
          this.lastExCommand = command;
          this.closeCommandLine();
          if (command === "~" && this.lastSubstitution && this.lastSearchQuery !== null) {
            const delimiter = this.lastSubstitution.delimiter || "/";
            this.executeEx(`s${delimiter}${this.lastSearchQuery}${delimiter}${this.lastSubstitution.replacement}${delimiter}`);
          } else {
            this.rememberSubstitution(command);
            this.executeEx(command);
          }
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
          // A confirmed search is the live pattern, exactly like `hlsearch`.
          this.setMatchPattern(this.commandLine);
          this.commandLine = null;
          this.commandPrefix = null;
        }
      } else {
        const text = literalText(vimKey);
        if (text !== null) this.commandLine += text;
      }
      this.syncCommandInput();
      return finish(true);
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
        return finish(true);
      }
      pendingAtPrefix = true;
    }
    if (vimKey === "@" && !pendingAtPrefix) {
      this.awaitingColonRegister = true;
      return finish(true);
    }
    if (vimKey === "&" && this.lastSubstitution) {
      // `&` repeats the substitution pattern and replacement but intentionally
      // does not inherit flags such as `g`.
      const { delimiter, pattern, replacement } = this.lastSubstitution;
      this.executeEx(`s${delimiter}${pattern}${delimiter}${replacement}${delimiter}`);
      return finish(true);
    }

    const wasInsert = Boolean(this.cm.state.vim?.insertMode);
    const pendingKeys = this.cm.state.vim?.inputState?.keyBuffer || [];
    const opensCommandLine = !wasInsert && pendingKeys.length === 0 && (vimKey === ":" || vimKey === "/" || vimKey === "?");
    // Claim command-line input before asking the adapter to open its panel.
    // The panel can mount after handleKey() returns; otherwise the very next
    // lesson/demo key is interpreted as Normal-mode input and the Ex prompt
    // disappears. Do this only from an idle Vim state: `:` and `/` can also
    // be character arguments to pending Normal-mode commands. The adapter
    // still creates the native panel, while this bridge owns its text from
    // the first key onward.
    if (opensCommandLine) {
      this.commandLine = "";
      this.commandPrefix = vimKey;
    }
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
    if (opensCommandLine && commandInput) {
      // Visual-mode `:` starts with Vim's `'<,'>` range. Preserve that
      // generated prefix so touch input can execute the same command that a
      // physical Vim command line would show.
      this.commandLine = commandInput.value || "";
      this.syncCommandInput();
    }
    this.disableNativeInputs();
    return finish(Boolean(handled));
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

  confirmationInput() {
    if (!this.cm?.state?.vim?.exMode || this.commandLine !== null) return null;
    return this.view.dom.querySelector(".cm-vim-panel input, .cm-vim-panel textarea");
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

  /**
   * Decorations are requested from inside key handling, where dispatching
   * straight away would re-enter CodeMirror while the Vim adapter is still
   * mid-operation and leave `cm.state.vim` null. Deferring to a microtask
   * applies them after the key has fully settled, and collapsing repeated
   * requests keeps one dispatch per key.
   */
  scheduleDecorations(compute) {
    this.pendingDecorations = compute;
    if (this.decorationFlush) return;
    this.decorationFlush = true;
    queueMicrotask(() => {
      this.decorationFlush = false;
      const pending = this.pendingDecorations;
      this.pendingDecorations = null;
      if (!pending || !this.view.dom.isConnected) return;
      this.view.dispatch({ effects: setPreviewRange.of(pending()) });
    });
  }

  showPreviewRange(ranges) {
    const list = (Array.isArray(ranges) ? ranges : [ranges]).filter(Boolean);
    this.scheduleDecorations(() => {
      const text = this.view.state.doc.toString();
      const marks = [];
      for (const range of list) {
        const from = offsetForPosition(text, range.from);
        const to = offsetForPosition(text, range.to);
        if (from < to) marks.push(Decoration.mark({ class: range.className || "cm-preview-range" }).range(from, to));
      }
      // Decoration sets must be sorted by start offset.
      marks.sort((left, right) => left.from - right.from);
      return marks.length ? Decoration.set(marks) : Decoration.none;
    });
  }

  /**
   * Mark every on-screen line the live pattern matches. The rail ticks show
   * where matches sit in the whole buffer; these marks give the visible ones a
   * referent inside the code.
   */
  showMatchLines() {
    const lines = this.getMatchLines();
    if (!lines.length) {
      this.showPreviewRange(null);
      return;
    }
    const { doc } = this.view.state;
    this.showPreviewRange(lines.map(line => {
      const row = doc.line(line + 1);
      return {
        from: [line, 0],
        to: [line, row.length],
        className: "cm-match-line",
      };
    }));
  }

  clearEffects() {
    this.effects?.clear();
  }

  executeEx(command) {
    const before = this.view.state.doc.toString().split("\n");
    // `:nohlsearch` retires the live pattern, so the match map goes with it.
    if (/^noh(?:l(?:search)?)?!?$/.test(command.trim())) this.setMatchPattern(null);
    // `:global` reports its own substitution counts from the per-line loop it
    // already runs, so only a bare `:substitute` is planned here.
    const planned = parseGlobalOperation(this.cm, command) ? null : this.planSubstitutionReport(command);
    if (!this.executeGlobalOperation(command) && !this.executeNormalOperation(command)
      && !this.executeLineOperation(command)) {
      Vim.handleEx(this.cm, command);
      this.moveCursorToLineStart();
      if (planned) this.reportSubstitutions(planned);
    }
    this.reportBufferChange(before);
  }

  /**
   * Count the substitutions a `:s` command is about to make. Vim reports the
   * same numbers, and counting before the edit keeps the source text intact.
   */
  planSubstitutionReport(command) {
    const substitution = parseSubstitution(command);
    if (!substitution) return null;
    const pattern = substitution.pattern || this.lastSearchQuery;
    if (!pattern) return null;
    const range = parseRangePrefix(this.cm, command);
    if (!range) return null;
    const expression = compileGlobalPattern(pattern);
    if (!expression) return null;
    const report = countSubstitutions(expression, range.lines, range.start, range.end, substitution.flags.includes("g"));
    return report ? { ...report, pattern } : null;
  }

  reportSubstitutions({ substitutions, lines, pattern }) {
    this.lastImpact = { ...(this.lastImpact || {}), substitutions, substitutionLines: lines.length };
    this.setMatchPattern(pattern);
  }

  /**
   * A `:global` that rewrites lines in place changes no line count and reports
   * no substitutions, yet it is exactly the command whose reach a learner
   * cannot see through a small window. Counting the lines whose text actually
   * changed gives that case a signal too.
   */
  reportBufferChange(before) {
    const after = this.view.state.doc.toString().split("\n");
    const lineDelta = after.length - before.length;
    if (lineDelta) {
      this.lastImpact = { ...(this.lastImpact || {}), lineDelta };
      return;
    }
    const changedLines = before.reduce((count, line, index) => count + (line === after[index] ? 0 : 1), 0);
    if (!changedLines && !this.lastImpact) return;
    this.lastImpact = { ...(this.lastImpact || {}), lineDelta: 0, changedLines };
  }

  executeNormalKeys(keys, line) {
    this.cm.setCursor(line, 0);
    for (const key of keys) {
      const wasInsert = Boolean(this.cm.state.vim?.insertMode);
      const handled = Vim.multiSelectHandleKey(this.cm, toVimKey(key), "ex-normal");
      if (!handled && wasInsert && this.cm.state.vim?.insertMode) {
        const text = literalText(toVimKey(key));
        if (text !== null) {
          if (this.cm.state.overwrite && !text.includes("\n")) this.cm.overWriteSelection(text);
          else this.cm.replaceSelection(text);
        }
      }
    }
    if (this.cm.state.vim?.insertMode) Vim.multiSelectHandleKey(this.cm, "<Esc>", "ex-normal");
  }

  executeNormalOperation(input) {
    const operation = parseNormalOperation(this.cm, input);
    if (!operation) return false;
    const { lines, start, end, keys } = operation;
    if (start < 0 || end < start || end >= lines.length) return true;
    for (let line = start; line <= end; line += 1) this.executeNormalKeys(keys, line);
    return true;
  }

  executeGlobalOperation(input) {
    const operation = parseGlobalOperation(this.cm, input);
    if (!operation) return false;
    const { lines, start, end, pattern, nestedCommand, inverted } = operation;
    if (start < 0 || end < start || end >= lines.length) return true;
    const expression = compileGlobalPattern(pattern);
    if (!expression) return true;
    const matchingLines = [];
    for (let line = start; line <= end; line += 1) {
      expression.lastIndex = 0;
      if (expression.test(lines[line]) !== inverted) matchingLines.push(line);
    }
    // `:g` and `:v` both make the searched pattern the live one, matching how
    // Vim leaves it in the search register.
    this.setMatchPattern(pattern);
    if (!matchingLines.length || !nestedCommand) return true;

    if (/^(delete|d)(?:\s+["0-9a-z+_-])?$/.test(nestedCommand)) {
      const register = nestedCommand.trim().split(/\s+/)[1]?.[0] || null;
      const controller = Vim.getRegisterController?.();
      for (const line of matchingLines) controller?.pushText(register, "delete", `${lines[line]}\n`, true);
      const removed = new Set(matchingLines);
      const nextLines = lines.filter((_, line) => !removed.has(line));
      if (!nextLines.length) nextLines.push("");
      const cursorLine = Math.min(
        nextLines.length - 1,
        matchingLines.at(-1) - (matchingLines.length - 1),
      );
      const cursorColumn = Math.max(0, nextLines[cursorLine].search(/\S/));
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: nextLines.join("\n") },
        selection: EditorSelection.cursor(offsetForLineStart(nextLines, cursorLine) + cursorColumn),
      });
      return true;
    }

    if (/^(normal|norm)!?[ \t]+/.test(nestedCommand)) {
      const normal = nestedCommand.match(/^(?:normal|norm)!?[ \t]+([\s\S]+)$/);
      if (!normal) return true;
      for (const line of matchingLines) this.executeNormalKeys(normal[1], line);
      return true;
    }

    if (/^(substitute|s)(?=[^A-Za-z0-9\s])/.test(nestedCommand)) {
      const nested = parseSubstitution(nestedCommand);
      const nestedExpression = nested && compileGlobalPattern(nested.pattern || this.lastSearchQuery || "");
      let substitutions = 0;
      const substituted = [];
      for (const line of matchingLines) {
        if (nestedExpression) {
          const count = countLineMatches(nestedExpression, lines[line], nested.flags.includes("g"));
          if (count) {
            substitutions += count;
            substituted.push(line);
          }
        }
        Vim.handleEx(this.cm, `${line + 1}${nestedCommand}`);
      }
      this.moveCursorToLineStart();
      // The nested pattern is the one the learner sees replaced, so it wins the
      // match map over the `:g` selector.
      if (substitutions) this.reportSubstitutions({ substitutions, lines: substituted, pattern: nested.pattern || this.lastSearchQuery });
      return true;
    }

    const relocation = nestedCommand.match(/^(copy|co|t|move|m)(.*)$/);
    if (relocation) {
      const result = relocateGlobalMatches(this.cm, {
        lines,
        marks: matchingLines,
        move: relocation[1][0] === "m",
        address: relocation[2].trim(),
      });
      if (!result) return true;
      const cursorColumn = Math.max(0, result.lines[result.cursorLine].search(/\S/));
      // One transaction keeps the whole `:global` run inside a single undo
      // step, matching Vim.
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: result.lines.join("\n") },
        selection: EditorSelection.cursor(offsetForLineStart(result.lines, result.cursorLine) + cursorColumn),
      });
      return true;
    }

    return true;
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
      const sorted = sortLines(selected, argument);
      if (!sorted) return true;
      if (operation.bang) sorted.reverse();
      const next = [...lines];
      next.splice(start, selected.length, ...sorted);
      setDocument(next, start);
      return true;
    }

    return false;
  }

  rememberSubstitution(command) {
    const substitution = parseSubstitution(command);
    if (substitution) this.lastSubstitution = substitution;
  }

  closeCommandLine() {
    const input = this.cm?.state?.dialog?.querySelector("input");
    this.commandLine = null;
    this.commandPrefix = null;
    this.awaitingCommandLineRegister = false;
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
    this.effects?.destroy();
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

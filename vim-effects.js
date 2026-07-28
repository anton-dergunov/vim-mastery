import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

const setTransientDecorations = StateEffect.define();
const setSelectionDecorations = StateEffect.define();

const transientDecorationField = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setTransientDecorations)) return effect.value;
    }
    return value.map(transaction.changes);
  },
  provide: field => EditorView.decorations.from(field),
});

const selectionDecorationField = StateField.define({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSelectionDecorations)) return effect.value;
    }
    return value.map(transaction.changes);
  },
  provide: field => EditorView.decorations.from(field),
});

export const vimEffectExtensions = [
  transientDecorationField,
  selectionDecorationField,
];

const visualModes = new Map([
  ["visual", "character"],
  ["visual-line", "line"],
  ["visual-block", "block"],
]);

const positionKey = position => `${position[0]}:${position[1]}`;
const samePosition = (left, right) => Boolean(left && right && left[0] === right[0] && left[1] === right[1]);

function positionForOffset(text, offset) {
  const safeOffset = Math.max(0, Math.min(text.length, offset));
  const before = text.slice(0, safeOffset);
  const lines = before.split("\n");
  return [lines.length - 1, lines.at(-1).length];
}

function offsetForPosition(text, [row, column]) {
  const lines = text.split("\n");
  const safeRow = Math.max(0, Math.min(lines.length - 1, row));
  const lineOffset = lines.slice(0, safeRow).reduce((total, line) => total + line.length + 1, 0);
  return Math.max(lineOffset, Math.min(text.length, lineOffset + Math.max(0, column)));
}

function cloneRange(range) {
  return { from: [...range.from], to: [...range.to] };
}

function comparePosition(left, right) {
  return left[0] - right[0] || left[1] - right[1];
}

function normalizeRange(from, to) {
  return comparePosition(from, to) <= 0
    ? { from: [...from], to: [...to] }
    : { from: [...to], to: [...from] };
}

function uniqueRanges(ranges) {
  const seen = new Set();
  return ranges.filter(range => {
    const key = `${positionKey(range.from)}-${positionKey(range.to)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sourceFor(source) {
  if (source === "demo") return "demo";
  if (source === "physical") return "physical";
  return "lesson";
}

function registersChanged(before = {}, after = {}) {
  const names = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...names].filter(name => {
    const left = before[name];
    const right = after[name];
    return left?.text !== right?.text || left?.type !== right?.type;
  });
}

function primaryRegisterDelta(before, after) {
  const changed = registersChanged(before?.registers, after?.registers);
  const name = ["0", '"', "-", "1", ...changed].find(candidate => changed.includes(candidate));
  if (!name) return null;
  return { name, before: before.registers?.[name] || null, after: after.registers?.[name] || null };
}

function changesFromSet(changeSet, beforeText, afterText) {
  if (!changeSet) return [];
  const changes = [];
  changeSet.iterChanges((fromA, toA, fromB, toB) => {
    changes.push({
      before: {
        from: positionForOffset(beforeText, fromA),
        to: positionForOffset(beforeText, toA),
      },
      after: {
        from: positionForOffset(afterText, fromB),
        to: positionForOffset(afterText, toB),
      },
      deletedText: beforeText.slice(fromA, toA),
      insertedText: afterText.slice(fromB, toB),
    });
  });
  return changes;
}

function fallbackChange(beforeText, afterText) {
  if (beforeText === afterText) return [];
  let prefix = 0;
  while (prefix < beforeText.length && prefix < afterText.length && beforeText[prefix] === afterText[prefix]) prefix += 1;
  let beforeSuffix = beforeText.length;
  let afterSuffix = afterText.length;
  while (beforeSuffix > prefix && afterSuffix > prefix && beforeText[beforeSuffix - 1] === afterText[afterSuffix - 1]) {
    beforeSuffix -= 1;
    afterSuffix -= 1;
  }
  return [{
    before: { from: positionForOffset(beforeText, prefix), to: positionForOffset(beforeText, beforeSuffix) },
    after: { from: positionForOffset(afterText, prefix), to: positionForOffset(afterText, afterSuffix) },
    deletedText: beforeText.slice(prefix, beforeSuffix),
    insertedText: afterText.slice(prefix, afterSuffix),
  }];
}

function selectionRanges(snapshot, kind = visualModes.get(snapshot?.mode)) {
  if (!snapshot || !kind) return [];
  const text = snapshot.text;
  if (kind === "line") {
    const start = Math.min(snapshot.anchorPosition[0], snapshot.cursorPosition[0]);
    const end = Math.max(snapshot.anchorPosition[0], snapshot.cursorPosition[0]);
    const lines = text.split("\n");
    return [{
      from: [start, 0],
      to: end < lines.length - 1 ? [end + 1, 0] : [end, lines[end].length],
    }];
  }
  if (kind === "block") {
    const ranges = snapshot.ranges.map(range => normalizeRange(range.from, range.to));
    return ranges.map(range => {
      if (!samePosition(range.from, range.to)) return range;
      const line = text.split("\n")[range.from[0]] || "";
      return {
        from: range.from,
        to: [range.to[0], Math.min(line.length, range.to[1] + 1)],
      };
    });
  }
  const ranges = snapshot.ranges.map(range => normalizeRange(range.from, range.to));
  if (ranges.some(range => !samePosition(range.from, range.to))) return ranges;
  const range = normalizeRange(snapshot.anchorPosition, snapshot.cursorPosition);
  const line = text.split("\n")[range.to[0]] || "";
  range.to = [range.to[0], Math.min(line.length, range.to[1] + 1)];
  return [range];
}

function linewiseRange(snapshot, lineCount = 1) {
  const lines = snapshot.text.split("\n");
  const start = snapshot.cursorPosition[0];
  const end = Math.min(lines.length - 1, start + Math.max(1, lineCount) - 1);
  return {
    from: [start, 0],
    to: end < lines.length - 1 ? [end + 1, 0] : [end, lines[end].length],
  };
}

function nearestTextRange(snapshot, text) {
  const target = text.replace(/\n$/, "");
  if (!target) return null;
  const candidates = [];
  let start = 0;
  while (start <= snapshot.text.length) {
    const found = snapshot.text.indexOf(target, start);
    if (found < 0) break;
    candidates.push(found);
    start = found + Math.max(1, target.length);
  }
  if (!candidates.length) return null;
  const cursor = snapshot.cursor;
  const found = candidates.sort((left, right) => Math.abs(left - cursor) - Math.abs(right - cursor))[0];
  return {
    from: positionForOffset(snapshot.text, found),
    to: positionForOffset(snapshot.text, found + target.length),
  };
}

function captureRanges(before, register) {
  const kind = visualModes.get(before.mode);
  if (kind) return selectionRanges(before, kind);
  if (register?.type === "linewise") {
    const count = Math.max(1, register.text.replace(/\n$/, "").split("\n").length);
    return [linewiseRange(before, count)];
  }
  const nearest = nearestTextRange(before, register?.text || "");
  return nearest ? [nearest] : [];
}

function keyText(keys) {
  return keys.map(key => key === "Enter" ? "\n" : key).join("");
}

function exText(keys) {
  if (keys[0] !== ":") return "";
  const end = keys.lastIndexOf("Enter");
  return keys.slice(1, end < 0 ? undefined : end).join("");
}

function globalCommand(input) {
  const match = input.match(/(?:^|[,%.'$+\-0-9?\/;>])(global|g|vglobal|v)(!?)(?=[^A-Za-z0-9\s])/);
  if (!match) return null;
  const commandIndex = match.index + match[0].length - match[1].length - match[2].length;
  const delimiterIndex = commandIndex + match[1].length + match[2].length;
  const delimiter = input[delimiterIndex];
  if (!delimiter) return null;
  let patternEnd = delimiterIndex + 1;
  for (; patternEnd < input.length; patternEnd += 1) {
    if (input[patternEnd] !== delimiter || input[patternEnd - 1] === "\\") continue;
    break;
  }
  if (patternEnd >= input.length) return null;
  return {
    prefix: input.slice(0, commandIndex),
    pattern: input.slice(delimiterIndex + 1, patternEnd),
    nested: input.slice(patternEnd + 1).trimStart(),
    inverted: match[1].startsWith("v") || match[2] === "!",
  };
}

function globalLineChanges(input, before, after) {
  const command = globalCommand(input);
  if (!command || !/^(?:delete|d)(?:\s|$)/.test(command.nested)) return null;
  const expression = compileVimPattern(command.pattern);
  if (!expression) return null;
  const beforeLines = before.text.split("\n");
  const afterLines = after.text.split("\n");
  let first = 0;
  let last = beforeLines.length - 1;
  if (command.prefix && command.prefix !== "%") {
    const numericRange = command.prefix.match(/^(\d+)(?:,(\d+))?$/);
    if (numericRange) {
      first = Math.max(0, Number(numericRange[1]) - 1);
      last = Math.min(beforeLines.length - 1, Number(numericRange[2] || numericRange[1]) - 1);
    }
  }
  const matching = [];
  for (let row = first; row <= last; row += 1) {
    expression.lastIndex = 0;
    if (expression.test(beforeLines[row]) !== command.inverted) matching.push(row);
  }
  return matching.map((row, index) => {
    const to = row < beforeLines.length - 1 ? [row + 1, 0] : [row, beforeLines[row].length];
    const finalRow = Math.max(0, Math.min(afterLines.length - 1, row - index));
    return {
      before: { from: [row, 0], to },
      after: { from: [finalRow, 0], to: [finalRow, 0] },
      deletedText: `${beforeLines[row]}${row < beforeLines.length - 1 ? "\n" : ""}`,
      insertedText: "",
    };
  });
}

function operationFor(keys, before, after, changes) {
  const joined = keyText(keys);
  const ex = exText(keys);
  if (keys.at(-1) === "." && keys.length === 1) return "dot";
  if (keys[0] === "@") return "macro";
  if (keys.length === 1 && keys[0] === "u") return "undo";
  if (keys.length === 1 && keys[0] === "Ctrl-r") return "redo";
  if (ex && /(?:^|[,%.'$+\-0-9?\/;>])s(?=[^A-Za-z0-9\s])/.test(ex)) return "substitute";
  if (ex && globalCommand(ex)) return "global";
  if (/(?:^|[^A-Za-z])(put|pu)(?:\s|$)/.test(ex) || /^(?:"[0-9A-Za-z+*_"-])?(?:g?[pP])$/.test(joined)) return "put";
  if (/(?:^|[^A-Za-z])(yank|y)(?:\s|$)/.test(ex) || before.mode.startsWith("visual") && keys.at(-1) === "y" || /^"?[0-9A-Za-z+*_"-]*y/.test(joined)) return "yank";
  if (/(?:^|[^A-Za-z])(delete|d)(?:\s|$)/.test(ex) || /^"?[0-9A-Za-z+*_"-]*d/.test(joined)) return "delete";
  if (/^"?[0-9A-Za-z+*_"-]*c/.test(joined)) return "change";
  if (/^(?:[0-9]*[<>=])|^(?:g[~uUqw])/.test(joined)) {
    if (joined.includes("=")) return "indent";
    if (joined.startsWith("gq") || joined.startsWith("gw")) return "format";
    if (joined.includes("<") || joined.includes(">")) return "indent";
    return "case";
  }
  if (changes.length && before.mode.startsWith("visual")) {
    if (["d", "x"].includes(keys.at(-1))) return "delete";
    if (["c", "s"].includes(keys.at(-1))) return "change";
    if (["<", ">", "="].includes(keys.at(-1))) return "indent";
    if (["~", "u", "U"].includes(keys.at(-1))) return "case";
  }
  return null;
}

function compileVimPattern(pattern, flags = "") {
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
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

function searchRanges(snapshot, pattern) {
  const expression = compileVimPattern(pattern, "g");
  if (!expression || !pattern) return [];
  const ranges = [];
  for (const match of snapshot.text.matchAll(expression)) {
    if (!match[0].length) continue;
    ranges.push({
      from: positionForOffset(snapshot.text, match.index),
      to: positionForOffset(snapshot.text, match.index + match[0].length),
    });
  }
  return ranges;
}

function searchEventRanges(keys, after) {
  if (!["/", "?"].includes(keys[0]) || keys.at(-1) !== "Enter") return [];
  return searchRanges(after, keys.slice(1, -1).join(""));
}

function isJumpCommand(keys) {
  return ["'", "`"].includes(keys[0])
    || (keys.length === 1 && ["Ctrl-o", "Ctrl-i"].includes(keys[0]))
    || /^g[;,]$/.test(keys.join(""));
}

function isMarkCommand(keys) {
  return keys[0] === "m" && keys.length === 2;
}

function eventBase({ type, operation = null, ranges = [], selectionKind = null, source, reducedMotion, keys }) {
  return {
    type,
    operation,
    ranges: uniqueRanges(ranges.map(cloneRange)),
    selectionKind,
    source: sourceFor(source),
    reducedMotion: Boolean(reducedMotion),
    keys: [...keys],
  };
}

function replayType(changes) {
  if (changes.every(change => !change.deletedText && change.insertedText)) return "materialize";
  return "range-change";
}

export function classifySemanticEffect({
  before,
  after,
  keys,
  source = "lesson",
  reducedMotion = false,
  changeSet = null,
  changes: providedChanges = null,
}) {
  if (!before || !after || !keys?.length) return null;
  const changes = providedChanges || changesFromSet(changeSet, before.text, after.text);
  const normalizedChanges = changes.length || before.text === after.text ? changes : fallbackChange(before.text, after.text);
  const selectionKind = visualModes.get(after.mode);
  if (selectionKind) {
    return {
      ...eventBase({
        type: "selection",
        ranges: selectionRanges(after, selectionKind),
        selectionKind,
        source,
        reducedMotion,
        keys,
      }),
      changes: normalizedChanges,
    };
  }

  const joined = keyText(keys);
  const macroStarted = !before.macro?.recording && after.macro?.recording;
  const macroStopped = before.macro?.recording && !after.macro?.recording;
  if (macroStarted || macroStopped) {
    return {
      ...eventBase({
        type: "repeat",
        operation: "macro",
        ranges: [{ from: after.cursorPosition, to: after.cursorPosition }],
        source,
        reducedMotion,
        keys,
      }),
      phase: macroStarted ? "record-start" : "record-stop",
      register: after.macro?.register || before.macro?.register || keys.at(-1),
      intensity: 0.7,
      changes: normalizedChanges,
    };
  }

  const searchMatches = searchEventRanges(keys, after);
  if (searchMatches.length) {
    const activeRange = searchMatches.find(range => comparePosition(range.from, after.cursorPosition) <= 0 && comparePosition(after.cursorPosition, range.to) < 0)
      || searchMatches.find(range => samePosition(range.from, after.cursorPosition))
      || searchMatches[0];
    return {
      ...eventBase({ type: "matches", ranges: searchMatches, source, reducedMotion, keys }),
      phase: "search",
      activeRange: cloneRange(activeRange),
      changes: normalizedChanges,
    };
  }

  if (isMarkCommand(keys)) {
    return {
      ...eventBase({
        type: "jump",
        ranges: [{ from: after.cursorPosition, to: after.cursorPosition }],
        source,
        reducedMotion,
        keys,
      }),
      phase: "mark",
      mark: keys[1],
      changes: normalizedChanges,
    };
  }

  if (isJumpCommand(keys) && !samePosition(before.cursorPosition, after.cursorPosition)) {
    return {
      ...eventBase({
        type: "jump",
        ranges: [
          { from: before.cursorPosition, to: before.cursorPosition },
          { from: after.cursorPosition, to: after.cursorPosition },
        ],
        source,
        reducedMotion,
        keys,
      }),
      phase: "trace",
      trace: { from: [...before.cursorPosition], to: [...after.cursorPosition] },
      changes: normalizedChanges,
    };
  }

  const operation = operationFor(keys, before, after, normalizedChanges);
  const registerDelta = primaryRegisterDelta(before, after);

  if (operation === "yank" && registerDelta?.after) {
    return {
      ...eventBase({
        type: "capture",
        operation: "yank",
        ranges: captureRanges(before, registerDelta.after),
        selectionKind: visualModes.get(before.mode) || null,
        source,
        reducedMotion,
        keys,
      }),
      register: { name: registerDelta.name, ...registerDelta.after },
      changes: normalizedChanges,
    };
  }

  if (!normalizedChanges.length) return null;

  if (operation === "undo" || operation === "redo") {
    return {
      ...eventBase({
        type: "rewind",
        ranges: normalizedChanges.map(change => samePosition(change.after.from, change.after.to) ? change.before : change.after),
        source,
        reducedMotion,
        keys,
      }),
      direction: operation,
      changes: normalizedChanges,
    };
  }

  if (operation === "substitute" || operation === "global") {
    const ex = exText(keys);
    const exactChanges = operation === "global"
      ? (globalLineChanges(ex, before, after) || normalizedChanges)
      : normalizedChanges;
    return {
      ...eventBase({
        type: "matches",
        operation: operation === "substitute" ? "substitute" : null,
        ranges: exactChanges.map(change => samePosition(change.after.from, change.after.to) ? change.before : change.after),
        selectionKind: visualModes.get(before.mode) || null,
        source,
        reducedMotion,
        keys,
      }),
      phase: globalCommand(ex) ? "global" : "substitute",
      ...(operation === "global" ? { renderRanges: exactChanges.map(change => change.after) } : {}),
      changes: exactChanges,
    };
  }

  if (operation === "put") {
    return {
      ...eventBase({
        type: "materialize",
        operation: "put",
        ranges: normalizedChanges.map(change => change.after),
        source,
        reducedMotion,
        keys,
      }),
      changes: normalizedChanges,
    };
  }

  if (operation === "dot" || operation === "macro") {
    return {
      ...eventBase({
        type: "repeat",
        operation,
        ranges: normalizedChanges.map(change => samePosition(change.after.from, change.after.to) ? change.before : change.after),
        source,
        reducedMotion,
        keys,
      }),
      phase: "replay",
      replayType: replayType(normalizedChanges),
      intensity: 0.7,
      changes: normalizedChanges,
    };
  }

  if (["delete", "change", "indent", "format", "case"].includes(operation)) {
    return {
      ...eventBase({
        type: "range-change",
        operation,
        ranges: normalizedChanges.map(change => change.before),
        selectionKind: visualModes.get(before.mode) || null,
        source,
        reducedMotion,
        keys,
      }),
      renderRanges: normalizedChanges.map(change => change.after),
      changes: normalizedChanges,
    };
  }

  // Literal Insert/Replace input and ordinary one-character edits deliberately
  // stop here. Their document changes remain owned by Vim with no extra effect.
  return null;
}

class EffectPulseWidget extends WidgetType {
  constructor(className, label = "") {
    super();
    this.className = className;
    this.label = label;
  }

  eq(other) {
    return other.className === this.className && other.label === this.label;
  }

  toDOM() {
    const element = document.createElement("span");
    element.className = `cm-effect-pulse ${this.className}`;
    element.setAttribute("aria-hidden", "true");
    element.dataset.label = this.label;
    return element;
  }

  ignoreEvent() {
    return true;
  }
}

class DeletedRangeWidget extends WidgetType {
  constructor(text, className) {
    super();
    this.text = text;
    this.className = className;
  }

  eq(other) {
    return other.text === this.text && other.className === this.className;
  }

  toDOM() {
    const element = document.createElement("span");
    element.className = `cm-effect-deleted-ghost ${this.className}`;
    element.setAttribute("aria-hidden", "true");
    element.textContent = this.text;
    return element;
  }

  ignoreEvent() {
    return true;
  }
}

function offsetRange(view, range) {
  const text = view.state.doc.toString();
  return {
    from: offsetForPosition(text, range.from),
    to: offsetForPosition(text, range.to),
  };
}

function selectionDecorations(view, event) {
  const className = `cm-effect-selection cm-effect-selection-${event.selectionKind}`;
  const decorations = [];
  if (event.selectionKind === "line") {
    const rows = new Set();
    for (const range of event.ranges) {
      const finalRow = range.to[1] === 0 && range.to[0] > range.from[0] ? range.to[0] - 1 : range.to[0];
      for (let row = range.from[0]; row <= finalRow; row += 1) rows.add(row);
    }
    for (const row of rows) {
      const line = view.state.doc.line(Math.min(view.state.doc.lines, row + 1));
      decorations.push(Decoration.line({ class: className }).range(line.from));
    }
    return Decoration.set(decorations, true);
  }
  for (const [index, range] of event.ranges.entries()) {
    const { from, to } = offsetRange(view, range);
    const blockEdge = event.selectionKind === "block"
      ? [
        index === 0 && "cm-effect-block-start",
        index === event.ranges.length - 1 && "cm-effect-block-end",
        index > 0 && index < event.ranges.length - 1 && "cm-effect-block-middle",
      ].filter(Boolean).map(value => ` ${value}`).join("")
      : "";
    if (from < to) decorations.push(Decoration.mark({ class: className + blockEdge }).range(from, to));
  }
  return Decoration.set(decorations, true);
}

function transientClass(event) {
  const operation = event.operation ? ` cm-effect-operation-${event.operation}` : "";
  const phase = event.phase ? ` cm-effect-phase-${event.phase}` : "";
  const replay = event.replayType ? ` cm-effect-${event.replayType}` : "";
  return `cm-effect-transient cm-effect-${event.type}${operation}${phase}${replay}`;
}

function transientDecorations(view, event) {
  const className = transientClass(event);
  const decorations = [];
  const renderRanges = event.renderRanges || event.ranges;
  for (const range of renderRanges) {
    const { from, to } = offsetRange(view, range);
    if (from < to) decorations.push(Decoration.mark({ class: className }).range(from, to));
    else decorations.push(Decoration.widget({
      widget: new EffectPulseWidget(className, event.phase || event.operation || event.type),
      side: 1,
    }).range(from));
  }
  if (event.type === "range-change" || event.type === "repeat" || event.type === "rewind") {
    for (const change of event.changes || []) {
      if (!change.deletedText || !samePosition(change.after.from, change.after.to)) continue;
      const at = offsetForPosition(view.state.doc.toString(), change.after.from);
      decorations.push(Decoration.widget({
        widget: new DeletedRangeWidget(change.deletedText, className),
        side: 1,
      }).range(at));
    }
  }
  return Decoration.set(decorations, true);
}

function eventDuration(event) {
  if (event.reducedMotion) return 140;
  if (event.type === "capture") return 200;
  if (event.type === "materialize") return 240;
  if (event.type === "matches") return 250;
  if (event.type === "jump" || event.type === "rewind") return 220;
  if (event.type === "repeat" && event.phase?.startsWith("record")) return 180;
  if (event.type === "repeat") return 168;
  return 220;
}

function shouldKeepCommand({ after, pending }) {
  if (after.mode === "command-line" || after.mode === "operator-pending") return true;
  if (after.mode === "insert" || after.mode === "replace") return true;
  return Boolean(pending);
}

export class VimEffectController {
  constructor({ view, onEffect, enabled = () => true, reducedMotion = () => false }) {
    this.view = view;
    this.onEffect = onEffect;
    this.enabled = enabled;
    this.reducedMotion = reducedMotion;
    this.command = null;
    this.timer = null;
    this.sequence = 0;
  }

  beginKey({ key, source, before }) {
    if (!this.command) {
      this.command = { before, keys: [], source, changeSet: null };
    }
    this.command.keys.push(key);
    this.command.source = source;
    this.command.keyBefore = before;
  }

  recordUpdate(update) {
    if (!this.command || !update.docChanged) return;
    this.command.changeSet = this.command.changeSet
      ? this.command.changeSet.compose(update.changes)
      : update.changes;
  }

  endKey({ after, pending = false }) {
    if (!this.command) return;
    const enabled = this.enabled();
    this.view.dom.classList.toggle("cm-effect-operator-pending", enabled && after.mode === "operator-pending");
    this.view.dom.classList.toggle("cm-effect-recording", enabled && Boolean(after.macro?.recording));

    const command = this.command;
    const visualKind = visualModes.get(after.mode);
    const visualEnded = visualModes.has(command.keyBefore?.mode) && !visualKind;
    const macroTransition = command.keyBefore?.macro?.recording !== after.macro?.recording;
    const boundary = visualKind || visualEnded || macroTransition || !shouldKeepCommand({ after, pending });

    if (!boundary) return;
    const classifyBefore = visualEnded ? command.keyBefore : command.before;
    const event = classifySemanticEffect({
      before: classifyBefore,
      after,
      keys: visualEnded ? [command.keys.at(-1)] : command.keys,
      source: command.source,
      reducedMotion: this.reducedMotion(),
      changeSet: command.changeSet,
    });
    this.command = null;
    if (!event) {
      if (!visualKind) this.clearSelection();
      return;
    }
    event.id = ++this.sequence;
    event.duration = eventDuration(event);
    if (command.source !== "setup") this.onEffect?.(structuredClone(event));
    if (!enabled) {
      this.clear();
      return;
    }
    if (event.type === "selection") this.showSelection(event);
    else {
      this.clearSelection();
      this.showTransient(event);
    }
  }

  showSelection(event) {
    this.view.dispatch({ effects: setSelectionDecorations.of(selectionDecorations(this.view, event)) });
  }

  clearSelection() {
    this.view.dispatch({ effects: setSelectionDecorations.of(Decoration.none) });
  }

  showTransient(event) {
    if (this.timer) window.clearTimeout(this.timer);
    this.view.dom.dataset.semanticEffect = event.type;
    this.view.dom.dataset.semanticOperation = event.operation || event.phase || "";
    this.view.dom.style.setProperty("--vim-effect-intensity", String(event.intensity ?? 1));
    this.view.dom.classList.toggle("cm-effect-reduced-motion", event.reducedMotion);
    this.view.dispatch({ effects: setTransientDecorations.of(transientDecorations(this.view, event)) });
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.view.dispatch({ effects: setTransientDecorations.of(Decoration.none) });
      delete this.view.dom.dataset.semanticEffect;
      delete this.view.dom.dataset.semanticOperation;
      this.view.dom.style.removeProperty("--vim-effect-intensity");
      this.view.dom.classList.remove("cm-effect-reduced-motion");
    }, event.duration);
  }

  clear() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.command = null;
    this.view.dispatch({
      effects: [
        setTransientDecorations.of(Decoration.none),
        setSelectionDecorations.of(Decoration.none),
      ],
    });
    delete this.view.dom.dataset.semanticEffect;
    delete this.view.dom.dataset.semanticOperation;
    this.view.dom.style.removeProperty("--vim-effect-intensity");
    this.view.dom.classList.remove(
      "cm-effect-operator-pending",
      "cm-effect-recording",
      "cm-effect-reduced-motion",
    );
  }

  destroy() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
    this.command = null;
  }
}

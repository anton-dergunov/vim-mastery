/* Actions: the logical commands the solver may try for one exercise, built
 * only from atoms the course has taught by then.
 *
 * Each action is a complete command that starts and (normally) ends in Normal
 * mode: `{ keys, atoms, counted }`. Cost is `keys.length`. Literal payloads are
 * never enumerated: an insert entry is followed by one of a few candidate text
 * spans and Escape, and Ex and search lines come from the canonical route or
 * from words in the buffer. Anything outside this grammar is a limitation of
 * the audit, listed in the report header, not a route the learner lacks.
 */

import { normalizeObject } from "./grammar.mjs";

// Counts of this size or more mean counting objects on screen. Per the audit
// rule they are reported, but they do not make a route "easier".
export const COUNTED_FROM = 4;

const WORD_MOTIONS = ["h", "j", "k", "l", "w", "W", "b", "B", "e", "E", "ge", "gE", "gj", "gk", "(", ")", "{", "}", ";", ",", "n", "N"];
const PLAIN_MOTIONS = [
  "h", "j", "k", "l", "w", "W", "b", "B", "e", "E", "0", "^", "$", "|", "G", "-", "+", "_",
  ";", ",", "%", "(", ")", "{", "}", "H", "M", "L", "n", "N", "*", "#",
  "gg", "ge", "gE", "g_", "gj", "gk", "g*", "g#", "gn", "gN", "[[", "]]", "[]", "][", "[(", "])", "[{", "]}",
  "Ctrl-o", "Ctrl-i", "g;", "g,",
];
const SCROLLS = ["Ctrl-f", "Ctrl-b", "Ctrl-d", "Ctrl-u", "Ctrl-e", "Ctrl-y", "zt", "zz", "zb"];
const WINDOW_MOTIONS = new Set(["H", "M", "L"]);
const OPERATORS = ["d", "c", "y", ">", "<", "=", "g~", "gu", "gU", "gq", "gw"];
const TEXT_OBJECTS = ["w", "W", "s", "p", "\"", "'", "`", "(", "[", "{", "<", "t"].flatMap(char => ["i", "a"].map(prefix => normalizeObject(prefix, char)));
const STANDALONE = ["x", "X", "D", "J", "gJ", "~", "p", "P", "gp", "gP", "Y", ".", "&", "g&", "@:", "Ctrl-a", "Ctrl-x"];
const COUNTABLE_STANDALONE = new Set(["x", "X", "~", "J", "p", "P", ".", "Ctrl-a", "Ctrl-x"]);
// Standalone commands that repeat or apply something that is not tied to the
// cursor's line.
const NONLOCAL = new Set([".", "g&", "@:"]);
const INSERT_ENTRIES = ["i", "a", "I", "A", "o", "O", "s", "S", "C", "gI"];
const VISUAL_ENTRIES = ["v", "V", "Ctrl-v"];
const EDIT_ATOMS = /^(v:(?!y$|Y$).+|[dc><=]|g[~uUqw]|dd|cc|>>|<<|==|g~~|guu|gUU|gqq|gww|[xXDJ~pPsSCiaIAoOR.&]|gJ|gp|gP|gI|g&|Ctrl-a|Ctrl-x|@:|@@|r\{c\}|:.*)$/;
const VISUAL_OPERATORS = ["d", "x", "y", ">", "<", "~", "u", "U", "J", "p", "D", "X", "Y", "gq"];

// How an operator treats the text a motion crosses. An operator applied to
// two motions of the same kind that land on the same place from the same
// start changes the same text, so the search replays only one of them
// (`landing` in search.mjs). Motions missing here are never merged: `w` and
// `W` (`cw` acts like `ce`, and `dw` stops at the line end), `;` and `,`
// (their kind is the last find's), `gn`, and the jumps.
const MOTION_KINDS = {
  linewise: ["j", "k", "G", "gg", "-", "+", "_", "H", "M", "L"],
  inclusive: ["e", "E", "ge", "gE", "$", "g_", "%", "f{c}", "t{c}"],
  exclusive: ["h", "l", "b", "B", "0", "^", "|", "(", ")", "{", "}", "F{c}", "T{c}", "n", "N", "*", "#", "g*", "g#",
    "gj", "gk", "[[", "]]", "[]", "][", "[(", "])", "[{", "]}", "/", "?"],
};
const MOTION_KIND = new Map(Object.entries(MOTION_KINDS).flatMap(([kind, atoms]) => atoms.map(atom => [atom, kind])));

// A search typed with an offset (`/x/e`) is not the exclusive motion a plain
// search is.
function motionKind(motion) {
  if (motion.search && /(^|[^\\])[/?]/.test(motion.keys.slice(1, -1).join(""))) return null;
  return MOTION_KIND.get(motion.atoms.at(-1)) || null;
}

// A Visual selection is fixed by where it starts and where its motion lands,
// whatever the motion, except `$`, which also stretches a block to every
// line's end.
const reachKey = keys => keys.join("\u0000");
const VISUAL_INSERTS = ["c", "s", "C", "S", "I", "A"];

function splitKeys(text) {
  return [...text].map(char => (char === "\n" ? "Enter" : char === "\t" ? "Tab" : char));
}

function countKeys(count) {
  return count > 1 ? String(count).split("") : [];
}

// Spans a learner might type: what the canonical types, plus what differs
// between initial and target lines.
export function candidateSpans(exercise, insertRuns) {
  const spans = new Map();
  const add = keys => {
    if (!keys.length || keys.length > 60) return;
    spans.set(keys.join("\u0000"), keys);
  };
  for (const run of insertRuns) {
    add(run);
    const text = run.map(key => (key === "Enter" ? "\n" : key === "Tab" ? "\t" : key)).join("");
    if (text.trimStart() !== text) add(splitKeys(text.trimStart()));
  }
  const initial = exercise.scenario.initial.lines;
  const target = exercise.scenario.target.lines;
  if (initial.length === target.length) {
    initial.forEach((line, row) => {
      const goal = target[row];
      if (line === goal) return;
      let prefix = 0;
      while (prefix < line.length && prefix < goal.length && line[prefix] === goal[prefix]) prefix += 1;
      let suffix = 0;
      while (suffix < line.length - prefix && suffix < goal.length - prefix
        && line[line.length - 1 - suffix] === goal[goal.length - 1 - suffix]) suffix += 1;
      const middle = goal.slice(prefix, goal.length - suffix);
      if (middle) add(splitKeys(middle));
      // Whole-word variants, for changes made with `cw` or `ciw`.
      const wordStart = goal.slice(0, prefix).search(/\w*$/);
      const wordEnd = goal.length - suffix + (goal.slice(goal.length - suffix).match(/^\w*/)?.[0].length || 0);
      const word = goal.slice(wordStart, wordEnd);
      if (word && word !== middle) add(splitKeys(word));
      const tail = goal.slice(wordStart);
      if (tail && tail !== word) add(splitKeys(tail));
    });
  } else {
    const initialSet = new Set(initial);
    for (const line of target) if (!initialSet.has(line)) add(splitKeys(line.trimStart()));
  }
  return [...spans.values()];
}

function charset(exercise) {
  const chars = new Set();
  for (const line of [...exercise.scenario.initial.lines, ...exercise.scenario.target.lines]) {
    for (const char of line) chars.add(char);
  }
  return [...chars].sort();
}

function words(exercise) {
  const found = new Set();
  for (const line of exercise.scenario.initial.lines) {
    for (const match of line.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) found.add(match[0]);
  }
  return [...found].slice(0, 40);
}

// What kinds of change the exercise needs. Commands that can only make a
// change the target does not need are never offered: a route that uppercases
// a letter is not a shorter way to fix a typo.
function needs(exercise, parsed) {
  const initial = exercise.scenario.initial.lines;
  const target = exercise.scenario.target.lines;
  const initialText = initial.join("\n");
  const targetText = target.join("\n");
  const canonicalAtoms = new Set(parsed.commands.flatMap(command => command.atoms));
  const usesAny = atoms => atoms.some(atom => canonicalAtoms.has(atom) || canonicalAtoms.has(`v:${atom}`));
  const letters = text => new Set(text.match(/[A-Za-z]/g) || []);
  const initialLetters = letters(initialText);
  const indent = lines => lines.map(line => line.match(/^\s*/)[0]);
  return {
    caseChange: usesAny(["~", "g~", "gu", "gU", "g~~", "guu", "gUU", "u", "U"])
      || [...letters(targetText)].some(letter => !initialLetters.has(letter) && initialLetters.has(letter === letter.toUpperCase() ? letter.toLowerCase() : letter.toUpperCase())),
    indent: usesAny([">", "<", ">>", "<<", "=", "=="]) || indentChanges(initial, target, indent),
    // An increment needs a number to work on.
    numbers: usesAny(["Ctrl-a", "Ctrl-x", "g Ctrl-a", "g Ctrl-x"])
      || (/\d/.test(initialText) && (initialText.match(/\d+/g) || []).join() !== (targetText.match(/\d+/g) || []).join()),
    join: usesAny(["J", "gJ", "gq", "gw", "gqq", "gww"]) || target.length < initial.length,
    newLines: target.length > initial.length || usesAny(["o", "O", "p", "P"]),
    format: Boolean(exercise.editor?.textWidth),
    yank: Object.keys(exercise.scenario.target.registers || {}).length > 0,
    paste: pasteCouldHelp(initial, target) || usesAny(["p", "P", "gp", "gP", "y", "yy", "Y"]),
  };
}

// Whether some line needs its indent changed: with the same number of lines,
// any line whose indent differs; otherwise a target line whose text the
// buffer already has, but never at that indent. A line added with a
// different number of lines around it says nothing about indent.
function indentChanges(initial, target, indent) {
  if (initial.length === target.length) return JSON.stringify(indent(initial)) !== JSON.stringify(indent(target));
  const indents = new Map();
  initial.forEach(line => {
    if (!indents.has(line.trim())) indents.set(line.trim(), new Set());
    indents.get(line.trim()).add(line.match(/^\s*/)[0]);
  });
  return target.some(line => line.trim() && indents.has(line.trim()) && !indents.get(line.trim()).has(line.match(/^\s*/)[0]));
}

// Putting text back only saves typing when the target repeats text the buffer
// already has, or holds the same text in a different order.
function pasteCouldHelp(initial, target) {
  const tally = lines => {
    const counts = new Map();
    for (const token of lines.join("\n").match(/\S+/g) || []) counts.set(token, (counts.get(token) || 0) + 1);
    return counts;
  };
  const before = tally(initial);
  const after = tally(target);
  if ([...after].some(([token, count]) => count > (before.get(token) || 0) && before.has(token))) return true;
  const trimmedInitial = initial.map(line => line.trim()).filter(Boolean);
  const trimmedTarget = target.map(line => line.trim()).filter(Boolean);
  const sameLines = [...trimmedInitial].sort().join("\n") === [...trimmedTarget].sort().join("\n");
  if (sameLines && trimmedInitial.join("\n") !== trimmedTarget.join("\n")) return true;
  const initialTokens = (initial.join(" ").match(/\S+/g) || []);
  const targetTokens = (target.join(" ").match(/\S+/g) || []);
  return initialTokens.length === targetTokens.length
    && [...initialTokens].sort().join(" ") === [...targetTokens].sort().join(" ")
    && initialTokens.join(" ") !== targetTokens.join(" ");
}

const CASE_COMMANDS = new Set(["~", "g~", "gu", "gU", "g~~", "guu", "gUU", "u", "U"]);
const INDENT_COMMANDS = new Set([">", "<", ">>", "<<", "=", "=="]);
const NUMBER_COMMANDS = new Set(["Ctrl-a", "Ctrl-x"]);
const JOIN_COMMANDS = new Set(["J", "gJ"]);
const FORMAT_COMMANDS = new Set(["gq", "gw", "gqq", "gww"]);

function relevant(command, need) {
  if (CASE_COMMANDS.has(command)) return need.caseChange;
  if (INDENT_COMMANDS.has(command)) return need.indent;
  if (NUMBER_COMMANDS.has(command)) return need.numbers;
  if (JOIN_COMMANDS.has(command)) return need.join;
  if (FORMAT_COMMANDS.has(command)) return need.format;
  // A yank only matters when a register is checked or can be put back.
  if (command === "y" || command === "yy" || command === "Y") return need.yank || need.paste;
  if (["p", "P", "gp", "gP"].includes(command)) return need.paste;
  return true;
}

/**
 * Build the action list for one exercise.
 * `allowed` is the taught atom set; `parsed` is the canonical's parsed trace.
 */
export function buildActions(exercise, allowed, parsed) {
  const need = needs(exercise, parsed);
  const has = atom => allowed.has(atom) && relevant(atom.replace(/^v:/, ""), need);
  const actions = [];
  const push = (keys, atoms, counted = false, find = null, spanStart = undefined, merge = {}) => actions.push({ keys, atoms, counted, find, spanStart, ...merge });
  const chars = charset(exercise);
  const counts = has("count") ? [2, 3, 4, 5, 6, 7, 8, 9] : [];
  const smallCounts = counts.filter(count => count < COUNTED_FROM);
  const lineCount = Math.max(exercise.scenario.initial.lines.length, exercise.scenario.target.lines.length);

  // Window motions and scrolls are tried only where the exercise fixes the
  // viewport. Elsewhere the window is whatever the layout gives, down to a
  // partly visible row, which is not something a route should depend on.
  const fixedWindow = Boolean(exercise.editor?.viewportRows);
  // Motions on their own, with the counts a learner might put in front.
  const motions = [];
  for (const motion of PLAIN_MOTIONS) {
    if (!has(motion)) continue;
    if (WINDOW_MOTIONS.has(motion) && !fixedWindow) continue;
    motions.push({ keys: motion === "Enter" ? ["Enter"] : splitMotion(motion), atoms: [motion], countable: WORD_MOTIONS.includes(motion) });
  }
  for (const motion of ["f", "F", "t", "T"]) {
    if (!has(`${motion}{c}`)) continue;
    for (const char of chars) {
      const repeats = [...exercise.scenario.initial.lines, ...exercise.scenario.target.lines]
        .some(line => line.split(char).length > 2);
      motions.push({ keys: [motion, char], atoms: [`${motion}{c}`], countable: repeats, charMotion: true, find: { kind: motion, char } });
    }
  }
  const searchLines = [];
  for (const line of parsed.lines) {
    if (line.prefix === "/" || line.prefix === "?") searchLines.push([line.prefix, ...line.keys, "Enter"]);
  }
  for (const prefix of ["/", "?"]) {
    if (!has(prefix)) continue;
    for (const word of words(exercise)) {
      const lengths = new Set([1, 2, 3, word.length].filter(length => length <= word.length));
      for (const length of lengths) searchLines.push([prefix, ...word.slice(0, length), "Enter"]);
    }
  }
  const uniqueSearches = [...new Map(searchLines.map(keys => [keys.join("\u0000"), keys])).values()];
  for (const keys of uniqueSearches) motions.push({ keys, atoms: [keys[0]], countable: false, search: true });

  // A motion on its own records where it lands (`reachId`), so operators and
  // Visual selections that use it can be merged by landing.
  for (const motion of motions) {
    if (motion.search) continue;
    push(motion.keys, motion.atoms, false, motion.find && { ...motion.find, count: 1 }, undefined, { reachId: reachKey(motion.keys) });
    if (!motion.countable) continue;
    for (const count of motion.charMotion ? smallCounts : counts) {
      const keys = [...countKeys(count), ...motion.keys];
      push(keys, ["count", ...motion.atoms], count >= COUNTED_FROM, motion.find && { ...motion.find, count }, undefined, { reachId: reachKey(keys) });
    }
  }
  for (const motion of motions.filter(item => item.search)) push(motion.keys, motion.atoms, false, null, undefined, { reachId: reachKey(motion.keys) });
  // A line number read off the gutter is not counted, so a jump to a line on
  // screen never marks a route as counted. A line outside a fixed viewport
  // has no number the learner can see, so jumping to it by number is.
  const onScreen = exercise.editor?.viewportRows
    ? (exercise.scenario.initial.viewport || { topLine: 0, bottomLine: exercise.editor.viewportRows - 1 })
    : { topLine: 0, bottomLine: lineCount - 1 };
  for (const motion of ["G", "gg"]) {
    if (!has(motion) || !has("count")) continue;
    for (let line = 1; line <= lineCount; line += 1) {
      const visible = line - 1 >= onScreen.topLine && line - 1 <= onScreen.bottomLine;
      push([...String(line).split(""), ...splitMotion(motion)], ["count", motion], !visible);
    }
  }
  if (fixedWindow) for (const scroll of SCROLLS) if (has(scroll)) push(splitMotion(scroll), [scroll]);

  // Operators with motions and text objects, and doubled operators.
  const objects = TEXT_OBJECTS.filter(has);
  const spans = candidateSpans(exercise, parsed.insertRuns);
  // Registers worth naming: the ones the target checks and the ones the
  // canonical itself names.
  const canonicalRegisters = parsed.commands.flatMap(command => command.atoms)
    .filter(atom => atom.startsWith("register:")).map(atom => atom.slice("register:".length));
  const registerNames = [...new Set([...Object.keys(exercise.scenario.target.registers || {}), ...canonicalRegisters])]
    .filter(name => /^[a-zA-Z0-9"_+\-%.:/]$/.test(name));
  const registerPrefixes = has("\"") ? registerNames.map(name => ["\"", name]) : [];
  for (const operator of OPERATORS) {
    const opKeys = splitMotion(operator);
    // `reach` is the motion's own keys and `kind` how the operator treats it;
    // `group` is everything else about the command.
    const finish = (keys, atoms, counted, find = null, reach = null, kind = null, rows = null) => {
      const merge = prefix => ({
        ...(reach && kind ? { reach, group: `op\u0001${kind}\u0001${[...prefix, ...opKeys].join("\u0000")}`, repeatable: true } : {}),
        ...(rows ? { rows } : reach ? { rows: { reach } } : {}),
      });
      if (operator === "c") {
        for (const span of spans) {
          const tail = merge([]);
          if (tail.group) tail.group += `\u0001${span.join("\u0000")}`;
          push([...keys, ...span, "Escape"], atoms, counted, find, keys.length, tail);
        }
      } else {
        push(keys, atoms, counted, find, undefined, merge([]));
        for (const prefix of operator === "y" || operator === "d" || operator === "c" ? registerPrefixes : []) {
          push([...prefix, ...keys], ["\"", ...atoms], counted, find, undefined, merge(prefix));
        }
      }
    };
    if (has(operator)) {
      for (const motion of motions) {
        // Search as an operator range is only offered once the course has
        // shown it.
        if (motion.search && !has("op+search")) continue;
        const kind = motionKind(motion);
        finish([...opKeys, ...motion.keys], [operator, ...motion.atoms], false, motion.find && { ...motion.find, count: 1 }, reachKey(motion.keys), kind);
        if (!motion.countable) continue;
        for (const count of motion.charMotion ? smallCounts : counts) {
          const reach = [...countKeys(count), ...motion.keys];
          finish([...opKeys, ...reach], [operator, "count", ...motion.atoms], count >= COUNTED_FROM, motion.find && { ...motion.find, count }, reachKey(reach), kind);
        }
      }
      for (const object of objects) finish([...opKeys, ...object.split("")], [operator, object], false);
    }
    const double = operator.length === 1 ? `${operator}${operator}` : `${operator}${operator.slice(-1)}`;
    if (has(double)) {
      const keys = splitMotion(double);
      finish(keys, [double], false, null, null, null, { count: 1 });
      for (const count of counts) finish([...countKeys(count), ...keys], ["count", double], count >= COUNTED_FROM, null, null, null, { count });
    }
  }

  // `rows` says which lines a command can change, from the cursor's line:
  // `{ count }` lines from it, or `{ reach }` as far as that motion lands.
  // Commands without it (`.`, `g&`, `@:`, Ex lines, text objects) can act
  // anywhere.
  for (const command of STANDALONE) {
    if (!has(command)) continue;
    const rows = count => (NONLOCAL.has(command) ? {} : { rows: { count } });
    push(splitMotion(command), [command], false, null, undefined, rows(1));
    if (COUNTABLE_STANDALONE.has(command)) {
      for (const count of counts) push([...countKeys(count), command], ["count", command], count >= COUNTED_FROM, null, undefined, rows(count));
    }
    if (["p", "P", "gp", "gP"].includes(command) && has("\"")) {
      for (const name of [...new Set([...registerNames, "0"])]) push(["\"", name, ...splitMotion(command)], ["\"", command], false, null, undefined, rows(1));
    }
  }
  if (has("r{c}")) for (const char of chars) push(["r", char], ["r{c}"], false, null, undefined, { rows: { count: 1 } });

  for (const entry of INSERT_ENTRIES) {
    if (!has(entry)) continue;
    for (const span of spans) push([...splitMotion(entry), ...span, "Escape"], [entry], false, null, splitMotion(entry).length, { rows: { count: 1 } });
    if ((entry === "o" || entry === "O") && need.newLines) push([entry, "Escape"], [entry], false, null, undefined, { rows: { count: 1 } });
  }

  // Visual selections: one entry, one motion or object, one operator.
  // Charwise and linewise selections cost a key more than the operator and
  // motion they spell, so they are tried only in exercises about Visual mode.
  // Block selections have no operator equivalent and are always tried.
  const canonicalAtoms = new Set(parsed.commands.flatMap(command => command.atoms));
  for (const entry of VISUAL_ENTRIES) {
    if (!has(entry)) continue;
    if (entry !== "Ctrl-v" && !canonicalAtoms.has(entry)) continue;
    const reaches = [
      ...motions.filter(motion => !motion.search && !motion.charMotion).map(motion => ({ keys: motion.keys, atoms: motion.atoms, countable: motion.countable, landing: MOTION_KIND.has(motion.atoms.at(-1)) && motion.atoms.at(-1) !== "$" })),
      ...objects.map(object => ({ keys: object.split(""), atoms: [object], countable: false, landing: false, object: true })),
    ];
    for (const reach of reaches) {
      const variants = [{ keys: reach.keys, atoms: reach.atoms, counted: false }];
      if (reach.countable) {
        for (const count of counts) variants.push({ keys: [...countKeys(count), ...reach.keys], atoms: ["count", ...reach.atoms], counted: count >= COUNTED_FROM });
      }
      for (const variant of variants) {
        // Selections merge by landing whatever `.` would repeat: a repeated
        // Visual change remembers the selection, not the motion that made it.
        const merge = tail => ({
          ...(reach.landing ? { reach: reachKey(variant.keys), group: `visual\u0001${entry}\u0001${tail.join("\u0000")}` } : {}),
          ...(reach.object ? {} : { rows: { reach: reachKey(variant.keys) } }),
        });
        for (const operator of VISUAL_OPERATORS) {
          if (!has(`v:${operator}`) && !has(operator === "x" ? "v:d" : `v:${operator}`)) continue;
          push([entry, ...variant.keys, ...splitMotion(operator)], [entry, ...variant.atoms, `v:${operator}`], variant.counted, null, undefined, merge(splitMotion(operator)));
        }
        for (const operator of VISUAL_INSERTS) {
          if (!has(`v:${operator}`)) continue;
          for (const span of spans) {
            const prefix = [entry, ...variant.keys, operator];
            push([...prefix, ...span, "Escape"], [entry, ...variant.atoms, `v:${operator}`], variant.counted, null, prefix.length, merge([operator, ...span]));
          }
        }
        if (has("v:r{c}")) {
          for (const char of chars) push([entry, ...variant.keys, "r", char], [entry, ...variant.atoms, "v:r{c}"], variant.counted, null, undefined, merge(["r", char]));
        }
      }
    }
  }

  // The canonical's own Ex lines, whole.
  for (const line of parsed.lines) {
    if (line.prefix === ":") push([":", ...line.keys, "Enter"], [`:${line.keys.join("")}`]);
  }

  // An action is an edit unless it only moves, scrolls, or yanks. `typed` is
  // the set of characters it types, which the search uses to bound the cost of
  // the last edit a route can make.
  for (const action of actions) {
    action.edit = action.atoms.some(atom => EDIT_ATOMS.test(atom));
    action.typed = typedCharacters(action);
  }
  const result = dedupeActions(actions);
  result.pasteMatters = need.paste || need.yank;
  return result;
}

/**
 * The core of an exercise's actions, for a second, deeper search when the
 * full one runs out of budget: line and word motions, the operators and
 * standalone edits, typed text, and the canonical's own Ex lines, with counts
 * up to 3. No Visual selections, searches, character finds, or other text
 * objects. A route found in it is as real as any other; finding none proves
 * nothing about the full grammar.
 */
const CORE_MOTIONS = new Set(["h", "j", "k", "l", "w", "b", "e", "0", "^", "$", "G", "gg", "iw", "aw"]);
const MOTION_ATOMS = new Set([...PLAIN_MOTIONS, ...TEXT_OBJECTS, ...SCROLLS, "f{c}", "F{c}", "t{c}", "T{c}", "/", "?", "/offset", "?offset", "op+search"]);

export function coreActions(actions) {
  return actions.filter(action => {
    if (action.counted) return false;
    if (action.atoms.some(atom => ["v", "V", "Ctrl-v"].includes(atom))) return false;
    if (action.atoms.some(atom => MOTION_ATOMS.has(atom) && !CORE_MOTIONS.has(atom))) return false;
    if (!action.atoms.includes("count") || action.atoms.includes("G") || action.atoms.includes("gg")) return true;
    const digits = action.keys.join("").match(/\d+/);
    return !digits || Number(digits[0]) <= 3;
  });
}

/**
 * Whether a character find can land from this state: the character has to be
 * on the cursor's line in the right direction, often enough for the count. A
 * find that fails leaves the state unchanged, so it is never worth replaying.
 */
export function findCanLand(find, text, cursor) {
  const line = text.split("\n")[cursor[0]] ?? "";
  const forward = find.kind === "f" || find.kind === "t";
  const side = forward ? line.slice(cursor[1] + 1) : line.slice(0, cursor[1]);
  // Deliberately permissive: a `t` to the adjacent character is replayed even
  // though it may not move, because wrongly skipping a find would hide routes.
  return side.split(find.char).length - 1 >= find.count;
}

function typedCharacters(action) {
  const typed = new Set();
  const { keys } = action;
  const escape = keys.lastIndexOf("Escape");
  const enter = keys.lastIndexOf("Enter");
  let from = -1;
  let to = -1;
  if (escape !== -1) {
    // Typed text runs from the insert entry to Escape. Entries are one or two
    // keys after the operator and motion, so take everything that is a literal
    // character between the last command key and Escape.
    from = action.spanStart ?? 0;
    to = escape;
  } else if (keys[0] === ":" && enter !== -1) {
    from = 1;
    to = enter;
  } else if (action.atoms.includes("r{c}") || action.atoms.includes("v:r{c}")) {
    typed.add(keys[keys.length - 1]);
    return typed;
  }
  for (let index = from; index >= 0 && index < to; index += 1) {
    if (keys[index].length === 1) typed.add(keys[index]);
    else if (keys[index] === "Enter") typed.add("\n");
    else if (keys[index] === "Tab") typed.add("\t");
  }
  return typed;
}

function splitMotion(motion) {
  if (motion.startsWith("Ctrl-")) return [motion];
  if (motion === "g Ctrl-a") return ["g", "Ctrl-a"];
  return motion.split("");
}

function dedupeActions(actions) {
  const byKeys = new Map();
  for (const action of actions) {
    const key = action.keys.join("\u0000");
    const existing = byKeys.get(key);
    if (!existing || (existing.counted && !action.counted)) byKeys.set(key, action);
  }
  return [...byKeys.values()];
}

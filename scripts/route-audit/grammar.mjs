/* Grammar: splits a recorded key stream into the logical commands a learner
 * typed, so the audit can tell which commands the course has taught.
 *
 * Every key arrives with the mode the editor was in before it ran. A key sent
 * in Normal, Visual, or operator-pending mode is a command; a key sent in
 * Insert, Replace, or command-line mode is literal text. That distinction is
 * why this needs a replay: `t` first appears in the course as a typed letter,
 * long before it is taught as a motion.
 *
 * Atoms are the unit of "taught": a motion (`w`, `f{c}`), an operator (`c`), a
 * text object (`i(`), a standalone command (`C`), an insert entry (`A`), an Ex
 * command (`:s`), or a search (`/`). Visual-mode commands carry a `v:` prefix
 * and Insert-mode controls an `i:` prefix, because `u` in Visual mode and `u`
 * in Normal mode are different lessons.
 */

export const COMMAND_MODES = new Set(["normal", "visual", "visual-line", "visual-block", "operator-pending"]);
const VISUAL_MODES = new Set(["visual", "visual-line", "visual-block"]);

export const OPERATORS = ["d", "c", "y", ">", "<", "=", "g~", "gu", "gU", "gq", "gw", "g?", "!", "zf"];
// Keys that take one following character as an argument.
const CHAR_MOTIONS = new Set(["f", "F", "t", "T"]);
const MARK_MOTIONS = new Set(["`", "'"]);
export const SIMPLE_MOTIONS = [
  "h", "j", "k", "l", "w", "W", "b", "B", "e", "E", "0", "^", "$", "|", "G", "-", "+",
  ";", ",", "%", "(", ")", "{", "}", "H", "M", "L", "n", "N", "*", "#", "_",
  "gg", "ge", "gE", "g_", "gj", "gk", "gm", "go", "g*", "g#", "gn", "gN",
  "[[", "]]", "[]", "][", "[(", "])", "[{", "]}",
];
const SCROLLS = ["Ctrl-f", "Ctrl-b", "Ctrl-d", "Ctrl-u", "Ctrl-e", "Ctrl-y", "zt", "zz", "zb", "z.", "z-", "z\n"];
const JUMPS = ["Ctrl-o", "Ctrl-i", "g;", "g,", "gv", "gi"];
const STANDALONE = [
  "x", "X", "D", "C", "S", "s", "J", "gJ", "~", "p", "P", "gp", "gP", "Y", ".", "u", "U", "Ctrl-r",
  "Ctrl-a", "Ctrl-x", "g&", "&", "i", "a", "I", "A", "o", "O", "gI", "R", "v", "V", "Ctrl-v",
  "Escape", "Ctrl-[", "ZZ", "gx", "g Ctrl-a", "g Ctrl-x", "@@", "@:",
];
const CHAR_COMMANDS = new Set(["r", "m", "q", "@", "\""]);
const MULTI_KEY_PREFIXES = new Set(["g", "z", "[", "]", "Z"]);
const VISUAL_OBJECT_PREFIXES = new Set(["i", "a"]);

const BRACKET_OBJECTS = { ")": "(", b: "(", "]": "[", "}": "{", B: "{", ">": "<" };

export function normalizeObject(prefix, char) {
  return `${prefix}${BRACKET_OBJECTS[char] || char}`;
}

const EX_ALIASES = {
  s: "s", su: "s", sub: "s", substitute: "s",
  g: "g", gl: "g", global: "g", v: "v", vg: "v", vglobal: "v",
  norm: "normal", normal: "normal",
  d: "d", de: "d", del: "d", delete: "d",
  y: "y", ya: "y", yank: "y",
  pu: "put", put: "put",
  co: "t", copy: "t", t: "t",
  m: "m", mo: "m", move: "m",
  j: "j", jo: "j", join: "j",
  sor: "sort", sort: "sort",
  p: "p", pr: "p", print: "p", nu: "nu", number: "nu", "#": "nu",
  reg: "registers", registers: "registers", di: "registers", display: "registers",
  "&": "&", "&&": "&", "~": "~",
};

// The command name of an Ex line after its range: `:%s/a/b/` names `s`.
export function exCommandName(line) {
  const range = /^(?:\s|[%.$,;]|\d+|'[a-z<>]|\/(?:\\.|[^/])*\/|\?(?:\\.|[^?])*\?|[+-]\d*)*/;
  const rest = line.replace(range, "");
  const match = rest.match(/^([a-zA-Z]+|&&?|~|#|!|<|>|=)/);
  if (!match) return rest ? rest[0] : "range";
  const name = match[1];
  if (EX_ALIASES[name]) return EX_ALIASES[name];
  // `:s` flags run on without a separator (`:sg`), so try the longest known
  // prefix before giving up.
  for (let length = name.length - 1; length > 0; length -= 1) {
    const prefix = name.slice(0, length);
    if (EX_ALIASES[prefix] && ["s", "g", "v"].includes(EX_ALIASES[prefix])) return EX_ALIASES[prefix];
  }
  return name;
}

function literalFor(key) {
  if (key === "Enter") return "\n";
  if (key === "Tab") return "\t";
  return key.length === 1 ? key : null;
}

/**
 * Parse a trace of `{ key, mode }` entries into logical commands.
 * Returns `{ commands, insertRuns, lines }`:
 * - `commands`: `{ keys, atoms, count }` per Normal/Visual command,
 * - `insertRuns`: typed text (as key arrays) between entering and leaving Insert,
 * - `lines`: Ex and search command lines as `{ prefix, keys }`.
 */
export function parseTrace(trace) {
  const commands = [];
  const insertRuns = [];
  const lines = [];
  let index = 0;
  let recording = false;
  let run = null;

  const at = offset => trace[index + offset];
  const isCommand = entry => entry && COMMAND_MODES.has(entry.mode);
  const closeRun = () => {
    if (run?.length) insertRuns.push(run);
    run = null;
  };

  while (index < trace.length) {
    const entry = trace[index];
    if (!isCommand(entry)) {
      // Insert, Replace, or command-line text reached outside a parsed
      // command, for example after a setup that already opened Insert mode.
      consumeLiteral();
      continue;
    }
    closeRun();
    const start = index;
    const atoms = [];
    const visual = VISUAL_MODES.has(entry.mode);
    const prefix = visual ? "v:" : "";
    let count = null;

    const readCount = () => {
      let digits = "";
      while (isCommand(at(0)) && /^[0-9]$/.test(at(0).key) && (digits || at(0).key !== "0")) {
        digits += at(0).key;
        index += 1;
      }
      if (digits) {
        count = Number(digits);
        atoms.push("count");
      }
    };

    readCount();
    if (isCommand(at(0)) && at(0).key === "\"" && at(1)) {
      atoms.push(`register:${at(1).key}`);
      atoms.push("\"");
      index += 2;
      readCount();
    }
    const head = readHead();
    if (head === null) {
      index = Math.max(index, start + 1);
      continue;
    }

    if (OPERATORS.includes(head) && !visual) {
      readCount();
      const tail = readHead({ operatorPending: true, operator: head });
      // `dd`, `gUU`, and `>>` are commands of their own, not the operator
      // applied to a motion, so they are taught separately.
      if (tail === head) atoms.push(doubled(head));
      else {
        atoms.push(head);
        if (tail === "/" || tail === "?") {
          atoms.push("op+search");
          readLine(tail, false, atoms);
        }
        else if (tail !== null) atoms.push(tail);
      }
      if (head === "c") startRunAfter();
    } else if (head === ":" || head === "/" || head === "?") {
      readLine(head, visual, atoms);
    } else {
      atoms.push(visual && !isMotion(head) ? `${prefix}${head}` : head);
      if (["i", "a", "I", "A", "o", "O", "s", "S", "C", "R", "gI", "gi"].includes(head) && !visual) startRunAfter();
      if (visual && ["c", "s", "I", "A", "C", "S", "R"].includes(head)) startRunAfter();
    }
    commands.push({ keys: keysFrom(start), atoms: dedupe(atoms), count });
  }
  closeRun();
  return { commands, insertRuns, lines };

  function doubled(operator) {
    const last = operator.slice(-1);
    return operator.length === 1 ? `${operator}${operator}` : `${operator}${last}`;
  }

  function isMotion(head) {
    return SIMPLE_MOTIONS.includes(head) || SCROLLS.includes(head) || /^[fFtT]\{c\}$/.test(head)
      || head.startsWith("mark") || head === "/" || head === "?";
  }

  function keysFrom(start) {
    return trace.slice(start, index).map(item => item.key);
  }

  function startRunAfter() {
    run = [];
  }

  function consumeLiteral() {
    const entry = trace[index];
    index += 1;
    if (entry.key === "Escape" || entry.key === "Ctrl-[") {
      closeRun();
      return;
    }
    if (entry.mode === "insert" || entry.mode === "replace") {
      if (entry.key === "Ctrl-r" || entry.key === "Ctrl-o") {
        commands.push({ keys: [entry.key], atoms: [`i:${entry.key}`], count: null });
        if (entry.key === "Ctrl-r" && trace[index]) index += 1;
        return;
      }
      if (["Ctrl-w", "Ctrl-u", "Backspace"].includes(entry.key)) {
        commands.push({ keys: [entry.key], atoms: [`i:${entry.key}`], count: null });
        return;
      }
      const literal = literalFor(entry.key);
      if (literal !== null) {
        run ??= [];
        run.push(entry.key);
      }
    }
  }

  function readLine(head, visual, atoms) {
    const keys = [];
    while (index < trace.length && trace[index].mode === "command-line") {
      const { key } = trace[index];
      index += 1;
      if (key === "Enter" || key === "Escape" || key === "Ctrl-[") {
        if (key === "Enter") lines.push({ prefix: head, keys });
        break;
      }
      keys.push(key);
    }
    const text = keys.join("");
    if (head === ":") atoms.push(`${visual ? "v:" : ""}:${exCommandName(text.replace(/^'<,'>/, ""))}`);
    else atoms.push(/(^|[^\\])[/?][esb+-]/.test(text) ? `${head}offset` : head);
  }

  // Reads one head token (a motion, operator, text object, or command) and
  // returns its atom id, or null when the keys do not form a command.
  function readHead({ operatorPending = false, operator = null } = {}) {
    const first = at(0);
    if (!isCommand(first)) return null;
    const key = first.key;
    index += 1;
    // The operator's last key again doubles it (`dd`, `gqq`, `g~~`); this has
    // to win over `q` starting a recording.
    if (operatorPending && operator && key === operator.slice(-1)) return operator;
    if (operatorPending && VISUAL_OBJECT_PREFIXES.has(key) && at(0)) {
      const char = at(0).key;
      index += 1;
      return normalizeObject(key, char);
    }
    if (operatorPending && ["v", "V", "Ctrl-v"].includes(key)) {
      const inner = readHead({ operatorPending: true, operator });
      return inner === null ? null : `force-${key}+${inner}`;
    }
    if (VISUAL_MODES.has(first.mode) && VISUAL_OBJECT_PREFIXES.has(key) && at(0) && isCommand(at(0))
      && /^[wWsp"'`()[\]{}<>bBt]$/.test(at(0).key)) {
      const char = at(0).key;
      index += 1;
      return normalizeObject(key, char);
    }
    if (CHAR_MOTIONS.has(key)) {
      if (at(0)) index += 1;
      return `${key}{c}`;
    }
    if (MARK_MOTIONS.has(key)) {
      if (at(0)) index += 1;
      return `mark${key}`;
    }
    if (CHAR_COMMANDS.has(key)) {
      if (key === "q" && recording) {
        recording = false;
        return "q";
      }
      const argument = at(0)?.key;
      if (argument !== undefined) index += 1;
      if (key === "q") {
        recording = true;
        return argument && /[A-Z]/.test(argument) ? "q{A}" : "q{r}";
      }
      if (key === "@") return argument === "@" ? "@@" : argument === ":" ? "@:" : "@{r}";
      if (key === "r") return "r{c}";
      if (key === "m") return "m{c}";
      return `"${argument}`;
    }
    if (MULTI_KEY_PREFIXES.has(key) && at(0)) {
      const second = at(0).key;
      const pair = `${key}${second === "Enter" ? "\n" : second}`;
      const known = [...SIMPLE_MOTIONS, ...SCROLLS, ...JUMPS, ...STANDALONE, ...OPERATORS].includes(pair)
        || (operator && pair === operator.slice(-1).repeat(2));
      if (known || key === "g" || key === "z") {
        index += 1;
        if (pair === "g" + "Ctrl-a" || pair === "gCtrl-a") return "g Ctrl-a";
        if (pair === "gCtrl-x") return "g Ctrl-x";
        // A doubled g-operator (`gUU`, `g~~`) finishes with its last key.
        if (operator && operator.startsWith("g") && second === operator.slice(-1)) return operator;
        if (operator && operator.startsWith("g") && pair === operator) return operator;
        return pair;
      }
    }
    if (operator && key === operator.slice(-1)) return operator;
    return key;
  }
}

function dedupe(values) {
  return [...new Set(values)];
}

/** All atoms a parsed trace uses. */
export function atomsOf(parsed) {
  const atoms = new Set();
  for (const command of parsed.commands) command.atoms.forEach(atom => atoms.add(atom));
  return atoms;
}

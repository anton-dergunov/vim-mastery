/* Search: a bounded best-first search for a route shorter than the canonical.
 *
 * The search runs here; the page only replays paths (`evaluate`). A path is
 * expanded level by level in key cost, so each level is one batch and the
 * first level with a match holds every shortest route. States are compared by
 * text, cursor, mode, the registers that matter, the viewport when the
 * exercise has one, and the hidden state a taught repeat command reads.
 *
 * A route whose advantage needs a count of COUNTED_FROM or more is kept apart
 * as "counted": it is reported, but it does not beat the canonical.
 */

import { findCanLand } from "./actions.mjs";

// Characters a route can produce without typing them, given its actions:
// increments make digits and signs, case commands flip letters, and joins,
// indents, and opened lines make whitespace.
function freeCharacters(actions) {
  const atoms = new Set(actions.flatMap(action => action.atoms.map(atom => atom.replace(/^v:/, ""))));
  const has = list => list.some(atom => atoms.has(atom));
  return {
    digits: has(["Ctrl-a", "Ctrl-x", "g Ctrl-a", "g Ctrl-x"]),
    fold: has(["~", "g~", "gu", "gU", "g~~", "guu", "gUU", "u", "U"]),
    space: has(["J", "gJ", ">", "<", ">>", "<<", "=", "==", "o", "O", "gq", "gw", "gqq", "gww"]),
  };
}

// A lower bound on the keys still needed: every character the target needs
// that exists nowhere in the buffer or the registers has to be typed, and
// typing needs at least one key to start.
function missingCharacters(result, targetText, free) {
  const normalize = char => (free.fold ? char.toLowerCase() : char);
  const pool = new Set([...result.text].map(normalize));
  for (const register of Object.values(result.registers || {})) {
    for (const char of String(register?.text || "")) pool.add(normalize(char));
  }
  const missing = [];
  for (const raw of new Set(targetText)) {
    const char = normalize(raw);
    if (free.digits && /[0-9+-]/.test(char)) continue;
    if (free.space && /\s/.test(char)) continue;
    if (!pool.has(char) && !missing.includes(char)) missing.push(char);
  }
  return missing;
}

function heuristic(text, missing, targetText, editsLeft, actions) {
  if (text === targetText) return 0;
  if (editsLeft <= 0) return Infinity;
  if (!missing.length) return 1;
  if (editsLeft === 1) {
    let cheapest = Infinity;
    for (const action of actions) {
      if (action.keys.length < cheapest && missing.every(char => action.types.has(char))) cheapest = action.keys.length;
    }
    return cheapest;
  }
  return missing.length + 1;
}

// Edit distance between two buffers, measured only over the lines and the
// characters that differ, so long buffers with one changed row stay cheap.
export function textDistance(left, right) {
  if (left === right) return 0;
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start += 1;
  let end = 0;
  while (end < left.length - start && end < right.length - start
    && left[left.length - 1 - end] === right[right.length - 1 - end]) end += 1;
  const a = left.slice(start, left.length - end);
  const b = right.slice(start, right.length - end);
  if (!a.length || !b.length) return a.length + b.length;
  if (a.length * b.length > 250_000) return Math.max(a.length, b.length);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= b.length; column += 1) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * The lines of `text` a change has to touch to bring it closer to `target`:
 * from the end of their common prefix to the start of their common suffix.
 * Where repeated text makes that ambiguous (deleting either of two equal
 * lines), both readings count, the prefix taken first and the suffix first.
 */
export function differingRows(text, target) {
  if (text === target) return null;
  const prefix = limit => {
    let length = 0;
    while (length < limit && text[length] === target[length]) length += 1;
    return length;
  };
  const suffix = limit => {
    let length = 0;
    while (length < limit && text[text.length - 1 - length] === target[target.length - 1 - length]) length += 1;
    return length;
  };
  const shorter = Math.min(text.length, target.length);
  const firstPrefix = prefix(shorter);
  const firstSuffix = suffix(shorter - firstPrefix);
  const lastSuffix = suffix(shorter);
  const lastPrefix = prefix(shorter - lastSuffix);
  const from = Math.min(firstPrefix, lastPrefix);
  const to = Math.max(text.length - firstSuffix, text.length - lastSuffix);
  const rowOf = offset => text.slice(0, offset).split("\n").length - 1;
  return [rowOf(from), rowOf(Math.max(from, to - 1))];
}

/**
 * How the canonical changes the text: the number of edits (text changes seen
 * each time the editor is back in Normal mode) and whether any of them moves
 * the text away from the target first.
 */
export function editProfile(trace, startText, targetText) {
  let text = startText;
  let edits = 0;
  let worsens = false;
  trace.forEach((entry, index) => {
    const next = trace[index + 1];
    if (next && next.mode !== "normal") return;
    if (entry.text === text) return;
    edits += 1;
    if (textDistance(entry.text, targetText) > textDistance(text, targetText)) worsens = true;
    text = entry.text;
  });
  return { edits, worsens };
}

// How the last edit a route can make might type text, gathered once per
// exercise from its actions.
function finishers(actions) {
  const spans = new Set();
  const atoms = new Set();
  for (const action of actions) {
    action.atoms.forEach(atom => atoms.add(atom));
    const escape = action.keys.lastIndexOf("Escape");
    if (action.spanStart !== undefined && escape !== -1) {
      spans.add(action.keys.slice(action.spanStart, escape).map(key => (key === "Enter" ? "\n" : key === "Tab" ? "\t" : key)).join(""));
    }
  }
  return {
    spans: [...spans],
    blockInsert: atoms.has("Ctrl-v") && (atoms.has("v:I") || atoms.has("v:A")),
    exTyping: actions.some(action => action.keys[0] === ":"),
    replaceMode: atoms.has("R"),
    replaceChar: atoms.has("r{c}") || atoms.has("v:r{c}"),
    openLine: atoms.has("o") || atoms.has("O"),
  };
}

// With one edit left and characters still to type, that edit types one of the
// candidate spans, so the text before it must already be the target with that
// span removed or replaced: the target's text before the span and after it
// have to be in place. Anything else cannot finish and is not searched.
function canFinish(text, targetText, finish) {
  if (finish.blockInsert || finish.exTyping || finish.replaceMode) return true;
  if (finish.replaceChar && text.length === targetText.length) {
    let differences = 0;
    for (let index = 0; index < text.length && differences < 2; index += 1) if (text[index] !== targetText[index]) differences += 1;
    if (differences === 1) return true;
  }
  if (finish.openLine && text.split("\n").length === targetText.split("\n").length - 1) return true;
  for (const span of finish.spans) {
    for (let index = targetText.indexOf(span); index !== -1; index = targetText.indexOf(span, index + 1)) {
      const before = targetText.slice(0, index);
      const after = targetText.slice(index + span.length);
      if (text.length >= before.length + after.length && text.startsWith(before) && text.endsWith(after)) return true;
    }
  }
  return false;
}

// Where a motion lands, with the hidden state later keys can read. Merging
// two motions by landing must not merge what `;` or `n` would do next.
function landingKeyFor(allowed) {
  const watchFind = allowed.has(";") || allowed.has(",");
  const watchSearch = ["n", "N", "&", "g&", "gn", "gN"].some(atom => allowed.has(atom));
  return result => {
    const hidden = JSON.parse(result.hidden || "{}");
    return JSON.stringify([result.cursor, watchFind ? hidden.find : null, watchSearch ? hidden.search : null]);
  };
}

function stateKeyFor(exercise, allowed, pasteMatters) {
  const target = exercise.scenario.target;
  const registerNames = new Set(Object.keys(target.registers || {}));
  if (pasteMatters) registerNames.add("\"");
  const watchFind = allowed.has(";") || allowed.has(",");
  const watchSearch = ["n", "N", "&", "g&", "gn", "gN"].some(atom => allowed.has(atom));
  const watchEdit = allowed.has(".");
  const watchEx = ["&", "g&", "@:"].some(atom => allowed.has(atom));
  const watchViewport = Boolean(exercise.editor?.viewportRows);
  // `watchEdit` is passed per state: once the one edit a route has left must
  // type characters `.` cannot supply, what `.` would repeat no longer matters.
  return (result, repeatMatters = true) => {
    const hidden = JSON.parse(result.hidden || "{}");
    return JSON.stringify([
      result.text,
      result.cursor,
      result.mode,
      [...registerNames].sort().map(name => [name, result.registers?.[name]?.text ?? null, result.registers?.[name]?.type ?? null]),
      watchViewport ? [result.viewport.topLine, result.viewport.bottomLine] : null,
      watchFind ? hidden.find : null,
      watchSearch ? hidden.search : null,
      watchEdit && repeatMatters ? [hidden.edit, hidden.insert] : null,
      watchEx ? hidden.ex : null,
      hidden.column ?? null,
    ]);
  };
}

/**
 * @param exercise   the authored exercise
 * @param actions    from buildActions
 * @param allowed    taught atom set
 * @param evaluate   async (paths) => results, replayed in the page
 * @param options    { maxEvaluations, maxMilliseconds, batchSize }
 */
export async function searchShorter(exercise, actions, allowed, evaluate, options = {}) {
  const { maxEvaluations = 60_000, maxMilliseconds = 180_000, batchSize = 150, maxEdits = Infinity, allowWorsen = true, merge = true, rowFilter = true } = options;
  const canonicalCost = exercise.script.steps.length;
  const bound = canonicalCost - 1;
  const targetText = exercise.scenario.target.lines.join("\n");
  const targetMode = exercise.scenario.target.mode;
  const stateKey = stateKeyFor(exercise, allowed, actions.pasteMatters);
  const landingKey = landingKeyFor(allowed);
  // An operator applied to a motion is repeated by `.` with that motion, so
  // two motions that land together today can repeat differently later. Such
  // edits merge only when no edit can follow them.
  const dotTaught = allowed.has(".");
  const free = freeCharacters(actions);
  const finish = finishers(actions);
  // Missing characters are compared case-folded when case commands exist, so
  // what an action types is folded the same way.
  for (const action of actions) {
    action.types = free.fold ? new Set([...action.typed].map(char => char.toLowerCase())) : action.typed;
  }
  const startedAt = Date.now();
  const visited = new Map();
  const routes = [];
  const counted = [];
  let evaluated = 0;
  let reachedCost = 0;
  let budgetHit = false;

  // Nodes are linked to their parent, so memory holds one action per state
  // reached rather than every path; a level's children are generated only
  // when that level is searched.
  const byLength = new Map();
  for (const action of actions) {
    if (!byLength.has(action.keys.length)) byLength.set(action.keys.length, []);
    byLength.get(action.keys.length).push(action);
  }
  const expandedByCost = new Map();
  const pathOf = node => {
    const parts = [];
    for (let cursor = node; cursor.action; cursor = cursor.parent) parts.push(cursor.action.keys);
    return parts.reverse().flat();
  };
  function* childrenAt(cost) {
    for (const [length, group] of byLength) {
      for (const parent of expandedByCost.get(cost - length) || []) {
        for (const action of group) {
          if (action.find && !findCanLand(action.find, parent.text, parent.cursor)) continue;
          // With no edits left only motions can help; with one left, only an
          // edit that types every missing character can.
          if (action.edit && parent.editsLeft <= 0) continue;
          if (action.edit && parent.editsLeft === 1 && parent.missing.length
            && !parent.missing.every(char => action.types.has(char))) continue;
          // Bound the child before replaying it. A motion or yank cannot type
          // anything, so it keeps its parent's estimate; an edit that does not
          // type every missing character leaves one edit fewer to type them.
          if (cost + (action.edit ? estimateAfterEdit(parent, action) : parent.estimate) > bound) continue;
          // When this edit may not move the text away from the target (no
          // slack left, or it is the last edit), it has to change a line
          // that still differs, give or take the line next to it (a join, a
          // put, an opened line). Where it acts is known before replaying it
          // for most commands; the rest are always replayed.
          if (rowFilter && action.edit && action.rows && parent.rowsToFix && (parent.editsLeft === 1 || !allowWorsen || parent.slack)) {
            const row = parent.cursor[0];
            let low = row;
            let high = row + (action.rows.count || 1) - 1;
            if (action.rows.reach) {
              const landing = parent.landingRows?.get(action.rows.reach);
              if (landing === undefined) {
                low = -Infinity;
                high = Infinity;
              } else {
                low = Math.min(row, landing);
                high = Math.max(row, landing);
              }
            }
            if (high + 1 < parent.rowsToFix[0] || low - 1 > parent.rowsToFix[1]) continue;
          }
          // Commands that differ only in a motion that lands in the same
          // place change the same text; the cheapest one stands for all.
          if (merge && action.group && !(action.repeatable && dotTaught && parent.editsLeft > 1)) {
            const landing = parent.landings?.get(action.reach);
            if (landing !== undefined && landing !== parent.selfLanding) {
              const merged = `${action.group}\u0002${landing}`;
              parent.merged ??= new Set();
              if (parent.merged.has(merged)) continue;
              parent.merged.add(merged);
            }
          }
          yield { parent, action, cost, counted: parent.counted || action.counted, slack: parent.slack, edits: parent.edits };
        }
      }
    }
  }
  const coverCost = new Map();
  const estimateAfterEdit = (parent, action) => {
    const remaining = parent.missing.filter(char => !action.types.has(char));
    if (!remaining.length) return 0;
    const editsLeft = parent.editsLeft - 1;
    if (editsLeft <= 0) return Infinity;
    if (editsLeft > 1) return remaining.length + 1;
    const key = remaining.join("");
    if (!coverCost.has(key)) coverCost.set(key, heuristic(null, remaining, targetText, 1, actions));
    return coverCost.get(key);
  };
  const describeState = (node, result) => {
    node.rowsToFix = differingRows(result.text, targetText);
    node.text = result.text;
    node.cursor = result.cursor;
    node.selfLanding = landingKey(result);
    node.missing = missingCharacters(result, targetText, free);
    node.editsLeft = maxEdits - node.edits;
  };
  const repeatMatters = node => node.editsLeft >= 2 || (node.editsLeft === 1 && !node.missing.length);
  const expand = node => {
    const estimate = heuristic(node.text, node.missing, targetText, node.editsLeft, actions);
    if (node.cost + estimate > bound) return;
    node.estimate = estimate;
    if (!expandedByCost.has(node.cost)) expandedByCost.set(node.cost, []);
    expandedByCost.get(node.cost).push(node);
  };
  // A node carries its handicaps: whether it used a large count, whether it
  // spent its one edit away from the target, and how many edits it has made.
  // A state reached earlier with no more of any of them dominates this node.
  //
  // A node that ties with the one kept (same state, same handicaps, same
  // cost) is remembered as its alternative. Two commands can reach the same
  // state in the app's adapter while only one of them does in native Vim, and
  // the route through the other must not be lost when native Vim rejects the
  // first (`g~j` on the last line changes nothing in Vim; `g~$` does the same
  // work in both).
  const visit = (key, node) => {
    const seenLabels = visited.get(key) || [];
    const label = [node.counted ? 1 : 0, node.slack ? 1 : 0, node.edits];
    for (const seen of seenLabels) {
      if (!seen.label.every((value, index) => value <= label[index])) continue;
      if (seen.node.cost === node.cost && seen.label.every((value, index) => value === label[index])) {
        seen.node.alternatives ??= [];
        if (seen.node.alternatives.length < 6) seen.node.alternatives.push(node);
      }
      return false;
    }
    seenLabels.push({ label, node });
    visited.set(key, seenLabels);
    return true;
  };

  const [start] = await evaluate([[]]);
  evaluated += 1;
  const root = { parent: null, action: null, cost: 0, counted: false, slack: false, edits: 0, distance: textDistance(start.text, targetText) };
  describeState(root, start);
  visit(stateKey(start, repeatMatters(root)), root);
  if (start.match) return { verdict: "trivial", canonicalCost, routes: [], counted: [], evaluated, reachedCost: 0, samplePaths: [] };
  expand(root);
  // A reservoir of replayed paths, so the audit can check that the reused
  // editor behaves like a fresh one on a spread of this exercise's states.
  const samplePaths = [];
  const sample = path => {
    if (samplePaths.length < 40) samplePaths.push(path);
    else {
      const slot = Math.floor(Math.random() * evaluated);
      if (slot < samplePaths.length) samplePaths[slot] = path;
    }
  };

  for (let cost = 1; cost <= bound && !budgetHit; cost += 1) {
    let batch = [];
    const flush = async () => {
      const paths = batch.map(pathOf);
      const results = await evaluate(paths);
      evaluated += batch.length;
      results.forEach((result, index) => {
        const node = batch[index];
        sample(paths[index]);
        if (result.error) return;
        // A motion's landing is recorded on its parent before anything prunes
        // it, for merging the commands that use the same motion.
        if (node.action.reachId && !result.pending && result.mode === "normal") {
          node.parent.landings ??= new Map();
          node.parent.landings.set(node.action.reachId, landingKey(result));
          node.parent.landingRows ??= new Map();
          node.parent.landingRows.set(node.action.reachId, result.cursor[0]);
        }
        if (result.match) {
          (node.counted ? counted : routes).push(node);
          return;
        }
        if (result.pending || (result.mode !== "normal" && result.mode !== targetMode)) return;
        // An edit that changed nothing only rewrites what `.` would repeat,
        // and a repeat of it would change nothing too.
        if (node.action.edit && result.text === node.parent.text) return;
        // A route may make one more edit than the canonical, and the last
        // edit it can make has to land on the target text.
        if (result.text !== node.parent.text) node.edits += 1;
        if (node.edits > maxEdits || (node.edits === maxEdits && result.text !== targetText)) return;
        // It may move the text away from the target once (a cut before a put,
        // a join before a split), and only when the canonical does too.
        node.distance = textDistance(result.text, targetText);
        if (node.distance > node.parent.distance) {
          if (node.slack || !allowWorsen) return;
          node.slack = true;
        }
        describeState(node, result);
        if (node.editsLeft === 1 && node.missing.length && !canFinish(result.text, targetText, finish)) return;
        if (!visit(stateKey(result, repeatMatters(node)), node)) return;
        expand(node);
      });
      batch = [];
    };
    for (const child of childrenAt(cost)) {
      batch.push(child);
      if (batch.length < batchSize) continue;
      if (evaluated >= maxEvaluations || Date.now() - startedAt > maxMilliseconds) {
        budgetHit = true;
        break;
      }
      await flush();
    }
    if (budgetHit) break;
    if (batch.length) await flush();
    reachedCost = cost;
    if (options.onLevel) {
      options.onLevel({
        cost,
        evaluated,
        states: visited.size,
        texts: new Set([...visited.keys()].map(key => JSON.parse(key)[0])).size,
        sample: [...visited.keys()].slice(-6),
        elapsedMs: Date.now() - startedAt,
      });
    }
    if (routes.length) break;
  }

  const describeActions = used => ({
    keys: used.flatMap(action => action.keys),
    cost: used.reduce((total, action) => total + action.keys.length, 0),
    commands: used.map(action => action.keys.join("")),
    distinctCommands: new Set(used.map(action => action.keys.join(""))).size,
    atoms: [...new Set(used.flatMap(action => action.atoms))],
  });
  // Every spelling of a route through tied nodes, up to `limit`, the kept
  // one first.
  const spellings = (node, limit) => {
    if (!node.action) return [[]];
    const found = [];
    for (const variant of [node, ...(node.alternatives || [])]) {
      for (const prefix of spellings(variant.parent, limit - found.length)) {
        found.push([...prefix, variant.action]);
        if (found.length >= limit) return found;
      }
    }
    return found;
  };
  const describe = node => {
    const [primary, ...others] = spellings(node, 24).map(describeActions);
    return { ...primary, alternatives: others };
  };
  const rank = (left, right) => left.cost - right.cost || left.distinctCommands - right.distinctCommands;
  const found = routes.map(describe).sort(rank);
  const countedFound = counted.map(describe).sort(rank).slice(0, 3);
  const verdict = found.length ? "shorter" : budgetHit ? "inconclusive" : "none-shorter";
  return {
    verdict,
    canonicalCost,
    routes: found.slice(0, 5),
    counted: countedFound,
    evaluated,
    reachedCost,
    elapsedMs: Date.now() - startedAt,
    samplePaths,
  };
}

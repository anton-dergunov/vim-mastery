#!/usr/bin/env node
/* Rebuild: recompute an exercise's target and checkpoints from native Vim
 * after its buffer, cursor, or keys change, so a re-authored exercise stays
 * consistent with the Vim that judges it.
 *
 *   node scripts/route-audit/rebuild.mjs < jobs.json > patches.json
 *
 * Each job is `{ activity, lines?, cursor?, steps?, registers? }`: the authored
 * activity plus what changes. `registers` names the registers the target
 * should check. The output is, per job, the new `scenario` and `script`
 * (steps, groups untouched, checkpoints recomputed with the fields each
 * checkpoint already asserted).
 */

import process from "node:process";
import { runNativeVim } from "../../tests/native-vim-runner.mjs";

const keyOf = step => (typeof step === "string" ? step : step.key);
const input = JSON.parse(await new Promise(done => {
  let text = "";
  process.stdin.on("data", chunk => { text += chunk; });
  process.stdin.on("end", () => done(text));
}));

// Boundaries that fall inside a `:`, `/`, or `?` command line.
function commandLineBoundaries(keys) {
  const inside = new Set();
  let open = false;
  keys.forEach((key, index) => {
    const previous = keys[index - 1];
    if (!open && [":", "/", "?"].includes(key) && !["f", "F", "t", "T", "r", "m", "'", "`", "\"", "q", "@"].includes(previous)) open = true;
    else if (open && (key === "Enter" || key === "Escape")) open = false;
    if (open) inside.add(index + 1);
  });
  return inside;
}

const output = input.map(job => {
  const activity = structuredClone(job.activity);
  const scenario = activity.scenario;
  if (job.lines) scenario.initial.lines = job.lines;
  if (job.cursor) scenario.initial.cursor = job.cursor;
  if (job.steps) activity.script.steps = job.steps;
  const keys = activity.script.steps.map(keyOf);
  const setupKeys = (scenario.initial.setup?.steps || []).map(keyOf);
  const cursor = scenario.initial.setup?.cursor || scenario.initial.cursor;
  const registerNames = job.registers || Object.keys(scenario.target.registers || {});
  const run = count => runNativeVim({
    initialCode: scenario.initial.lines,
    cursor,
    setupKeys,
    keys: keys.slice(0, count),
    fileName: activity.fileName,
    textWidth: activity.editor?.textWidth,
    registerNames,
    // Headless Vim has no clipboard; `"+` stands in for a named register, as
    // in the content tests.
    registerAliases: { "+": "z" },
  });
  // Headless Vim also ends Visual mode when its keys run out, without moving
  // the cursor. A yank into an unused register lands only when a selection is
  // open, and the mode is whichever Visual entry came last.
  const visualModeAt = count => {
    const probe = runNativeVim({
      initialCode: scenario.initial.lines, cursor, setupKeys, keys: [...keys.slice(0, count), "\"", "z", "y"],
      fileName: activity.fileName, textWidth: activity.editor?.textWidth, registerNames: ["z"],
    });
    if (!probe.registers.z?.text) return null;
    const entry = keys.slice(0, count).findLast(key => ["v", "V", "Ctrl-v"].includes(key));
    return { v: "visual", V: "visual-line", "Ctrl-v": "visual-block" }[entry] || null;
  };
  const final = run(keys.length);
  scenario.target.lines = final.code;
  scenario.target.cursor = final.cursor;
  scenario.target.mode = final.mode;
  if (registerNames.length) {
    scenario.target.registers = Object.fromEntries(registerNames.map(name => [name, final.registers[name]]));
  }
  // New keys invalidate the old checkpoint positions, so they are rebuilt at
  // every command-group boundary with lines, cursor, and mode.
  if (job.steps || job.commandGroups) {
    if (job.commandGroups) activity.script.commandGroups = job.commandGroups;
    const onLine = commandLineBoundaries(keys);
    activity.script.checkpoints = activity.script.commandGroups.filter(group => {
      if (group.to === keys.length) return true;
      // Headless Vim ends Insert mode when its keys run out, so a boundary
      // inside a text run cannot be checked natively. A probe character that
      // lands in the buffer shows that Insert or Replace mode was still open.
      if (onLine.has(group.to)) return false;
      const probe = runNativeVim({
        initialCode: scenario.initial.lines, cursor, setupKeys, keys: [...keys.slice(0, group.to), "\u00a7"],
        fileName: activity.fileName, textWidth: activity.editor?.textWidth,
      });
      return !probe.code.join("\n").includes("\u00a7");
    }).map(group => {
      const state = run(group.to);
      const checkpoint = { afterStep: group.to };
      checkpoint.lines = state.code;
      checkpoint.cursor = state.cursor;
      checkpoint.mode = group.to < keys.length ? visualModeAt(group.to) || state.mode : state.mode;
      return checkpoint;
    });
    return { id: activity.id, scenario, script: activity.script };
  }
  activity.script.checkpoints = activity.script.checkpoints.map(checkpoint => {
    const state = run(checkpoint.afterStep);
    const next = { ...checkpoint };
    if ("lines" in checkpoint || checkpoint.afterStep === keys.length) next.lines = state.code;
    if ("cursor" in checkpoint) next.cursor = state.cursor;
    if ("mode" in checkpoint) next.mode = state.mode;
    if ("registers" in checkpoint) {
      next.registers = Object.fromEntries(Object.keys(checkpoint.registers).map(name => [name, state.registers[name]]));
    }
    return next;
  });
  return { id: activity.id, scenario, script: activity.script };
});

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

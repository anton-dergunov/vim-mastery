#!/usr/bin/env node
/* Route audit: for every exercise, search for a route shorter than the taught
 * one, using only commands the course has taught by then, and replaying every
 * candidate in the app's own Vim adapter.
 *
 *   npm run audit:routes                         whole course, writes the report
 *   npm run audit:routes -- --unit 5             one unit, prints results
 *   npm run audit:routes -- --activity change-after-colon
 *   npm run audit:routes -- --print-taught       first use of every command
 *
 *   npm run audit:routes -- --unit 8 --offset 24 --limit 24 --update
 *                                                merge a slice into the report
 *
 * Options: --budget <evaluations> --seconds <per exercise> --pages <n>
 * --extra-edits <n> (edits a route may make beyond the canonical's, default 1)
 * --out <file> (filtered runs print only unless given) --update --no-native
 * --layout-only (exercises with a fixed viewport or wrap width)
 * --phase <isolate|mix|challenge> --verdict <verdict in the committed report>.
 *
 * The course trace is cached under node_modules/.cache/route-audit, keyed by
 * the content and the audit's own sources, so slices do not replay it.
 *
 * It starts its own Vite server and headless Chrome and closes both on exit.
 * It is not part of `npm test`.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import { runNativeVim } from "../../tests/native-vim-runner.mjs";
import { buildActions, COUNTED_FROM } from "./actions.mjs";
import { parseTrace } from "./grammar.mjs";
import { renderMarkdown } from "./report.mjs";
import { editProfile, searchShorter } from "./search.mjs";
import { buildTaughtIndex, keyOf, keysOf, loadCourse, orderedRunnables } from "./taught.mjs";

const root = resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1];
};
const flag = name => argv.includes(name);

const port = option("--port", "4177");
const origin = `http://127.0.0.1:${port}`;
const unitFilter = option("--unit", null);
const activityFilter = option("--activity", null);
const maxEvaluations = Number(option("--budget", "60000"));
const maxMilliseconds = Number(option("--seconds", "180")) * 1000;
const pageCount = Math.max(1, Number(option("--pages", "1")));
const extraEdits = Number(option("--extra-edits", "1"));
const filtered = Boolean(unitFilter || activityFilter || flag("--layout-only") || option("--phase", null) || option("--verdict", null));
const reportPath = "scripts/route-audit/report.json";
const update = flag("--update");
const outPath = option("--out", filtered && !update ? null : reportPath);
const offset = Number(option("--offset", "0"));
const limit = Number(option("--limit", "100000"));
const cachePath = resolve(root, "node_modules/.cache/route-audit/trace.json");
const phaseFilter = option("--phase", null);
// `--verdict inconclusive` re-runs what the committed report left open, for
// example with a larger budget.
const verdictFilter = option("--verdict", null);
const previousVerdicts = new Map(verdictFilter && existsSync(resolve(root, reportPath))
  ? JSON.parse(readFileSync(resolve(root, reportPath), "utf8")).exercises.map(result => [result.id, result.verdict])
  : []);
const pageRunner = readFileSync(resolve(import.meta.dirname, "page-runner.js"), "utf8");

async function waitForServer(child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Vite exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${origin}/play/`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise(done => setTimeout(done, 250));
  }
  throw new Error("Vite did not start");
}

async function openUnit(page, unit) {
  await page.goto(`${origin}/play/?unit=${unit.id}`);
  await page.waitForFunction(() => Boolean(window.VimWilds));
  await page.addScriptTag({ type: "module", content: pageRunner });
  await page.waitForFunction(() => Boolean(window.RouteAudit));
}

async function showActivity(page, activity) {
  await page.evaluate(({ id, config }) => {
    const index = window.VimWilds.activities.findIndex(candidate => candidate.id === id || candidate.sourceActivityId === id);
    if (index === -1) throw new Error(`activity ${id} not in the flow`);
    window.VimWilds.goToActivity(index);
    window.RouteAudit.prepare(config);
  }, { id: activity.id, config: activity });
}

function runnerConfig(activity) {
  const { id, languageId, fileName, editor, scenario, script } = activity;
  return { id, languageId, fileName, editor, scenario, script: { steps: script.steps } };
}

// Replays every demo and exercise once, in course order, recording the mode
// before each key. Also confirms each exercise's canonical reaches its target
// inside the audit's host; if it does not, nothing the host reports about that
// exercise can be trusted.
async function traceCourse(page, units, ordered) {
  const parsedById = new Map();
  const profiles = new Map();
  const hostMismatch = new Set();
  for (const unit of units) {
    const members = ordered.filter(item => item.unit === unit);
    if (!members.length) continue;
    await openUnit(page, unit);
    for (const { activity } of members) {
      await showActivity(page, runnerConfig(activity));
      const result = await page.evaluate(keys => window.RouteAudit.trace(keys), keysOf(activity));
      parsedById.set(activity.id, parseTrace(result.trace));
      profiles.set(activity.id, editProfile(result.trace, result.start, activity.scenario.target.lines.join("\n")));
      if (activity.type === "exercise" && !result.final.match) hostMismatch.add(activity.id);
    }
    process.stdout.write(`traced unit ${unit.unitNumber}\n`);
  }
  return { parsedById, profiles, hostMismatch };
}

const WINDOW_ATOMS = new Set(["H", "M", "L", "Ctrl-f", "Ctrl-b", "Ctrl-d", "Ctrl-u", "Ctrl-e", "Ctrl-y", "zt", "zz", "zb"]);

function confirmNative(exercise, keys, atoms = []) {
  const target = exercise.scenario.target;
  const initial = exercise.scenario.initial;
  const result = runNativeVim({
    initialCode: initial.lines,
    cursor: initial.setup?.cursor || initial.cursor,
    setupKeys: (initial.setup?.steps || []).map(keyOf),
    keys,
    fileName: exercise.fileName,
    textWidth: exercise.editor?.textWidth,
    registerNames: Object.keys(target.registers || {}),
  });
  const sameText = JSON.stringify(result.code) === JSON.stringify(target.lines);
  // Headless Vim has no display geometry, so wrapped cursor positions and
  // window motions are the browser's to judge (the rule the content tests
  // follow for wrapped lines).
  const geometry = exercise.editor?.wrapColumns || atoms.some(atom => WINDOW_ATOMS.has(atom));
  const sameCursor = geometry || JSON.stringify(result.cursor) === JSON.stringify(target.cursor);
  const sameRegisters = Object.entries(target.registers || {})
    .every(([name, expected]) => result.registers?.[name]?.text === expected.text);
  return Boolean(sameText && sameCursor && sameRegisters && result.mode === target.mode);
}

async function auditExercise(page, item, taught, parsedById, profiles, hostMismatch) {
  const { unit, lesson, activity } = item;
  const base = {
    id: activity.id,
    unitNumber: unit.unitNumber,
    unitId: unit.id,
    lessonId: lesson.id,
    phase: activity.phase,
    primary: activity.skills?.primary || [],
    canonical: { keys: keysOf(activity), cost: activity.script.steps.length },
    routeNote: activity.verification?.routeNote || null,
  };
  if (hostMismatch.has(activity.id)) return { ...base, verdict: "host-mismatch", routes: [], counted: [] };
  const allowed = taught.allowed.get(activity.id);
  const parsed = parsedById.get(activity.id);
  const actions = buildActions(activity, allowed, parsed);
  const profile = profiles.get(activity.id);
  if (flag("--verbose")) {
    const histogram = {};
    for (const action of actions) histogram[action.atoms.join(" ")] = (histogram[action.atoms.join(" ")] || 0) + 1;
    console.log(`  ${activity.id}: ${actions.length} actions`, Object.entries(histogram).sort((a, b) => b[1] - a[1]).slice(0, 25));
  }
  await showActivity(page, runnerConfig(activity));
  const outcome = await searchShorter(
    activity,
    actions,
    allowed,
    paths => page.evaluate(batch => window.RouteAudit.evaluate(batch), paths),
    {
      maxEvaluations,
      maxMilliseconds,
      maxEdits: profile.edits + extraEdits,
      allowWorsen: profile.worsens,
      onLevel: flag("--verbose")
        ? level => console.log(`  ${activity.id} cost ${level.cost}: ${level.evaluated} evaluated, ${level.states} states, ${level.texts} texts, ${level.elapsedMs}ms`, flag("--samples") ? level.sample : "")
        : undefined,
    },
  );
  const { samplePaths, ...outcome2 } = outcome;
  const result = {
    ...base,
    ...outcome2,
    actionCount: actions.length,
    canonicalEdits: profile.edits,
    canonicalCovered: expressible(keysOf(activity), actions),
  };
  // Every reported route is replayed once more in a fresh editor, and a sample
  // of the search's paths checks the reused editor against fresh ones.
  const fresh = await page.evaluate(paths => window.RouteAudit.evaluate(paths, { fresh: true }), [...result.routes, ...result.counted].map(route => route.keys));
  [...result.routes, ...result.counted].forEach((route, index) => { route.freshEditor = fresh[index].match; });
  const rejected = [];
  const keep = route => (route.freshEditor ? true : (rejected.push(route), false));
  result.routes = result.routes.filter(keep);
  result.counted = result.counted.filter(keep);
  const resetMismatches = samplePaths?.length ? await page.evaluate(paths => window.RouteAudit.checkReset(paths), samplePaths) : [];
  result.resetMismatches = resetMismatches.map(item => item.keys);
  if (result.verdict === "shorter" && !result.routes.length) result.verdict = "engine-mismatch";
  if (!flag("--no-native")) {
    for (const route of [...result.routes, ...result.counted]) {
      route.nativeVim = confirmNative(activity, route.keys, route.atoms);
      if (route.atoms.some(atom => WINDOW_ATOMS.has(atom))) route.cursorJudgedBy = "browser";
    }
    const agreed = route => (route.nativeVim ? true : (rejected.push(route), false));
    if (result.verdict === "shorter") {
      result.routes = result.routes.filter(agreed);
      if (!result.routes.length) result.verdict = "engine-mismatch";
    }
    result.counted = result.counted.filter(agreed);
  }
  // Routes one engine accepted and the other did not, kept for diagnosis.
  if (rejected.length) result.rejectedRoutes = rejected.slice(0, 5);
  if (["shorter", "trivial"].includes(result.verdict) && result.routeNote) result.verdict = "justified";
  return result;
}

// Whether the canonical route can be spelled from the search's actions. When
// it cannot, "none-shorter" only speaks for the routes the grammar covers.
// Bracket objects have aliases (`ab` is `a(`, `a}` is `a{`); the search
// offers one spelling of each.
const OBJECT_ALIASES = { b: "(", ")": "(", B: "{", "}": "{", "]": "[", ">": "<" };

function expressible(canonicalKeys, actions) {
  const keys = canonicalKeys.map((key, index) => (["i", "a"].includes(canonicalKeys[index - 1]) && OBJECT_ALIASES[key]) || key);
  const spellings = new Set(actions.map(action => action.keys.join("\u0000")));
  const longest = Math.max(...actions.map(action => action.keys.length));
  const reachable = [true];
  for (let end = 1; end <= keys.length; end += 1) {
    reachable[end] = false;
    for (let length = 1; length <= Math.min(longest, end) && !reachable[end]; length += 1) {
      if (reachable[end - length] && spellings.has(keys.slice(end - length, end).join("\u0000"))) reachable[end] = true;
    }
  }
  return reachable[keys.length];
}

function selectExercises(ordered) {
  const units = unitFilter ? new Set(unitFilter.split(",")) : null;
  return ordered.filter(({ unit, activity }) => activity.type === "exercise"
    && (!units || units.has(unit.id) || units.has(String(unit.unitNumber)))
    && (!activityFilter || activityFilter.split(",").includes(activity.id))
    && (!flag("--layout-only") || activity.editor?.viewportRows || activity.editor?.wrapColumns)
    && (!phaseFilter || activity.phase === phaseFilter)
    && (!verdictFilter || previousVerdicts.get(activity.id) === verdictFilter))
    .slice(offset, offset + limit);
}

function traceCacheKey() {
  const hash = createHash("sha256");
  const files = [
    ...readdirSync(resolve(root, "content/units")).sort().map(name => `content/units/${name}`),
    "content/unit-index.json",
    "scripts/route-audit/grammar.mjs",
    "scripts/route-audit/page-runner.js",
    "scripts/route-audit/audit.mjs",
    "src/editor/vim-engine.js",
  ];
  for (const file of files) hash.update(readFileSync(resolve(root, file)));
  return hash.digest("hex");
}

async function cachedTrace(page, units, ordered) {
  const key = traceCacheKey();
  if (existsSync(cachePath)) {
    const cached = JSON.parse(readFileSync(cachePath, "utf8"));
    if (cached.key === key) {
      return {
        parsedById: new Map(cached.parsed),
        profiles: new Map(cached.profiles),
        hostMismatch: new Set(cached.hostMismatch),
      };
    }
  }
  const traced = await traceCourse(page, units, ordered);
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify({
    key,
    parsed: [...traced.parsedById],
    profiles: [...traced.profiles],
    hostMismatch: [...traced.hostMismatch],
  }));
  return traced;
}

function printTaught(firstUse) {
  const rows = [...firstUse.entries()].sort((left, right) => left[1].unitNumber - right[1].unitNumber || left[0].localeCompare(right[0]));
  for (const [atom, { unitNumber, activityId }] of rows) console.log(`${String(unitNumber).padStart(2)}  ${atom.padEnd(14)} ${activityId}`);
}

async function main() {
  const units = loadCourse(root);
  const ordered = orderedRunnables(units);
  const vite = spawn(resolve(root, "node_modules/.bin/vite"), ["--host", "127.0.0.1", "--port", port, "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  // A timeout or Ctrl-C must not leave Vite or Chrome running.
  const stop = async signal => {
    await browser?.close().catch(() => {});
    if (vite.exitCode === null) vite.kill("SIGTERM");
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    await waitForServer(vite);
    // The browser suites use system Chrome on macOS; fall back to Playwright's
    // own Chromium when it will not start, for example mid-update.
    browser = process.platform === "darwin"
      ? await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" })
        .catch(() => chromium.launch())
      : await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pages = [];
    for (let index = 0; index < pageCount; index += 1) pages.push(await context.newPage());

    const { parsedById, profiles, hostMismatch } = await cachedTrace(pages[0], units, ordered);
    const taught = buildTaughtIndex(ordered, parsedById);
    if (flag("--print-taught")) {
      printTaught(taught.firstUse);
      return;
    }

    const selected = selectExercises(ordered);
    const results = new Array(selected.length);
    let next = 0;
    // Each page takes the next exercise and reloads only when the unit changes.
    await Promise.all(pages.map(async page => {
      let openUnitId = null;
      while (next < selected.length) {
        const index = next;
        next += 1;
        const item = selected[index];
        if (openUnitId !== item.unit.id) {
          await openUnit(page, item.unit);
          openUnitId = item.unit.id;
        }
        const result = await auditExercise(page, item, taught, parsedById, profiles, hostMismatch);
        results[index] = result;
        const best = result.routes?.[0];
        console.log(`${String(item.unit.unitNumber).padStart(2)} ${item.activity.id.padEnd(44)} ${result.verdict.padEnd(13)}`
          + ` ${result.canonical.cost}${best ? ` -> ${best.cost}  ${best.commands.join(" ")}` : ""}`
          + `${result.evaluated ? `  (${result.evaluated} states, ${Math.round((result.elapsedMs || 0) / 1000)}s)` : ""}`
          + `${result.resetMismatches?.length ? `  RESET MISMATCH ${result.resetMismatches.length}` : ""}`);
      }
    }));

    if (outPath) {
      // An update keeps every exercise it did not audit and replaces the ones
      // it did, then puts them back in course order.
      const courseOrder = new Map(ordered.map(({ activity }, index) => [activity.id, index]));
      const previous = update && existsSync(resolve(root, outPath))
        ? JSON.parse(readFileSync(resolve(root, outPath), "utf8")).exercises
        : [];
      const fresh = new Map(results.filter(Boolean).map(result => [result.id, result]));
      const merged = [...previous.filter(result => !fresh.has(result.id)), ...fresh.values()]
        .sort((left, right) => courseOrder.get(left.id) - courseOrder.get(right.id));
      const report = {
        generatedBy: "scripts/route-audit/audit.mjs",
        countedFrom: COUNTED_FROM,
        extraEdits,
        budget: { maxEvaluations, secondsPerExercise: maxMilliseconds / 1000 },
        exercises: merged,
      };
      writeFileSync(resolve(root, outPath), `${JSON.stringify(report, null, 2)}\n`);
      writeFileSync(resolve(root, outPath.replace(/\.json$/, ".md")), renderMarkdown(report));
      console.log(`wrote ${relative(root, resolve(root, outPath))}`);
    }
  } finally {
    await browser?.close();
    if (vite.exitCode === null) {
      vite.kill("SIGTERM");
      await new Promise(done => {
        const timeout = setTimeout(done, 5_000);
        vite.once("exit", () => {
          clearTimeout(timeout);
          done();
        });
      });
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

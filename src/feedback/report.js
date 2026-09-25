/* Feedback report envelope.
 *
 * This module is deliberately pure: it takes plain snapshots and returns plain
 * data, so the whole redaction contract can be unit-tested in Node without a
 * DOM, a browser, or a network. Everything that touches the page lives in
 * capture.js, and everything that touches the wire lives in
 * transport.js.
 *
 * The Markdown is rendered here rather than in the sync script on purpose. The
 * reviewer reads it before sending and the triage file on disk is the same
 * text, so there is exactly one renderer and no way for the two to drift.
 */

export const FEEDBACK_SCHEMA_VERSION = 1;

export const FEEDBACK_CATEGORIES = Object.freeze([
  { id: "bug", label: "Something is wrong" },
  { id: "content", label: "Lesson or wording" },
  { id: "idea", label: "Idea" },
]);

// A buffer is authored content in a lesson and free-form typing everywhere
// else. Only the second case is the learner's own text.
const AUTHORED_BUFFER_SURFACES = new Set(["lesson", "mastery"]);

const MAX_BUFFER_LINES = 200;
const MAX_EFFECTS = 40;
const MAX_REJECTED_KEYS = 40;

function trimLines(lines, limit = MAX_BUFFER_LINES) {
  if (!Array.isArray(lines)) return [];
  return lines.length > limit ? [...lines.slice(0, limit), `… ${lines.length - limit} more lines`] : [...lines];
}

/** True when the buffer at this surface can contain text the learner typed. */
export function bufferIsUserAuthored(surface, practicePolicy) {
  return !AUTHORED_BUFFER_SURFACES.has(surface) || practicePolicy === "explore";
}

/* Registers are module-global in codemirror-vim, so text yanked in free
 * practice is still sitting there during a later lesson. A lesson report that
 * shipped them verbatim would leak scratchpad content from a surface the
 * reviewer thought they had left. */
function summarizeRegisters(registers) {
  if (!registers || typeof registers !== "object") return {};
  return Object.fromEntries(Object.entries(registers)
    .filter(([, value]) => value && typeof value.text === "string" && value.text.length)
    .map(([name, value]) => [name, { text: value.text, type: value.type || "characterwise" }]));
}

/* The key list on a semantic effect is the literal characters that ran the
 * command, which in free practice is whatever the learner typed. */
function redactEffects(effects, surface) {
  if (!Array.isArray(effects)) return [];
  const recent = effects.slice(-MAX_EFFECTS);
  if (surface !== "free-practice") return recent;
  return recent.map(({ keys, ...rest }) => ({ ...rest, keys: "[redacted]" }));
}

export function buildReport({
  note = "",
  category = "bug",
  state = {},
  effects = [],
  environment = {},
  layout = {},
  screenshot = null,
  appVersion = "unknown",
  href = "",
  deepLink = "",
  commandLine = null,
  rejectedKeys = [],
  attempt = {},
  includeEditorContents = true,
  createdAt = new Date().toISOString(),
} = {}) {
  const surface = state.surface || "lesson";
  const userAuthoredBuffer = bufferIsUserAuthored(surface, state.practicePolicy);
  const redactions = [];

  const editor = {
    cursor: state.cursor || null,
    mode: state.mode || null,
    selection: state.selection || null,
    viewport: state.viewport || null,
    matchLines: state.matchLines || [],
    impactMessage: state.impactMessage || "",
    setupDrift: state.setupDrift || null,
    fileName: state.fileName || "",
  };

  if (includeEditorContents) {
    editor.code = trimLines(state.code);
    editor.registers = summarizeRegisters(state.registers);
    if (typeof commandLine === "string" && commandLine.length) editor.commandLine = commandLine;
  } else {
    editor.code = null;
    editor.registers = null;
    redactions.push("Editor buffer, registers and command line withheld at the reporter's request.");
  }

  if (includeEditorContents && userAuthoredBuffer) {
    redactions.push(`Buffer on the "${surface}" surface may contain text typed by the reporter.`);
  }
  if (surface === "free-practice") {
    redactions.push("Per-command keystrokes redacted from the effect log on the free practice surface.");
  }

  return {
    schemaVersion: FEEDBACK_SCHEMA_VERSION,
    createdAt,
    category,
    note: String(note).trim(),
    app: { version: appVersion, href, deepLink },
    location: {
      surface,
      // Which dialog the report was filed from, when it was one. `surface`
      // stays the board underneath: the free-practice keystroke redaction below
      // keys off it, so overwriting it would un-redact scratchpad typing.
      reportedFrom: state.reportedFrom || null,
      reportedFromDetail: state.reportedFromDetail || null,
      unitId: state.unitId || null,
      unitNumber: state.unitNumber ?? null,
      lessonId: state.lessonId || null,
      activityId: state.activityId || null,
      activityType: state.activityType || null,
      activityIndex: state.activityIndex ?? null,
      sourceActivityId: state.sourceActivityId || null,
      practiceMode: state.practiceMode || null,
      practicePolicy: state.practicePolicy || null,
    },
    progress: {
      progress: state.progress ?? null,
      playbackStep: state.playbackStep ?? null,
      complete: Boolean(state.complete),
      exploreTargetReached: Boolean(state.exploreTargetReached),
      hintLevel: attempt.hintLevel ?? null,
      consecutiveMistakes: attempt.consecutiveMistakes ?? null,
      recallFeedback: attempt.recallFeedback ?? null,
    },
    keys: {
      accepted: Array.isArray(state.history) ? [...state.history] : [],
      // The refused keys are the single most useful datum in a "this command
      // was not accepted" report, and nothing else in the app records them.
      rejected: Array.isArray(rejectedKeys) ? rejectedKeys.slice(-MAX_REJECTED_KEYS) : [],
      effects: redactEffects(effects, surface),
    },
    editor,
    environment,
    layout,
    screenshot,
    redactions,
  };
}

function bullet(label, value) {
  return value === null || value === undefined || value === "" ? null : `- **${label}** — ${value}`;
}

function fence(lines, language = "") {
  return ["```" + language, ...lines, "```"].join("\n");
}

function renderKeys(keys) {
  return keys.length ? keys.map(key => `\`${key === " " ? "Space" : key}\``).join(" ") : "_none_";
}

/** Render the envelope as the Markdown that is reviewed, saved and filed. */
export function renderReportMarkdown(report, { screenshotPath = "screenshot.webp" } = {}) {
  const { location: place, progress, keys, editor, environment: env, layout } = report;
  const heading = report.note.split("\n")[0].trim() || "Feedback";
  const out = [`# ${heading}`, ""];

  if (report.screenshot) out.push(`![screenshot](${screenshotPath})`, "");
  if (report.note) out.push(report.note, "");

  out.push("## Where", "");
  out.push(...[
    bullet("Surface", place.surface),
    bullet("Reported from", place.reportedFrom
      && (place.reportedFromDetail ? `${place.reportedFrom} — ${place.reportedFromDetail}` : place.reportedFrom)),
    bullet("Unit", place.unitNumber ? `${place.unitNumber} \`${place.unitId}\`` : place.unitId),
    bullet("Lesson", place.lessonId && `\`${place.lessonId}\``),
    bullet("Activity", place.activityId && `\`${place.activityId}\` (${place.activityType || "?"}${place.practiceMode ? `, ${place.practiceMode}` : ""})`),
    bullet("Policy", place.practicePolicy),
    bullet("Reproduce", report.app.deepLink && `<${report.app.deepLink}>`),
    bullet("Build", report.app.version && `\`${report.app.version}\``),
    bullet("Reported", report.createdAt),
  ].filter(Boolean));

  out.push("", "## State", "");
  out.push(...[
    bullet("Mode", editor.mode),
    bullet("Cursor", editor.cursor && `line ${editor.cursor[0] + 1}, column ${editor.cursor[1] + 1}`),
    bullet("Step", progress.progress === null ? null : `${progress.progress}${progress.complete ? " (complete)" : ""}`),
    bullet("Hints used", progress.hintLevel),
    bullet("Mistake streak", progress.consecutiveMistakes),
    bullet("File", editor.fileName && `\`${editor.fileName}\``),
    bullet("Setup drift", editor.setupDrift ? "**yes — authored initial state did not match the engine**" : null),
  ].filter(Boolean));

  out.push("", "## Keys", "");
  out.push(`- **Accepted** — ${renderKeys(keys.accepted)}`);
  if (keys.rejected.length) {
    out.push(`- **Refused** — ${keys.rejected.map(entry => `\`${entry.key}\`${entry.expected ? ` (expected \`${entry.expected}\`)` : ""}`).join(", ")}`);
  }

  if (editor.code) {
    out.push("", "## Buffer", "");
    out.push(fence(editor.code));
    const registers = Object.entries(editor.registers || {});
    if (registers.length) {
      out.push("", "### Registers", "");
      out.push(...registers.map(([name, value]) => `- \`"${name}\` (${value.type}) — \`${value.text.replaceAll("\n", "\\n")}\``));
    }
    if (editor.commandLine) out.push("", `### Command line`, "", `\`${editor.commandLine}\``);
  }

  out.push("", "## Environment", "");
  out.push(...[
    bullet("Viewport", env.viewport && `${env.viewport.width}×${env.viewport.height} @ ${env.devicePixelRatio}x`),
    bullet("Screen", env.screen && `${env.screen.width}×${env.screen.height}`),
    bullet("Orientation", env.orientation),
    bullet("Root font size", env.rootFontSize && `${env.rootFontSize}px`),
    bullet("Display mode", env.standalone ? "standalone (installed)" : "browser tab"),
    bullet("Pointer", env.coarsePointer ? "coarse (touch)" : "fine"),
    bullet("Reduced motion", env.reducedMotion ? "yes" : null),
    bullet("Online", env.online === false ? "no — report was queued" : null),
    bullet("User agent", env.userAgent && `\`${env.userAgent}\``),
  ].filter(Boolean));

  if (layout && (layout.documentOverflow || layout.overflowing?.length)) {
    out.push("", "## Layout problems detected", "");
    if (layout.documentOverflow) out.push("- **The document itself scrolls or overflows horizontally.**");
    out.push(...(layout.overflowing || []).map(entry => (
      `- \`${entry.selector}\` — content ${entry.scrollWidth}×${entry.scrollHeight} in a ${entry.clientWidth}×${entry.clientHeight} box`
    )));
  }

  if (report.redactions.length) {
    out.push("", "## Privacy", "");
    out.push(...report.redactions.map(line => `- ${line}`));
  }

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

/** A short, stable, filesystem-safe stem for a saved report. */
export function reportSlug(report) {
  const date = (report.createdAt || "").slice(0, 10) || "undated";
  const where = report.location.activityId || report.location.unitId || report.location.surface || "report";
  return `${date}-${String(where).replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}`;
}

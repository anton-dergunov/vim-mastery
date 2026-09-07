import assert from "node:assert/strict";
import test from "node:test";

import {
  bufferIsUserAuthored,
  buildReport,
  FEEDBACK_SCHEMA_VERSION,
  renderReportMarkdown,
  reportSlug,
} from "../feedback-report.js";

const lessonState = {
  surface: "lesson",
  unitId: "text-objects",
  unitNumber: 3,
  lessonId: "inside-word",
  activityId: "promote-one-identifier",
  activityType: "exercise",
  practiceMode: "guided",
  practicePolicy: "guided-sequence",
  progress: 2,
  complete: false,
  history: ["g", "U"],
  code: ["DRAFT_MODE = True"],
  cursor: [0, 0],
  mode: "normal",
  registers: { '"': { text: "draft", type: "characterwise" } },
  fileName: "settings.py",
};

const environment = {
  viewport: { width: 360, height: 740 },
  screen: { width: 360, height: 800 },
  devicePixelRatio: 3,
  orientation: "portrait",
  rootFontSize: 16,
  userAgent: "Mozilla/5.0 (Linux; Android 14)",
  coarsePointer: true,
  standalone: true,
  online: true,
};

function report(overrides = {}) {
  return buildReport({
    note: "iw is not suggested",
    state: lessonState,
    environment,
    appVersion: "0.1.0+02aa1f4c",
    deepLink: "https://example.test/play/?unit=text-objects&activity=promote-one-identifier",
    createdAt: "2026-09-06T10:00:00.000Z",
    ...overrides,
  });
}

test("a lesson report carries the location that a screenshot alone cannot", () => {
  const envelope = report();
  assert.equal(envelope.schemaVersion, FEEDBACK_SCHEMA_VERSION);
  assert.deepEqual(envelope.location, {
    surface: "lesson",
    reportedFrom: null,
    reportedFromDetail: null,
    unitId: "text-objects",
    unitNumber: 3,
    lessonId: "inside-word",
    activityId: "promote-one-identifier",
    activityType: "exercise",
    activityIndex: null,
    sourceActivityId: null,
    practiceMode: "guided",
    practicePolicy: "guided-sequence",
  });
  assert.equal(envelope.app.version, "0.1.0+02aa1f4c");
});

/* Five dialogs can file a report about themselves. Without this the reviewer
 * cannot tell a complaint about a reference card from one about the lesson
 * behind it, because both carry the same surface. */
test("a report filed from a dialog names the dialog, not just the board behind it", () => {
  const envelope = report({
    state: { ...lessonState, reportedFrom: "reference", reportedFromDetail: "registers · yank-into-a-named-register · card 2 of 7" },
  });
  assert.equal(envelope.location.surface, "lesson");
  assert.equal(envelope.location.reportedFrom, "reference");
  assert.equal(envelope.location.reportedFromDetail, "registers · yank-into-a-named-register · card 2 of 7");
  assert.match(renderReportMarkdown(envelope), /\*\*Reported from\*\* — reference — registers · yank-into-a-named-register · card 2 of 7/);
});

test("a report filed from the board says so by omission", () => {
  const markdown = renderReportMarkdown(report());
  assert.equal(markdown.includes("Reported from"), false);
});

test("refused keys are reported, since nothing else in the app records them", () => {
  const envelope = report({ rejectedKeys: [{ key: "i", expected: "g" }, { key: "w", expected: "g" }] });
  assert.deepEqual(envelope.keys.rejected, [{ key: "i", expected: "g" }, { key: "w", expected: "g" }]);
  assert.deepEqual(envelope.keys.accepted, ["g", "U"]);
  assert.match(renderReportMarkdown(envelope), /\*\*Refused\*\* — `i` \(expected `g`\)/);
});

test("an authored lesson buffer is not flagged as the reporter's own text", () => {
  assert.equal(bufferIsUserAuthored("lesson", "guided-sequence"), false);
  assert.equal(bufferIsUserAuthored("mastery", "recall-sequence"), false);
  const envelope = report();
  assert.deepEqual(envelope.editor.code, ["DRAFT_MODE = True"]);
  assert.equal(envelope.redactions.length, 0);
});

test("free practice and explore buffers are flagged, because the learner typed them", () => {
  assert.equal(bufferIsUserAuthored("free-practice", "free"), true);
  assert.equal(bufferIsUserAuthored("lesson", "explore"), true);

  const envelope = report({
    state: { ...lessonState, surface: "free-practice", practicePolicy: "free", code: ["my own notes"] },
  });
  assert.ok(envelope.redactions.some(line => line.includes("typed by the reporter")));
});

test("per-command keystrokes are redacted on the scratchpad, where they are typed text", () => {
  const effects = [{ id: 1, type: "capture", keys: ["s", "e", "c", "r", "e", "t"] }];

  const lesson = report({ effects });
  assert.deepEqual(lesson.keys.effects[0].keys, ["s", "e", "c", "r", "e", "t"]);

  const scratchpad = report({
    effects,
    state: { ...lessonState, surface: "free-practice", practicePolicy: "free" },
  });
  assert.equal(scratchpad.keys.effects[0].keys, "[redacted]");
  assert.equal(scratchpad.keys.effects[0].type, "capture");
  assert.ok(scratchpad.redactions.some(line => line.includes("free practice")));
});

test("clearing the buffer withholds registers and the command line as well", () => {
  const envelope = report({ includeEditorContents: false, commandLine: ":s/secret/x/" });
  assert.equal(envelope.editor.code, null);
  assert.equal(envelope.editor.registers, null);
  assert.equal(envelope.editor.commandLine, undefined);
  // The cursor and mode still describe the defect without quoting any text.
  assert.equal(envelope.editor.mode, "normal");
  assert.ok(envelope.redactions.some(line => line.includes("withheld")));

  const markdown = renderReportMarkdown(envelope);
  assert.doesNotMatch(markdown, /DRAFT_MODE/);
  assert.doesNotMatch(markdown, /secret/);
});

test("the learning history profile is never part of a report", () => {
  const envelope = report({ state: { ...lessonState, masteryState: { completions: { a: 1 } } } });
  assert.equal(JSON.stringify(envelope).includes("completions"), false);
});

test("a report with no screenshot is complete, not degraded", () => {
  const envelope = report({ screenshot: null });
  assert.equal(envelope.screenshot, null);
  const markdown = renderReportMarkdown(envelope);
  assert.doesNotMatch(markdown, /!\[screenshot\]/);
  assert.match(markdown, /# iw is not suggested/);
  assert.match(markdown, /## Where/);
});

test("a screenshot is referenced by the path the sync script writes", () => {
  const markdown = renderReportMarkdown(report({ screenshot: { source: "auto", bytes: 4096, type: "image/webp" } }));
  assert.match(markdown, /!\[screenshot\]\(screenshot\.webp\)/);
});

test("the layout scan reports the overflow a screenshot only hints at", () => {
  const envelope = report({
    layout: {
      documentOverflow: false,
      overflowing: [{ selector: "#activityInstruction", scrollWidth: 420, clientWidth: 344, scrollHeight: 60, clientHeight: 40 }],
    },
  });
  const markdown = renderReportMarkdown(envelope);
  assert.match(markdown, /## Layout problems detected/);
  assert.match(markdown, /#activityInstruction` — content 420×60 in a 344×40 box/);
});

test("the environment block records what makes a layout bug reproducible", () => {
  const markdown = renderReportMarkdown(report());
  assert.match(markdown, /\*\*Viewport\*\* — 360×740 @ 3x/);
  assert.match(markdown, /\*\*Root font size\*\* — 16px/);
  assert.match(markdown, /\*\*Display mode\*\* — standalone \(installed\)/);
});

test("a long buffer is truncated rather than sent whole", () => {
  const lines = Array.from({ length: 260 }, (_, index) => `line ${index}`);
  const envelope = report({ state: { ...lessonState, code: lines } });
  assert.equal(envelope.editor.code.length, 201);
  assert.equal(envelope.editor.code.at(-1), "… 60 more lines");
});

test("the slug names the activity so saved reports sort and read sensibly", () => {
  assert.equal(reportSlug(report()), "2026-09-06-promote-one-identifier");
});

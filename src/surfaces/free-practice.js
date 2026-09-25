/* Free practice: a scratch buffer on a real file, with no goal and no score.
 */

import { appUrl } from "../app/version.js";
import { escapeHtml, renderInline } from "../app/html.js";
import { elements, state } from "../app/context.js";
import { isFreePractice, languageLabel } from "../app/activity.js";
import { resetActivity } from "../app/navigation.js";
import { worldRenderer } from "../lesson/board.js";
import { clearPlayback } from "../lesson/demo.js";
import { vimEngine } from "../editor/mount.js";

// Free practice is not progress either. Its own key keeps a scratchpad flag
// from ever reading as curriculum state to a restore or a migration.
const practiceStateKey = "vim-wilds.practice.v1";

function readPracticeState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(practiceStateKey) || "null");
    return { noticeSeen: saved?.noticeSeen === true };
  } catch {
    return { noticeSeen: false };
  }
}
export const practiceState = readPracticeState();

/**
 * A scratchpad is an exercise as far as input is concerned, and nothing else.
 * `type: "exercise"` is load-bearing: it is what keeps the touch keyboard, the
 * physical keydown path, the latched modifiers and Caps Lock working without a
 * second implementation. The empty `commandGroups`, the `lessonIndex` and the
 * Normal `mode` exist so the shared presentation, console and mount helpers
 * cannot dereference something undefined.
 */
function freePracticeActivity(sample) {
  return {
    id: "free-practice",
    type: "exercise",
    practiceMode: "free",
    lessonIndex: 0,
    title: sample.fileName,
    instruction: "",
    languageId: sample.languageId,
    // The picker and the header already show this name; passing it on is what
    // makes `"%` and `Ctrl-r%` report it inside a practice buffer.
    fileName: sample.fileName,
    hints: [],
    script: { steps: [], commandGroups: [] },
    scenario: { initial: { lines: sample.lines, cursor: [0, 0], mode: "normal" } },
  };
}

// Free practice ------------------------------------------------------------
// Fetched lazily and cached the way a non-current unit's reference entries are.
// Most sessions never open the scratchpad, and twenty buffers do not belong in
// front of first paint. The service worker precaches the file, so the first
// ever open still works offline.
let practiceSamplesPromise = null;
let practiceNoticeReturnsToPicker = false;
const practiceSampleIndex = new Map();

export function practiceSampleCatalog() {
  practiceSamplesPromise ||= fetch(appUrl("content/practice-samples.json"))
    .then(response => {
      if (!response.ok) throw new Error(`Practice samples request failed (${response.status})`);
      return response.json();
    })
    .then(data => {
      data.samples.forEach(sample => practiceSampleIndex.set(sample.id, sample));
      return data.samples;
    });
  return practiceSamplesPromise;
}

function randomPracticeSample(samples, excludeId = null) {
  // Excluding the open file is what makes a second "Surprise me" always change
  // something.
  const pool = samples.filter(sample => sample.id !== excludeId);
  const choices = pool.length ? pool : samples;
  return choices[Math.floor(Math.random() * choices.length)];
}

function persistPracticeState() {
  try {
    window.localStorage.setItem(practiceStateKey, JSON.stringify(practiceState));
  } catch {
    // A blocked or full store only costs a repeated notice, never correctness.
  }
}

function openPracticeNotice({ fromPicker = false } = {}) {
  practiceNoticeReturnsToPicker = fromPicker;
  if (fromPicker && elements.practiceFilesDialog.open) elements.practiceFilesDialog.close();
  if (!elements.practiceNoticeDialog.open) elements.practiceNoticeDialog.showModal();
}

export async function startFreePractice(sampleId = null) {
  const samples = await practiceSampleCatalog();
  const sample = (sampleId && practiceSampleIndex.get(sampleId))
    || randomPracticeSample(samples, state.freePractice?.sample?.id || null);
  clearPlayback();
  elements.tocDialog?.close();
  if (elements.practiceFilesDialog.open) elements.practiceFilesDialog.close();
  state.freePractice = { sample, activity: freePracticeActivity(sample) };
  elements.phone.dataset.surface = "free-practice";
  // The scenic layers are hidden for as long as this surface is up, so their
  // remote variant streaming is pure wasted bandwidth. Same pair the reference
  // surface uses.
  worldRenderer.cancelRemoteVariants({ clearLayer: true });
  resetActivity({ vibrateReset: false });
  // Entering writes nothing to the session key. That is what makes "no
  // progression state changes on entry" true by construction.
  if (!practiceState.noticeSeen) openPracticeNotice();
  return sample;
}

export function exitFreePractice() {
  if (!isFreePractice()) return;
  state.freePractice = null;
  delete elements.phone.dataset.surface;
  resetActivity({ vibrateReset: false });
  worldRenderer.syncRemoteVariants();
}

export async function openPracticeFiles() {
  elements.tocDialog?.close();
  elements.practiceFileList.innerHTML = '<p class="practice-loading">Loading…</p>';
  if (!elements.practiceFilesDialog.open) elements.practiceFilesDialog.showModal();
  const samples = await practiceSampleCatalog();
  elements.practiceFileList.innerHTML = samples.map(sample => `
    <button type="button" data-practice-sample="${escapeHtml(sample.id)}">
      <strong>${escapeHtml(sample.fileName)}</strong>
      <small>${renderInline(sample.summary)}</small>
      <span>${escapeHtml(languageLabel(sample))} · ${sample.lines.length} lines</span>
    </button>`).join("");
}
elements.practiceFilesButton?.addEventListener("click", () => void openPracticeFiles());
elements.practiceFilesDialog?.addEventListener("click", event => {
  if (event.target.closest("[data-practice-notice]")) return openPracticeNotice({ fromPicker: true });
  if (event.target.closest("[data-practice-random]")) return void startFreePractice();
  const sampleId = event.target.closest("[data-practice-sample]")?.dataset.practiceSample;
  if (sampleId) void startFreePractice(sampleId);
});
// `close` covers the button, Escape and the backdrop in one place. The
// reference deck intercepts `cancel` instead only because it has renderer
// teardown that a plain close would skip.
elements.practiceFilesDialog?.addEventListener("close", () => {
  if (!elements.practiceNoticeDialog.open) vimEngine?.focus();
});
elements.practiceNoticeDialog?.addEventListener("close", () => {
  if (!practiceState.noticeSeen) {
    practiceState.noticeSeen = true;
    persistPracticeState();
  }
  if (practiceNoticeReturnsToPicker) {
    practiceNoticeReturnsToPicker = false;
    void openPracticeFiles();
    return;
  }
  vimEngine?.focus();
});

/* What the app draws around the editor from its snapshot: match marks, Vim's
 * message screen, the position rail, and the impact line.
 */

import { $ } from "../app/dom.js";
import { escapeHtml } from "../app/html.js";
import { elements, state } from "../app/context.js";
import { vimEngine } from "./mount.js";

/**
 * A demo checkpoint's affected range is the more specific signal, so it wins
 * over the live pattern's match lines whenever one is authored.
 */
export function renderEditorMarks(range = null) {
  if (!vimEngine) return;
  if (range) vimEngine.showPreviewRange(range);
  else vimEngine.showMatchLines();
}

/**
 * Vim answers `:g/pat/p` by painting the matched lines over the buffer and
 * waiting for a key. This is that screen. It is transient by construction: the
 * engine retires `exOutput` on the next keystroke, exactly as it retires the
 * impact readout, so rendering straight from the snapshot is the whole
 * lifecycle.
 */
export function renderExOutput() {
  const output = state.editorSnapshot?.exOutput;
  const open = Boolean(output?.lines?.length);
  if (open) {
    const width = String(output.lines.at(-1).number).length;
    elements.exOutputLines.innerHTML = output.lines.map(({ number, text }) => {
      const gutter = output.numbered ? `<b style="min-width:${width}ch">${number}</b>` : "";
      // An empty line still has to occupy a row, exactly as Vim prints a space.
      return `<span class="ex-output-line">${gutter}<span>${escapeHtml(text) || " "}</span></span>`;
    }).join("");
    elements.exOutputLines.scrollTop = 0;
  } else {
    elements.exOutputLines.innerHTML = "";
  }
  elements.exOutput.classList.toggle("open", open);
  elements.exOutput.setAttribute("aria-hidden", String(!open));
}

/**
 * Vim's message screen is dismissed by any key. Keys that reach the engine
 * retire the output on their own; this covers the ones that never get there —
 * a wrong key in a guided lesson, and a reset.
 */
export function dismissExOutput() {
  if (!elements.exOutput.classList.contains("open")) return;
  vimEngine?.clearExOutput();
  if (state.editorSnapshot) state.editorSnapshot = { ...state.editorSnapshot, exOutput: null };
  renderExOutput();
}

export function renderBufferPosition() {
  const rail = $(".buffer-position", elements.worldGrid);
  const viewport = state.editorSnapshot?.viewport;
  if (!rail || !viewport) return;
  const visibleLines = viewport.bottomLine - viewport.topLine + 1;
  const thumb = $(".buffer-track i", rail);
  // Both the thumb and the match ticks map a buffer line to the same fraction
  // of the track, so a tick inside the thumb means that line is on screen.
  const rowHeight = 100 / viewport.totalLines;
  rail.classList.toggle("has-above", viewport.topLine > 0);
  rail.classList.toggle("has-below", viewport.bottomLine < viewport.totalLines - 1);
  thumb.style.height = `${visibleLines * rowHeight}%`;
  thumb.style.top = `${viewport.topLine * rowHeight}%`;
  renderMatchMap(rail, viewport);
}

function renderMatchMap(rail, viewport) {
  const track = $(".buffer-track", rail);
  const matches = state.editorSnapshot?.matchLines || [];
  track.querySelectorAll(".match-tick").forEach(tick => tick.remove());
  rail.classList.toggle("has-matches", matches.length > 0);
  const rowHeight = 100 / viewport.totalLines;
  for (const line of matches) {
    const tick = document.createElement("span");
    tick.className = "match-tick";
    tick.style.top = `${line * rowHeight}%`;
    tick.style.height = `${rowHeight}%`;
    track.append(tick);
  }
}

/**
 * Vim prints a buffer-level report after a command. Reproducing it is what
 * makes an edit legible when most of the lines it touched are off-screen.
 */
export function impactMessage(snapshot = state.editorSnapshot) {
  const impact = snapshot?.impact;
  if (!impact) return "";
  if (impact.substitutions) {
    const substitutions = `${impact.substitutions} substitution${impact.substitutions === 1 ? "" : "s"}`;
    const lines = `${impact.substitutionLines} line${impact.substitutionLines === 1 ? "" : "s"}`;
    return `${substitutions} on ${lines}`;
  }
  const delta = impact.lineDelta || 0;
  if (delta) {
    const count = Math.abs(delta);
    return `${count} ${delta > 0 ? "more" : "fewer"} line${count === 1 ? "" : "s"}`;
  }
  const changed = impact.changedLines || 0;
  return changed ? `${changed} line${changed === 1 ? "" : "s"} changed` : "";
}

/**
 * A single-line edit needs no readout. Report only when the effect spans more
 * than one line or reaches past the visible window, which is a superset of
 * Vim's `'report'` threshold.
 */
export function shouldReportImpact(snapshot = state.editorSnapshot) {
  const impact = snapshot?.impact;
  if (!impact) return false;
  const touchedLines = impact.substitutions
    ? impact.substitutionLines
    : Math.abs(impact.lineDelta || 0) || impact.changedLines || 0;
  if (touchedLines > 1) return true;
  const viewport = snapshot?.viewport;
  return (snapshot?.matchLines || []).some(line => viewport && (line < viewport.topLine || line > viewport.bottomLine));
}

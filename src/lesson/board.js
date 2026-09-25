/* The board: the world scene, the theme colours, and what the lesson grid
 * shows — the editor slab, a reading card, or the completion panel.
 */

import { appUrl, remoteMediaUrls } from "../app/version.js";
import { WorldPresentationRenderer } from "../world/presentation.js";
import { escapeHtml, renderInline } from "../app/html.js";
import { allowedThemes, elements, state, unit, unitPresentation } from "../app/context.js";
import {
  currentActivity,
  hasEditor,
  isDemo,
  isFreePractice,
  isPractice,
  isRunnable,
  plannedEditorRows,
} from "../app/activity.js";
import { renderFieldNote } from "./notes.js";
import { renderCharacterLayer } from "./characters.js";
import { mountEditor, unmountEditor } from "../editor/mount.js";

const presentations = [
  { theme: "glass", codeSide: "left" },
  { theme: "deepwater", codeSide: "right" },
  { theme: "moonroot", codeSide: "left" },
  { theme: "ember", codeSide: "right" },
];

const themeColors = {
  moonroot: ["#071d18", "#1c533d", "#77e0a3", "#a77bff", "#ffc866"],
  ember: ["#20120e", "#683420", "#f59a61", "#ff7468", "#ffd06c"],
  glass: ["#0b1722", "#234f68", "#78dbea", "#b89cff", "#ffe08b"],
  deepwater: ["#07151d", "#123f4e", "#55bfd0", "#888cff", "#f6bd63"],
};

export function presentationFor(activity = currentActivity()) {
  return presentations[activity.lessonIndex % presentations.length];
}

export function functionalThemeFor(activity = currentActivity()) {
  return unitPresentation?.world.autoThemeId || presentationFor(activity).theme;
}

export function setTheme(theme) {
  const activeTheme = state.themePreference !== "auto" ? state.themePreference : theme;
  allowedThemes.forEach(candidate => {
    if (candidate !== "auto") elements.world.classList.remove(`theme-${candidate}`);
  });
  elements.world.classList.add(`theme-${activeTheme}`);
  elements.world.classList.toggle("complete", state.complete);
  const [dark, mid, bright, magic, warm] = themeColors[activeTheme];
  elements.phone.style.setProperty("--theme-dark", dark);
  elements.phone.style.setProperty("--theme-mid", mid);
  elements.phone.style.setProperty("--theme-bright", bright);
  elements.phone.style.setProperty("--theme-magic", magic);
  elements.phone.style.setProperty("--theme-warm", warm);
}

export const worldRenderer = new WorldPresentationRenderer({
  world: elements.world,
  backdropLayer: elements.worldBackdrop,
  ambientLayer: elements.worldAmbient,
  remoteVariantLayer: elements.worldRemoteVariantLayer,
  assetUrl: appUrl,
  remoteAssetUrls: remoteMediaUrls,
});

function applyWorldPresentation(activity, presentation) {
  // Every unit now has a registered scene. Simple backgrounds retain that
  // unit-specific base board; they do not revive the retired world-tile art.
  const simpleBackground = state.generatedBackdrops === "disabled";
  elements.world.dataset.simpleBackground = String(simpleBackground);
  elements.referenceVisual.dataset.simpleBackground = String(simpleBackground);
  const layeredWorld = worldRenderer.setPresentation(unitPresentation, {
    unitId: unit.id,
    phase: activity.phase || (activity.type === "summary" ? "summary" : "explain"),
    landmarkState: "dormant",
    // Reading and decision cards use the naturally framed static board. During
    // hands-on work, portrait and compact boards opt into the compact-registered
    // animation; wide and shallow boards retain their purpose-built wide art.
    variantPolicy: isRunnable(activity) ? "practice" : "static",
  });
  return layeredWorld;
}

export function refreshWorldPresentation() {
  const activity = currentActivity();
  const presentation = presentationFor(activity);
  const layeredWorld = applyWorldPresentation(activity, presentation);
  if (layeredWorld) worldRenderer.considerUnitReveal();
}

export function completionRendersInWorld() {
  return isPractice() && state.complete && state.keyboardVisibility === "hidden";
}

export function completionPanelMarkup(activity, { inWorld = false } = {}) {
  const feedback = activity.feedback || {};
  return `<section class="completion-panel${inWorld ? " in-world" : ""}" role="status">
    <span>${activity.practiceMode === "recall" ? "Recall complete" : "Guided practice complete"}</span>
    <strong>${renderInline(feedback.success || "Practice complete.")}</strong>
    <p>${renderInline(feedback.why || "Continue when you are ready.")}</p>
    <button class="primary-action" data-action="next" type="button">Next →</button>
  </section>`;
}

export function renderCompletionHost() {
  elements.completionHost.innerHTML = completionRendersInWorld()
    ? completionPanelMarkup(currentActivity(), { inWorld: true })
    : "";
}

export function renderWorld() {
  const activity = currentActivity();
  const presentation = presentationFor(activity);
  if (!hasEditor(activity)) unmountEditor();
  setTheme(functionalThemeFor(activity));
  const layeredWorld = isFreePractice() ? null : applyWorldPresentation(activity, presentation);
  const viewportRows = activity.editor?.viewportRows;
  const plannedRows = plannedEditorRows(activity);
  const editorRows = viewportRows || plannedRows;
  const expandedRowsClass = editorRows > 6 ? " has-expanded-rows" : "";
  // A named buffer wears its file name where Vim puts it, along the bottom of
  // the slab. The label is absolutely positioned so it can never take a code
  // row; the strip it needs is bought with slab height instead, and for the
  // small buffers these activities use it disappears inside the slab's own
  // minimum height and costs nothing at all.
  const fileNameLabel = isRunnable(activity) ? activity.fileName : "";
  const editorPadding = (viewportRows ? 18 : 24) + (fileNameLabel ? 14 : 0);
  const editorStyle = `--editor-rows:${editorRows};--editor-height:${editorRows * 24 + editorPadding}px${viewportRows ? `;--viewport-rows:${viewportRows}` : ""}`;
  const content = isFreePractice()
    // No viewport rows and no authored height: the free practice slab is sized
    // by the surface rather than by the buffer, and its scroller is the one
    // place in the product where CodeMirror scrolls natively so Vim can keep
    // the cursor in view across a sixty-line file.
    ? `<div class="editor-stack free-practice-stack">
          <div class="code-slab next-code-slab"><div class="code-body" id="editorMount" aria-label="Free practice editor"></div></div>
        </div>`
    : isRunnable(activity)
    ? `<div class="editor-stack${viewportRows ? " has-viewport" : ""}${expandedRowsClass}" data-planned-rows="${editorRows}" style="${editorStyle}">
          <div class="code-slab next-code-slab${fileNameLabel ? " has-file-name" : ""}"><div class="code-body" id="editorMount" aria-label="Vim lesson editor"></div>${viewportRows ? '<div class="buffer-position" aria-hidden="true"><span class="buffer-cue buffer-cue-top">▲</span><span class="buffer-track"><i></i></span><span class="buffer-cue buffer-cue-bottom">▼</span></div>' : ""}${fileNameLabel ? `<div class="buffer-name">${escapeHtml(fileNameLabel)}</div>` : ""}</div>
          ${isDemo(activity) ? '<div class="demo-controls" id="demoControls" aria-label="Demo controls"></div>' : ""}
        </div>`
    : activity.inspection
      ? `<div class="inspection-layout">
          <div class="code-slab inspection-code-slab"><div class="code-body" id="editorMount" aria-label="Vim inspection editor"></div></div>
          <div class="inspection-choice">${renderFieldNote(activity)}</div>
        </div>`
    : `<div class="field-note-wrap side-${presentation.codeSide}">${renderFieldNote(activity)}</div>`;
  elements.worldGrid.innerHTML = content;
  if (isFreePractice()) {
    elements.characterLayer.dataset.side = "none";
    elements.characterLayer.innerHTML = "";
    elements.completionHost.innerHTML = "";
  } else {
    renderCharacterLayer(activity, presentation);
    renderCompletionHost();
  }
  if (hasEditor(activity)) mountEditor();
  if (layeredWorld) worldRenderer.considerUnitReveal();
}

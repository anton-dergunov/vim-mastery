import unit from "./content/units/repeatable-editing.json";
import languageProfiles from "./content/language-profiles.json";
import { spriteCells } from "./exercise-data.js";
import { canonicalKeyToken, VimEngine, resetVimEngineState } from "./vim-engine.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const urlParams = new URLSearchParams(window.location.search);
const nextUI = urlParams.get("ui") === "next";
const themePreferenceKey = "vim-wilds.theme";
const allowedThemes = new Set(["auto", "moonroot", "ember", "glass", "deepwater"]);

document.documentElement.classList.toggle("next-ui", nextUI);

const elements = {
  phone: $("#phone"),
  locationLabel: $("#locationLabel"),
  progressPill: $("#progressPill"),
  activitySelect: $("#activitySelect"),
  modePill: nextUI ? $("#nextModePill") : $("#modePill"),
  resetButton: nextUI ? $("#nextResetButton") : $("#resetButton"),
  lessonLabel: $("#lessonLabel"),
  tocButton: $("#tocButton"),
  settingsButton: $("#settingsButton"),
  activityIntro: $("#activityIntro"),
  activityKicker: $("#activityKicker"),
  activityTitle: $("#activityTitle"),
  activityInstruction: $("#activityInstruction"),
  hintButton: $("#hintButton"),
  eyebrow: $("#eyebrow"),
  questTitle: $("#questTitle"),
  questInstruction: $("#questInstruction"),
  world: $("#world"),
  groundGrid: $("#groundGrid"),
  worldGrid: $("#worldGrid"),
  helpCard: $("#helpCard"),
  helpClose: $("#helpClose"),
  hintSteps: $("#hintSteps"),
  successBanner: $("#successBanner"),
  successTitle: $("#successTitle"),
  successText: $("#successText"),
  nextButton: $("#nextButton"),
  activityControls: $("#activityControls"),
  keyboardPanel: $(".keyboard-panel"),
  commandTray: nextUI ? $("#nextCommandTray") : $("#commandTray"),
  commandText: nextUI ? $("#nextCommandText") : $("#commandText"),
  guidance: nextUI ? $("#nextGuidance") : $("#guidance"),
  commandExplanation: $("#commandExplanation"),
  keyboard: $("#keyboard"),
  tocDialog: $("#tocDialog"),
  tocLessons: $("#tocLessons"),
  settingsDialog: $("#settingsDialog"),
  themeOptions: $("#themeOptions"),
};

const presentations = [
  { theme: "glass", template: "mirrors", codeSide: "left", blocks: ["mirror", "mirror", "mirror"] },
  { theme: "deepwater", template: "terminal", codeSide: "right", blocks: ["terminal", "crystal"] },
  { theme: "moonroot", template: "causeway", codeSide: "left", blocks: ["rune", "gate"] },
  { theme: "ember", template: "beacons", codeSide: "right", blocks: ["beacon", "beacon"] },
];

const themeLabels = {
  moonroot: "Moonroot Ruins",
  ember: "Ember Vault",
  glass: "Hall of Mirrors",
  deepwater: "Deepwater Archive",
};

const themeColors = {
  moonroot: ["#071d18", "#1c533d", "#77e0a3", "#a77bff", "#ffc866"],
  ember: ["#20120e", "#683420", "#f59a61", "#ff7468", "#ffd06c"],
  glass: ["#0b1722", "#234f68", "#78dbea", "#b89cff", "#ffe08b"],
  deepwater: ["#07151d", "#123f4e", "#55bfd0", "#888cff", "#f6bd63"],
};

const lessons = unit.lessons.map((lesson, lessonIndex) => ({ ...lesson, lessonIndex }));
const activities = lessons.flatMap(lesson => lesson.activities.map((activity, activityIndex) => ({
  ...activity,
  lessonId: lesson.id,
  lessonTitle: lesson.title,
  lessonIndex: lesson.lessonIndex,
  activityIndex,
})));
const exercises = activities.filter(activity => activity.type === "exercise");
const languageNames = new Map(languageProfiles.profiles.map(profile => [profile.id, profile.displayName]));

function storedThemePreference() {
  try {
    const value = window.localStorage.getItem(themePreferenceKey) || "auto";
    return allowedThemes.has(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

const state = {
  activityIndex: 0,
  progress: 0,
  history: [],
  modifiers: new Set(),
  physicalShift: false,
  capsLock: false,
  complete: false,
  choiceResult: null,
  editorSnapshot: null,
  playbackStep: 0,
  playbackTimer: null,
  playbackMode: null,
  themePreference: storedThemePreference(),
};

let vimEngine = null;
let executionMeasurementFrame = null;

function currentActivity() {
  return activities[state.activityIndex];
}

function isRunnable(activity = currentActivity()) {
  return activity?.type === "demo" || activity?.type === "exercise";
}

function isPractice(activity = currentActivity()) {
  return activity?.type === "exercise";
}

function isDemo(activity = currentActivity()) {
  return activity?.type === "demo";
}

function scriptKeys(activity = currentActivity()) {
  return activity.script.steps.map(step => typeof step === "string" ? step : step.key);
}

function languageLabel(activity) {
  return languageNames.get(activity.languageId) || activity.languageId;
}

function vibrate(pattern = 7) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatToken(token) {
  const labels = { Escape: "ESC", Enter: "ENTER", " ": "SPACE", Tab: "TAB" };
  return labels[token] || token;
}

function displayKeyToken(token) {
  const labels = { Escape: "Esc", Enter: "Enter", " ": "Space", Tab: "Tab" };
  return labels[token] || token;
}

function renderKeycap(token, className = "") {
  const extraClass = className ? ` ${className}` : "";
  return `<kbd class="command-key${extraClass}">${escapeHtml(displayKeyToken(token))}</kbd>`;
}

function renderHistory(tokens) {
  return tokens.length
    ? tokens.map(token => renderKeycap(token)).join("")
    : '<span class="ghost">waiting…</span>';
}

function guidanceToken(token) {
  if (!token) return "COMPLETE";
  if (token.startsWith("Ctrl-")) return `CTRL + ${token.slice(5).toUpperCase()}`;
  if (token.includes("+")) return token.replaceAll("+", " + ").toUpperCase();
  if (token === "Escape") return "ESCAPE";
  if (token === "Enter") return "ENTER";
  const exact = keyButtonsFor(token);
  if (exact.some(button => button.dataset.shift === token) || (token.length === 1 && token !== token.toLowerCase())) return `SHIFT + ${token}`;
  return token;
}

function presentationFor(activity = currentActivity()) {
  return presentations[activity.lessonIndex % presentations.length];
}

function setTheme(theme) {
  const activeTheme = nextUI && state.themePreference !== "auto" ? state.themePreference : theme;
  elements.world.className = `world theme-${activeTheme}${state.complete ? " complete" : ""}`;
  const [dark, mid, bright, magic, warm] = themeColors[activeTheme];
  elements.phone.style.setProperty("--theme-dark", dark);
  elements.phone.style.setProperty("--theme-mid", mid);
  elements.phone.style.setProperty("--theme-bright", bright);
  elements.phone.style.setProperty("--theme-magic", magic);
  elements.phone.style.setProperty("--theme-warm", warm);
}

function groundType(template, row, col) {
  const edge = row === 1 || row === 9 || col === 1 || col === 12;
  switch (template) {
    case "mirrors": return edge ? "water" : (row + col) % 3 === 0 ? "stone" : "moss";
    case "terminal": return edge ? "water" : row >= 2 && row <= 8 ? "stone" : "moss";
    case "causeway": return col <= 2 || col === 12 ? "water" : col >= 8 ? "stone" : "moss";
    case "beacons": return col <= 3 || col >= 10 ? "stone" : edge ? "water" : "moss";
    default: return edge ? "water" : "moss";
  }
}

function renderGround(presentation) {
  const cells = [];
  for (let row = 1; row <= 9; row += 1) {
    for (let col = 1; col <= 12; col += 1) {
      const glow = ((row * 13 + col * 7 + currentActivity().lessonIndex) % 29 === 0) ? " glow" : "";
      cells.push(`<div class="ground-cell ${groundType(presentation.template, row, col)}${glow}"></div>`);
    }
  }
  elements.groundGrid.innerHTML = cells.join("");
}

function renderSprites(presentation) {
  return presentation.blocks.map((type, index) => {
    const [x, y] = spriteCells[type];
    const positions = [[10, 3], [10, 6], [2, 5]];
    const [col, row] = positions[index] || positions[0];
    return `<div class="sprite type-${type}${state.complete ? " active" : ""}" style="grid-column:${col};grid-row:${row};--sprite-x:${(x * 100 / 3).toFixed(3)}%;--sprite-y:${(y * 100 / 3).toFixed(3)}%" aria-hidden="true"></div>`;
  }).join("");
}

function renderFieldNote(activity) {
  if (activity.type === "theory") {
    const action = activity.demoRef
      ? `<button class="note-action" type="button" data-action="show-demo" data-demo="${activity.demoRef}">Show example →</button>`
      : nextUI ? '<button class="note-action" type="button" data-action="next">Next →</button>' : "";
    return `<article class="field-note" aria-label="Theory">
      <span class="field-note-kicker">Field note · explain</span>
      <h2>${escapeHtml(activity.title)}</h2>
      <p>${escapeHtml(activity.body)}</p>
      ${activity.grammar ? `<pre class="grammar">${escapeHtml(activity.grammar)}</pre>` : ""}
      ${activity.contrast ? `<p class="contrast">${escapeHtml(activity.contrast)}</p>` : ""}
      ${action}
    </article>`;
  }
  if (activity.type === "choice") {
    const choices = activity.options.map(option => `<button class="choice-option${state.choiceResult === option.id ? " selected" : ""}" data-choice="${option.id}" type="button">${escapeHtml(option.label)}</button>`).join("");
    const result = state.choiceResult ? `<p class="choice-feedback ${state.complete ? "correct" : ""}">${escapeHtml(activity.explanation)}</p>` : "";
    const next = nextUI && state.complete ? '<button class="note-action" type="button" data-action="next">Next →</button>' : "";
    return `<article class="field-note choice-note" aria-label="Tool choice challenge">
      <span class="field-note-kicker">Challenge · choose</span><h2>${escapeHtml(activity.title)}</h2>
      <p>${escapeHtml(activity.prompt)}</p><div class="choice-options">${choices}</div>${result}${next}
    </article>`;
  }
  return `<article class="field-note summary-note" aria-label="Lesson summary">
    <span class="field-note-kicker">Lesson summary</span><h2>${escapeHtml(activity.title)}</h2>
    <p>${escapeHtml(activity.body)}</p><ul>${activity.takeaways.map(takeaway => `<li>${escapeHtml(takeaway)}</li>`).join("")}</ul>
    ${nextUI ? '<button class="note-action" type="button" data-action="next">Next →</button>' : ""}
  </article>`;
}

function renderActivityIntro() {
  if (!nextUI) return;
  const activity = currentActivity();
  const show = isRunnable(activity);
  elements.activityIntro.hidden = !show;
  if (!show) return;
  elements.activityKicker.textContent = `${activity.type === "demo" ? "Demo" : "Exercise"} · ${languageLabel(activity)}`;
  elements.activityTitle.textContent = activity.title;
  elements.activityInstruction.textContent = activity.instruction;
  elements.hintButton.hidden = !isPractice(activity);
}

function renderWorld() {
  const activity = currentActivity();
  const presentation = presentationFor(activity);
  if (!isRunnable(activity)) {
    vimEngine?.destroy();
    vimEngine = null;
    resetVimEngineState();
  }
  setTheme(presentation.theme);
  renderGround(presentation);
  const oppositeSide = presentation.codeSide === "left" ? "right" : "left";
  const content = isRunnable(activity)
    ? nextUI
      ? `<div class="editor-stack" style="--editor-height:${108 + activity.scenario.initial.lines.length * 24}px">
          <div class="code-slab next-code-slab"><div class="code-body" id="editorMount" aria-label="Vim lesson editor"></div></div>
          ${isDemo(activity) ? '<div class="demo-controls" id="demoControls" aria-label="Demo controls"></div>' : ""}
        </div>`
      : `<div class="code-slab side-${presentation.codeSide}"><div class="code-head"><i></i><span>${escapeHtml(languageLabel(activity))} · ${activity.type}</span></div><div class="code-body" id="editorMount" aria-label="Vim lesson editor"></div></div>`
    : `<div class="field-note-wrap side-${presentation.codeSide}">${renderFieldNote(activity)}</div>`;
  const oracle = isPractice(activity) && !nextUI ? `<button class="oracle ${oppositeSide}" type="button" data-action="help" aria-label="Open hints">?</button>` : "";
  elements.worldGrid.innerHTML = `${renderSprites(presentation)}${content}<img class="nix ${presentation.codeSide}" src="assets/characters/nix/idle.png" alt="Nix, a lantern-moth apprentice">${oracle}`;
  if (isRunnable(activity)) mountEditor();
}

function mountEditor() {
  vimEngine?.destroy();
  resetVimEngineState();
  const activity = currentActivity();
  vimEngine = new VimEngine({
    parent: $("#editorMount", elements.worldGrid),
    text: activity.scenario.initial.lines.join("\n"),
    cursor: activity.scenario.initial.cursor,
    language: activity.languageId,
    onEvent: handleEngineEvent,
  });
  state.editorSnapshot = vimEngine.getSnapshot();
  vimEngine.setLocked(!isPractice(activity));
  if (!window.matchMedia("(pointer: coarse)").matches) vimEngine.focus();
}

function modeLabel() {
  if (state.complete) return "Complete";
  if (!isRunnable()) return currentActivity().type === "theory" ? "Theory" : "Review";
  const mode = state.editorSnapshot?.mode || "normal";
  return mode === "visual-line" ? "Visual Line" : mode === "visual-block" ? "Visual Block" : mode === "command-line" ? "Command" : `${mode.charAt(0).toUpperCase()}${mode.slice(1)}`;
}

function renderMode() {
  const label = modeLabel();
  elements.modePill.textContent = label;
  const kind = /visual/i.test(label) ? "visual" : /command/i.test(label) ? "command" : /complete/i.test(label) ? "complete" : "";
  elements.modePill.className = `mode-pill ${kind}`.trim();
}

function activeCommandGroup(activity = currentActivity(), step = state.playbackStep) {
  return activity.script?.commandGroups.find(group => step >= group.from && step < group.to)
    || activity.script?.commandGroups.at(-1);
}

function executionContent(activity, step, history, complete = false) {
  const keys = scriptKeys(activity);
  const group = activeCommandGroup(activity, step);
  const done = complete || step >= keys.length;
  return {
    explanation: group?.explanation || "Follow the authored command sequence.",
    history,
    primary: done ? (activity.type === "demo" ? "Demo" : "Practice") : activity.type === "demo" ? `Step ${step + 1} of ${keys.length}` : "Next",
    secondary: done ? "Complete" : "",
    key: done ? null : keys[step],
  };
}

function applyExecutionContent(root, content) {
  $(".command-explanation", root).textContent = content.explanation;
  $(".command-text", root).innerHTML = renderHistory(content.history);
  $(".status-primary", root).textContent = content.primary;
  $(".status-secondary", root).textContent = content.secondary;
  const key = $(".status-key", root);
  key.innerHTML = content.key ? renderKeycap(content.key, "status-command-key") : "";
  key.hidden = !content.key;
}

function measureExecutionConsole() {
  executionMeasurementFrame = null;
  if (!nextUI) return;
  const probe = elements.commandTray.cloneNode(true);
  probe.removeAttribute("id");
  probe.removeAttribute("aria-live");
  probe.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
  probe.classList.remove("hidden");
  probe.classList.add("execution-measure");
  probe.style.width = `${elements.phone.getBoundingClientRect().width}px`;
  elements.phone.append(probe);
  let requiredHeight = 0;
  activities.filter(isRunnable).forEach(activity => {
    const keys = scriptKeys(activity);
    for (let step = 0; step <= keys.length; step += 1) {
      applyExecutionContent(probe, executionContent(activity, step, keys.slice(0, step), step >= keys.length));
      requiredHeight = Math.max(requiredHeight, Math.ceil(probe.scrollHeight), Math.ceil(probe.getBoundingClientRect().height));
    }
  });
  probe.remove();
  elements.phone.style.setProperty("--execution-console-height", `${requiredHeight}px`);
}

function scheduleExecutionConsoleMeasurement() {
  if (!nextUI || executionMeasurementFrame) return;
  executionMeasurementFrame = window.requestAnimationFrame(measureExecutionConsole);
}

function renderCommand() {
  const activity = currentActivity();
  if (!isRunnable(activity)) {
    if (nextUI) {
      elements.commandExplanation.textContent = "";
      elements.commandTray.classList.add("hidden");
      return;
    }
    elements.commandText.innerHTML = '<span class="ghost">read, choose, or continue</span>';
    elements.guidance.textContent = activity.type === "choice" ? "CHOOSE A TOOL" : "FIELD NOTES";
    return;
  }
  elements.commandTray.classList.remove("hidden");
  if (nextUI) {
    const step = isDemo(activity) ? state.playbackStep : state.progress;
    applyExecutionContent(elements.commandTray, executionContent(activity, step, state.history, state.complete));
    scheduleExecutionConsoleMeasurement();
    return;
  }
  const history = state.history.map(formatToken).join(" ");
  elements.commandText.innerHTML = history ? escapeHtml(history) : '<span class="ghost">waiting…</span>';
  if (isDemo(activity)) {
    const keys = scriptKeys(activity);
    const group = activeCommandGroup(activity);
    elements.guidance.textContent = nextUI
      ? state.playbackStep >= keys.length ? "Demo complete" : `Step ${state.playbackStep + 1} of ${keys.length}: ${guidanceToken(keys[state.playbackStep])}`
      : state.playbackStep >= keys.length ? "DEMO COMPLETE" : group?.explanation?.toUpperCase() || `STEP: ${guidanceToken(keys[state.playbackStep])}`;
    return;
  }
  const next = scriptKeys(activity)[state.progress];
  elements.guidance.textContent = nextUI
    ? state.complete ? "Practice complete" : next ? `Next: ${guidanceToken(next)}` : "Verifying"
    : state.complete ? "PRACTICE COMPLETE" : next ? `NEXT: ${guidanceToken(next)}` : "VERIFYING";
}

function renderHeader() {
  const activity = currentActivity();
  if (nextUI) {
    elements.lessonLabel.textContent = activity.lessonTitle;
    elements.resetButton.hidden = !isRunnable(activity);
    renderTableOfContents();
    return;
  }
  elements.locationLabel.textContent = `${themeLabels[presentationFor(activity).theme]} · ${activity.lessonTitle}`;
  elements.progressPill.textContent = `${state.activityIndex + 1} / ${activities.length}`;
  elements.activitySelect.value = String(state.activityIndex);
  elements.eyebrow.textContent = `${activity.lessonTitle} · ${activity.phase}`;
  elements.questTitle.textContent = activity.title;
  elements.questInstruction.textContent = activity.instruction || activity.body || activity.prompt || "Review the field notes, then continue.";
}

function renderHints() {
  const hints = isPractice() ? currentActivity().hints : [];
  elements.hintSteps.innerHTML = hints.map((hint, index) => `<div class="hint-step"><kbd>Hint ${index + 1}</kbd><small>${escapeHtml(hint)}</small></div>`).join("");
}

function renderActivityControls() {
  const activity = currentActivity();
  if (nextUI) {
    elements.keyboardPanel.classList.remove("controls-only");
    elements.keyboardPanel.classList.toggle("empty-panel", !isRunnable(activity));
    elements.keyboardPanel.classList.toggle("completed", isPractice(activity) && state.complete);
    elements.keyboard.classList.toggle("hidden", !isPractice(activity));
    elements.keyboard.toggleAttribute("inert", isPractice(activity) && state.complete);
    if (isPractice(activity) && state.complete) elements.keyboard.setAttribute("aria-hidden", "true");
    else elements.keyboard.removeAttribute("aria-hidden");
    if (isDemo(activity)) {
      const done = state.playbackStep >= scriptKeys(activity).length;
      const playing = Boolean(state.playbackTimer);
      const playLabel = playing ? "Pause" : done ? "Reset" : "Play";
      const action = done ? "reset" : "play-toggle";
      const demoControls = $("#demoControls", elements.worldGrid);
      if (demoControls) demoControls.innerHTML = `
        <button data-action="${action}" type="button">${playLabel}</button>
        <button data-action="step" type="button" ${done || playing ? "disabled" : ""}>Step</button>
        <button class="primary-action" data-action="next" type="button">Next →</button>`;
      elements.activityControls.innerHTML = "";
      return;
    }
    if (isPractice(activity) && state.complete) {
      const feedback = activity.feedback || {};
      elements.activityControls.innerHTML = `<section class="completion-panel" role="status">
        <span>Exercise complete</span>
        <strong>${escapeHtml(feedback.success || "Practice complete.")}</strong>
        <p>${escapeHtml(feedback.why || "Continue when you are ready.")}</p>
        <button class="primary-action" data-action="next" type="button">Next →</button>
      </section>`;
      return;
    }
    elements.activityControls.innerHTML = "";
    return;
  }
  elements.keyboardPanel.classList.toggle("controls-only", !isPractice(activity));
  elements.keyboard.classList.toggle("hidden", !isPractice(activity));
  elements.commandTray.classList.toggle("hidden", !isRunnable(activity));
  if (isDemo(activity)) {
    const done = state.playbackStep >= scriptKeys(activity).length;
    const playing = Boolean(state.playbackTimer);
    elements.activityControls.innerHTML = `<div class="control-deck demo-deck">
      <button data-action="reset" type="button">Reset</button><button data-action="step" type="button" ${done ? "disabled" : ""}>Step</button>
      <button data-action="play" type="button" ${done || playing ? "disabled" : ""}>Play</button><button data-action="slow" type="button" ${done || playing ? "disabled" : ""}>Slow</button>
      <button data-action="pause" type="button" ${playing ? "" : "disabled"}>Pause</button><button data-action="next" type="button" ${done ? "" : "disabled"}>Continue →</button>
    </div>`;
    return;
  }
  if (isPractice(activity)) {
    elements.activityControls.innerHTML = "";
    return;
  }
  const previous = state.activityIndex > 0;
  const next = state.activityIndex < activities.length - 1;
  elements.activityControls.innerHTML = `<div class="control-deck"><button data-action="previous" type="button" ${previous ? "" : "disabled"}>← Back</button><button data-action="next" type="button" ${next ? "" : "disabled"}>Continue →</button></div>`;
}

function renderSuccess() {
  if (nextUI) {
    elements.successBanner.classList.remove("show");
    return;
  }
  const show = state.complete && (isPractice() || currentActivity().type === "choice");
  elements.successBanner.classList.toggle("show", show);
  if (!show) return;
  elements.successTitle.textContent = currentActivity().type === "choice" ? "Sound judgment." : "Beautifully done.";
  elements.successText.textContent = currentActivity().feedback?.why || "Continue to the next activity.";
  elements.nextButton.textContent = state.activityIndex === activities.length - 1 ? "Restart" : "Next →";
}

function renderModifiers() {
  const shiftActive = state.modifiers.has("Shift") || state.physicalShift;
  $$('[data-mod]', elements.keyboard).forEach(button => {
    button.classList.toggle("latched", state.modifiers.has(button.dataset.mod));
    button.setAttribute("aria-pressed", String(state.modifiers.has(button.dataset.mod)));
  });
  const capsButton = $('.key[data-key="CapsLock"]', elements.keyboard);
  capsButton?.classList.toggle("latched", state.capsLock);
  capsButton?.setAttribute("aria-pressed", String(state.capsLock));
  elements.keyboard.classList.toggle("shift-layer", shiftActive);
  elements.keyboard.classList.toggle("letter-uppercase", shiftActive !== state.capsLock);
}

function renderAll() {
  renderHeader();
  renderActivityIntro();
  renderWorld();
  renderMode();
  renderHints();
  renderModifiers();
  renderCommand();
  renderActivityControls();
  renderSuccess();
}

function populateTableOfContents() {
  elements.activitySelect.innerHTML = lessons.map(lesson => {
    const options = activities.filter(activity => activity.lessonId === lesson.id).map(activity => {
      const index = activities.indexOf(activity);
      return `<option value="${index}">${escapeHtml(`${activity.activityIndex + 1}. ${activity.title}`)}</option>`;
    }).join("");
    return `<optgroup label="${escapeHtml(lesson.title)}">${options}</optgroup>`;
  }).join("");
}

function activityTypeLabel(type) {
  return ({ theory: "Theory", demo: "Demo", exercise: "Exercise", choice: "Choice", summary: "Summary" })[type] || type;
}

function renderTableOfContents() {
  if (!nextUI) return;
  const current = currentActivity();
  const lessonMarkup = lessons.map((lesson, lessonIndex) => {
    const lessonActivities = activities.filter(activity => activity.lessonId === lesson.id);
    const rows = lessonActivities.map((activity, activityIndex) => {
      const globalIndex = activities.indexOf(activity);
      const isCurrent = globalIndex === state.activityIndex;
      return `<button class="toc-activity${isCurrent ? " current" : ""}" type="button" data-activity-index="${globalIndex}" ${isCurrent ? 'aria-current="page"' : ""}>
        <span class="toc-number">${lessonIndex + 1}.${activityIndex + 1}</span>
        <span class="toc-activity-title">${escapeHtml(activity.title)}</span>
        <span class="activity-type type-${activity.type}">${activityTypeLabel(activity.type)}</span>
      </button>`;
    }).join("");
    return `<details class="toc-lesson" ${lesson.id === current.lessonId ? "open" : ""}>
      <summary><span>${lessonIndex + 1}</span><strong>${escapeHtml(lesson.title)}</strong><small>${lessonActivities.length} activities</small></summary>
      <div class="toc-activities">${rows}</div>
    </details>`;
  }).join("");
  const authoredUnit = unit.curriculumDefinition?.unit || `10. ${unit.title}`;
  const unitMatch = authoredUnit.match(/^(\d+)\.\s*(.+)$/);
  const unitNumber = unitMatch?.[1] || "10";
  const unitTitle = unitMatch?.[2] || unit.title;
  elements.tocLessons.innerHTML = `<details class="toc-unit" open>
    <summary>
      <span>Unit ${escapeHtml(unitNumber)}</span>
      <strong>${escapeHtml(unitTitle)}</strong>
      <small>${lessons.length} lessons</small>
    </summary>
    <div class="toc-unit-lessons">${lessonMarkup}</div>
  </details>`;
}

function renderThemeOptions() {
  if (!nextUI) return;
  const input = $(`input[name="theme"][value="${state.themePreference}"]`, elements.themeOptions);
  if (input) input.checked = true;
}

function clearPlayback() {
  if (state.playbackTimer) window.clearTimeout(state.playbackTimer);
  state.playbackTimer = null;
  state.playbackMode = null;
}

function resetActivity({ vibrateReset = true } = {}) {
  clearPlayback();
  state.progress = 0;
  state.history = [];
  state.modifiers.clear();
  state.physicalShift = false;
  state.complete = false;
  state.choiceResult = null;
  state.playbackStep = 0;
  state.editorSnapshot = null;
  setHelp(false);
  elements.successBanner.classList.remove("show");
  renderAll();
  if (vibrateReset) vibrate(9);
}

function goToActivity(index) {
  if (!Number.isInteger(index) || index < 0 || index >= activities.length) throw new RangeError("Invalid activity index");
  elements.tocDialog?.close();
  state.activityIndex = index;
  resetActivity({ vibrateReset: false });
}

function nextActivity() {
  if (!nextUI && isDemo() && state.playbackStep < scriptKeys().length) return;
  if (isPractice() && !state.complete) return;
  if (currentActivity().type === "choice" && !state.complete) return;
  if (state.activityIndex === activities.length - 1) {
    goToActivity(0);
    return;
  }
  goToActivity(state.activityIndex + 1);
}

function previousActivity() {
  if (state.activityIndex > 0) goToActivity(state.activityIndex - 1);
}

function isTargetSnapshot(snapshot) {
  const target = currentActivity().scenario.target;
  return snapshot.text === target.lines.join("\n")
    && snapshot.mode === target.mode
    && snapshot.cursorPosition[0] === target.cursor[0]
    && snapshot.cursorPosition[1] === target.cursor[1];
}

function completeActivity() {
  state.complete = true;
  clearPlayback();
  vimEngine?.setLocked(true);
  setTheme(presentationFor().theme);
  $$(".sprite", elements.worldGrid).forEach(sprite => sprite.classList.add("active"));
  if (nextUI && currentActivity().type === "choice") renderWorld();
  renderMode();
  renderCommand();
  renderActivityControls();
  renderSuccess();
  vibrate([18, 35, 18]);
}

function handleEngineEvent(event) {
  state.editorSnapshot = event.snapshot;
  // Only the gate's explicit injection is evidence of learner/demo progress.
  // CodeMirror can also report keypresses from its transient search prompt;
  // those must not turn an accepted sequence into a different one.
  if (event.kind === "key" && (event.source === "lesson" || event.source === "demo")) {
    state.history.push(event.key);
    if (isPractice()) state.progress = state.history.length;
  }
  renderMode();
  renderCommand();
  if (isPractice() && !state.complete && state.progress === scriptKeys().length && isTargetSnapshot(event.snapshot)) completeActivity();
}

function flashError() {
  elements.commandTray.classList.remove("error");
  void elements.commandTray.offsetWidth;
  elements.commandTray.classList.add("error");
  window.setTimeout(() => elements.commandTray.classList.remove("error"), 300);
}

function processToken(token) {
  if (!isPractice() || state.complete || !vimEngine) return false;
  const expected = scriptKeys()[state.progress];
  if (token !== expected) {
    flashError();
    return false;
  }
  setHelp(false);
  return vimEngine.sendKey(token, { source: "lesson" });
}

function stepDemo() {
  if (!isDemo() || state.playbackStep >= scriptKeys().length || !vimEngine) return false;
  const token = scriptKeys()[state.playbackStep];
  vimEngine.sendKey(token, { bypassLock: true, source: "demo" });
  state.playbackStep += 1;
  renderCommand();
  renderActivityControls();
  return state.playbackStep < scriptKeys().length;
}

function playDemo(interval) {
  if (!isDemo() || state.playbackTimer) return;
  state.playbackMode = interval === 850 ? "slow" : "normal";
  const tick = () => {
    if (!stepDemo()) {
      clearPlayback();
      renderActivityControls();
      return;
    }
    state.playbackTimer = window.setTimeout(tick, interval);
    renderActivityControls();
  };
  tick();
}

function setHelp(open) {
  const canHelp = isPractice();
  elements.helpCard.classList.toggle("open", Boolean(open && canHelp));
  elements.helpCard.setAttribute("aria-hidden", String(!(open && canHelp)));
  elements.hintButton?.setAttribute("aria-expanded", String(Boolean(open && canHelp)));
  $$(".key", elements.keyboard).forEach(button => button.classList.remove("hinted"));
  if (open && canHelp) {
    scriptKeys().forEach(token => requiredButtons(token).forEach(button => button.classList.add("hinted")));
    vibrate(5);
  }
}

function keyButtonsFor(value) {
  return $$(".key", elements.keyboard).filter(button => button.dataset.key === value || button.dataset.shift === value);
}

function modifierButtonsFor(value) {
  return $$('[data-mod]', elements.keyboard).filter(button => button.dataset.mod === value);
}

function requiredButtons(token) {
  const result = [];
  if (token.startsWith("Ctrl-")) return [...modifierButtonsFor("Ctrl"), ...keyButtonsFor(token.slice(5))];
  const exact = keyButtonsFor(token);
  result.push(...exact);
  if (token.length === 1 && (token !== token.toLowerCase() || exact.some(button => button.dataset.shift === token))) result.push(...modifierButtonsFor("Shift"));
  return result;
}

function flashKey(button) {
  if (!button) return;
  button.classList.add("pressed");
  window.setTimeout(() => button.classList.remove("pressed"), 110);
}

function toggleModifier(modifier) {
  if (!isPractice()) return;
  if (state.modifiers.has(modifier)) state.modifiers.delete(modifier);
  else state.modifiers.add(modifier);
  renderModifiers();
  vibrate(5);
}

function emitFromButton(button) {
  if (button.dataset.mod) return toggleModifier(button.dataset.mod);
  if (button.dataset.key === "CapsLock") {
    if (!isPractice()) return;
    state.capsLock = !state.capsLock;
    renderModifiers();
    return;
  }
  if (!isPractice()) return;
  let value = button.dataset.key;
  const shiftActive = state.modifiers.has("Shift");
  if (/^[a-z]$/.test(value)) value = shiftActive !== state.capsLock ? value.toUpperCase() : value;
  else if (shiftActive) value = button.dataset.shift || value;
  const chordModifiers = ["Ctrl", "Alt", "Shift"].filter(modifier => state.modifiers.has(modifier));
  let token = value;
  if (chordModifiers.some(modifier => modifier !== "Shift")) token = `${chordModifiers.join("+")}+${value.toLowerCase()}`;
  state.modifiers.clear();
  renderModifiers();
  processToken(token);
}

function processChoice(id) {
  const activity = currentActivity();
  if (activity.type !== "choice" || state.complete) return;
  state.choiceResult = id;
  renderAll();
  if (id === activity.correctOptionId) completeActivity();
}

function handleActivityAction(action) {
  if (!action) return;
  if (action === "reset") resetActivity();
  if (action === "step") stepDemo();
  if (action === "play") playDemo(420);
  if (action === "slow") playDemo(850);
  if (action === "pause") { clearPlayback(); renderActivityControls(); }
  if (action === "play-toggle") {
    if (state.playbackTimer) {
      clearPlayback();
      renderActivityControls();
    } else {
      playDemo(850);
    }
  }
  if (action === "next") nextActivity();
  if (action === "previous") previousActivity();
}

elements.keyboard.addEventListener("pointerdown", event => {
  const button = event.target.closest(".key");
  if (!button) return;
  event.preventDefault();
  flashKey(button);
  emitFromButton(button);
});

document.addEventListener("keydown", event => {
  if (event.vimWildsPrompt) return;
  if (event.target.closest?.("select, button:not(.key)")) return;
  const modifierMap = { Control: "Ctrl", Shift: "Shift", Alt: "Alt" };
  if (event.key === "CapsLock") {
    event.preventDefault();
    if (isPractice()) state.capsLock = event.getModifierState("CapsLock");
    renderModifiers();
    return;
  }
  if (modifierMap[event.key]) {
    event.preventDefault();
    if (event.key === "Shift" && isPractice()) state.physicalShift = true;
    renderModifiers();
    return;
  }
  if (event.repeat) return;
  if (!isPractice()) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  let token = event.key;
  if (event.ctrlKey || event.altKey) {
    const modifiers = [event.ctrlKey && "Ctrl", event.altKey && "Alt"].filter(Boolean);
    token = canonicalKeyToken(`${modifiers.join("+")}+${event.key.toLowerCase()}`);
  }
  const matching = token.startsWith("Ctrl-") ? keyButtonsFor(token.slice(5))[0] : keyButtonsFor(event.key)[0] || keyButtonsFor(event.key.toLowerCase())[0];
  if (!matching) {
    flashError();
    return;
  }
  flashKey(matching);
  processToken(token);
}, true);

document.addEventListener("keyup", event => {
  if (event.key === "Shift") {
    state.physicalShift = false;
    renderModifiers();
  }
});

elements.worldGrid.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "help") setHelp(!elements.helpCard.classList.contains("open"));
  if (action === "show-demo") {
    const index = activities.findIndex(activity => activity.id === event.target.closest("[data-demo]").dataset.demo);
    if (index >= 0) goToActivity(index);
  }
  if (!["help", "show-demo"].includes(action)) handleActivityAction(action);
  const choice = event.target.closest("[data-choice]")?.dataset.choice;
  if (choice) processChoice(choice);
});
const editorPointerEvents = ["pointerdown", "mousedown", "dblclick", "selectstart", "contextmenu"];
editorPointerEvents.forEach(type => elements.worldGrid.addEventListener(type, event => {
  if (!nextUI || !event.target.closest?.(".cm-content, .cm-gutters")) return;
  event.preventDefault();
  event.stopPropagation();
}, true));
elements.helpClose.addEventListener("click", () => setHelp(false));
elements.resetButton.addEventListener("click", () => resetActivity());
elements.nextButton.addEventListener("click", nextActivity);
elements.activitySelect.addEventListener("change", event => goToActivity(Number(event.target.value)));
elements.hintButton?.addEventListener("click", () => setHelp(!elements.helpCard.classList.contains("open")));
elements.tocButton?.addEventListener("click", () => {
  renderTableOfContents();
  elements.tocDialog.showModal();
});
elements.settingsButton?.addEventListener("click", () => {
  renderThemeOptions();
  elements.settingsDialog.showModal();
});
elements.tocLessons?.addEventListener("click", event => {
  const button = event.target.closest("[data-activity-index]");
  if (button) goToActivity(Number(button.dataset.activityIndex));
});
elements.themeOptions?.addEventListener("change", event => {
  const value = event.target.closest('input[name="theme"]')?.value;
  if (!allowedThemes.has(value)) return;
  state.themePreference = value;
  try { window.localStorage.setItem(themePreferenceKey, value); } catch {}
  setTheme(presentationFor().theme);
});
$$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => {
  $("#" + button.dataset.closeDialog)?.close();
}));
$$('.app-dialog').forEach(dialog => dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
}));
elements.activityControls.addEventListener("click", event => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  handleActivityAction(action);
});

window.addEventListener("resize", () => {
  if (!nextUI) return;
  elements.phone.style.removeProperty("--execution-console-height");
  scheduleExecutionConsoleMeasurement();
});
document.fonts?.ready.then(scheduleExecutionConsoleMeasurement);

window.VimWilds = Object.freeze({
  activities,
  exercises,
  emit: processToken,
  goTo(index) {
    if (!Number.isInteger(index) || index < 0 || index >= exercises.length) throw new RangeError("Invalid exercise index");
    goToActivity(activities.indexOf(exercises[index]));
  },
  goToActivity,
  solveCurrent() {
    if (isDemo()) while (stepDemo());
    else if (isPractice()) scriptKeys().slice(state.progress).forEach(processToken);
  },
  getState() {
    const snapshot = state.editorSnapshot || vimEngine?.getSnapshot();
    const ranges = snapshot?.ranges || [];
    const hasSelection = snapshot?.anchor !== snapshot?.head;
    const selection = snapshot?.mode === "visual-block" && ranges.length > 1 ? {
      kind: "block",
      from: ranges[0].from,
      to: [ranges.at(-1).to[0], ranges.at(-1).to[1] - 1],
    } : hasSelection ? {
      kind: "linear",
      from: snapshot.anchorPosition,
      to: snapshot.cursorPosition,
    } : null;
    return {
      activityIndex: state.activityIndex,
      activityId: currentActivity().id,
      activityType: currentActivity().type,
      lessonId: currentActivity().lessonId,
      exerciseIndex: exercises.indexOf(currentActivity()),
      exerciseId: isPractice() ? currentActivity().id : null,
      progress: state.progress,
      playbackStep: state.playbackStep,
      history: [...state.history],
      complete: state.complete,
      code: snapshot?.text.split("\n") || [],
      cursor: snapshot?.cursorPosition || [0, 0],
      selection,
      mode: state.complete ? "Complete" : (snapshot?.mode || "normal"),
      modifiers: [...state.modifiers],
      capsLock: state.capsLock,
      guidance: elements.guidance.textContent,
    };
  },
});

if (nextUI) {
  const requestedActivity = urlParams.get("activity");
  const requestedIndex = activities.findIndex(activity => activity.id === requestedActivity);
  if (requestedIndex >= 0) state.activityIndex = requestedIndex;
}

populateTableOfContents();
renderAll();
renderThemeOptions();

if (nextUI && urlParams.get("preview") === "complete") {
  if (isDemo()) while (stepDemo());
  else if (isPractice()) scriptKeys().forEach(processToken);
}

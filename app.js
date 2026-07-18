import languageProfiles from "./content/language-profiles.json";
import { spriteCells } from "./exercise-data.js";
import { findNextSequentialUnit } from "./unit-navigation.js";
import { canonicalKeyToken, VimEngine, resetVimEngineState } from "./vim-engine.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const urlParams = new URLSearchParams(window.location.search);
const unitModules = import.meta.glob("./content/units/[0-9][0-9]-*.json", { eager: true, import: "default" });
const units = Object.values(unitModules).sort((left, right) => left.unitNumber - right.unitNumber);
const requestedUnitId = urlParams.get("unit");
const unit = units.find(candidate => candidate.id === requestedUnitId) || units[0];
const themePreferenceKey = "vim-wilds.theme";
const allowedThemes = new Set(["auto", "moonroot", "ember", "glass", "deepwater"]);

const elements = {
  phone: $("#phone"),
  modePill: $("#nextModePill"),
  resetButton: $("#nextResetButton"),
  lessonLabel: $("#lessonLabel"),
  tocButton: $("#tocButton"),
  settingsButton: $("#settingsButton"),
  activityIntro: $("#activityIntro"),
  activityKicker: $("#activityKicker"),
  activityTitle: $("#activityTitle"),
  activityInstruction: $("#activityInstruction"),
  hintButton: $("#hintButton"),
  world: $("#world"),
  groundGrid: $("#groundGrid"),
  worldGrid: $("#worldGrid"),
  helpCard: $("#helpCard"),
  helpClose: $("#helpClose"),
  hintSteps: $("#hintSteps"),
  activityControls: $("#activityControls"),
  keyboardPanel: $(".keyboard-panel"),
  commandTray: $("#nextCommandTray"),
  commandText: $("#nextCommandText"),
  guidance: $("#nextGuidance"),
  commandExplanation: $("#commandExplanation"),
  statusPrimary: $("#statusPrimary"),
  statusSecondary: $("#statusSecondary"),
  statusKey: $("#statusKey"),
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

const themeColors = {
  moonroot: ["#071d18", "#1c533d", "#77e0a3", "#a77bff", "#ffc866"],
  ember: ["#20120e", "#683420", "#f59a61", "#ff7468", "#ffd06c"],
  glass: ["#0b1722", "#234f68", "#78dbea", "#b89cff", "#ffe08b"],
  deepwater: ["#07151d", "#123f4e", "#55bfd0", "#888cff", "#f6bd63"],
};

const lessons = unit.lessons.map((lesson, lessonIndex) => ({ ...lesson, lessonIndex }));
const contextualizeActivity = (activity, lesson, activityIndex, extra = {}) => ({
  ...activity,
  ...extra,
  lessonId: lesson.id,
  lessonTitle: lesson.title,
  lessonIndex: lesson.lessonIndex,
  authoredActivityIndex: activityIndex,
});
const activityFlowFor = lesson => {
  const authored = lesson.activities.map((activity, activityIndex) => contextualizeActivity(activity, lesson, activityIndex));
  const practices = authored.filter(activity => activity.type === "exercise");
  const leadIn = authored.filter(activity => !["exercise", "choice", "summary"].includes(activity.type));
  const closing = authored.filter(activity => ["choice", "summary"].includes(activity.type));
  const guided = practices.filter(activity => (activity.delivery || "guided-then-recall") !== "recall")
    .map(activity => ({ ...activity, practiceMode: "guided", sourceActivityId: activity.id }));
  const recall = practices.filter(activity => (activity.delivery || "guided-then-recall") !== "guided")
    .map(activity => ({ ...activity, id: `${activity.id}-recall`, practiceMode: "recall", sourceActivityId: activity.id }));
  return [...leadIn, ...guided, ...recall, ...closing];
};
const activities = lessons.flatMap(activityFlowFor).map((activity, activityIndex) => ({ ...activity, activityIndex }));
const exercises = activities.filter(activity => activity.type === "exercise" && activity.practiceMode === "guided");
const languageNames = new Map(languageProfiles.profiles.map(profile => [profile.id, profile.displayName]));

let characterAssets = {
  nix: {
    name: "Nix",
    role: "guide",
    idle: "assets/characters/nix/idle.png",
    animations: { "joyful-hop": { src: "assets/characters/nix/animations/joyful-hop.webp", css_scale: 1.375 } },
  },
};
const characterAssignments = new Map();

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
  hintLevel: 0,
  consecutiveMistakes: 0,
  recallFeedback: null,
  errorTimer: null,
  remediationReturnId: null,
};

let vimEngine = null;
let executionMeasurementFrame = null;

function currentActivity() {
  return activities[state.activityIndex];
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function characterKey(activity) {
  return activity?.sourceActivityId || activity?.id;
}

function assignCharacters() {
  characterAssignments.clear();
  const characterIds = shuffle(Object.keys(characterAssets));
  const keys = [...new Set(activities.map(characterKey))];
  keys.forEach((key, index) => {
    const characterId = characterIds[index % characterIds.length];
    const animationIds = Object.keys(characterAssets[characterId].animations);
    const animationId = animationIds[Math.floor(Math.random() * animationIds.length)];
    characterAssignments.set(key, { characterId, animationId });
  });
}

function characterAssignment(activity = currentActivity()) {
  return characterAssignments.get(characterKey(activity)) || { characterId: "nix", animationId: "joyful-hop" };
}

async function loadCharacterAssets() {
  try {
    const response = await fetch("assets/characters/manifest.json");
    if (!response.ok) throw new Error(`manifest request failed (${response.status})`);
    const manifest = await response.json();
    characterAssets = Object.fromEntries(Object.entries(manifest.characters).map(([id, character]) => [id, character]));
    assignCharacters();
    document.documentElement.dataset.charactersReady = "true";
    renderAll();
  } catch (error) {
    document.documentElement.dataset.charactersReady = "fallback";
    console.warn("Using the Nix-only character fallback:", error);
  }
}

function isRunnable(activity = currentActivity()) {
  return activity?.type === "demo" || activity?.type === "exercise";
}

function hasEditor(activity = currentActivity()) {
  return isRunnable(activity) || Boolean(activity?.inspection);
}

function initialStateFor(activity = currentActivity()) {
  return activity?.scenario?.initial || activity?.inspection?.initial || null;
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

function renderInline(value) {
  const source = String(value ?? "");
  return source.split(/(`[^`]*`)/g).map(part => {
    if (part.startsWith("`") && part.endsWith("`")) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    const escaped = escapeHtml(part);
    const bold = escaped.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    return bold.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  }).join("");
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

function presentationFor(activity = currentActivity()) {
  return presentations[activity.lessonIndex % presentations.length];
}

function setTheme(theme) {
  const activeTheme = state.themePreference !== "auto" ? state.themePreference : theme;
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

function renderRoutes(routes = []) {
  if (!routes.length) return "";
  return `<div class="note-routes">${routes.map(route => `<button class="note-action${route.emphasis === "secondary" ? " secondary-action" : ""}" type="button" data-route="${escapeHtml(route.activityRef)}">${renderInline(route.label)}</button>`).join("")}</div>`;
}

function nextSequentialUnit() {
  return findNextSequentialUnit(units, unit);
}

function renderUnitContinuation(activity) {
  const nextUnit = nextSequentialUnit();
  const primaryAction = nextUnit
    ? `<button class="note-action" type="button" data-unit-id="${escapeHtml(nextUnit.id)}">Continue to Unit ${nextUnit.unitNumber} →</button>`
    : `<div class="unit-coming-soon"><span>Unit ${unit.unitNumber + 1} is next</span><strong>Coming soon</strong></div>
       <button class="note-action" type="button" data-action="open-toc">Open course contents</button>`;
  return `<div class="unit-continuation">${primaryAction}${renderRoutes(activity.routes)}</div>`;
}

function modeDisplayName(mode) {
  return ({
    normal: "Normal",
    insert: "Insert",
    replace: "Replace",
    "operator-pending": "Operator-pending",
    visual: "Visual Character",
    "visual-line": "Visual Line",
    "visual-block": "Visual Block",
    "command-line": "Command-line",
  })[mode] || mode;
}

function modePillName(mode) {
  return ({
    "operator-pending": "Op-pending",
    visual: "Visual Char",
    "command-line": "Command",
  })[mode] || modeDisplayName(mode);
}

function renderTheoryPresentation(presentation) {
  if (!presentation) return "";
  if (presentation.kind === "mode-compass") {
    return `<div class="mode-compass" aria-label="Vim mode compass">
      <div class="mode-home"><strong>Normal</strong><small>home base</small></div>
      <div class="mode-spokes">${presentation.transitions.filter(item => item.mode !== "normal").map(item => `
        <div class="mode-spoke mode-${escapeHtml(item.mode)}">
          <span>${escapeHtml(item.enterKeys.join(" / "))}</span><strong>${escapeHtml(modeDisplayName(item.mode))}</strong>
          <small>${escapeHtml(item.purpose)}</small><em>${escapeHtml(item.exitKeys.join(" / "))} ↩</em>
        </div>`).join("")}</div>
    </div>`;
  }
  return `<div class="command-forge" aria-label="Command assembly">${presentation.parts.map((part, index) => `
    ${index ? '<span class="forge-plus" aria-hidden="true">+</span>' : ""}
    <div class="forge-part role-${part.role}"><kbd>${escapeHtml(part.keys)}</kbd><strong>${escapeHtml(part.role)}</strong><small>${escapeHtml(part.meaning)}</small></div>`).join("")}</div>`;
}

function renderFieldNote(activity) {
  if (activity.type === "theory") {
    const lessonTheories = lessons[activity.lessonIndex].activities.filter(item => item.type === "theory");
    const isFinalTheory = lessonTheories.at(-1)?.id === activity.id;
    const action = state.remediationReturnId
      ? '<button class="note-action" type="button" data-action="return-remediation">Back to quick check →</button>'
      : activity.routes?.length ? renderRoutes(activity.routes) : isFinalTheory && activity.demoRef
      ? `<button class="note-action" type="button" data-action="show-demo" data-demo="${activity.demoRef}">Show example →</button>`
      : '<button class="note-action" type="button" data-action="next">Next →</button>';
    return `<article class="field-note" aria-label="Theory">
      <span class="field-note-kicker">Field note · explain</span>
      <h2>${renderInline(activity.title)}</h2>
      <p>${renderInline(activity.body)}</p>
      ${renderTheoryPresentation(activity.presentation)}
      ${activity.grammar ? `<pre class="grammar">${escapeHtml(activity.grammar)}</pre>` : ""}
      ${activity.contrast ? `<p class="contrast">${renderInline(activity.contrast)}</p>` : ""}
      ${action}
    </article>`;
  }
  if (activity.type === "choice") {
    const choices = activity.options.map(option => `<button class="choice-option${state.choiceResult === option.id ? " selected" : ""}" data-choice="${option.id}" type="button">${renderInline(option.label)}</button>`).join("");
    const result = state.choiceResult ? `<p class="choice-feedback ${state.complete ? "correct" : ""}">${renderInline(activity.explanation)}</p>` : "";
    const remediation = state.choiceResult && !state.complete && activity.remediationRef
      ? `<button class="note-action secondary-action remediation-action" type="button" data-remediation="${escapeHtml(activity.remediationRef)}">Review this idea</button>` : "";
    const next = state.complete ? '<button class="note-action" type="button" data-action="next">Next →</button>' : "";
    return `<article class="field-note choice-note" aria-label="Tool choice challenge">
      <span class="field-note-kicker">Challenge · choose</span><h2>${renderInline(activity.title)}</h2>
      <p>${renderInline(activity.prompt)}</p><div class="choice-options">${choices}</div>${result}${remediation}${next}
    </article>`;
  }
  return `<article class="field-note summary-note" aria-label="Lesson summary">
    <span class="field-note-kicker">Lesson summary</span><h2>${renderInline(activity.title)}</h2>
    <p>${renderInline(activity.body)}</p><ul>${activity.takeaways.map(takeaway => `<li>${renderInline(takeaway)}</li>`).join("")}</ul>
    ${activity.activityIndex === activities.length - 1
      ? renderUnitContinuation(activity)
      : activity.routes?.length ? renderRoutes(activity.routes) : '<button class="note-action" type="button" data-action="next">Next →</button>'}
  </article>`;
}

function renderActivityIntro() {
  const activity = currentActivity();
  const show = isRunnable(activity);
  elements.activityIntro.hidden = !show;
  if (!show) return;
  const practiceLabel = activity.practiceMode === "guided" ? "Guided practice" : activity.practiceMode === "recall" ? "Recall practice" : "Demo";
  elements.activityKicker.textContent = `${practiceLabel} · ${languageLabel(activity)}`;
  elements.activityTitle.innerHTML = renderInline(activity.title);
  elements.activityInstruction.innerHTML = renderInline(activity.instruction);
  elements.hintButton.hidden = !isPractice(activity);
}

function renderWorld() {
  const activity = currentActivity();
  const presentation = presentationFor(activity);
  if (!hasEditor(activity)) {
    vimEngine?.destroy();
    vimEngine = null;
    resetVimEngineState();
  }
  setTheme(presentation.theme);
  renderGround(presentation);
  const initialState = initialStateFor(activity);
  const content = isRunnable(activity)
    ? `<div class="editor-stack" style="--editor-height:${108 + initialState.lines.length * 24}px">
          <div class="code-slab next-code-slab"><div class="code-body" id="editorMount" aria-label="Vim lesson editor"></div></div>
          ${isDemo(activity) ? '<div class="demo-controls" id="demoControls" aria-label="Demo controls"></div>' : ""}
        </div>`
    : activity.inspection
      ? `<div class="inspection-layout">
          <div class="code-slab inspection-code-slab"><div class="code-body" id="editorMount" aria-label="Vim inspection editor"></div></div>
          <div class="inspection-choice">${renderFieldNote(activity)}</div>
        </div>`
    : `<div class="field-note-wrap side-${presentation.codeSide}">${renderFieldNote(activity)}</div>`;
  const assignment = characterAssignment(activity);
  const character = characterAssets[assignment.characterId] || characterAssets.nix;
  const shouldShowCharacter = (isPractice(activity) || activity.type === "choice") && !activity.inspection;
  const characterMarkup = shouldShowCharacter
    ? `<img class="nix ${presentation.codeSide}" data-character="${assignment.characterId}" data-animation="${assignment.animationId}" src="${character.idle}" alt="${escapeHtml(`${character.name}, ${character.role}`)}">`
    : "";
  const spriteMarkup = activity.inspection ? "" : renderSprites(presentation);
  elements.worldGrid.innerHTML = `${spriteMarkup}${content}${characterMarkup}`;
  if (hasEditor(activity)) mountEditor();
}

function mountEditor() {
  vimEngine?.destroy();
  resetVimEngineState();
  const activity = currentActivity();
  const initial = initialStateFor(activity);
  const startCursor = initial.setup?.cursor || initial.cursor;
  vimEngine = new VimEngine({
    parent: $("#editorMount", elements.worldGrid),
    text: initial.lines.join("\n"),
    cursor: startCursor,
    language: activity.languageId,
    wrapColumns: activity.editor?.wrapColumns,
    onEvent: handleEngineEvent,
  });
  for (const step of initial.setup?.steps || []) {
    const key = typeof step === "string" ? step : step.key;
    vimEngine.sendKey(key, { bypassLock: true, source: "setup" });
  }
  state.editorSnapshot = vimEngine.getSnapshot();
  const setupMatches = state.editorSnapshot.text === initial.lines.join("\n")
    && state.editorSnapshot.mode === initial.mode
    && state.editorSnapshot.cursorPosition[0] === initial.cursor[0]
    && state.editorSnapshot.cursorPosition[1] === initial.cursor[1];
  if (!setupMatches) console.warn(`Initial editor setup drifted for ${activity.id}`, state.editorSnapshot, initial);
  vimEngine.setLocked(!isPractice(activity));
  if (state.complete && activity.inspection?.revealRange) vimEngine.showPreviewRange(activity.inspection.revealRange);
  if (!window.matchMedia("(pointer: coarse)").matches) vimEngine.focus();
}

function modeLabel() {
  const activity = currentActivity();
  if (activity.type === "choice" && activity.questionKind === "mode-identification" && !state.complete) return "Identify";
  if (activity.type === "choice" && activity.questionKind === "mode-identification" && state.complete) return modePillName(state.editorSnapshot?.mode || activity.inspection?.initial.mode);
  if (state.complete) return "Complete";
  if (!isRunnable()) return currentActivity().type === "theory" ? "Theory" : "Review";
  const mode = state.editorSnapshot?.mode || "normal";
  return modePillName(mode);
}

function renderMode() {
  const label = modeLabel();
  elements.modePill.textContent = label;
  const actualMode = state.editorSnapshot?.mode || "normal";
  const kind = /complete/i.test(label) ? "complete" : /identify/i.test(label) ? "identify" : actualMode;
  elements.modePill.className = `mode-pill mode-${kind}`.trim();
  elements.world.dataset.mode = actualMode;
}

function activeCommandGroup(activity = currentActivity(), step = state.playbackStep) {
  return activity.script?.commandGroups.find(group => step >= group.from && step < group.to)
    || activity.script?.commandGroups.at(-1);
}

function executionContent(activity, step, history, complete = false) {
  const keys = scriptKeys(activity);
  const structured = activity.script.steps.filter(item => typeof item === "object" && ["count", "operator", "motion", "text-object"].includes(item.kind));
  const group = activeCommandGroup(activity, step);
  const done = complete || step >= keys.length;
  const recall = activity.practiceMode === "recall" && !done;
  const reveal = recall && state.recallFeedback === "reveal";
  const retry = recall && state.recallFeedback === "retry";
  return {
    explanation: group?.explanation || "Follow the authored command sequence.",
    history,
    primary: done ? (activity.type === "demo" ? "Demo" : "Practice") : activity.type === "demo" ? `Step ${step + 1} of ${keys.length}` : retry ? "Try" : reveal ? "Next" : recall ? "Recall" : "Next",
    secondary: done ? "Complete" : retry ? "Again" : reveal ? "A clue" : recall ? "From memory" : "",
    key: done || (recall && !reveal) ? null : keys[step],
    assembly: structured.length ? activity.script.steps.map((item, index) => typeof item === "object" && ["count", "operator", "motion", "text-object"].includes(item.kind)
      ? { key: item.key, kind: item.kind, cue: item.cue, active: index < step || done }
      : null).filter(Boolean) : [],
  };
}

function applyExecutionContent(root, content) {
  const assembly = content.assembly.length ? `<div class="execution-assembly">${content.assembly.map(part => `<span class="assembly-part role-${part.kind}${part.active ? " active" : ""}"><kbd>${escapeHtml(part.key)}</kbd><small>${escapeHtml(part.cue || part.kind)}</small></span>`).join('<i aria-hidden="true">+</i>')}</div>` : "";
  $(".command-explanation", root).innerHTML = `${renderInline(content.explanation)}${assembly}`;
  $(".command-text", root).innerHTML = renderHistory(content.history);
  $(".status-primary", root).textContent = content.primary;
  $(".status-secondary", root).textContent = content.secondary;
  const key = $(".status-key", root);
  key.innerHTML = content.key ? renderKeycap(content.key, "status-command-key") : "";
  key.hidden = !content.key;
}

function measureExecutionConsole() {
  executionMeasurementFrame = null;
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
  if (executionMeasurementFrame) return;
  executionMeasurementFrame = window.requestAnimationFrame(measureExecutionConsole);
}

function renderCommand() {
  const activity = currentActivity();
  if (!isRunnable(activity)) {
    elements.commandExplanation.textContent = "";
    elements.commandTray.classList.add("hidden");
    return;
  }
  elements.commandTray.classList.remove("hidden");
  const step = isDemo(activity) ? state.playbackStep : state.progress;
  applyExecutionContent(elements.commandTray, executionContent(activity, step, state.history, state.complete));
  scheduleExecutionConsoleMeasurement();
}

function renderHeader() {
  const activity = currentActivity();
  elements.lessonLabel.textContent = activity.lessonTitle;
  elements.resetButton.hidden = !isRunnable(activity);
  renderTableOfContents();
}

function renderHints() {
  const hints = isPractice() ? currentActivity().hints : [];
  elements.hintSteps.innerHTML = hints.slice(0, state.hintLevel).map((hint, index) => `<div class="hint-step"><kbd>Hint ${index + 1}</kbd><small>${renderInline(hint)}</small></div>`).join("");
}

function renderActivityControls() {
  const activity = currentActivity();
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
      <span>${activity.practiceMode === "recall" ? "Recall complete" : "Guided practice complete"}</span>
      <strong>${renderInline(feedback.success || "Practice complete.")}</strong>
      <p>${renderInline(feedback.why || "Continue when you are ready.")}</p>
      <button class="primary-action" data-action="next" type="button">Next →</button>
    </section>`;
    return;
  }
  if (isPractice(activity) && state.recallFeedback === "reveal" && activity.remediationRef) {
    elements.activityControls.innerHTML = `<button class="review-idea-action" type="button" data-remediation="${escapeHtml(activity.remediationRef)}">Review this idea</button>`;
    return;
  }
  elements.activityControls.innerHTML = "";
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
}

function activityTypeLabel(type) {
  return ({ theory: "Theory", demo: "Demo", exercise: "Exercise", choice: "Choice", summary: "Summary" })[type] || type;
}

function renderTableOfContents() {
  const current = currentActivity();
  const lessonMarkup = lessons.map((lesson, lessonIndex) => {
    const lessonActivities = activities.filter(activity => activity.lessonId === lesson.id);
    const rows = lessonActivities.map((activity, activityIndex) => {
      const globalIndex = activities.indexOf(activity);
      const isCurrent = globalIndex === state.activityIndex;
      return `<button class="toc-activity${isCurrent ? " current" : ""}" type="button" data-activity-index="${globalIndex}" ${isCurrent ? 'aria-current="page"' : ""}>
        <span class="toc-number">${lessonIndex + 1}.${activityIndex + 1}</span>
        <span class="toc-activity-title">${renderInline(activity.title)}</span>
        <span class="activity-type type-${activity.practiceMode || activity.type}">${activity.practiceMode ? escapeHtml(activity.practiceMode) : activityTypeLabel(activity.type)}</span>
      </button>`;
    }).join("");
    return `<details class="toc-lesson" ${lesson.id === current.lessonId ? "open" : ""}>
      <summary><span>${lessonIndex + 1}</span><strong>${renderInline(lesson.title)}</strong><small>${lessonActivities.length} activities</small></summary>
      <div class="toc-activities">${rows}</div>
    </details>`;
  }).join("");
  elements.tocLessons.innerHTML = units.map(candidate => {
    const isCurrent = candidate.id === unit.id;
    const summary = `<span>Unit ${candidate.unitNumber}</span><strong>${renderInline(candidate.title)}</strong><small>${candidate.lessons.length} lessons</small>`;
    return isCurrent
      ? `<details class="toc-unit" open><summary>${summary}</summary><div class="toc-unit-lessons">${lessonMarkup}</div></details>`
      : `<div class="toc-unit toc-unit-link"><button type="button" data-unit-id="${escapeHtml(candidate.id)}">${summary}</button></div>`;
  }).join("");
}

function renderThemeOptions() {
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
  state.hintLevel = 0;
  clearPracticeError();
  setHelp(false);
  renderAll();
  if (vibrateReset) vibrate(9);
}

function goToActivity(index, { preserveRemediation = false } = {}) {
  if (!Number.isInteger(index) || index < 0 || index >= activities.length) throw new RangeError("Invalid activity index");
  elements.tocDialog?.close();
  if (!preserveRemediation) state.remediationReturnId = null;
  state.activityIndex = index;
  resetActivity({ vibrateReset: false });
}

function navigateToUnit(unitId) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("unit", unitId);
  nextUrl.searchParams.delete("activity");
  window.location.assign(nextUrl);
}

function openTableOfContents() {
  renderTableOfContents();
  elements.tocDialog.showModal();
}

function nextActivity() {
  if (isPractice() && !state.complete) return;
  if (currentActivity().type === "choice" && !state.complete) return;
  if (state.activityIndex === activities.length - 1) {
    const nextUnit = nextSequentialUnit();
    if (nextUnit) navigateToUnit(nextUnit.id);
    else openTableOfContents();
    return;
  }
  goToActivity(state.activityIndex + 1);
}

function previousActivity() {
  if (state.activityIndex > 0) goToActivity(state.activityIndex - 1);
}

function goToActivityId(id, options) {
  const index = activities.findIndex(activity => activity.id === id || activity.sourceActivityId === id);
  if (index >= 0) goToActivity(index, options);
}

function goToRemediation(id) {
  state.remediationReturnId = currentActivity().id;
  goToActivityId(id, { preserveRemediation: true });
}

function returnFromRemediation() {
  const returnId = state.remediationReturnId;
  if (!returnId) return;
  state.remediationReturnId = null;
  goToActivityId(returnId);
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
  if (currentActivity().type === "choice") renderWorld();
  if (isPractice() || currentActivity().type === "choice") playSuccessCharacter();
  renderMode();
  renderCommand();
  renderActivityControls();
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

function clearPracticeError() {
  if (state.errorTimer) window.clearTimeout(state.errorTimer);
  state.errorTimer = null;
  state.recallFeedback = null;
  state.consecutiveMistakes = 0;
  elements.statusKey?.classList.remove("error");
}

function flashWrongKey(button) {
  if (!button) return;
  button.classList.remove("wrong");
  void button.offsetWidth;
  button.classList.add("wrong");
  window.setTimeout(() => button.classList.remove("wrong"), 360);
}

function flashError(token, button) {
  elements.commandTray.classList.remove("error");
  void elements.commandTray.offsetWidth;
  elements.commandTray.classList.add("error");
  window.setTimeout(() => elements.commandTray.classList.remove("error"), 300);
  if (!isPractice()) return;
  if (currentActivity().practiceMode === "guided") {
    elements.statusKey?.classList.remove("error");
    void elements.statusKey?.offsetWidth;
    elements.statusKey?.classList.add("error");
    window.setTimeout(() => elements.statusKey?.classList.remove("error"), 420);
    return;
  }
  // Only a touched on-screen key gets a red flash. Physical keys retain the
  // compact rail feedback without inventing a keyboard interaction.
  flashWrongKey(button);
  state.consecutiveMistakes += 1;
  state.recallFeedback = state.consecutiveMistakes >= 3 ? "reveal" : "retry";
  if (state.errorTimer) window.clearTimeout(state.errorTimer);
  renderCommand();
  renderActivityControls();
  state.errorTimer = window.setTimeout(() => {
    state.errorTimer = null;
    if (state.recallFeedback === "reveal") state.consecutiveMistakes = 0;
    state.recallFeedback = null;
    renderCommand();
    renderActivityControls();
  }, state.recallFeedback === "reveal" ? 1400 : 520);
}

function processToken(token, button) {
  if (!isPractice() || state.complete || !vimEngine) return false;
  const expected = scriptKeys()[state.progress];
  if (token !== expected) {
    flashError(token, button);
    return false;
  }
  clearPracticeError();
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
    const checkpoint = currentActivity().script.checkpoints?.find(item => item.afterStep === state.playbackStep);
    const demonstratesIntermediateMode = unit.unitNumber === 1 && checkpoint?.mode && checkpoint.mode !== "normal";
    const delay = demonstratesIntermediateMode ? Math.max(interval, 1200) : interval;
    state.playbackTimer = window.setTimeout(tick, delay);
    renderActivityControls();
  };
  tick();
}

function setHelp(open) {
  const canHelp = isPractice();
  if (open && canHelp) {
    state.hintLevel = Math.min(currentActivity().hints.length, state.hintLevel + 1);
    renderHints();
  }
  elements.helpCard.classList.toggle("open", Boolean(open && canHelp));
  elements.helpCard.setAttribute("aria-hidden", String(!(open && canHelp)));
  elements.hintButton?.setAttribute("aria-expanded", String(Boolean(open && canHelp)));
  $$(".key", elements.keyboard).forEach(button => button.classList.remove("hinted"));
  if (open && canHelp) {
    scriptKeys().forEach(token => requiredButtons(token).forEach(button => button.classList.add("hinted")));
    vibrate(5);
  }
  // The hint control receives browser focus on tap. Restore the practice
  // editor immediately so physical Vim input remains uninterrupted.
  if (canHelp) vimEngine?.focus();
}

function playSuccessCharacter() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const character = $(".nix", elements.worldGrid);
  const asset = characterAssets[character?.dataset.character || ""];
  const animation = asset?.animations?.[character?.dataset.animation || ""];
  if (!character || !animation?.src) return;
  const celebrating = character.cloneNode();
  celebrating.src = animation.src;
  celebrating.alt = `${asset.name}, celebrating`;
  celebrating.style.setProperty("--success-canvas-scale", String(animation.css_scale || 1));
  let started = false;
  const startTransition = () => {
    if (started || !state.complete || !character.isConnected) return;
    started = true;
    celebrating.classList.add("celebrating", "transitioning-in");
    character.classList.add("transitioning-out");
    character.setAttribute("aria-hidden", "true");
    character.after(celebrating);
    window.setTimeout(() => character.remove(), 420);
  };
  celebrating.decode().then(startTransition, startTransition);
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
  if (chordModifiers.some(modifier => modifier !== "Shift")) token = canonicalKeyToken(`${chordModifiers.join("+")}+${value.toLowerCase()}`);
  state.modifiers.clear();
  renderModifiers();
  processToken(token, button);
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
  if (action === "return-remediation") returnFromRemediation();
  if (action === "open-toc") openTableOfContents();
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
    flashError(token);
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
  const remediation = event.target.closest("[data-remediation]")?.dataset.remediation;
  if (remediation) goToRemediation(remediation);
  const route = event.target.closest("[data-route]")?.dataset.route;
  if (route) goToActivityId(route);
  const unitId = event.target.closest("[data-unit-id]")?.dataset.unitId;
  if (unitId) navigateToUnit(unitId);
});
const editorPointerEvents = ["pointerdown", "mousedown", "dblclick", "selectstart", "contextmenu"];
editorPointerEvents.forEach(type => elements.worldGrid.addEventListener(type, event => {
  if (!event.target.closest?.(".cm-content, .cm-gutters")) return;
  event.preventDefault();
  event.stopPropagation();
}, true));
elements.helpClose.addEventListener("click", () => setHelp(false));
elements.resetButton.addEventListener("click", () => resetActivity());
elements.hintButton?.addEventListener("click", () => setHelp(!elements.helpCard.classList.contains("open")));
elements.tocButton?.addEventListener("click", () => {
  openTableOfContents();
});
elements.settingsButton?.addEventListener("click", () => {
  renderThemeOptions();
  elements.settingsDialog.showModal();
});
elements.tocLessons?.addEventListener("click", event => {
  const button = event.target.closest("[data-activity-index]");
  if (button) goToActivity(Number(button.dataset.activityIndex));
  const unitButton = event.target.closest("[data-unit-id]");
  if (unitButton) navigateToUnit(unitButton.dataset.unitId);
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
  const remediation = event.target.closest("[data-remediation]")?.dataset.remediation;
  if (remediation) goToRemediation(remediation);
  const route = event.target.closest("[data-route]")?.dataset.route;
  if (route) goToActivityId(route);
});

window.addEventListener("resize", () => {
  elements.phone.style.removeProperty("--execution-console-height");
  scheduleExecutionConsoleMeasurement();
});
document.fonts?.ready.then(scheduleExecutionConsoleMeasurement);

window.VimWilds = Object.freeze({
  units: units.map(candidate => ({ id: candidate.id, unitNumber: candidate.unitNumber, title: candidate.title })),
  unit: { id: unit.id, unitNumber: unit.unitNumber, title: unit.title },
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
      unitId: unit.id,
      unitNumber: unit.unitNumber,
      activityIndex: state.activityIndex,
      activityId: currentActivity().id,
      activityType: currentActivity().type,
      lessonId: currentActivity().lessonId,
      exerciseIndex: isPractice() ? exercises.findIndex(exercise => exercise.sourceActivityId === currentActivity().sourceActivityId) : -1,
      exerciseId: isPractice() ? currentActivity().sourceActivityId : null,
      sourceActivityId: currentActivity().sourceActivityId || currentActivity().id,
      practiceMode: currentActivity().practiceMode || null,
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

const requestedActivity = urlParams.get("activity");
const requestedIndex = activities.findIndex(activity => activity.id === requestedActivity || activity.sourceActivityId === requestedActivity);
if (requestedIndex >= 0) state.activityIndex = requestedIndex;

assignCharacters();
renderAll();
renderThemeOptions();
void loadCharacterAssets();

if (urlParams.get("preview") === "complete") {
  if (isDemo()) while (stepDemo());
  else if (isPractice()) scriptKeys().forEach(processToken);
}

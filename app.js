import {
  exercises,
  knownTemplates,
  knownThemes,
  spriteCells,
} from "./exercise-data.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const elements = {
  phone: $("#phone"),
  locationLabel: $("#locationLabel"),
  progressPill: $("#progressPill"),
  modePill: $("#modePill"),
  resetButton: $("#resetButton"),
  quest: $("#quest"),
  eyebrow: $("#eyebrow"),
  questTitle: $("#questTitle"),
  questInstruction: $("#questInstruction"),
  gameArea: $("#gameArea"),
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
  commandTray: $("#commandTray"),
  commandText: $("#commandText"),
  guidance: $("#guidance"),
  keyboard: $("#keyboard"),
  rewardOverlay: $("#rewardOverlay"),
  rewardButton: $("#rewardButton"),
};

const themeLabels = {
  moonroot: "Moonroot Ruins",
  ember: "Ember Vault",
  glass: "Glass Garden",
  deepwater: "Deepwater Archive",
};

const themeColors = {
  moonroot: ["#071d18", "#1c533d", "#77e0a3", "#a77bff", "#ffc866"],
  ember: ["#20120e", "#683420", "#f59a61", "#ff7468", "#ffd06c"],
  glass: ["#0b1722", "#234f68", "#78dbea", "#b89cff", "#ffe08b"],
  deepwater: ["#07151d", "#123f4e", "#55bfd0", "#888cff", "#f6bd63"],
};

const state = {
  exerciseIndex: 0,
  progress: 0,
  history: [],
  modifiers: new Set(),
  complete: false,
  transitioning: false,
  pointerStartY: null,
  physicalShift: false,
};

function validateExercises(catalog) {
  const errors = [];
  const ids = new Set();
  const spriteTypes = new Set(Object.keys(spriteCells));

  if (catalog.length !== 11) errors.push(`Expected 11 exercises, received ${catalog.length}.`);

  catalog.forEach((exercise, index) => {
    const prefix = `Exercise ${index + 1} (${exercise.id || "missing id"})`;
    if (!exercise.id || ids.has(exercise.id)) errors.push(`${prefix}: id must be unique.`);
    ids.add(exercise.id);
    if (!knownThemes.includes(exercise.scene?.theme)) errors.push(`${prefix}: unknown theme.`);
    if (!knownTemplates.includes(exercise.scene?.template)) errors.push(`${prefix}: unknown template.`);
    if (!["left", "right"].includes(exercise.scene?.codeSide)) errors.push(`${prefix}: invalid code side.`);
    if (!Array.isArray(exercise.initialCode) || !exercise.initialCode.length || exercise.initialCode.length > 5) {
      errors.push(`${prefix}: initialCode must contain 1–5 lines.`);
    }
    if (!Array.isArray(exercise.targetCode) || !exercise.targetCode.length || exercise.targetCode.length > 5) {
      errors.push(`${prefix}: targetCode must contain 1–5 lines.`);
    }
    if (JSON.stringify(exercise.initialCode) === JSON.stringify(exercise.targetCode)) {
      errors.push(`${prefix}: initial and target code must differ.`);
    }
    if (!Array.isArray(exercise.solution) || !exercise.solution.length) errors.push(`${prefix}: missing solution.`);
    if (!Array.isArray(exercise.cursor) || exercise.cursor.length !== 2) errors.push(`${prefix}: invalid cursor.`);
    else if (
      exercise.cursor[0] < 0 ||
      exercise.cursor[0] >= exercise.initialCode.length ||
      exercise.cursor[1] < 0 ||
      exercise.cursor[1] > exercise.initialCode[exercise.cursor[0]].length
    ) errors.push(`${prefix}: cursor is outside the initial buffer.`);

    let previous = 0;
    const checkpointsByStep = new Map();
    (exercise.checkpoints || []).forEach(checkpoint => {
      if (checkpoint.at < previous || checkpoint.at > exercise.solution.length) {
        errors.push(`${prefix}: checkpoint ${checkpoint.at} is out of sequence.`);
      }
      if (checkpointsByStep.has(checkpoint.at)) errors.push(`${prefix}: checkpoint ${checkpoint.at} is duplicated.`);
      checkpointsByStep.set(checkpoint.at, checkpoint);

      if (checkpoint.selection?.kind === "block") {
        if (!checkpoint.cursor || checkpoint.cursor[0] !== checkpoint.selection.to[0] || checkpoint.cursor[1] !== checkpoint.selection.to[1]) {
          errors.push(`${prefix}: block selection at ${checkpoint.at} must end at its cursor.`);
        }
      }
      if (checkpoint.selection?.kind === "line" && checkpoint.mode?.toLowerCase().includes("visual")) {
        if (!checkpoint.cursor || checkpoint.cursor[0] !== checkpoint.selection.to[0]) {
          errors.push(`${prefix}: line selection at ${checkpoint.at} must end on its cursor row.`);
        }
      }
      previous = checkpoint.at;
    });

    exercise.solution.forEach((token, tokenIndex) => {
      const step = tokenIndex + 1;
      const finishesFind = tokenIndex > 0 && exercise.solution[tokenIndex - 1] === "f";
      if ((token === "j" || finishesFind) && !checkpointsByStep.get(step)?.cursor) {
        errors.push(`${prefix}: cursor-moving step ${step} (${token}) requires an explicit cursor checkpoint.`);
      }
    });
    const lastCheckpoint = exercise.checkpoints?.at(-1);
    if (!lastCheckpoint || lastCheckpoint.at !== exercise.solution.length || lastCheckpoint.code !== "target") {
      errors.push(`${prefix}: final checkpoint must resolve to target code at solution length.`);
    }

    (exercise.scene?.blocks || []).forEach(sceneBlock => {
      if (!spriteTypes.has(sceneBlock.type)) errors.push(`${prefix}: unknown block ${sceneBlock.type}.`);
      if (sceneBlock.col < 1 || sceneBlock.col > 12 || sceneBlock.row < 1 || sceneBlock.row > 9) {
        errors.push(`${prefix}: block ${sceneBlock.type} is outside the 12×9 grid.`);
      }
    });
  });

  if (errors.length) throw new Error(`Invalid exercise catalog:\n${errors.join("\n")}`);
  return true;
}

validateExercises(exercises);

function currentExercise() {
  return exercises[state.exerciseIndex];
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
  const labels = {
    "Ctrl-v": "CTRL+V",
    Escape: "ESC",
    Enter: "ENTER",
    " ": "SPACE",
    Tab: "TAB",
  };
  return labels[token] || token;
}

function guidanceToken(token) {
  if (token.startsWith("Ctrl-")) return `CTRL + ${token.slice(5).toUpperCase()}`;
  const labels = { Escape: "ESCAPE", Enter: "ENTER", " ": "SPACE", Tab: "TAB" };
  if (labels[token]) return labels[token];
  const shiftedKey = keyButtonsFor(token).find(button => button.dataset.shift === token);
  if (shiftedKey) return `SHIFT + ${shiftedKey.dataset.key.toUpperCase()}`;
  if (token.length === 1 && token !== token.toLowerCase()) return `SHIFT + ${token}`;
  return token;
}

function getVisualState(exercise = currentExercise()) {
  const visual = {
    code: exercise.initialCode,
    cursor: exercise.cursor,
    selection: null,
    mode: "Normal",
  };

  for (const checkpoint of exercise.checkpoints) {
    if (checkpoint.at > state.progress) break;
    if (checkpoint.code === "target") visual.code = exercise.targetCode;
    else if (Array.isArray(checkpoint.code)) visual.code = checkpoint.code;
    if (checkpoint.cursor) visual.cursor = checkpoint.cursor;
    if (checkpoint.selection) visual.selection = checkpoint.selection;
    if (checkpoint.code) visual.selection = null;
    if (checkpoint.mode) visual.mode = checkpoint.mode;
  }

  if (state.complete) {
    visual.code = exercise.targetCode;
    visual.selection = null;
    visual.mode = "Complete";
  }
  return visual;
}

function tokenKinds(line) {
  const kinds = Array.from({ length: line.length }, () => "");
  const mark = (start, end, kind) => {
    for (let i = Math.max(0, start); i < Math.min(line.length, end); i += 1) kinds[i] = kind;
  };

  const comment = line.indexOf("//");
  if (comment >= 0) mark(comment, line.length, "comment");

  for (const match of line.matchAll(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g)) {
    if (comment < 0 || match.index < comment) mark(match.index, match.index + match[0].length, "string");
  }
  for (const match of line.matchAll(/\b(?:const|let|var|if|return|false|true|function|test)\b/g)) {
    if (!kinds[match.index]) mark(match.index, match.index + match[0].length, "keyword");
  }
  for (const match of line.matchAll(/\b\d+\b/g)) {
    if (!kinds[match.index]) mark(match.index, match.index + match[0].length, "number");
  }
  return kinds;
}

function isSelected(selection, row, col) {
  if (!selection) return false;
  const [startRow, startCol] = selection.from;
  const [endRow, endCol] = selection.to;
  if (selection.kind === "line") return row >= startRow && row <= endRow;
  if (selection.kind === "block") {
    return row >= startRow && row <= endRow && col >= startCol && col <= endCol;
  }
  if (row < startRow || row > endRow) return false;
  if (startRow === endRow) return col >= startCol && col <= endCol;
  if (row === startRow) return col >= startCol;
  if (row === endRow) return col <= endCol;
  return true;
}

function renderCode(exercise, visual) {
  return visual.code.map((line, row) => {
    const kinds = tokenKinds(line);
    const chars = [...line].map((character, col) => {
      const classes = ["code-char"];
      if (kinds[col]) classes.push(kinds[col]);
      if (isSelected(visual.selection, row, col)) classes.push("selected");
      if (!state.complete && visual.cursor[0] === row && visual.cursor[1] === col) classes.push("cursor");
      return `<span class="${classes.join(" ")}">${escapeHtml(character)}</span>`;
    }).join("");
    const emptyCursor = !state.complete && visual.cursor[0] === row && visual.cursor[1] === line.length
      ? '<span class="code-char cursor"> </span>'
      : "";
    return `<div class="code-line"><span class="line-no">${row + 1}</span><span>${chars}${emptyCursor}</span></div>`;
  }).join("");
}

function groundType(template, row, col) {
  const edge = row === 1 || row === 9 || col === 1 || col === 12;
  const center = col >= 5 && col <= 8;
  switch (template) {
    case "causeway": return col <= 2 || col === 12 ? "water" : col >= 8 ? "stone" : "moss";
    case "islands": return edge || (row + col) % 7 === 0 ? "water" : center ? "stone" : "moss";
    case "altar": return edge || (col <= 2 && row <= 6) ? "water" : row >= 3 && row <= 7 ? "stone" : "moss";
    case "lanes": return col === 3 || col === 9 || row === 5 ? "stone" : edge ? "water" : "moss";
    case "mirrors": return edge ? "water" : (row + col) % 3 === 0 ? "stone" : "moss";
    case "beacons": return col <= 3 || col >= 10 ? "stone" : edge ? "water" : "moss";
    case "terminal": return edge ? "water" : row >= 2 && row <= 8 ? "stone" : "moss";
    case "bridge": return row === 5 ? "water" : col >= 8 ? "stone" : "moss";
    case "aqueduct": return row >= 4 && row <= 6 ? "water" : center ? "stone" : "moss";
    case "vines": return edge || (col < 3 && row > 4) ? "water" : (row + col) % 4 === 0 ? "stone" : "moss";
    case "echo": return edge ? "water" : (col <= 3 || col >= 10) ? "stone" : "moss";
    default: return edge ? "water" : "moss";
  }
}

function renderGround(exercise) {
  const cells = [];
  for (let row = 1; row <= 9; row += 1) {
    for (let col = 1; col <= 12; col += 1) {
      const type = groundType(exercise.scene.template, row, col);
      const glow = ((row * 13 + col * 7 + state.exerciseIndex * 3) % 29 === 0) ? " glow" : "";
      cells.push(`<div class="ground-cell ${type}${glow}"></div>`);
    }
  }
  elements.groundGrid.innerHTML = cells.join("");
}

function renderSprite(sceneBlock) {
  const [x, y] = spriteCells[sceneBlock.type];
  const xPos = `${(x * 100 / 3).toFixed(3)}%`;
  const yPos = `${(y * 100 / 3).toFixed(3)}%`;
  const active = state.progress >= sceneBlock.activatesAt ? " active" : "";
  const sizeClass = sceneBlock.size > 1 ? " size-2" : "";
  const style = [
    `grid-column:${sceneBlock.col} / span ${sceneBlock.size}`,
    `grid-row:${sceneBlock.row} / span ${sceneBlock.size}`,
    `--sprite-x:${xPos}`,
    `--sprite-y:${yPos}`,
  ].join(";");
  return `<div class="sprite type-${sceneBlock.type}${sizeClass}${active}" data-block="${sceneBlock.type}" style="${style}" aria-hidden="true"></div>`;
}

function setTheme(theme) {
  elements.world.className = `world theme-${theme}${state.complete ? " complete" : ""}`;
  const [dark, mid, bright, magic, warm] = themeColors[theme];
  elements.phone.style.setProperty("--theme-dark", dark);
  elements.phone.style.setProperty("--theme-mid", mid);
  elements.phone.style.setProperty("--theme-bright", bright);
  elements.phone.style.setProperty("--theme-magic", magic);
  elements.phone.style.setProperty("--theme-warm", warm);
}

function renderWorld() {
  const exercise = currentExercise();
  const visual = getVisualState(exercise);
  setTheme(exercise.scene.theme);
  renderGround(exercise);

  const oppositeSide = exercise.scene.codeSide === "left" ? "right" : "left";
  const code = `
    <div class="code-slab side-${exercise.scene.codeSide}">
      <div class="code-head"><i></i><span>${escapeHtml(exercise.language)} · buffer</span></div>
      <div class="code-body">${renderCode(exercise, visual)}</div>
    </div>`;
  const sprites = exercise.scene.blocks.map(renderSprite).join("");
  const character = `<img class="nix ${exercise.scene.codeSide}" src="assets/nix.png" alt="Nix, a lantern-moth apprentice">`;
  const oracle = `<button class="oracle ${oppositeSide}" type="button" data-action="help" aria-label="Open in-world help">?</button>`;
  elements.worldGrid.innerHTML = `${sprites}${code}${character}${oracle}`;
}

function modeClass(mode) {
  const lower = mode.toLowerCase();
  if (lower.includes("visual") || lower.includes("block")) return "visual";
  if (lower.includes("record")) return "recording";
  if (lower.includes("command")) return "command";
  if (lower.includes("complete")) return "complete";
  return "";
}

function renderMode() {
  const mode = getVisualState().mode;
  elements.modePill.textContent = mode;
  elements.modePill.className = `mode-pill ${modeClass(mode)}`.trim();
}

function renderCommand() {
  const history = state.history.map(formatToken).join(" ");
  const pending = [...state.modifiers].map(modifier => `${modifier.toUpperCase()} + …`).join(" ");
  if (!history && !pending) elements.commandText.innerHTML = '<span class="ghost">waiting…</span>';
  else elements.commandText.textContent = `${history}${history && pending ? "  " : ""}${pending}`;

  if (state.complete) {
    elements.guidance.textContent = state.exerciseIndex === exercises.length - 1 ? "MEMORY READY" : "NEXT: SWIPE UP";
  } else {
    const next = currentExercise().solution[state.progress];
    elements.guidance.textContent = `NEXT: ${guidanceToken(next)}`;
  }
}

function renderModifiers() {
  $$('[data-mod]', elements.keyboard).forEach(button => {
    button.classList.toggle("latched", state.modifiers.has(button.dataset.mod));
  });
  elements.keyboard.classList.toggle("shift-layer", state.modifiers.has("Shift") || state.physicalShift);
  renderCommand();
}

function renderHints() {
  elements.hintSteps.innerHTML = currentExercise().hints.map(hint => `
    <div class="hint-step">
      <kbd>${escapeHtml(hint.keys)}</kbd>
      <small>${escapeHtml(hint.label)}</small>
    </div>`).join("");
}

function renderHeader() {
  const exercise = currentExercise();
  elements.locationLabel.textContent = themeLabels[exercise.scene.theme];
  elements.progressPill.textContent = `${state.exerciseIndex + 1} / ${exercises.length}`;
  elements.eyebrow.textContent = `${exercise.skill} · ${exercise.language}`;
  elements.questTitle.textContent = exercise.title;
  elements.questInstruction.textContent = exercise.instruction;
}

function renderSuccess() {
  elements.successBanner.classList.toggle("show", state.complete);
  if (!state.complete) return;
  const last = state.exerciseIndex === exercises.length - 1;
  elements.successTitle.textContent = last ? "Chapter restored." : "Beautifully done.";
  elements.successText.textContent = last ? "Your Moonroot Memory is ready." : "Swipe up for the next spell.";
  elements.nextButton.textContent = last ? "Unlock ✦" : "Next ↑";
}

function renderAll() {
  renderHeader();
  renderWorld();
  renderMode();
  renderHints();
  renderModifiers();
  renderSuccess();
}

function keyButtonsFor(value) {
  return $$(".key", elements.keyboard).filter(button => button.dataset.key === value || button.dataset.shift === value);
}

function modifierButtonsFor(value) {
  return $$('[data-mod]', elements.keyboard).filter(button => button.dataset.mod === value);
}

function requiredButtons(token) {
  const result = [];
  if (token.startsWith("Ctrl-")) {
    result.push(...modifierButtonsFor("Ctrl"));
    result.push(...keyButtonsFor(token.slice(5)));
    return result;
  }
  const exact = keyButtonsFor(token);
  result.push(...exact);
  if (token.length === 1 && (token !== token.toLowerCase() || exact.some(button => button.dataset.shift === token))) {
    result.push(...modifierButtonsFor("Shift"));
  }
  return result;
}

function setHelp(open) {
  elements.helpCard.classList.toggle("open", open);
  elements.helpCard.setAttribute("aria-hidden", String(!open));
  $$(".key", elements.keyboard).forEach(button => button.classList.remove("hinted"));
  if (open) {
    currentExercise().solution.forEach(token => requiredButtons(token).forEach(button => button.classList.add("hinted")));
    vibrate(5);
  }
}

function flashKey(button) {
  if (!button) return;
  button.classList.add("pressed");
  window.setTimeout(() => button.classList.remove("pressed"), 110);
}

function showError() {
  elements.commandTray.classList.remove("error");
  void elements.commandTray.offsetWidth;
  elements.commandTray.classList.add("error");
  const expected = currentExercise().solution[state.progress];
  elements.guidance.textContent = `TRY: ${guidanceToken(expected)}`;
  vibrate([14, 25, 14]);
  window.setTimeout(() => {
    elements.commandTray.classList.remove("error");
    renderCommand();
  }, 850);
}

function finishExercise() {
  state.complete = true;
  setHelp(false);
  renderWorld();
  renderMode();
  renderCommand();
  window.setTimeout(renderSuccess, 160);
  vibrate([18, 35, 18]);
}

function processToken(token) {
  if (state.complete || state.transitioning) return false;
  setHelp(false);
  const exercise = currentExercise();
  if (token !== exercise.solution[state.progress]) {
    showError();
    return false;
  }

  state.history.push(token);
  state.progress += 1;
  if (state.progress === exercise.solution.length) {
    finishExercise();
    return true;
  }

  renderWorld();
  renderMode();
  renderCommand();
  vibrate(7);
  return true;
}

function toggleModifier(modifier) {
  if (state.modifiers.has(modifier)) state.modifiers.delete(modifier);
  else state.modifiers.add(modifier);
  renderModifiers();
  vibrate(5);
}

function emitFromButton(button) {
  if (button.dataset.mod) {
    toggleModifier(button.dataset.mod);
    return;
  }

  let value = button.dataset.key;
  if (state.modifiers.has("Shift")) value = button.dataset.shift || (value.length === 1 ? value.toUpperCase() : value);

  let token = value;
  if (state.modifiers.has("Ctrl")) token = `Ctrl-${value.toLowerCase()}`;
  else if (state.modifiers.has("Alt")) token = `Alt-${value}`;

  state.modifiers.clear();
  renderModifiers();
  processToken(token);
}

function resetExercise({ vibrateReset = true } = {}) {
  state.progress = 0;
  state.history = [];
  state.modifiers.clear();
  state.complete = false;
  state.transitioning = false;
  state.physicalShift = false;
  setHelp(false);
  elements.successBanner.classList.remove("show");
  renderAll();
  if (vibrateReset) vibrate(9);
}

function showReward() {
  elements.rewardOverlay.classList.add("open");
  elements.rewardOverlay.setAttribute("aria-hidden", "false");
  vibrate([20, 45, 20]);
}

function nextExercise() {
  if (!state.complete || state.transitioning) return;
  if (state.exerciseIndex === exercises.length - 1) {
    showReward();
    return;
  }
  state.transitioning = true;
  elements.world.classList.add("swipe-out");
  window.setTimeout(() => {
    state.exerciseIndex += 1;
    resetExercise({ vibrateReset: false });
    elements.world.classList.add("swipe-in");
    window.setTimeout(() => elements.world.classList.remove("swipe-in"), 420);
  }, 290);
}

elements.keyboard.addEventListener("pointerdown", event => {
  const button = event.target.closest(".key");
  if (!button) return;
  event.preventDefault();
  flashKey(button);
  emitFromButton(button);
});

document.addEventListener("keydown", event => {
  if (event.repeat || elements.rewardOverlay.classList.contains("open")) return;
  const modifierMap = { Control: "Ctrl", Shift: "Shift", Alt: "Alt" };
  if (modifierMap[event.key]) {
    if (event.key === "Shift") {
      state.physicalShift = true;
      renderModifiers();
    }
    modifierButtonsFor(modifierMap[event.key]).forEach(button => button.classList.add("pressed"));
    return;
  }

  let token = event.key;
  if (event.ctrlKey && event.key.length === 1) token = `Ctrl-${event.key.toLowerCase()}`;
  const matching = token.startsWith("Ctrl-")
    ? keyButtonsFor(token.slice(5))[0]
    : keyButtonsFor(event.key)[0] || keyButtonsFor(event.key.toLowerCase())[0];
  if (!matching && token !== currentExercise().solution[state.progress]) return;
  event.preventDefault();
  flashKey(matching);
  processToken(token);
});

document.addEventListener("keyup", event => {
  const modifierMap = { Control: "Ctrl", Shift: "Shift", Alt: "Alt" };
  if (modifierMap[event.key]) modifierButtonsFor(modifierMap[event.key]).forEach(button => button.classList.remove("pressed"));
  if (event.key === "Shift") {
    state.physicalShift = false;
    renderModifiers();
  }
});

elements.worldGrid.addEventListener("click", event => {
  if (event.target.closest('[data-action="help"]')) setHelp(!elements.helpCard.classList.contains("open"));
});
elements.helpClose.addEventListener("click", () => setHelp(false));
elements.resetButton.addEventListener("click", () => resetExercise());
elements.nextButton.addEventListener("click", nextExercise);

elements.gameArea.addEventListener("pointerdown", event => {
  if (event.target.closest("button")) return;
  state.pointerStartY = event.clientY;
});
elements.gameArea.addEventListener("pointerup", event => {
  if (state.pointerStartY === null) return;
  const distance = event.clientY - state.pointerStartY;
  state.pointerStartY = null;
  if (state.complete && distance < -42) nextExercise();
});

elements.rewardButton.addEventListener("click", () => {
  elements.rewardOverlay.classList.remove("open");
  elements.rewardOverlay.setAttribute("aria-hidden", "true");
  state.exerciseIndex = 0;
  resetExercise();
});

window.VimWilds = Object.freeze({
  exercises,
  emit: processToken,
  goTo(index) {
    if (!Number.isInteger(index) || index < 0 || index >= exercises.length) throw new RangeError("Invalid exercise index");
    state.exerciseIndex = index;
    resetExercise({ vibrateReset: false });
  },
  solveCurrent() {
    const remaining = currentExercise().solution.slice(state.progress);
    remaining.forEach(processToken);
  },
  getState() {
    const visual = getVisualState();
    return {
      exerciseIndex: state.exerciseIndex,
      exerciseId: currentExercise().id,
      progress: state.progress,
      history: [...state.history],
      complete: state.complete,
      code: [...visual.code],
      cursor: [...visual.cursor],
      selection: visual.selection ? structuredClone(visual.selection) : null,
      mode: visual.mode,
      modifiers: [...state.modifiers],
      guidance: elements.guidance.textContent,
    };
  },
});

renderAll();
requestAnimationFrame(() => {
  // Force a separate first-paint pass for the dense keyboard layer on mobile WebKit/Chromium.
  elements.keyboard.style.opacity = ".999";
  requestAnimationFrame(() => { elements.keyboard.style.opacity = "1"; });
});

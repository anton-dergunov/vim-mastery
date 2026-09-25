/* The execution console under the editor: the next key, the command being
 * assembled, and the height it reserves so it never jumps between steps.
 */

import { $ } from "../app/dom.js";
import { escapeHtml, renderHistory, renderInline, renderKeycap } from "../app/html.js";
import { elements, state } from "../app/context.js";
import {
  basePracticePolicy,
  currentActivity,
  isDemo,
  isFreePractice,
  isRunnable,
  practicePolicy,
  practicePolicyValues,
  scriptKeys,
} from "../app/activity.js";
import { impactMessage, shouldReportImpact } from "../editor/readouts.js";

let executionMeasurementFrame = null;
let executionMeasurementSignature = null;

export function activeCommandGroup(activity = currentActivity(), step = state.playbackStep) {
  return activity.script?.commandGroups.find(group => step >= group.from && step < group.to)
    || activity.script?.commandGroups.at(-1);
}

function executionAssembly(steps, step, done) {
  const parts = [];
  for (let index = 0; index < steps.length; index += 1) {
    const item = steps[index];
    if (typeof item !== "object") continue;
    const next = steps[index + 1];
    const isTextObjectPrefix = item.kind === "command"
      && ["inside", "around"].includes(item.cue)
      && typeof next === "object"
      && next.kind === "text-object";
    if (isTextObjectPrefix) {
      parts.push({
        key: `${item.key}${next.key}`,
        kind: "text-object",
        cue: `${item.cue} ${next.cue || "object"}`,
        active: done || index + 1 < step,
      });
      index += 1;
      continue;
    }
    if (!["count", "operator", "motion", "text-object"].includes(item.kind)) continue;
    parts.push({ key: item.key, kind: item.kind, cue: item.cue, active: done || index < step });
  }
  return parts;
}

function executionContent(activity, step, history, complete = false, preview = {}) {
  const keys = scriptKeys(activity);
  const group = activeCommandGroup(activity, step);
  const done = complete || step >= keys.length;
  const policy = preview.policy === undefined ? practicePolicy(activity) : preview.policy;
  const recallFeedback = preview.recallFeedback === undefined ? state.recallFeedback : preview.recallFeedback;
  const exploreTargetReached = preview.exploreTargetReached === undefined ? state.exploreTargetReached : preview.exploreTargetReached;
  const impact = preview.impact === undefined
    ? (shouldReportImpact() ? impactMessage() : "")
    : preview.impact;
  const explore = policy === practicePolicyValues.explore;
  const recall = policy === practicePolicyValues.recall && !done;
  const reveal = recall && recallFeedback === "reveal";
  const retry = recall && recallFeedback === "retry";
  if (explore) {
    return {
      explanation: exploreTargetReached
        ? "Target reached. Keep experimenting, undo, or reset whenever you like."
        : "Explore mode: use any Vim commands. The target will be detected if you reach it.",
      history,
      primary: "Explore",
      secondary: exploreTargetReached ? "Target reached" : "Target open",
      stepStatus: false,
      key: null,
      assembly: [],
      impact,
    };
  }
  return {
    explanation: recall && !reveal
      ? activity.instruction
      : group?.explanation || "Follow the authored command sequence.",
    history,
    primary: done ? (activity.type === "demo" ? "Demo" : "Practice") : activity.type === "demo" ? "Step" : retry ? "Try" : reveal ? "Next" : recall ? "Recall" : "Next",
    secondary: done ? "Complete" : activity.type === "demo" ? `${step + 1} / ${keys.length}` : retry ? "Again" : reveal ? "A clue" : recall ? "From\nmemory" : "",
    stepStatus: !done && activity.type === "demo",
    key: done || (recall && !reveal) ? null : keys[step],
    assembly: executionAssembly(activity.script.steps, step, done),
    impact,
  };
}

function applyExecutionContent(root, content) {
  const assembly = content.assembly.length
    ? `<div class="execution-assembly" style="--assembly-count:${content.assembly.length}">${content.assembly.map(part => `<span class="assembly-part role-${part.kind}${part.active ? " active" : ""}"><kbd>${escapeHtml(part.key)}</kbd><small>${escapeHtml(part.cue || part.kind)}</small></span>`).join("")}</div>`
    : "";
  $(".command-explanation", root).innerHTML = `${renderInline(content.explanation)}${assembly}`;
  const history = $(".command-text", root);
  history.innerHTML = renderHistory(content.history);
  history.scrollTop = history.scrollHeight;
  const impact = $(".impact-readout", root);
  impact.textContent = content.impact || "";
  // The readout takes the whole row when it is present so it never has to
  // ellipsize beside the label at 360px.
  $(".command-history-label", root).classList.toggle("has-impact", Boolean(content.impact));
  $(".status-primary", root).textContent = content.primary;
  $(".status-secondary", root).textContent = content.secondary;
  root.classList.toggle("is-step-status", content.stepStatus);
  const key = $(".status-key", root);
  key.innerHTML = content.key ? renderKeycap(content.key, "status-command-key") : "";
  key.hidden = !content.key;
}

function executionMeasurementContents(activity) {
  const keys = scriptKeys(activity);
  const contents = [];
  const addSequence = (policy, recallFeedback = null) => {
    for (let step = 0; step <= keys.length; step += 1) {
      contents.push(executionContent(activity, step, keys.slice(0, step), step >= keys.length, {
        policy,
        recallFeedback,
        impact: "",
      }));
    }
  };
  // The readout shares the reserved history-label row, but measuring a
  // representative message keeps the console height stable if it ever wraps.
  const addImpactVariant = policy => contents.push(executionContent(activity, 0, keys.slice(0, 1), false, {
    policy,
    impact: "99 substitutions on 99 lines",
  }));
  if (isDemo(activity)) {
    addSequence(null);
    addImpactVariant(null);
  } else {
    const policy = basePracticePolicy(activity);
    addSequence(policy);
    if (policy === practicePolicyValues.recall) {
      addSequence(policy, "retry");
      addSequence(policy, "reveal");
    }
    contents.push(executionContent(activity, 0, keys, false, {
      policy: practicePolicyValues.explore,
      exploreTargetReached: false,
    }));
    contents.push(executionContent(activity, 0, keys, false, {
      policy: practicePolicyValues.explore,
      exploreTargetReached: true,
      impact: "",
    }));
    addImpactVariant(basePracticePolicy(activity));
  }
  return contents;
}

function executionConsoleMeasurementSignature(activity = currentActivity()) {
  const trayWidth = Math.round(elements.commandTray.getBoundingClientRect().width * 10) / 10;
  return `${activity.id}:${innerWidth}x${Math.round(window.visualViewport?.height || innerHeight)}:${trayWidth}`;
}

function measureExecutionConsole() {
  executionMeasurementFrame = null;
  const activity = currentActivity();
  if (!isRunnable(activity) || isFreePractice()) return;
  const signature = executionConsoleMeasurementSignature(activity);
  const probe = elements.commandTray.cloneNode(true);
  probe.removeAttribute("id");
  probe.removeAttribute("aria-live");
  probe.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
  probe.querySelectorAll("[aria-live], [role=status]").forEach(node => {
    node.removeAttribute("aria-live");
    node.removeAttribute("role");
  });
  probe.classList.remove("hidden");
  probe.classList.add("execution-measure");
  probe.style.width = `${elements.commandTray.getBoundingClientRect().width}px`;
  elements.phone.append(probe);
  let requiredHeight = 0;
  executionMeasurementContents(activity).forEach(content => {
    applyExecutionContent(probe, content);
    requiredHeight = Math.max(requiredHeight, Math.ceil(probe.scrollHeight), Math.ceil(probe.getBoundingClientRect().height));
  });
  probe.remove();
  elements.phone.style.setProperty("--execution-console-height", `${requiredHeight}px`);
  executionMeasurementSignature = signature;
}

export function scheduleExecutionConsoleMeasurement({ force = false } = {}) {
  if (!isRunnable() || isFreePractice()) return;
  if (!force && executionMeasurementSignature === executionConsoleMeasurementSignature()) return;
  if (executionMeasurementFrame) return;
  executionMeasurementFrame = window.requestAnimationFrame(measureExecutionConsole);
}

export function renderCommand() {
  const activity = currentActivity();
  if (!isRunnable(activity) || isFreePractice()) {
    elements.commandExplanation.textContent = "";
    elements.commandTray.classList.add("hidden");
    return;
  }
  elements.commandTray.classList.remove("hidden");
  const step = isDemo(activity) ? state.playbackStep : state.progress;
  applyExecutionContent(elements.commandTray, executionContent(activity, step, state.history, state.complete));
  scheduleExecutionConsoleMeasurement();
}

window.addEventListener("resize", () => {
  elements.phone.style.removeProperty("--execution-console-height");
  executionMeasurementSignature = null;
  scheduleExecutionConsoleMeasurement({ force: true });
});
document.fonts?.ready.then(() => {
  executionMeasurementSignature = null;
  scheduleExecutionConsoleMeasurement({ force: true });
});

/* The feedback dialog.
 *
 * The dialog is excluded from its own screenshot (data-feedback-exclude), so
 * it can open immediately while the capture runs behind it. That ordering is
 * the whole reason the picture shows the problem rather than the report form.
 */

import { captureEnvironment, captureLayout, captureScreenshot, describeScreenshot } from "./feedback-capture.js";
import { buildReport, bufferIsUserAuthored, FEEDBACK_CATEGORIES, renderReportMarkdown, reportSlug } from "./feedback-report.js";
import { copyReportText, flushOutbox, hasEndpoint, pendingCount, saveReport, sendReport } from "./feedback-transport.js";

export function createFeedbackSurface({ elements, getContext, onClose }) {
  const dialog = elements.feedbackDialog;
  if (!dialog) return null;

  let context = null;
  let attachment = null;
  let category = FEEDBACK_CATEGORIES[0].id;
  let busy = false;

  function setStatus(message, tone = "") {
    elements.feedbackStatus.textContent = message;
    elements.feedbackStatus.dataset.tone = tone;
  }

  function currentReport() {
    const bufferText = elements.feedbackBuffer.value;
    const includeEditorContents = bufferText.trim().length > 0;
    return buildReport({
      note: elements.feedbackNote.value,
      category,
      state: includeEditorContents
        ? { ...context.state, code: bufferText.split("\n") }
        : context.state,
      effects: context.effects,
      environment: context.environment,
      layout: context.layout,
      screenshot: describeScreenshot(attachment),
      appVersion: context.appVersion,
      href: context.href,
      deepLink: context.deepLink,
      commandLine: context.commandLine,
      rejectedKeys: context.rejectedKeys,
      attempt: context.attempt,
      includeEditorContents,
      createdAt: context.createdAt,
    });
  }

  function refreshPreview() {
    const report = currentReport();
    elements.feedbackPreview.textContent = renderReportMarkdown(report);
    elements.feedbackSend.disabled = busy || elements.feedbackNote.value.trim().length === 0;
  }

  function showAttachment() {
    const has = Boolean(attachment?.blob);
    elements.feedbackShotPreview.hidden = !has;
    elements.feedbackShotRemove.hidden = !has;
    elements.feedbackShotAttach.textContent = has ? "Replace" : "Attach a screenshot";
    if (has) {
      if (elements.feedbackShotPreview.src) URL.revokeObjectURL(elements.feedbackShotPreview.src);
      elements.feedbackShotPreview.src = URL.createObjectURL(attachment.blob);
    }
    refreshPreview();
  }

  function renderCategories() {
    elements.feedbackCategories.innerHTML = FEEDBACK_CATEGORIES.map(entry => `
      <label><input type="radio" name="feedback-category" value="${entry.id}"${entry.id === category ? " checked" : ""}>
      <span><strong>${entry.label}</strong></span></label>
    `).join("");
  }

  async function refreshPending() {
    const count = await pendingCount();
    elements.feedbackPending.hidden = count === 0;
    elements.feedbackPending.textContent = count === 1
      ? "1 report is waiting to be sent."
      : `${count} reports are waiting to be sent.`;
    return count;
  }

  async function open() {
    context = {
      ...getContext(),
      environment: captureEnvironment(),
      layout: captureLayout(elements.phone),
      createdAt: new Date().toISOString(),
    };

    attachment = null;
    busy = false;
    category = FEEDBACK_CATEGORIES[0].id;
    renderCategories();
    elements.feedbackNote.value = "";
    elements.feedbackShotPreview.hidden = true;
    elements.feedbackShotRemove.hidden = true;

    const place = context.state;
    elements.feedbackPlace.textContent = [
      place.surface === "lesson" ? null : place.surface.replace("-", " "),
      place.unitId && `unit ${place.unitNumber ?? "?"}`,
      place.activityId,
    ].filter(Boolean).join(" · ");

    const buffer = Array.isArray(place.code) ? place.code.join("\n") : "";
    elements.feedbackBuffer.value = buffer;
    const flagged = bufferIsUserAuthored(place.surface, place.practicePolicy);
    elements.feedbackBufferNote.textContent = flagged
      ? "This buffer holds text you typed rather than lesson content. Clear it if it should not leave the device."
      : "This is the lesson's authored buffer.";
    elements.feedbackBufferNote.dataset.flagged = String(flagged);
    // Content the learner typed is the one case worth interrupting for, so the
    // panel opens itself and Clear is a single tap away rather than three.
    elements.feedbackDetails.open = flagged && buffer.length > 0;

    elements.feedbackSend.hidden = !hasEndpoint();
    setStatus("");
    refreshPreview();
    if (!dialog.open) dialog.showModal();
    elements.feedbackNote.focus();

    elements.feedbackShotStatus.textContent = "Capturing the screen…";
    const shot = await captureScreenshot(elements.phone);
    if (!dialog.open) return;
    if (shot?.blob) {
      attachment = shot;
      elements.feedbackShotStatus.textContent = "Captured from the app.";
      showAttachment();
    } else {
      // Expected on iPhone and iPad. Say so plainly rather than reporting an
      // error for something that is simply how the platform works.
      elements.feedbackShotStatus.textContent = "Could not capture automatically. Attach your own screenshot, or send without one.";
      refreshPreview();
    }
    refreshPending();
  }

  async function withBusy(label, run) {
    busy = true;
    refreshPreview();
    setStatus(label);
    try {
      await run();
    } finally {
      busy = false;
      refreshPreview();
    }
  }

  async function submit() {
    const report = currentReport();
    const entry = { report, markdown: renderReportMarkdown(report), blob: attachment?.blob || null };
    await withBusy("Sending…", async () => {
      const result = await sendReport(entry);
      if (result.status === "sent") {
        setStatus("Sent. Thank you.", "ok");
        window.setTimeout(() => dialog.close(), 900);
      } else if (result.status === "queued") {
        setStatus("No connection. Saved and it will send itself later.", "ok");
        await refreshPending();
      } else {
        setStatus(`Could not send: ${result.error || "no endpoint configured"}. Use Save or Copy.`, "error");
      }
    });
  }

  async function save() {
    const report = currentReport();
    await withBusy("Preparing…", async () => {
      const result = await saveReport({
        markdown: renderReportMarkdown(report),
        blob: attachment?.blob || null,
        slug: reportSlug(report),
      });
      setStatus({
        shared: "Shared.",
        downloaded: "Saved to your downloads.",
        cancelled: "",
      }[result.status] ?? "", result.status === "cancelled" ? "" : "ok");
    });
  }

  async function copy() {
    const result = await copyReportText(renderReportMarkdown(currentReport()));
    setStatus(result.status === "copied" ? "Copied to the clipboard." : "Could not copy.", result.status === "copied" ? "ok" : "error");
  }

  elements.feedbackNote.addEventListener("input", refreshPreview);
  elements.feedbackBuffer.addEventListener("input", refreshPreview);
  elements.feedbackBufferClear.addEventListener("click", () => {
    elements.feedbackBuffer.value = "";
    refreshPreview();
  });
  elements.feedbackCategories.addEventListener("change", event => {
    if (event.target.name === "feedback-category") {
      category = event.target.value;
      refreshPreview();
    }
  });
  elements.feedbackShotAttach.addEventListener("click", () => elements.feedbackShotInput.click());
  elements.feedbackShotInput.addEventListener("change", () => {
    const file = elements.feedbackShotInput.files?.[0];
    if (!file) return;
    attachment = { blob: file, source: "manual", bytes: file.size, type: file.type };
    elements.feedbackShotStatus.textContent = "Using the screenshot you attached.";
    showAttachment();
    elements.feedbackShotInput.value = "";
  });
  elements.feedbackShotRemove.addEventListener("click", () => {
    attachment = null;
    elements.feedbackShotStatus.textContent = "Sending without a screenshot.";
    showAttachment();
  });
  elements.feedbackSend.addEventListener("click", submit);
  elements.feedbackSave.addEventListener("click", save);
  elements.feedbackCopy.addEventListener("click", copy);

  dialog.addEventListener("close", () => {
    if (elements.feedbackShotPreview.src) {
      URL.revokeObjectURL(elements.feedbackShotPreview.src);
      elements.feedbackShotPreview.removeAttribute("src");
    }
    attachment = null;
    onClose?.();
  });

  window.addEventListener("online", () => flushOutbox().then(refreshPending));
  flushOutbox().then(refreshPending);

  return { open, pendingCount: refreshPending, currentReport, isOpen: () => dialog.open };
}

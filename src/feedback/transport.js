/* Getting a feedback report off the device.
 *
 * The endpoint is optional. With VITE_FEEDBACK_ENDPOINT unset the feature is
 * still complete: reports are saved or copied instead of posted, which is what
 * local development does and what the app falls back to if the Worker is ever
 * unreachable. Nothing here may throw into the UI; every entry point resolves
 * to a result object describing what happened.
 */

const DB_NAME = "vim-wilds-feedback";
const DB_VERSION = 1;
const STORE = "outbox";

const feedbackEndpoint = (import.meta.env?.VITE_FEEDBACK_ENDPOINT || "").replace(/\/$/, "");

export function hasEndpoint() {
  return Boolean(feedbackEndpoint);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    let request;
    try {
      request = window.indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, run) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const result = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(result?.result ?? result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

function buildFormData({ report, markdown, blob }) {
  const form = new FormData();
  form.append("report", JSON.stringify(report));
  form.append("markdown", markdown);
  // A report without an image is ordinary, not degraded. The field is simply
  // absent and the Worker stores a row with no screenshot key.
  if (blob) form.append("screenshot", blob, "screenshot.webp");
  return form;
}

async function post({ report, markdown, blob }) {
  const response = await fetch(`${feedbackEndpoint}/report`, {
    method: "POST",
    body: buildFormData({ report, markdown, blob }),
  });
  if (!response.ok) throw new Error(`endpoint returned ${response.status}`);
  return response.json().catch(() => ({}));
}

export async function queueReport(entry) {
  try {
    await withStore("readwrite", store => store.add({ ...entry, queuedAt: new Date().toISOString() }));
    return true;
  } catch {
    return false;
  }
}

export async function pendingCount() {
  try {
    return await withStore("readonly", store => store.count());
  } catch {
    return 0;
  }
}

/** Post everything waiting in the outbox. Safe to call at any time. */
export async function flushOutbox() {
  if (!hasEndpoint()) return { sent: 0, remaining: await pendingCount() };
  let entries = [];
  try {
    entries = await withStore("readonly", store => store.getAll());
  } catch {
    return { sent: 0, remaining: 0 };
  }

  let sent = 0;
  for (const entry of entries) {
    try {
      await post(entry);
      await withStore("readwrite", store => store.delete(entry.id));
      sent += 1;
    } catch {
      // Stop at the first failure: the connection is down or the endpoint is
      // unhealthy, and draining the rest would only burn the same error.
      break;
    }
  }
  return { sent, remaining: await pendingCount() };
}

/**
 * Send one report. Falls back to the outbox when the endpoint is unreachable,
 * so composing a report in airplane mode never loses it.
 */
export async function sendReport(entry) {
  if (!hasEndpoint()) return { status: "no-endpoint" };
  try {
    const body = await post(entry);
    return { status: "sent", id: body?.id || null };
  } catch (error) {
    const queued = await queueReport(entry);
    return { status: queued ? "queued" : "failed", error: error?.message || String(error) };
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * The escape hatch: hand the report to the learner so a queued or failing
 * report is never trapped. Prefers the OS share sheet on a phone, because
 * that reaches the notes app or file store they already use.
 */
export async function saveReport({ markdown, blob, slug = "vim-wilds-report" }) {
  const files = [new File([markdown], `${slug}.md`, { type: "text/markdown" })];
  if (blob) files.push(new File([blob], `${slug}.webp`, { type: blob.type || "image/webp" }));

  if (navigator.canShare?.({ files })) {
    try {
      await navigator.share({ files });
      return { status: "shared" };
    } catch (error) {
      // A cancelled share sheet is a decision, not a failure to route around.
      if (error?.name === "AbortError") return { status: "cancelled" };
    }
  }

  downloadBlob(files[0], files[0].name);
  if (blob) downloadBlob(files[1], files[1].name);
  return { status: "downloaded" };
}

export async function copyReportText(markdown) {
  try {
    await navigator.clipboard.writeText(markdown);
    return { status: "copied" };
  } catch (error) {
    return { status: "failed", error: error?.message || String(error) };
  }
}

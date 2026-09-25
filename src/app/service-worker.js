/* Offline support and the update-ready prompt.
 */

import { appUrl, appVersion } from "./version.js";
import { $ } from "./dom.js";
import { elements } from "./context.js";

let serviceWorkerRegistration = null;

function showUpdateReady(registration) {
  serviceWorkerRegistration = registration;
  elements.settingsButton?.classList.add("update-ready");
  elements.settingsButton?.setAttribute("aria-label", "Open settings — update ready");
  $("[data-layout-action=\"settings\"]")?.classList.add("update-ready");
  elements.restartUpdateButton.hidden = false;
  elements.updateStatus.textContent = "A newer build has downloaded and is ready to restart.";
}

export function registerServiceWorker() {
  elements.currentVersion.textContent = `Build ${appVersion}`;
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) {
    elements.updateStatus.textContent = "Development build — updates come from the local Vite server.";
    return;
  }
  const checkForUpdate = async () => {
    try { await serviceWorkerRegistration?.update(); } catch {}
  };
  navigator.serviceWorker.register(appUrl("service-worker.js"), { scope: appUrl("") }).then(registration => {
    serviceWorkerRegistration = registration;
    if (registration.waiting && navigator.serviceWorker.controller) showUpdateReady(registration);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdateReady(registration);
      });
    });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    });
  }).catch(error => {
    elements.updateStatus.textContent = "Offline support could not be enabled for this browser.";
    console.warn("Service worker registration failed.", error);
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

export function applyUpdate() {
  serviceWorkerRegistration?.waiting?.postMessage({ type: "SKIP_WAITING" });
}

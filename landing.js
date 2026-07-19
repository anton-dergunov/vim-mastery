import { appVersion } from "./app-version.js";

const installButton = document.querySelector("#installButton");
const installHint = document.querySelector("#installHint");
const version = document.querySelector("#appVersion");
const installTabs = [...document.querySelectorAll("[data-install-platform]")];
const installPanels = [...document.querySelectorAll("[data-install-panel]")];
let installPrompt = null;

version.textContent = `Build ${appVersion}`;

function detectedPlatform() {
  const userAgent = navigator.userAgent || "";
  const isIPadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/i.test(userAgent) || isIPadDesktopMode) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

function selectPlatform(platform) {
  installTabs.forEach(tab => {
    const selected = tab.dataset.installPlatform === platform;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  installPanels.forEach(panel => {
    panel.hidden = panel.dataset.installPanel !== platform;
  });
}

installTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectPlatform(tab.dataset.installPlatform));
  tab.addEventListener("keydown", event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? installTabs.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + installTabs.length) % installTabs.length;
    installTabs[nextIndex].focus();
    selectPlatform(installTabs[nextIndex].dataset.installPlatform);
  });
});

selectPlatform(detectedPlatform());

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
  installHint.textContent = "Install Vim Wilds for a full-screen icon on your home screen.";
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.hidden = true;
  installHint.textContent = "Vim Wilds is installed. Open it from your Android home screen.";
});

installButton?.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});

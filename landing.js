import { appVersion } from "./app-version.js";

const installButton = document.querySelector("#installButton");
const installHint = document.querySelector("#installHint");
const version = document.querySelector("#appVersion");
let installPrompt = null;

version.textContent = `Build ${appVersion}`;

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

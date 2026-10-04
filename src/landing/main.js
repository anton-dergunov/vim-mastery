import { appVersion } from "../app/version.js";

const page = document.querySelector("#landingPage");
const lede = document.querySelector("#landingLede");
const installButton = document.querySelector("#installButton");
const iosSteps = document.querySelector("#iosSteps");
const startLink = document.querySelector("#startLink");
const installNote = document.querySelector("#installNote");
let installPrompt = null;
let installed = false;

document.querySelector("#appVersion").textContent = `Build ${appVersion}`;

function detectedPlatform() {
  const userAgent = navigator.userAgent || "";
  const isIPadDesktopMode = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iPad|iPhone|iPod/i.test(userAgent) || isIPadDesktopMode) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

function hasSavedProgress() {
  try {
    return window.localStorage.getItem("vim-wilds.session.v1") !== null;
  } catch {
    return false;
  }
}

const platform = detectedPlatform();
const verb = hasSavedProgress() ? "Continue" : "Start";
const address = `${window.location.host}${window.location.pathname}`.replace(/\/$/, "");

// The page leads with one action. On a phone that is installing, because the
// installed app has the whole screen and works offline; on a computer it is
// practising in the browser. Which one is possible depends on what the browser
// has offered, so this runs again whenever that changes.
function render() {
  const offered = Boolean(installPrompt);
  const state = installed ? "installed"
    : platform === "ios" ? "ios"
    : platform === "android" ? (offered ? "android-offer" : "android")
    : "desktop";
  const installLeads = state === "android-offer" || state === "ios";
  page.dataset.state = state;
  page.dataset.platform = platform;

  lede.textContent = platform === "desktop"
    ? "Learn Vim in short, hands-on lessons. It is designed for phones and works here too."
    : "Learn Vim in short lessons, on a keyboard built for thumbs. Install it once and it works offline.";

  iosSteps.hidden = state !== "ios";
  installButton.hidden = !offered || installed;
  installButton.textContent = platform === "desktop" ? "Install as an app" : "Install app";
  installButton.className = platform === "desktop" ? "landing-link" : "landing-primary";

  startLink.className = installLeads || installed ? "landing-link" : "landing-primary";
  startLink.textContent = installed ? "Open it here"
    : installLeads ? (verb === "Continue" ? "Continue in the browser" : "Try it in the browser")
    : `${verb} practice`;

  const note = installed ? "Installed. Open Vim Wilds from your home screen."
    : state === "android" ? "To install, open ⋮ and choose Install app."
    : state === "desktop" ? `On your phone: ${address}`
    : "";
  installNote.textContent = note;
  installNote.hidden = !note;
}

render();

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  render();
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  installed = true;
  render();
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  // A prompt can be shown once. Declined or accepted, the button has nothing
  // left to open, and the menu instruction takes its place.
  installPrompt = null;
  render();
});

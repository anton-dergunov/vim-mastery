/* Guide characters on the board: which one appears for an activity, how it
 * reacts, and the success animation.
 */

import { appUrl, remoteMediaUrls } from "../app/version.js";
import { CharacterReactions } from "../world/character-reactions.js";
import { $ } from "../app/dom.js";
import { escapeHtml } from "../app/html.js";
import { activities, elements, state } from "../app/context.js";
import { currentActivity, isFreePractice, isPractice } from "../app/activity.js";

let characterAssets = {
  nix: {
    name: "Nix",
    role: "guide",
    idle: "assets/characters/nix/idle.png",
    animations: { "joyful-hop": { src: "assets/characters/nix/animations/joyful-hop.webp", css_scale: 1.375 } },
  },
};
const characterAssignments = new Map();
let successMedia = null;

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

export function assignCharacters() {
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

export async function loadCharacterAssets() {
  if (state.characters !== "enabled") {
    document.documentElement.dataset.charactersReady = "disabled";
    return;
  }
  try {
    const response = await fetch(appUrl("assets/characters/manifest.json"));
    if (!response.ok) throw new Error(`manifest request failed (${response.status})`);
    const manifest = await response.json();
    characterAssets = Object.fromEntries(Object.entries(manifest.characters).map(([id, character]) => [id, character]));
    assignCharacters();
    document.documentElement.dataset.charactersReady = "true";
    const assignment = characterAssignment();
    const character = characterAssets[assignment.characterId] || characterAssets.nix;
    const image = $(".nix", elements.characterLayer);
    if (image && character) {
      image.dataset.character = assignment.characterId;
      image.dataset.animation = assignment.animationId;
      image.src = appUrl(character.idle);
      image.alt = `${character.name}, ${character.role}`;
      image.__characterAsset = character;
    }
    preloadSuccessMedia();
  } catch (error) {
    document.documentElement.dataset.charactersReady = "fallback";
    console.warn("Using the Nix-only character fallback:", error);
  }
}

export function releaseSuccessMedia() {
  if (successMedia?.objectUrl) URL.revokeObjectURL(successMedia.objectUrl);
  successMedia?.controller?.abort();
  successMedia = null;
}

async function fetchOptionalMedia(sources, options) {
  let lastError = null;
  for (const source of sources) {
    try {
      const response = await fetch(source, options);
      if (response.ok) return response;
      lastError = new Error(`Optional media request failed (${response.status})`);
    } catch (error) {
      if (error.name === "AbortError" || options.signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError || new Error("Optional media request failed");
}

export function preloadSuccessMedia(activity = currentActivity()) {
  if (state.characters !== "enabled") {
    releaseSuccessMedia();
    return;
  }
  if (isFreePractice()) return;
  if (!activity || !(isPractice(activity) || activity.type === "choice") || activity.inspection) return;
  const assignment = characterAssignment(activity);
  const asset = characterAssets[assignment.characterId] || characterAssets.nix;
  const animation = asset?.animations?.[assignment.animationId];
  if (!animation?.src) return;
  const sources = remoteMediaUrls(animation.src);
  const sourceKey = sources.join("|");
  if (successMedia?.sourceKey === sourceKey) return;
  releaseSuccessMedia();
  const controller = new AbortController();
  successMedia = { sourceKey, status: "loading", controller, objectUrl: null };
  fetchOptionalMedia(sources, { cache: "no-store", mode: "cors", signal: controller.signal })
    .then(response => response.blob())
    .then(blob => {
      if (successMedia?.sourceKey !== sourceKey) return;
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectUrl;
      return image.decode().then(() => {
        if (successMedia?.sourceKey !== sourceKey) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        successMedia.objectUrl = objectUrl;
        successMedia.status = "ready";
      });
    })
    .catch(error => {
      if (error.name === "AbortError" || successMedia?.sourceKey !== sourceKey) return;
      successMedia.status = "fallback";
    });
}

export const characterReactions = new CharacterReactions({
  layer: elements.characterLayer,
  assetUrl: appUrl,
  reducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
});

export function renderCharacterLayer(activity, presentation) {
  const assignment = characterAssignment(activity);
  const character = characterAssets[assignment.characterId] || characterAssets.nix;
  const characterSide = "left";
  const shouldShowCharacter = state.characters === "enabled"
    && (isPractice(activity) || activity.type === "choice")
    && !activity.inspection;
  const characterMarkup = shouldShowCharacter
    ? `<img class="nix ${characterSide}" data-character="${assignment.characterId}" data-animation="${assignment.animationId}" src="${appUrl(character.idle)}" alt="${escapeHtml(`${character.name}, ${character.role}`)}">`
    : "";
  elements.characterLayer.dataset.side = characterMarkup ? characterSide : "none";
  elements.characterLayer.innerHTML = characterMarkup;
  const image = $(".nix", elements.characterLayer);
  if (image) image.__characterAsset = character;
  characterReactions.setActivity(activity);
  characterReactions.apply("idle");
}

export function playSuccessCharacter({ allowExplore = false } = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (state.characters !== "enabled") return;
  const character = $(".nix", elements.characterLayer);
  const asset = characterAssets[character?.dataset.character || ""];
  const animation = asset?.animations?.[character?.dataset.animation || ""];
  if (!character || !animation?.src || successMedia?.status !== "ready" || !successMedia.objectUrl) return;
  const celebrating = character.cloneNode();
  celebrating.src = successMedia.objectUrl;
  celebrating.alt = `${asset.name}, celebrating`;
  celebrating.style.setProperty("--success-canvas-scale", String(animation.css_scale || 1));
  let started = false;
  const startTransition = () => {
    if (started || (!state.complete && !(allowExplore && state.exploreTargetReached)) || !character.isConnected) return;
    started = true;
    celebrating.classList.add("celebrating", "transitioning-in");
    character.classList.add("transitioning-out");
    character.setAttribute("aria-hidden", "true");
    character.after(celebrating);
    window.setTimeout(() => character.remove(), 420);
  };
  celebrating.decode().then(startTransition, startTransition);
}

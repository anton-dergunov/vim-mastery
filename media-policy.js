import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { remoteVariantPaths } from "./presentation-data.js";

const runtimeAssetPattern = /^assets\/[a-z0-9][a-z0-9./-]*\.(?:png|webp|svg)$/;
const sourcePathSegments = new Set(["candidates", "masters", "review", "reviews", "sources"]);

// A ceiling that stops a runaway precache, not a design target. A few hundred
// megabytes of illustrated boards is unremarkable for an installed app, so this
// exists to catch a mistake — a source tree packaged by accident, a variant
// directory promoted to core — rather than to ration artwork.
export const CORE_MEDIA_MAX_BYTES = 300 * 1024 * 1024;

function addAsset(target, asset, category) {
  if (asset === null || asset === undefined) return;
  if (typeof asset !== "string" || !runtimeAssetPattern.test(asset)) {
    throw new Error(`Invalid ${category} media path in a runtime manifest: ${String(asset)}`);
  }
  const segments = asset.split("/");
  if (segments.some(segment => sourcePathSegments.has(segment))) {
    throw new Error(`Source/review media cannot be shipped as runtime media: ${asset}`);
  }
  if (
    category !== "remote-scene-variant"
    && segments.some(segment => segment.startsWith("variants"))
  ) {
    throw new Error(`Unapproved scene variants cannot be shipped as core runtime media: ${asset}`);
  }
  if (!target.has(asset)) target.set(asset, category);
}

function stillSource(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  return value.still || value.src || null;
}

function reactionCandidates(value) {
  return Array.isArray(value) ? value : [value];
}

export function collectMediaPolicy(presentation, characterManifest) {
  const core = new Map();
  const optional = new Map();

  for (const unit of Object.values(presentation?.units || {})) {
    addAsset(core, unit.completion?.storyBackdrop, "unit-story-base");
    addAsset(core, unit.completion?.storyImage, "unit-story-image");
    const scene = unit.sceneId ? unit.scenes?.[unit.sceneId] : null;
    for (const profile of Object.values(scene?.profiles || {})) {
      addAsset(core, profile.base, "world-base");
      for (const asset of Object.values(profile.patches || {})) {
        addAsset(core, asset, "registered-patch");
      }
    }

    const variants = scene?.remoteVariants;
    if (variants) {
      for (const asset of remoteVariantPaths(variants)) {
        addAsset(optional, asset, "remote-scene-variant");
      }
    }
  }

  const referenceScene = presentation?.reference?.scene;
  if (referenceScene) {
    for (const profile of Object.values(referenceScene.profiles || {})) {
      addAsset(core, profile.base, "world-base");
    }
    for (const asset of remoteVariantPaths(referenceScene.remoteVariants)) {
      addAsset(optional, asset, "remote-scene-variant");
    }
  }

  for (const panel of presentation?.story?.intro || []) {
    addAsset(core, panel.asset, "story-still");
  }
  addAsset(core, presentation?.story?.writingPenAsset, "story-ui");
  addAsset(core, presentation?.story?.ending?.asset, "story-finale");

  for (const character of Object.values(characterManifest?.characters || {})) {
    addAsset(core, character.idle, "character-idle");
    for (const reaction of Object.values(character.reactions || character.stills || {})) {
      for (const candidate of reactionCandidates(reaction)) {
        addAsset(optional, stillSource(candidate), "character-reaction");
      }
    }
    for (const animation of Object.values(character.animations || {})) {
      addAsset(optional, animation?.src, "character-animation");
    }
  }

  return {
    core: [...core].map(([path, category]) => ({ path, category })).sort((left, right) => left.path.localeCompare(right.path)),
    optional: [...optional].map(([path, category]) => ({ path, category })).sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function assertMediaAssets(rootDirectory, media) {
  for (const { path, category } of [...media.core, ...media.optional]) {
    const absolutePath = resolve(rootDirectory, path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      throw new Error(`Missing ${category} manifest asset: ${path}`);
    }
  }
}

export function coreMediaBytes(rootDirectory, media) {
  return media.core.reduce((total, asset) => total + statSync(resolve(rootDirectory, asset.path)).size, 0);
}

export function assertCoreMediaBudget(rootDirectory, media) {
  const bytes = coreMediaBytes(rootDirectory, media);
  if (bytes > CORE_MEDIA_MAX_BYTES) {
    const formatted = (bytes / 1024 / 1024).toFixed(2);
    const limit = (CORE_MEDIA_MAX_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(`Core media budget exceeded: ${formatted} MiB is above the ${limit} MiB limit`);
  }
  return bytes;
}

export function contentRevision(rootDirectory, paths) {
  const digest = createHash("sha256");
  for (const path of [...paths].sort()) {
    digest.update(path);
    digest.update("\0");
    digest.update(readFileSync(resolve(rootDirectory, path)));
    digest.update("\0");
  }
  return digest.digest("hex").slice(0, 12);
}

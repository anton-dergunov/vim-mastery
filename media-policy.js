import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { remoteVariantPaths } from "./scene-variant-config.js";

const runtimeAssetPattern = /^assets\/[a-z0-9][a-z0-9./-]*\.(?:png|webp|svg)$/;
const sourcePathSegments = new Set(["candidates", "masters", "review", "reviews", "sources"]);

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

export function collectMediaPolicy(presentation, characterManifest) {
  const core = new Map();
  const optional = new Map();

  for (const unit of Object.values(presentation?.units || {})) {
    addAsset(core, unit.completion?.storyBackdrop, "unit-story-base");
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

  for (const panel of presentation?.story?.intro || []) {
    addAsset(core, panel.asset, "story-still");
  }

  for (const character of Object.values(characterManifest?.characters || {})) {
    addAsset(core, character.idle, "character-idle");
    for (const reaction of Object.values(character.reactions || character.stills || {})) {
      addAsset(core, stillSource(reaction), "reaction-still");
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

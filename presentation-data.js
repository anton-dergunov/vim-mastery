export const PRESENTATION_SCHEMA_VERSION = 2;

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetPattern = /^assets\/[a-z0-9][a-z0-9./-]*\.(?:png|webp|svg)$/;
const assetDirectoryPattern = /^assets\/[a-z0-9][a-z0-9./-]*$/;
const sceneProfiles = ["tall", "compact", "wide"];
const learningPhases = ["explain", "demonstrate", "isolate", "mix", "challenge", "summary"];

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateId(value, path, errors) {
  if (!idPattern.test(value || "")) errors.push(`${path} must be a kebab-case ID`);
}

function validateAsset(value, path, errors) {
  if (!assetPattern.test(value || "")) errors.push(`${path} must be a local presentation asset path`);
}

function validatePendingAsset(value, path, errors) {
  if (value !== null) validateAsset(value, path, errors);
}

function validateRemoteVariants(value, path, errors) {
  if (!object(value)) {
    errors.push(`${path} must define remote variant metadata`);
    return;
  }
  if (!Array.isArray(value.profiles) || !value.profiles.length || value.profiles.some(profile => !sceneProfiles.includes(profile))) {
    errors.push(`${path}.profiles must contain supported scene profiles`);
  }
  if (!assetDirectoryPattern.test(value.assetRoot || "")) {
    errors.push(`${path}.assetRoot must be an assets directory path`);
  }
  if (!sceneProfiles.includes(value.registrationProfile)) {
    errors.push(`${path}.registrationProfile must name a supported scene profile`);
  }
  if (value.mode !== undefined && !["complete-board", "transparent-patch"].includes(value.mode)) {
    errors.push(`${path}.mode must be complete-board or transparent-patch when provided`);
  }
  if (value.format !== undefined && !["png", "webp"].includes(value.format)) {
    errors.push(`${path}.format must be png or webp when provided`);
  }
  if (!Array.isArray(value.siteIds) || !value.siteIds.length) {
    errors.push(`${path}.siteIds must contain at least one semantic site ID`);
  } else {
    value.siteIds.forEach((siteId, index) => validateId(siteId, `${path}.siteIds[${index}]`, errors));
  }
  if (!Number.isInteger(value.variantsPerSite) || value.variantsPerSite < 1 || value.variantsPerSite > 20) {
    errors.push(`${path}.variantsPerSite must be an integer between 1 and 20`);
  }
  for (const field of ["initialDelayMs", "fadeMs", "holdMs", "gapMs"]) {
    if (!Number.isFinite(value.timing?.[field]) || value.timing[field] < 0) {
      errors.push(`${path}.timing.${field} must be a non-negative number`);
    }
  }
}

export function remoteVariantPaths(config) {
  if (
    !config
    || !Array.isArray(config.siteIds)
    || !Number.isInteger(config.variantsPerSite)
    || !config.assetRoot
  ) {
    return [];
  }
  const format = config.format || "webp";
  return config.siteIds.flatMap(siteId => Array.from(
    { length: config.variantsPerSite },
    (_, index) => (
      `${config.assetRoot}/${siteId}-c${String(index + 1).padStart(2, "0")}.${format}`
    ),
  ));
}

function validatePatchBounds(value, path, errors) {
  if (!object(value)) {
    errors.push(`${path} must define normalized patch bounds`);
    return;
  }
  for (const field of ["x", "y", "width", "height"]) {
    if (typeof value[field] !== "number" || value[field] < 0 || value[field] > 1) {
      errors.push(`${path}.${field} must be between 0 and 1`);
    }
  }
  if ((value.x || 0) + (value.width || 0) > 1 || (value.y || 0) + (value.height || 0) > 1) {
    errors.push(`${path} must remain inside the source canvas`);
  }
}

function validateScene(scene, path, errors) {
  if (!object(scene)) {
    errors.push(`${path} must be a registered scene`);
    return;
  }
  validateId(scene.id, `${path}.id`, errors);
  if (scene.remoteVariants !== undefined) validateRemoteVariants(scene.remoteVariants, `${path}.remoteVariants`, errors);
  const regionIds = new Set(Object.keys(object(scene.patchRegions) ? scene.patchRegions : {}));
  if (regionIds.size !== 3) errors.push(`${path}.patchRegions must define exactly three registered regions`);
  for (const [patchId, bounds] of Object.entries(scene.patchRegions || {})) {
    validateId(patchId, `${path}.patchRegions.${patchId}`, errors);
    validatePatchBounds(bounds, `${path}.patchRegions.${patchId}`, errors);
  }

  const profilePatchSets = [];
  for (const profile of sceneProfiles) {
    const profileData = scene.profiles?.[profile];
    const profilePath = `${path}.profiles.${profile}`;
    if (!object(profileData)) {
      errors.push(`${profilePath} is required`);
      continue;
    }
    validateAsset(profileData.base, `${profilePath}.base`, errors);
    if (profileData.focalPosition !== undefined && (typeof profileData.focalPosition !== "string" || !profileData.focalPosition.trim())) {
      errors.push(`${profilePath}.focalPosition must be a non-empty CSS position`);
    }
    if (!object(profileData.patches)) {
      errors.push(`${profilePath}.patches must be an object`);
      continue;
    }
    const ids = new Set(Object.keys(profileData.patches));
    profilePatchSets.push(ids);
    for (const [patchId, asset] of Object.entries(profileData.patches)) {
      validateId(patchId, `${profilePath}.patches.${patchId}`, errors);
      validateAsset(asset, `${profilePath}.patches.${patchId}`, errors);
    }
  }

  for (const phase of learningPhases) {
    const patchIds = scene.phasePatches?.[phase];
    if (!Array.isArray(patchIds)) {
      errors.push(`${path}.phasePatches.${phase} must be an array`);
      continue;
    }
    for (const patchId of patchIds) {
      if (!regionIds.has(patchId)) errors.push(`${path}.phasePatches.${phase} references undeclared patch "${patchId}"`);
      if (profilePatchSets.some(ids => !ids.has(patchId))) {
        errors.push(`${path}.phasePatches.${phase} patch "${patchId}" must exist in every profile`);
      }
    }
  }

  if (scene.landmarkPatches !== undefined) {
    for (const state of ["dormant", "restored"]) {
      const patchId = scene.landmarkPatches?.[state];
      if (patchId !== null && patchId !== undefined && profilePatchSets.some(ids => !ids.has(patchId))) {
        errors.push(`${path}.landmarkPatches.${state} patch "${patchId}" must exist in every profile`);
      }
    }
  }
}

export function validatePresentationManifest(manifest, { unitCatalog, characterIds } = {}) {
  const errors = [];
  if (!object(manifest)) return { valid: false, errors: ["presentation manifest must be an object"] };
  if (manifest.schemaVersion !== PRESENTATION_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PRESENTATION_SCHEMA_VERSION}`);
  }

  const worlds = object(manifest.worlds) ? manifest.worlds : {};
  const units = object(manifest.units) ? manifest.units : {};
  if (!object(manifest.worlds)) errors.push("worlds must be an object");
  if (!object(manifest.units)) errors.push("units must be an object");

  for (const [worldId, world] of Object.entries(worlds)) {
    validateId(worldId, `worlds.${worldId}`, errors);
    if (!object(world)) {
      errors.push(`worlds.${worldId} must be an object`);
      continue;
    }
    if (world.id !== worldId) errors.push(`worlds.${worldId}.id must match its world key`);
    if (typeof world.displayName !== "string" || !world.displayName.trim()) {
      errors.push(`worlds.${worldId}.displayName is required`);
    }
    if (!["moonroot", "ember", "glass", "deepwater"].includes(world.autoThemeId)) {
      errors.push(`worlds.${worldId}.autoThemeId is not a supported theme`);
    }
    if (!Array.isArray(world.ambientEffects)) errors.push(`worlds.${worldId}.ambientEffects must be an array`);
    if (typeof world.fallbackGradient !== "string" || !world.fallbackGradient.trim()) {
      errors.push(`worlds.${worldId}.fallbackGradient is required`);
    }
  }

  const knownCharacters = characterIds ? new Set(characterIds) : null;
  for (const [unitId, unit] of Object.entries(units)) {
    validateId(unitId, `units.${unitId}`, errors);
    if (!object(unit)) {
      errors.push(`units.${unitId} must be an object`);
      continue;
    }
    if (unit.id !== unitId) errors.push(`units.${unitId}.id must match its unit key`);
    if (!worlds[unit.worldId]) {
      errors.push(`units.${unitId}.worldId references missing world "${unit.worldId}"`);
    }
    validateId(unit.guideCharacterId, `units.${unitId}.guideCharacterId`, errors);
    if (knownCharacters && !knownCharacters.has(unit.guideCharacterId)) {
      errors.push(`units.${unitId}.guideCharacterId references missing character "${unit.guideCharacterId}"`);
    }
    validateId(unit.landmark?.id, `units.${unitId}.landmark.id`, errors);
    validateId(unit.completion?.actionId, `units.${unitId}.completion.actionId`, errors);
    if (unit.completion?.storyBackdrop !== undefined) {
      validateAsset(unit.completion.storyBackdrop, `units.${unitId}.completion.storyBackdrop`, errors);
    }
    if (unit.completion?.storyImage !== undefined) {
      validateAsset(unit.completion.storyImage, `units.${unitId}.completion.storyImage`, errors);
    }
    for (const field of ["action", "copy"]) {
      if (typeof unit.completion?.[field] !== "string" || !unit.completion[field].trim()) {
        errors.push(`units.${unitId}.completion.${field} is required`);
      }
    }
    if (typeof unit.completion?.nextHook?.copy !== "string" || !unit.completion.nextHook.copy.trim()) {
      errors.push(`units.${unitId}.completion.nextHook.copy is required`);
    }

    const scenes = object(unit.scenes) ? unit.scenes : {};
    if (unit.worldId === "moonroot-ruins" && !unit.sceneId) {
      errors.push(`units.${unitId}.sceneId is required for the Moonroot proof`);
    }
    if (unit.sceneId && !scenes[unit.sceneId]) {
      errors.push(`units.${unitId}.sceneId references missing scene "${unit.sceneId}"`);
    }
    for (const [sceneId, scene] of Object.entries(scenes)) {
      if (scene.id !== sceneId) errors.push(`units.${unitId}.scenes.${sceneId}.id must match its scene key`);
      validateScene(scene, `units.${unitId}.scenes.${sceneId}`, errors);
    }
  }

  if (unitCatalog?.units) {
    const catalogIds = unitCatalog.units.map(unit => unit.id);
    for (const unitId of catalogIds) {
      if (!units[unitId]) errors.push(`units is missing catalog unit "${unitId}"`);
    }
    for (const unitId of Object.keys(units)) {
      if (!catalogIds.includes(unitId)) errors.push(`units.${unitId} is not present in the unit catalog`);
    }
  }

  if (!Array.isArray(manifest.story?.intro) || manifest.story.intro.length !== 3) {
    errors.push("story.intro must contain exactly three panels");
  } else {
    manifest.story.intro.forEach((panel, index) => {
      validateId(panel?.id, `story.intro[${index}].id`, errors);
      validatePendingAsset(panel?.asset, `story.intro[${index}].asset`, errors);
      if (typeof panel?.copy !== "string" || !panel.copy.trim()) errors.push(`story.intro[${index}].copy is required`);
    });
  }
  validateAsset(manifest.story?.writingPenAsset, "story.writingPenAsset", errors);
  validateAsset(manifest.story?.ending?.asset, "story.ending.asset", errors);
  if (typeof manifest.story?.ending?.speaker !== "string" || !manifest.story.ending.speaker.trim()) {
    errors.push("story.ending.speaker is required");
  }
  if (typeof manifest.story?.ending?.copy !== "string" || !manifest.story.ending.copy.trim()) {
    errors.push("story.ending.copy is required");
  }

  return { valid: errors.length === 0, errors };
}

export function resolveUnitPresentation(manifest, unitId) {
  const unit = manifest?.units?.[unitId];
  const world = unit && manifest?.worlds?.[unit.worldId];
  const scene = unit?.sceneId ? unit.scenes?.[unit.sceneId] : null;
  return unit && world ? { unit, world, scene } : null;
}

export async function loadUnitCatalogWithPresentation({ catalogUrl, presentationUrl, fetchImpl = globalThis.fetch }) {
  const catalogRequest = fetchImpl(catalogUrl).then(async response => {
    if (!response.ok) throw new Error(`Unit catalog request failed (${response.status})`);
    return response.json();
  });
  const presentationRequest = fetchImpl(presentationUrl)
    .then(response => {
      if (!response.ok) throw new Error(`Presentation manifest request failed (${response.status})`);
      return response.json();
    })
    .catch(() => null);
  const [unitCatalog, candidate] = await Promise.all([catalogRequest, presentationRequest]);
  const validation = validatePresentationManifest(candidate, { unitCatalog });
  return {
    unitCatalog,
    presentation: validation.valid ? candidate : null,
    presentationErrors: validation.errors,
  };
}

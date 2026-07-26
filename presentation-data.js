export const PRESENTATION_SCHEMA_VERSION = 1;

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const assetPattern = /^assets\/[a-z0-9][a-z0-9./-]*\.(?:png|webp|svg)$/;
const shapes = ["portrait", "square", "wide", "shallow"];

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateId(value, path, errors) {
  if (!idPattern.test(value || "")) errors.push(`${path} must be a kebab-case ID`);
}

function validateAsset(value, path, errors) {
  if (!assetPattern.test(value || "")) errors.push(`${path} must be a local presentation asset path`);
}

function validatePlacements(placements, path, errors) {
  if (!object(placements)) {
    errors.push(`${path} must define responsive placements`);
    return;
  }
  for (const shape of shapes) {
    const placement = placements[shape];
    if (!object(placement)) {
      errors.push(`${path}.${shape} is required`);
      continue;
    }
    if (typeof placement.x !== "number" || placement.x < 0 || placement.x > 100) {
      errors.push(`${path}.${shape}.x must be between 0 and 100`);
    }
    if (typeof placement.y !== "number" || placement.y < 0 || placement.y > 100) {
      errors.push(`${path}.${shape}.y must be between 0 and 100`);
    }
    if (typeof placement.scale !== "number" || placement.scale <= 0 || placement.scale > 3) {
      errors.push(`${path}.${shape}.scale must be greater than 0 and no more than 3`);
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
    for (const shape of ["portrait", "square", "wide"]) {
      validateAsset(world.backdrops?.[shape], `worlds.${worldId}.backdrops.${shape}`, errors);
    }
    if (!Array.isArray(world.props)) {
      errors.push(`worlds.${worldId}.props must be an array`);
    } else {
      world.props.forEach((prop, index) => {
        const path = `worlds.${worldId}.props[${index}]`;
        validateId(prop?.id, `${path}.id`, errors);
        validateAsset(prop?.asset, `${path}.asset`, errors);
        validatePlacements(prop?.placements, `${path}.placements`, errors);
      });
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
    validateAsset(unit.landmark?.assets?.dormant, `units.${unitId}.landmark.assets.dormant`, errors);
    validateAsset(unit.landmark?.assets?.restored, `units.${unitId}.landmark.assets.restored`, errors);
    validatePlacements(unit.landmark?.placements, `units.${unitId}.landmark.placements`, errors);
    validateId(unit.completion?.actionId, `units.${unitId}.completion.actionId`, errors);
    for (const field of ["action", "copy"]) {
      if (typeof unit.completion?.[field] !== "string" || !unit.completion[field].trim()) {
        errors.push(`units.${unitId}.completion.${field} is required`);
      }
    }
    if (typeof unit.completion?.nextHook?.copy !== "string" || !unit.completion.nextHook.copy.trim()) {
      errors.push(`units.${unitId}.completion.nextHook.copy is required`);
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
      validateAsset(panel?.asset, `story.intro[${index}].asset`, errors);
      if (typeof panel?.copy !== "string" || !panel.copy.trim()) errors.push(`story.intro[${index}].copy is required`);
    });
  }
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
  return unit && world ? { unit, world } : null;
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

/**
 * Selects which checked-in backdrop animation representation is streamed.
 *
 * "transparent-patch" is the production default: it stores only the detected
 * changed object, uses lossless alpha plus quality-95 lossy RGB, and is much
 * smaller. "complete-board" streams the original full opaque generated frame:
 * it costs substantially more repository and transfer space, but is the
 * fidelity fallback if future patch extraction exposes an unacceptable edge.
 *
 * Both asset families are intentionally retained. Do not refactor this switch
 * away or delete either family merely because one is inactive. Remove one only
 * after an explicit product decision that accepts losing this quick fallback.
 */
export const SCENE_VARIANT_ASSET_MODE = "transparent-patch";

export const SCENE_VARIANT_ASSET_MODES = Object.freeze([
  "transparent-patch",
  "complete-board",
]);

export function remoteVariantAssetRoot(
  config,
  mode = SCENE_VARIANT_ASSET_MODE,
) {
  if (!SCENE_VARIANT_ASSET_MODES.includes(mode)) {
    throw new Error(`Unknown scene variant asset mode: ${mode}`);
  }
  const root = config?.assetRoots?.[mode];
  if (typeof root !== "string" || !root) {
    throw new Error(`Missing ${mode} scene variant asset root`);
  }
  return root;
}

export function remoteVariantPaths(
  config,
  mode = SCENE_VARIANT_ASSET_MODE,
) {
  if (
    !config
    || !Array.isArray(config.siteIds)
    || !Number.isInteger(config.variantsPerSite)
  ) {
    return [];
  }
  const root = remoteVariantAssetRoot(config, mode);
  const format = config.format || "webp";
  return config.siteIds.flatMap(siteId => Array.from(
    { length: config.variantsPerSite },
    (_, index) => (
      `${root}/${siteId}-c${String(index + 1).padStart(2, "0")}.${format}`
    ),
  ));
}

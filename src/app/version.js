export const appVersion = __VIM_WILDS_VERSION__;

export function appUrl(path = "") {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\//, "")}`;
}

// Optional media is streamed rather than precached, from the site's own origin.
export function remoteMediaUrls(path) {
  return [appUrl(path)];
}

export const appVersion = __VIM_WILDS_VERSION__;

export function appUrl(path = "") {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\//, "")}`;
}

export function remoteMediaUrls(path) {
  const normalizedPath = String(path).replace(/^\//, "");
  const githubPagesUrl = `https://anton-dergunov.github.io/vim-mastery/${normalizedPath}`;
  return import.meta.env.DEV ? [appUrl(normalizedPath), githubPagesUrl] : [githubPagesUrl];
}

export const appVersion = __VIM_WILDS_VERSION__;

export function appUrl(path = "") {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\//, "")}`;
}

export function remoteMediaUrl(path) {
  return `https://anton-dergunov.github.io/vim-mastery/${String(path).replace(/^\//, "")}`;
}

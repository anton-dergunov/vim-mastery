export const appVersion = __VIM_WILDS_VERSION__;
export const mediaRevision = __VIM_WILDS_MEDIA_REVISION__;

export function appUrl(path = "") {
  return `${import.meta.env.BASE_URL}${String(path).replace(/^\//, "")}`;
}

export function remoteMediaUrl(path) {
  return `https://raw.githubusercontent.com/anton-dergunov/vim-mastery/${mediaRevision}/${String(path).replace(/^\//, "")}`;
}

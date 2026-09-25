/* Small DOM helpers every part of the app uses.
 */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function vibrate(pattern = 7) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

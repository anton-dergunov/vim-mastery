/* Reading the page for a feedback report.
 *
 * Everything here is best-effort by design. A report with no screenshot is a
 * complete report, so every function in this module returns something usable
 * rather than throwing, and the caller never has to branch on failure to stay
 * correct.
 */

const SCREENSHOT_TIMEOUT_MS = 6000;
const SCREENSHOT_MAX_BYTES = 2 * 1024 * 1024;
const MAX_OVERFLOWING_ELEMENTS = 20;

/** A short, readable selector for one element, for the layout report. */
function describeElement(element) {
  if (element.id) return `#${element.id}`;
  const classes = [...element.classList].slice(0, 2).map(name => `.${name}`).join("");
  return `${element.tagName.toLowerCase()}${classes}`;
}

export function captureEnvironment() {
  const media = query => {
    try {
      return window.matchMedia(query).matches;
    } catch {
      return null;
    }
  };
  const root = document.documentElement;
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    // The visual viewport is what the code slab actually gets once a mobile
    // browser's URL bar is showing, which is the difference that makes a
    // layout look clipped on a phone but fine on a desktop at the same size.
    visualViewport: window.visualViewport
      ? { width: Math.round(window.visualViewport.width), height: Math.round(window.visualViewport.height) }
      : null,
    screen: { width: window.screen?.width ?? null, height: window.screen?.height ?? null },
    devicePixelRatio: window.devicePixelRatio || 1,
    orientation: window.screen?.orientation?.type
      || (window.innerWidth > window.innerHeight ? "landscape" : "portrait"),
    // A learner who has raised their system font size is the likeliest cause
    // of text overflowing a box that fits at the default size.
    rootFontSize: Number.parseFloat(window.getComputedStyle(root).fontSize) || null,
    userAgent: navigator.userAgent,
    language: navigator.language || null,
    maxTouchPoints: navigator.maxTouchPoints ?? null,
    coarsePointer: media("(pointer: coarse)"),
    reducedMotion: media("(prefers-reduced-motion: reduce)"),
    standalone: media("(display-mode: standalone)") || navigator.standalone === true,
    online: navigator.onLine !== false,
    serviceWorker: Boolean(navigator.serviceWorker?.controller),
  };
}

/* The overflow scan is what actually diagnoses "the instruction text is
 * overflowing and showing strange things". It survives a failed screenshot,
 * and unlike a picture it names the element. */
export function captureLayout(root = document.querySelector("#phone")) {
  const documentElement = document.documentElement;
  const layout = {
    documentOverflow: documentElement.scrollWidth > window.innerWidth
      || documentElement.scrollHeight > window.innerHeight,
    overflowing: [],
  };
  if (!root) return layout;

  for (const element of root.querySelectorAll("*")) {
    if (layout.overflowing.length >= MAX_OVERFLOWING_ELEMENTS) break;
    // A deliberate scroller is not a defect; only clipped content is.
    const style = window.getComputedStyle(element);
    if (style.overflow !== "visible" && style.overflow !== "hidden") continue;
    const overflowsX = element.scrollWidth > element.clientWidth + 1;
    const overflowsY = element.scrollHeight > element.clientHeight + 1;
    if (!overflowsX && !overflowsY) continue;
    layout.overflowing.push({
      selector: describeElement(element),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    });
  }
  return layout;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error("screenshot timed out")), ms)),
  ]);
}

const PSEUDO_PAINT_PROPERTIES = [
  "background-image", "background-position", "background-size", "background-repeat",
  "background-color", "filter", "opacity", "mix-blend-mode", "border-radius", "transform",
];

/* The board's scene art is painted by `.world-backdrop::before`, and DOM
 * rasterizers do not carry a pseudo-element's background image across. Left
 * alone, every report would show the lesson floating on a flat gradient, which
 * misrepresents a product whose visual polish is the thing being reviewed.
 *
 * So each such pseudo is restated as a real element for the duration of the
 * capture, and the original is suppressed so the two cannot double-paint. Only
 * absolutely positioned pseudos are handled: their box is fully determined by
 * computed insets, so the stand-in lands exactly where the original was. A
 * pseudo laid out any other way is skipped rather than guessed at — a
 * misplaced backdrop would be worse than a missing one.
 */
function materializePseudoBackgrounds(root) {
  const hosts = [];
  const overlays = [];
  const style = document.createElement("style");
  style.textContent = `[data-feedback-pseudo~="before"]::before,
    [data-feedback-pseudo~="after"]::after { background-image: none !important; }`;

  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const pseudo of ["::before", "::after"]) {
      const computed = window.getComputedStyle(element, pseudo);
      if (!computed.backgroundImage?.includes("url(")) continue;
      if (computed.position !== "absolute") continue;

      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.pointerEvents = "none";
      for (const side of ["top", "right", "bottom", "left"]) overlay.style[side] = computed[side];
      for (const property of PSEUDO_PAINT_PROPERTIES) {
        overlay.style.setProperty(property, computed.getPropertyValue(property));
      }
      // ::before paints beneath the element's children and ::after above them.
      if (pseudo === "::before") element.prepend(overlay); else element.append(overlay);

      const marker = element.dataset.feedbackPseudo || "";
      element.dataset.feedbackPseudo = `${marker} ${pseudo.slice(2)}`.trim();
      hosts.push(element);
      overlays.push(overlay);
    }
  }

  if (overlays.length) document.head.append(style);
  return () => {
    overlays.forEach(node => node.remove());
    hosts.forEach(node => delete node.dataset.feedbackPseudo);
    style.remove();
  };
}

/* Safari applies a stricter security model to the foreignObject element that
 * every DOM rasterizer relies on, so a failure here is an ordinary outcome on
 * iPhone and iPad rather than a bug. The caller offers the file picker
 * instead; nothing else changes. */
export async function captureScreenshot(node, { timeout = SCREENSHOT_TIMEOUT_MS } = {}) {
  if (!node) return null;
  let restorePseudoBackgrounds = () => {};
  try {
    const { domToBlob } = await import("modern-screenshot");
    restorePseudoBackgrounds = materializePseudoBackgrounds(node);
    const blob = await withTimeout(domToBlob(node, {
      type: "image/webp",
      quality: 0.8,
      // One device pixel per CSS pixel keeps a 3x phone from producing a
      // multi-megabyte image of a 390-point screen.
      scale: 1,
      backgroundColor: "#071715",
      filter: element => element.dataset?.feedbackExclude === undefined,
    }), timeout);
    if (!blob) return null;
    if (blob.size > SCREENSHOT_MAX_BYTES) {
      return { error: `capture was ${Math.round(blob.size / 1024)} KB, over the ${SCREENSHOT_MAX_BYTES / 1024 / 1024} MB limit` };
    }
    return { blob, source: "auto", bytes: blob.size, type: blob.type };
  } catch (error) {
    return { error: error?.message || "capture failed" };
  } finally {
    // The page must come back exactly as it was, including when the capture
    // threw or timed out partway through.
    restorePseudoBackgrounds();
  }
}

/** Describe an attached image for the envelope. Returns null when there is none. */
export function describeScreenshot(attachment) {
  if (!attachment?.blob) return null;
  return {
    source: attachment.source,
    bytes: attachment.blob.size,
    type: attachment.blob.type || "image/webp",
  };
}

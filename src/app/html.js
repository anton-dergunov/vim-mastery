/* Markup helpers: escaping, the inline Markdown subset lesson copy uses, and
 * keycaps.
 */

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * CommonMark closes a code span on a run of backticks the same length as the
 * run that opened it, which is how authored copy spells a command that itself
 * contains a backtick: ```a`` for the mark jump, `` `da` `` for the text
 * object. Matching only single backticks split those into an empty chip, a
 * chip holding the wrong text, and a loose backtick.
 */
export function renderInline(value) {
  const source = String(value ?? "");
  // Two capture groups, so split emits text, fence, code, text, fence, code...
  return source.split(/(`+)([\s\S]+?)\1(?!`)/g).map((part, index) => {
    if (index % 3 === 1) return "";
    if (index % 3 === 2) return `<code>${escapeHtml(stripCodeSpanPadding(part))}</code>`;
    const escaped = escapeHtml(part);
    const bold = escaped.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    return bold.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  }).join("");
}

/**
 * The spaces that keep a fence away from its content are separators, not text:
 * `` `a `` means the two characters `a. One space at each end goes, and only
 * when both are there and something is left over.
 */
function stripCodeSpanPadding(code) {
  return code.length > 2 && code.startsWith(" ") && code.endsWith(" ") && code.trim()
    ? code.slice(1, -1)
    : code;
}

function displayKeyToken(token) {
  const labels = { Escape: "Esc", Enter: "Enter", " ": "Space", Tab: "Tab" };
  return labels[token] || token;
}

export function renderKeycap(token, className = "") {
  const extraClass = className ? ` ${className}` : "";
  return `<kbd class="command-key${extraClass}">${escapeHtml(displayKeyToken(token))}</kbd>`;
}

export function renderHistory(tokens) {
  return tokens.length
    ? tokens.map(token => renderKeycap(token)).join("")
    : '<span class="ghost">waiting…</span>';
}

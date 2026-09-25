/* Reference decks and each unit's command reference, shown over their own board.
 */

import { appUrl, remoteMediaUrls } from "../app/version.js";
import { resolveReferencePresentation } from "../world/presentation-data.js";
import { WorldPresentationRenderer } from "../world/presentation.js";
import { escapeHtml, renderInline } from "../app/html.js";
import {
  activities,
  catalogData,
  elements,
  referenceCatalog,
  state,
  unitData,
  units,
} from "../app/context.js";
import { goToActivityId } from "../app/navigation.js";
import { renderTableOfContents } from "./contents.js";
import { showEntryLevelQuestion } from "./entry-level.js";

// The opening deck is not story state. Keeping it out of vim-wilds.story.v1
// stops a story replay from looking like curriculum progress, and stops the
// opening from replaying when someone rewatches the intro.
const referenceStateKey = "vim-wilds.reference.v1";

function readReferenceState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(referenceStateKey) || "null");
    return { orientationSeen: saved?.orientationSeen === true };
  } catch {
    return { orientationSeen: false };
  }
}
export const referenceState = readReferenceState();

// The reference surface is a second board, not a second world: the renderer is
// parameterised by element handles, so pointing one at the dialog's own layers
// gives the deck the Mosslight Landing backdrop, its ambient drift, and the
// reduced-motion and offline handling the lesson board already has.
const referenceRenderer = new WorldPresentationRenderer({
  world: elements.referenceVisual,
  backdropLayer: elements.referenceBackdrop,
  ambientLayer: elements.referenceAmbient,
  remoteVariantLayer: elements.referenceVariantLayer,
  assetUrl: appUrl,
  remoteAssetUrls: remoteMediaUrls,
});
const referencePresentation = resolveReferencePresentation(catalogData.presentation);
export const referenceDecks = new Map((referenceCatalog?.decks || []).map(deck => [deck.id, deck]));
export const openingDeck = (referenceCatalog?.decks || []).find(deck => deck.role === "opening") || null;
let referenceRendererStarted = false;
export const referenceSession = { deckId: null, cardIndex: 0, opening: false, unitId: null };

async function unitReferenceEntries(unitId) {
  return (await unitData(unitId))?.reference || [];
}

function renderUnitReferenceEntries(unitId, entries) {
  if (!entries.length) return '<p class="reference-empty">This unit has no reference entries.</p>';
  return `<div class="reference-rows">${entries.map(entry => {
    const examples = (entry.exampleActivityRefs || []).map(activityRef => {
      const local = activities.find(item => item.id === activityRef || item.sourceActivityId === activityRef);
      return local
        ? `<button type="button" data-reference-activity="${escapeHtml(activityRef)}">${escapeHtml(activityRef)}</button>`
        : `<a href="${escapeHtml(activityHref(unitId, activityRef))}">${escapeHtml(activityRef)}</a>`;
    }).join("");
    return `<div class="reference-row single">
      <div class="reference-row-command"><code>${escapeHtml(entry.command)}</code></div>
      <div class="reference-row-cell reference-row-vim"><p>${renderInline(entry.purpose)}</p></div>
      ${(entry.notes || []).length ? `<ul class="reference-notes">${entry.notes.map(note => `<li>${renderInline(note)}</li>`).join("")}</ul>` : ""}
      ${examples ? `<div class="reference-examples"><span class="reference-cell-label">Seen in</span>${examples}</div>` : ""}
    </div>`;
  }).join("")}</div>`;
}

export function activityHref(unitId, activityId) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("unit", unitId);
  url.searchParams.set("activity", activityId);
  return `${url.pathname}${url.search}`;
}

export async function openUnitReference(unitId) {
  const candidate = units.find(item => item.id === unitId);
  if (!candidate) throw new RangeError(`Unknown unit "${unitId}"`);
  referenceSession.deckId = null;
  referenceSession.cardIndex = 0;
  referenceSession.opening = false;
  referenceSession.unitId = unitId;
  elements.referenceDialog.dataset.deckId = `unit-${unitId}`;
  elements.referenceKicker.textContent = `Unit ${candidate.unitNumber}`;
  elements.referenceProgress.textContent = "";
  elements.referenceTitle.innerHTML = renderInline(candidate.title);
  elements.referenceCardBody.innerHTML = '<p class="reference-lede">Loading…</p>';
  elements.referenceActions.innerHTML = '<button class="note-action" type="button" data-reference-action="close">Done</button>';
  showReferenceSurface();
  const entries = await unitReferenceEntries(unitId);
  if (referenceSession.unitId !== unitId) return;
  elements.referenceCardBody.innerHTML = renderUnitReferenceEntries(unitId, entries);
  elements.referenceCardBody.scrollTop = 0;
}

export function referenceCard() {
  const deck = referenceDecks.get(referenceSession.deckId);
  return deck?.cards[referenceSession.cardIndex] || null;
}

function persistReferenceState() {
  try {
    window.localStorage.setItem(referenceStateKey, JSON.stringify(referenceState));
  } catch {
    // A blocked or full store only costs a repeated opening, never correctness.
  }
}

function renderReferenceRows(card) {
  const columns = card.columns || {};
  const vimHeading = columns.vim || "In Vim";
  const hostHeading = columns.host || "In an editor's Vim mode";
  const twoColumn = card.rows.some(row => row.host);
  const rows = card.rows.map(row => `<div class="reference-row${row.host ? "" : " single"}">
      <div class="reference-row-command"><code>${escapeHtml(row.command)}</code>${row.affects ? `<span class="reference-row-affects">${renderInline(row.affects)}</span>` : ""}</div>
      <div class="reference-row-cell reference-row-vim"><span class="reference-cell-label">${escapeHtml(vimHeading)}</span><p>${renderInline(row.vim)}</p></div>
      ${row.host ? `<div class="reference-row-cell reference-row-host"><span class="reference-cell-label">${escapeHtml(hostHeading)}</span><p>${renderInline(row.host)}</p></div>` : ""}
    </div>`).join("");
  const heading = twoColumn
    ? `<div class="reference-row-heading" aria-hidden="true"><span></span><span>${escapeHtml(vimHeading)}</span><span>${escapeHtml(hostHeading)}</span></div>`
    : "";
  return `<div class="reference-rows">${heading}${rows}</div>`;
}

function renderReferenceCard() {
  const deck = referenceDecks.get(referenceSession.deckId);
  const card = referenceCard();
  if (!deck || !card) return;
  elements.referenceKicker.textContent = deck.kicker;
  elements.referenceProgress.textContent = deck.cards.length > 1
    ? `${referenceSession.cardIndex + 1} of ${deck.cards.length}`
    : "";
  elements.referenceTitle.innerHTML = renderInline(card.title);
  elements.referenceCardBody.innerHTML = [
    card.lede ? `<p class="reference-lede">${renderInline(card.lede)}</p>` : "",
    (card.body || []).map(paragraph => `<p>${renderInline(paragraph)}</p>`).join(""),
    card.rows ? renderReferenceRows(card) : "",
    card.hostNote ? `<p class="reference-host-note">${renderInline(card.hostNote)}</p>` : "",
    (card.notes || []).length
      ? `<ul class="reference-notes">${card.notes.map(note => `<li>${renderInline(note)}</li>`).join("")}</ul>`
      : "",
  ].join("");
  elements.referenceCardBody.scrollTop = 0;

  const last = referenceSession.cardIndex === deck.cards.length - 1;
  const authored = last ? (card.actions || []) : [];
  const back = referenceSession.cardIndex > 0
    ? '<button class="note-action secondary-action" type="button" data-reference-action="previous">Back</button>'
    : "";
  const authoredMarkup = authored.map(action => `<button class="note-action${action.kind === "secondary" ? " secondary-action" : ""}" type="button" data-reference-action="authored" data-reference-authored="${escapeHtml(action.id)}">${renderInline(action.label)}</button>`).join("");
  const advance = last
    ? (authored.length
        ? ""
        : `<button class="note-action" type="button" data-reference-action="close">${referenceSession.opening ? "Start Unit 1" : "Done"}</button>`)
    : '<button class="note-action" type="button" data-reference-action="next">Next</button>';
  const skip = referenceSession.opening && !last
    ? '<button class="note-action secondary-action" type="button" data-reference-action="close">Skip</button>'
    : "";
  elements.referenceActions.innerHTML = `${back}${skip}${authoredMarkup}${advance}`;
}

export function openReferenceDeck(deckId, { opening = false } = {}) {
  const deck = referenceDecks.get(deckId);
  if (!deck) throw new RangeError(`Unknown reference deck "${deckId}"`);
  referenceSession.deckId = deckId;
  referenceSession.cardIndex = 0;
  referenceSession.opening = opening;
  elements.referenceDialog.dataset.deckId = deckId;
  elements.referenceDialog.dataset.opening = String(opening);
  renderReferenceCard();
  showReferenceSurface();
  return deck;
}

// Open first: a closed <dialog> has no layout, so the renderer would measure a
// zero-height board and pick the wrong scene profile.
function showReferenceSurface() {
  elements.referenceVisual.dataset.simpleBackground = String(state.generatedBackdrops === "disabled");
  if (!elements.referenceDialog.open) elements.referenceDialog.showModal();
  if (!referencePresentation) return;
  if (!referenceRendererStarted) {
    referenceRenderer.start();
    referenceRendererStarted = true;
  }
  referenceRenderer.setPresentation(referencePresentation, { unitId: "reference" });
  referenceRenderer.updateLayout(true);
  referenceRenderer.syncRemoteVariants();
}

export function closeReferenceDeck() {
  if (referenceSession.opening && !referenceState.orientationSeen) {
    referenceState.orientationSeen = true;
    persistReferenceState();
    renderTableOfContents();
  }
  referenceSession.opening = false;
  referenceSession.unitId = null;
  referenceRenderer.cancelRemoteVariants({ clearLayer: true });
  if (elements.referenceDialog.open) elements.referenceDialog.close();
  showEntryLevelQuestion();
}

function stepReferenceCard(delta) {
  const deck = referenceDecks.get(referenceSession.deckId);
  if (!deck) return;
  const next = referenceSession.cardIndex + delta;
  if (next < 0 || next >= deck.cards.length) return;
  referenceSession.cardIndex = next;
  renderReferenceCard();
}

function handleReferenceAuthoredAction(actionId) {
  if (actionId === "open-survival") {
    // The opening is finished either way: the learner made a choice about it.
    if (!referenceState.orientationSeen) {
      referenceState.orientationSeen = true;
      persistReferenceState();
      renderTableOfContents();
    }
    referenceSession.opening = false;
    openReferenceDeck("survival");
    return;
  }
  closeReferenceDeck();
}
elements.referenceDialog?.addEventListener("click", event => {
  const action = event.target.closest("[data-reference-action]")?.dataset.referenceAction;
  if (action === "next") stepReferenceCard(1);
  if (action === "previous") stepReferenceCard(-1);
  if (action === "close") closeReferenceDeck();
  if (action === "authored") {
    handleReferenceAuthoredAction(event.target.closest("[data-reference-authored]")?.dataset.referenceAuthored);
  }
  const activityRef = event.target.closest("[data-reference-activity]")?.dataset.referenceActivity;
  if (activityRef) {
    closeReferenceDeck();
    goToActivityId(activityRef);
  }
});
// Escape closes a <dialog> without a click, so the opening still has to record
// that it was shown; otherwise it reappears on the next launch.
elements.referenceDialog?.addEventListener("cancel", event => {
  event.preventDefault();
  closeReferenceDeck();
});

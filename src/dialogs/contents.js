/* The course map: one sheet with three tabs.
 *
 * Course lists the units by arc and opens any one of them onto its own page:
 * its board, its guide, and its lessons and activities. The sheet opens on the
 * current unit's page, since "where am I and what's next" is what it is opened
 * for most; "All units" slides back to the list. Practice is the mastery map
 * (`src/surfaces/mastery.js` renders it), with free practice as one row at the
 * bottom. Reference lists every card deck and field note, one level deep.
 *
 * The story lives in the course itself: the prologue opens the list, each
 * finished unit's page replays its chapter, and the epilogue closes the list.
 */

import { appUrl } from "../app/version.js";
import { escapeHtml, renderInline } from "../app/html.js";
import {
  activities,
  catalogData,
  curriculumArcs,
  elements,
  lessons,
  referenceCatalog,
  state,
  unit,
  unitData,
  unitFlow,
  units,
  unitsById,
} from "../app/context.js";
import { goToActivity, navigateToUnit } from "../app/navigation.js";
import { renderTrackBadge } from "../lesson/notes.js";
import { themeColors } from "../lesson/board.js";
import { resolveUnitPresentation, sceneThumbnailPath } from "../world/presentation-data.js";
import { storyTransitions } from "./story.js";
import { openReferenceDeck, openUnitReference, referenceDecks } from "./reference.js";
import { openPracticeFiles, startFreePractice } from "../surfaces/free-practice.js";
import { fieldNoteCatalog, renderMasteryMap, startFieldNote } from "../surfaces/mastery.js";

const tabs = ["course", "practice", "reference"];
// Where the sheet is. `pageUnitId` is the unit whose page the Course tab shows
// while `view` is "page"; it stays set on the list so "All units" can land on
// the row the learner came from.
const mapState = { tab: "course", view: "page", pageUnitId: unit.id };

// Lessons and the activity flow for every unit the map has opened. The current
// unit's is already built; the others are fetched the first time their page
// opens, from the same cache the reference and mastery surfaces use.
const flowCache = new Map([[unit.id, { lessons, activities, reference: unit.reference || [] }]]);

async function flowFor(unitId) {
  if (flowCache.has(unitId)) return flowCache.get(unitId);
  const data = await unitData(unitId);
  if (!data) return null;
  const flow = { ...unitFlow(data), reference: data.reference || [] };
  flowCache.set(unitId, flow);
  return flow;
}

// The catalog declares direct edges only, so anything that wants the real
// upstream set has to walk them. Unit 14 names Unit 11, which names Unit 4: a
// learner who has finished none of the three should hear about all three, not
// just the one edge Unit 14 happens to spell out.
function requiredUnitClosure(unitId, seen = new Set()) {
  for (const id of unitsById.get(unitId)?.prerequisiteSkillIds || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    requiredUnitClosure(id, seen);
  }
  return seen;
}

function unitNumberList(unitIds) {
  const numbers = [...unitIds]
    .map(id => unitsById.get(id))
    .filter(Boolean)
    .sort((left, right) => left.unitNumber - right.unitNumber)
    .map(candidate => candidate.unitNumber);
  if (!numbers.length) return "";
  if (numbers.length === 1) return `Unit ${numbers[0]}`;
  return `Units ${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

function activityTypeLabel(type) {
  return ({ theory: "Theory", demo: "Demo", exercise: "Exercise", choice: "Choice", summary: "Summary" })[type] || type;
}

// Finishing a chapter is a story event; keeping a skill is a mastery state.
// They are deliberately read from different stores and shown in different
// places, because conflating them is how "completed" starts to mean nothing.
function completedUnitIds() {
  return new Set(storyTransitions.getState().completedUnitStoryIds);
}

// Skipping ahead stays possible on purpose. `docs/curriculum-and-progression.md`
// promises that skipping "never permanently locks later material", so this
// warns, points at the way to earn the skipped topics back, and then gets out
// of the way. It never disables the button beside it.
function prerequisiteNotice(candidate, completed) {
  // A practice surface requires nothing: Unit 17 replays whatever exists, and
  // its own copy already says it needs two practised topics.
  if (candidate.surface === "mastery") return "";
  const byNumber = (left, right) => left.unitNumber - right.unitNumber;
  const required = [...requiredUnitClosure(candidate.id)].map(id => unitsById.get(id)).filter(Boolean).sort(byNumber);
  const unmet = required.filter(item => !completed.has(item.id));
  const recommended = (candidate.recommendedSkillIds || [])
    .map(id => unitsById.get(id))
    .filter(item => item && !completed.has(item.id))
    .sort(byNumber);
  const softLine = recommended.length
    ? `<p class="toc-unit-recommended">${unitNumberList(recommended.map(item => item.id))} would make this easier, but ${recommended.length > 1 ? "they are" : "it is"} not required.</p>`
    : "";
  if (!unmet.length) return softLine;
  // Name what this unit itself asks for before anything further upstream. The
  // closure is honest but starts at Unit 1, and "you have not finished the modal
  // model" is not the sentence that tells a learner what to do next.
  const direct = unmet.filter(item => candidate.prerequisiteSkillIds.includes(item.id));
  const lead = (direct.length ? direct : unmet).slice(0, 2);
  const others = unmet.length - lead.length;
  const named = lead.map(item => `${renderInline(item.title)} (Unit ${item.unitNumber})`).join(" or ");
  const rest = others ? `, and ${others} earlier ${others === 1 ? "unit" : "units"}` : "";
  return `<div class="toc-unit-warning" role="note">
    <p class="toc-unit-warning-head"><span aria-hidden="true">⚠</span> Reaches back to ${unitNumberList(required.map(item => item.id))}</p>
    <p>You have not finished ${named}${rest}. Nothing is locked — open this now, or test out of what you skipped.</p>
    <button type="button" data-toc-tab="practice">Test out a topic</button>
  </div>${softLine}`;
}

// What the world lends a unit on the map: its palette, a thumbnail for the
// list, its wide board for the page, its guide, and its chapter's words. The
// world is a tint here, never a heading: the map is organised by topic.
function unitArt(candidate) {
  const resolved = resolveUnitPresentation(catalogData.presentation, candidate.id);
  const [, mid, bright, , warm] = themeColors[resolved?.world.autoThemeId] || themeColors.moonroot;
  const boards = state.generatedBackdrops !== "disabled" && resolved?.scene;
  const thumb = boards ? sceneThumbnailPath(resolved.scene) : null;
  const hero = boards ? resolved.scene.profiles?.wide?.base || resolved.scene.profiles?.compact?.base : null;
  const url = path => `url(&quot;${escapeHtml(appUrl(path))}&quot;)`;
  const style = [
    `--unit-mid:${mid}`,
    `--unit-bright:${bright}`,
    `--unit-warm:${warm}`,
    resolved ? `--unit-gradient:${escapeHtml(resolved.world.fallbackGradient)}` : "",
    thumb ? `--unit-thumb:${url(thumb)}` : "",
    hero ? `--unit-hero:${url(hero)}` : "",
  ].filter(Boolean).join(";");
  return {
    style,
    guide: state.characters === "disabled" ? null : resolved?.unit.guideCharacterId || null,
    completion: resolved?.unit.completion || null,
  };
}

function guideName(id) {
  return id ? id[0].toUpperCase() + id.slice(1) : "";
}

// The lesson position, not the surface: free practice must not blank the open
// lesson in the contents.
function currentPosition() {
  const current = activities[state.activityIndex];
  return {
    lessonNumber: (current?.lessonIndex ?? 0) + 1,
    lessonCount: lessons.length,
    fraction: activities.length ? state.activityIndex / activities.length : 0,
  };
}

function arcOf(candidate) {
  return curriculumArcs.find(arc => arc.unitNumbers.includes(candidate.unitNumber)) || null;
}

// ---- The unit list ---------------------------------------------------------

function unitRow(candidate, completed) {
  const isCurrent = candidate.id === unit.id;
  const finished = completed.has(candidate.id);
  const position = isCurrent ? currentPosition() : null;
  const sub = isCurrent
    ? `Lesson ${position.lessonNumber} of ${position.lessonCount} · you are here`
    : `${candidate.lessonCount} ${candidate.lessonCount === 1 ? "lesson" : "lessons"}`;
  const mark = finished
    ? '<span class="toc-unit-mark toc-unit-complete" title="Chapter finished" aria-label="Chapter finished">✓</span>'
    : '<span class="toc-unit-mark" aria-hidden="true">›</span>';
  const classes = ["toc-unit-row", isCurrent && "current", finished && "finished"].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" data-toc-unit="${escapeHtml(candidate.id)}" style="${unitArt(candidate).style}"${isCurrent ? ' aria-current="true"' : ""}>
    <span class="toc-unit-strip" aria-hidden="true"><b>${candidate.unitNumber}</b></span>
    <span class="toc-unit-text"><span class="toc-unit-number">Unit ${candidate.unitNumber}</span><strong>${renderInline(candidate.title)}</strong><small>${sub}</small></span>
    ${mark}
  </button>`;
}

function storyRow({ kind, title, detail, asset, enabled }) {
  const art = asset && state.generatedBackdrops !== "disabled"
    ? `<img src="${escapeHtml(appUrl(asset))}" alt="" loading="lazy" decoding="async">`
    : '<span class="toc-story-glyph" aria-hidden="true">❦</span>';
  const body = `${art}<span><span class="toc-story-kicker">${kind}</span><strong>${renderInline(title)}</strong></span><em>${detail}</em>`;
  const attribute = kind === "Prologue" ? "data-story-replay-intro" : "data-story-replay-ending";
  return enabled
    ? `<button type="button" class="toc-story-row" ${attribute}>${body}</button>`
    : `<div class="toc-story-row later">${body}</div>`;
}

function renderUnitList() {
  const completed = completedUnitIds();
  const story = catalogData.presentation?.story;
  const assignedUnits = new Set();
  const arcMarkup = curriculumArcs.map((arc, arcIndex) => {
    const arcUnits = units.filter(candidate => arc.unitNumbers.includes(candidate.unitNumber));
    if (!arcUnits.length) return "";
    arcUnits.forEach(candidate => assignedUnits.add(candidate.id));
    const headingId = `toc-arc-${arc.arcNumber}-${arc.id}`;
    return `<section class="toc-arc" aria-labelledby="${escapeHtml(headingId)}">
      ${arcIndex ? '<div class="toc-arc-divider" aria-hidden="true"><span>❦</span></div>' : ""}
      <h3 class="toc-arc-heading" id="${escapeHtml(headingId)}"><span>Arc ${arc.arcNumber}</span><strong>${renderInline(arc.title)}</strong></h3>
      <div class="toc-arc-units">${arcUnits.map(candidate => unitRow(candidate, completed)).join("")}</div>
    </section>`;
  }).join("");
  const ungroupedUnits = units.filter(candidate => !assignedUnits.has(candidate.id));
  const ungroupedMarkup = ungroupedUnits.length
    ? `<section class="toc-arc" aria-labelledby="toc-arc-other"><h3 class="toc-arc-heading" id="toc-arc-other"><span>Course</span><strong>More units</strong></h3><div class="toc-arc-units">${ungroupedUnits.map(candidate => unitRow(candidate, completed)).join("")}</div></section>`
    : "";
  const endingSeen = storyTransitions.getState().endingSeen;
  elements.tocUnitList.innerHTML = [
    storyRow({ kind: "Prologue", title: "The Wilds fall silent", detail: "Replay", asset: story?.intro?.[0]?.asset, enabled: true }),
    arcMarkup,
    ungroupedMarkup,
    storyRow({
      kind: "Epilogue",
      title: story?.ending?.title || "The Wilds restored",
      detail: endingSeen ? "Replay" : `After Unit ${units[units.length - 1].unitNumber}`,
      asset: endingSeen ? story?.ending?.asset : null,
      enabled: endingSeen,
    }),
  ].join("");
}

// ---- A unit's page -----------------------------------------------------------

function activityRows(candidate, flow, lesson) {
  const isCurrentUnit = candidate.id === unit.id;
  const lessonActivities = flow.activities.filter(activity => activity.lessonId === lesson.id);
  return lessonActivities.map((activity, activityIndex) => {
    const isCurrent = isCurrentUnit && activity.activityIndex === state.activityIndex;
    // The current unit's rows move within the page; another unit's rows open it
    // at that activity, which is a page load, the way opening any unit is.
    const target = isCurrentUnit
      ? `data-activity-index="${activity.activityIndex}"`
      : `data-unit-activity="${escapeHtml(activity.id)}"`;
    return `<button class="toc-activity${isCurrent ? " current" : ""}" type="button" ${target}${isCurrent ? ' aria-current="step"' : ""}>
      <span class="toc-number">${lesson.lessonIndex + 1}.${activityIndex + 1}</span>
      <span class="toc-activity-title">${renderInline(activity.title)}</span>
      <span class="activity-type type-${activity.practiceMode || activity.type}">${activity.practiceMode ? escapeHtml(activity.practiceMode) : activityTypeLabel(activity.type)}</span>
    </button>`;
  }).join("");
}

function lessonList(candidate, flow) {
  const current = candidate.id === unit.id ? activities[state.activityIndex] : null;
  return flow.lessons.map(lesson => {
    const count = flow.activities.filter(activity => activity.lessonId === lesson.id).length;
    return `<details class="toc-lesson"${current?.lessonId === lesson.id ? " open" : ""}>
      <summary><span>${lesson.lessonIndex + 1}</span><strong>${renderInline(lesson.title)}</strong>${renderTrackBadge(lesson.track)}<small>${count} <span class="toc-count-label">activities</span></small></summary>
      <div class="toc-activities">${activityRows(candidate, flow, lesson)}</div>
    </details>`;
  }).join("");
}

// Every unit carries the note, because the point of it is that a learner who
// has not opened a unit yet still finds out its commands may be claimed by the
// editor they are sitting in. The card is linked rather than quoted: it is one
// table and it would swamp the page.
function editorNote(candidate) {
  if (!candidate.editorNote) return "";
  const card = referenceDecks.has("host-reality")
    ? '<button type="button" data-reference-deck="host-reality">Chords an editor may claim →</button>'
    : "";
  return `<div class="toc-unit-editor">
    <p><span class="toc-unit-editor-label">In your editor</span>${renderInline(candidate.editorNote)}</p>
    ${card}
  </div>`;
}

function unitPageBody(candidate, flow, finished) {
  if (!flow) {
    return `<p class="toc-unit-unavailable">This unit's lessons could not be loaded. Opening it still works once you are back online.</p>`;
  }
  const replay = finished
    ? `<button type="button" class="toc-chip" data-story-replay-unit="${escapeHtml(candidate.id)}"><span aria-hidden="true">❦</span>Replay chapter</button>`
    : "";
  const commands = flow.reference.length
    ? `<button type="button" class="toc-chip" data-reference-unit="${escapeHtml(candidate.id)}"><span aria-hidden="true">⌘</span>${flow.reference.length} commands</button>`
    : "";
  return `<div class="toc-lessons-box">${lessonList(candidate, flow)}</div>
    ${replay || commands ? `<div class="toc-unit-actions">${replay}${commands}</div>` : ""}`;
}

function unitPage(candidate) {
  const completed = completedUnitIds();
  const isCurrent = candidate.id === unit.id;
  const finished = completed.has(candidate.id);
  const art = unitArt(candidate);
  const index = units.indexOf(candidate);
  const previous = units[index - 1];
  const next = units[index + 1];
  const arc = arcOf(candidate);
  // A finished unit shows how its chapter ended; any other unit shows the hook
  // the previous chapter left, so nothing ahead is spoiled.
  const previousArt = previous ? unitArt(previous) : null;
  const line = finished ? art.completion?.copy : previousArt?.completion?.nextHook?.copy;
  const guide = art.guide
    ? `<img src="${escapeHtml(appUrl(`assets/characters/${art.guide}/idle.png`))}" alt="" decoding="async">`
    : "";
  const guideLabel = [art.guide && guideName(art.guide), finished && "chapter restored"].filter(Boolean).join(" · ");
  const position = isCurrent ? currentPosition() : null;
  const progress = isCurrent
    ? `<div class="toc-unit-progress"><span>Lesson ${position.lessonNumber} of ${position.lessonCount}</span><span class="toc-bar" aria-hidden="true"><i style="width:${Math.max(3, Math.round(position.fraction * 100))}%"></i></span></div>`
    : `<button type="button" class="toc-unit-open" data-unit-id="${escapeHtml(candidate.id)}">Open Unit ${candidate.unitNumber} →</button>`;
  const cached = flowCache.get(candidate.id);
  const pager = (other, direction) => other
    ? `<button type="button" class="toc-pager-${direction}" data-toc-unit="${escapeHtml(other.id)}"><small>${direction === "previous" ? `‹ Unit ${other.unitNumber}` : `Unit ${other.unitNumber} ›`}</small><span>${renderInline(other.title)}</span></button>`
    : "<span></span>";
  return `<div class="toc-page-bar" style="${art.style}">
      <button type="button" class="toc-back" data-toc-back>‹ All units</button>
      <span class="toc-page-bar-title" aria-hidden="true"><b>${candidate.unitNumber}</b> ${renderInline(candidate.title)}</span>
      ${isCurrent ? '<span class="toc-here">Here</span>' : ""}
    </div>
    <header class="toc-unit-hero" style="${art.style}">
      <span class="toc-hero-kicker">${arc ? `Arc ${arc.arcNumber} · ` : ""}Unit ${candidate.unitNumber}</span>
      <h3 id="tocUnitTitle" tabindex="-1">${renderInline(candidate.title)}</h3>
    </header>
    <div class="toc-page-body" style="${art.style}">
      ${guide || line || guideLabel ? `<div class="toc-guide">${guide}<p>${guideLabel ? `<b>${escapeHtml(guideLabel)}</b>` : ""}${line ? renderInline(line) : ""}</p></div>` : ""}
      ${isCurrent ? "" : prerequisiteNotice(candidate, completed)}
      ${progress}
      <div class="toc-unit-content" data-unit-content="${escapeHtml(candidate.id)}">${cached ? unitPageBody(candidate, cached, finished) : '<p class="practice-loading">Loading lessons…</p>'}</div>
      ${editorNote(candidate)}
      <nav class="toc-pager" aria-label="Neighbouring units">${pager(previous, "previous")}${pager(next, "next")}</nav>
      <p class="toc-escape-hint"><kbd>Esc</kbd> returns to all units; a second press closes the map.</p>
    </div>`;
}

async function renderUnitPage(unitId) {
  const candidate = unitsById.get(unitId) || unitsById.get(unit.id);
  const page = elements.tocUnitPage;
  const scrollTop = page.dataset.unitId === candidate.id ? page.scrollTop : 0;
  page.dataset.unitId = candidate.id;
  page.setAttribute("aria-labelledby", "tocUnitTitle");
  page.innerHTML = unitPage(candidate);
  page.scrollTop = scrollTop;
  syncPageBar();
  if (flowCache.has(candidate.id)) return;
  let flow = null;
  try {
    flow = await flowFor(candidate.id);
  } catch {
    flow = null;
  }
  const content = page.querySelector(`[data-unit-content="${CSS.escape(candidate.id)}"]`);
  if (!content || page.dataset.unitId !== candidate.id) return;
  content.innerHTML = unitPageBody(candidate, flow, completedUnitIds().has(candidate.id));
}

// The bar over the hero turns solid, and names the unit, once the hero's title
// has scrolled under it, so "All units" and where you are never leave the
// screen.
function syncPageBar() {
  const page = elements.tocUnitPage;
  const hero = page.querySelector(".toc-unit-hero");
  const bar = page.querySelector(".toc-page-bar");
  if (hero && bar) bar.classList.toggle("solid", page.scrollTop > hero.offsetHeight - bar.offsetHeight - 8);
}
elements.tocUnitPage?.addEventListener("scroll", syncPageBar, { passive: true });

// Opening on a long unit must still show the current activity: scroll it to
// about a third of the way down when it would otherwise start below the fold.
function revealCurrentActivity() {
  const page = elements.tocUnitPage;
  const row = page.querySelector(".toc-activity.current");
  if (!row) return;
  const pageBox = page.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  if (rowBox.bottom <= pageBox.bottom - 12) return;
  page.scrollTop += rowBox.top - pageBox.top - page.clientHeight / 3;
  syncPageBar();
}

function revealListRow(unitId) {
  const list = elements.tocUnitList;
  const row = list.querySelector(`[data-toc-unit="${CSS.escape(unitId)}"]`);
  if (!row) return;
  const listBox = list.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  list.scrollTop += rowBox.top - listBox.top - list.clientHeight / 3;
}

// The view that is away is inert, so neither focus nor a screen reader can
// wander into the list while a page covers it, or the other way round.
function setCourseView(view) {
  mapState.view = view;
  elements.tocCourse.dataset.view = view;
  elements.tocUnitList.inert = view !== "list";
  elements.tocUnitPage.inert = view !== "page";
}

function showUnitList({ focus = true } = {}) {
  renderUnitList();
  setCourseView("list");
  revealListRow(mapState.pageUnitId);
  if (focus) elements.tocUnitList.querySelector(`[data-toc-unit="${CSS.escape(mapState.pageUnitId)}"]`)?.focus({ preventScroll: true });
}

function showUnitPage(unitId, { focus = true } = {}) {
  mapState.pageUnitId = unitId;
  elements.tocUnitPage.dataset.unitId = "";
  setCourseView("page");
  void renderUnitPage(unitId).then(() => {
    if (focus) elements.tocUnitPage.querySelector("#tocUnitTitle")?.focus({ preventScroll: true });
  });
}

// ---- Reference tab -----------------------------------------------------------

function deckMarkup(deck) {
  const head = `<span class="toc-deck-kicker">${renderInline(deck.kicker)}</span><strong>${renderInline(deck.title)}</strong><small>${renderInline(deck.summary)}</small>`;
  if (deck.cards.length === 1) {
    return `<section class="toc-deck single" data-deck-section="${escapeHtml(deck.id)}">
      <button type="button" class="toc-deck-head" data-reference-deck="${escapeHtml(deck.id)}" data-reference-card="0">${head}<i aria-hidden="true">›</i></button>
    </section>`;
  }
  const cards = deck.cards.map((card, index) => `<li><button type="button" data-reference-deck="${escapeHtml(deck.id)}" data-reference-card="${index}"><span>${index + 1}</span>${renderInline(card.title)}<i aria-hidden="true">›</i></button></li>`).join("");
  return `<section class="toc-deck" data-deck-section="${escapeHtml(deck.id)}">
    <div class="toc-deck-head">${head}</div>
    <ol class="toc-deck-cards">${cards}</ol>
  </section>`;
}

async function renderReferenceTab() {
  const decks = (referenceCatalog?.decks || []).map(deckMarkup).join("");
  const unitButtons = units.map(candidate => `<button type="button" data-reference-unit="${escapeHtml(candidate.id)}"><b>${candidate.unitNumber}</b><span>${renderInline(candidate.title)}</span></button>`).join("");
  const render = notes => {
    const noteSection = notes?.length
      ? `<section class="toc-deck" data-deck-section="field-notes">
          <div class="toc-deck-head"><span class="toc-deck-kicker">Field notes</span><strong>Batch and command-line Vim</strong><small>Briefings, not drills: the app runs one buffer, so the multi-file commands they describe cannot be practised here.</small></div>
          <ol class="toc-deck-cards">${notes.map((note, index) => `<li><button type="button" data-field-note="${escapeHtml(note.id)}"><span>${index + 1}</span>${renderInline(note.title)}<i aria-hidden="true">›</i></button></li>`).join("")}</ol>
        </section>`
      : "";
    elements.tocReference.innerHTML = `<p class="toc-tab-lede"><strong>Cards to read.</strong> Nothing here is scored, tracked, or practised.</p>
      ${decks}
      ${noteSection}
      <section class="toc-deck" data-deck-section="units">
        <div class="toc-deck-head"><span class="toc-deck-kicker">By unit</span><strong>Commands each unit teaches</strong></div>
        <div class="toc-reference-units">${unitButtons}</div>
      </section>`;
  };
  render(null);
  try {
    render(await fieldNoteCatalog());
  } catch {
    // Offline before the notes were ever fetched: the decks still stand.
  }
}

// ---- The sheet ---------------------------------------------------------------

function renderHeadProgress() {
  const finished = units.filter(candidate => completedUnitIds().has(candidate.id)).length;
  elements.tocProgress.innerHTML = `<b>${finished}<span> of ${units.length}</span></b><small>chapters</small>`;
  elements.tocProgress.setAttribute("aria-label", `${finished} of ${units.length} chapters restored`);
}

function selectTab(tab, { focus = false } = {}) {
  mapState.tab = tabs.includes(tab) ? tab : "course";
  elements.tocDialog.querySelectorAll("[data-toc-tab][role='tab']").forEach(button => {
    const selected = button.dataset.tocTab === mapState.tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  elements.tocCourse.hidden = mapState.tab !== "course";
  elements.tocPractice.hidden = mapState.tab !== "practice";
  elements.tocReference.hidden = mapState.tab !== "reference";
  // Reports from the Practice tab keep the origin they had when the mastery map
  // was its own dialog, so triage history reads the same across the change.
  elements.tocDialog.querySelector("[data-feedback-open]")?.setAttribute("data-feedback-open", mapState.tab === "practice" ? "mastery" : "contents");
  if (mapState.tab === "practice") void renderMasteryMap();
  if (mapState.tab === "reference") void renderReferenceTab();
}

export function courseMapTab() {
  return elements.tocDialog?.open ? mapState.tab : null;
}

// Where a report filed from the sheet was looking.
export function courseMapLocation() {
  if (mapState.tab !== "course") return mapState.tab;
  const candidate = unitsById.get(mapState.pageUnitId);
  return mapState.view === "page" && candidate ? `course · Unit ${candidate.unitNumber}` : "course · all units";
}

/**
 * Redraws whatever the open sheet is showing. `renderAll` calls this on every
 * activity change, and the story and reference surfaces call it when progress
 * they own moves, so a closed sheet does nothing: opening it renders afresh.
 */
export function renderTableOfContents() {
  if (!elements.tocDialog?.open) return;
  renderHeadProgress();
  if (mapState.tab === "course") {
    if (mapState.view === "list") renderUnitList();
    else void renderUnitPage(mapState.pageUnitId);
  }
}

export function openTableOfContents({ tab = "course", unitId = unit.id } = {}) {
  mapState.pageUnitId = unitsById.has(unitId) ? unitId : unit.id;
  renderHeadProgress();
  renderUnitList();
  elements.tocUnitPage.dataset.unitId = "";
  setCourseView("page");
  void renderUnitPage(mapState.pageUnitId);
  selectTab(tab);
  if (!elements.tocDialog.open) elements.tocDialog.showModal();
  // Layout exists only once the sheet is open.
  elements.tocUnitPage.scrollTop = 0;
  revealCurrentActivity();
  syncPageBar();
}

elements.tocButton?.addEventListener("click", () => {
  openTableOfContents();
});

// Escape steps back before it closes: from a unit's page it returns to the
// list, and only the list (or another tab) lets the sheet close. The close
// button always closes at once.
elements.tocDialog?.addEventListener("cancel", event => {
  if (mapState.tab === "course" && mapState.view === "page") {
    event.preventDefault();
    showUnitList();
  }
});

elements.tocDialog?.querySelector(".toc-tabs")?.addEventListener("keydown", event => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const next = tabs[(tabs.indexOf(mapState.tab) + step + tabs.length) % tabs.length];
  selectTab(next, { focus: true });
});

function closeThen(action) {
  elements.tocDialog.close();
  action();
}

elements.tocDialog?.addEventListener("click", event => {
  const tab = event.target.closest("[data-toc-tab]")?.dataset.tocTab;
  if (tab) return selectTab(tab);
  if (event.target.closest("[data-toc-back]")) return showUnitList();
  const unitRowId = event.target.closest("[data-toc-unit]")?.dataset.tocUnit;
  if (unitRowId) return showUnitPage(unitRowId);
  if (event.target.closest("[data-practice-random]")) return closeThen(() => void startFreePractice());
  if (event.target.closest("[data-practice-browse]")) return closeThen(() => void openPracticeFiles());
  const referenceDeck = event.target.closest("[data-reference-deck]");
  if (referenceDeck) {
    const cardIndex = Number(referenceDeck.dataset.referenceCard || 0);
    return closeThen(() => openReferenceDeck(referenceDeck.dataset.referenceDeck, { cardIndex }));
  }
  const referenceUnit = event.target.closest("[data-reference-unit]")?.dataset.referenceUnit;
  if (referenceUnit) return closeThen(() => void openUnitReference(referenceUnit));
  const fieldNote = event.target.closest("[data-field-note]")?.dataset.fieldNote;
  if (fieldNote) return void startFieldNote(fieldNote);
  if (event.target.closest("[data-story-replay-intro]")) return closeThen(() => storyTransitions.showIntro({ replay: true }));
  if (event.target.closest("[data-story-replay-ending]")) return closeThen(() => storyTransitions.showEnding({ replay: true }));
  const storyUnit = event.target.closest("[data-story-replay-unit]")?.dataset.storyReplayUnit;
  if (storyUnit) return closeThen(() => storyTransitions.showUnit(storyUnit, { replay: true }));
  const activityButton = event.target.closest("[data-activity-index]");
  if (activityButton) return goToActivity(Number(activityButton.dataset.activityIndex));
  const otherActivity = event.target.closest("[data-unit-activity]")?.dataset.unitActivity;
  if (otherActivity) return navigateToUnit(mapState.pageUnitId, otherActivity);
  const unitButton = event.target.closest("button[data-unit-id]");
  if (unitButton) navigateToUnit(unitButton.dataset.unitId);
});

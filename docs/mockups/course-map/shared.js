// Shared runtime for the Course Map mockups: sample learner state, the
// Practice and Reference tabs, lesson/activity markup, tabs, and the toast.
// Each design page supplies only its Course tab through MapMock.mount().
(() => {
  const D = window.MAP_DATA;
  const ASSET_ROOT = "../../../";
  const params = new URLSearchParams(location.search);

  // The one learner state every mockup draws: in Unit 5, Lesson 2, third
  // activity, with Units 1–4 finished.
  const state = {
    unitId: "precision-motions-search",
    lessonIndex: 1,
    activityIndex: 2,
    finished: new Set(D.units.filter(unit => unit.number <= 4).map(unit => unit.id))
  };

  const unitsById = new Map(D.units.map(unit => [unit.id, unit]));
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const inline = value => esc(value).replace(/`([^`]+)`/g, "<code>$1</code>");
  const asset = path => ASSET_ROOT + path;
  const portrait = id => asset(`assets/characters/${id}/idle.png`);
  const typeLabel = { theory: "Theory", demo: "Demo", exercise: "Exercise", choice: "Choice", summary: "Summary" };

  const status = unit => state.finished.has(unit.id) ? "done" : unit.id === state.unitId ? "current" : "ahead";
  const unitsOfArc = arc => arc.unitNumbers.map(number => D.units.find(unit => unit.number === number)).filter(Boolean);
  const activityCount = unit => unit.lessons.reduce((sum, lesson) => sum + lesson.activities.length, 0);

  function requiredClosure(unit, seen = new Set()) {
    for (const id of unit.prerequisites) {
      if (seen.has(id) || !unitsById.has(id)) continue;
      seen.add(id);
      requiredClosure(unitsById.get(id), seen);
    }
    return seen;
  }
  const unmet = unit => unit.surface === "mastery" ? [] : [...requiredClosure(unit)].filter(id => !state.finished.has(id)).map(id => unitsById.get(id));
  const unmetRecommended = unit => unit.recommended.filter(id => !state.finished.has(id)).map(id => unitsById.get(id)).filter(Boolean);

  // Where the learner is inside the current unit, for progress bars.
  function position(unit = unitsById.get(state.unitId)) {
    const before = unit.lessons.slice(0, state.lessonIndex).reduce((sum, lesson) => sum + lesson.activities.length, 0) + state.activityIndex;
    const total = activityCount(unit);
    return { lesson: state.lessonIndex + 1, lessons: unit.lessons.length, done: before, total, fraction: before / total };
  }

  // ---- Lessons and activities ------------------------------------------

  function activities(unit, lesson, lessonIndex) {
    const isCurrentLesson = unit.id === state.unitId && lessonIndex === state.lessonIndex;
    return lesson.activities.map((activity, index) => {
      const current = isCurrentLesson && index === state.activityIndex;
      return `<button type="button" class="act${current ? " current" : ""}"${current ? ' aria-current="page"' : ""} data-open="${esc(`Unit ${unit.number} · ${activity.title}`)}">
        <span class="act-num">${lessonIndex + 1}.${index + 1}</span>
        <span class="act-title">${inline(activity.title)}</span>
        <span class="pill type-${activity.type}">${typeLabel[activity.type] || activity.type}</span>
      </button>`;
    }).join("");
  }

  function lessons(unit) {
    return unit.lessons.map((lesson, index) => {
      const open = unit.id === state.unitId && index === state.lessonIndex;
      const track = lesson.track === "core" ? "" : `<span class="track track-${lesson.track}">${lesson.track}</span>`;
      return `<details class="lesson"${open ? " open" : ""}>
        <summary>
          <span class="lesson-num">${index + 1}</span>
          <strong>${inline(lesson.title)}</strong>
          ${track}
          <small>${lesson.activities.length}</small>
        </summary>
        <div class="acts">${activities(unit, lesson, index)}</div>
      </details>`;
    }).join("");
  }

  // The notes and actions that sit under a unit's lessons: soft prerequisite
  // warning, chapter replay, commands, and the editor note.
  function unitNotice(unit) {
    const missing = unmet(unit);
    const recommended = unmetRecommended(unit);
    if (status(unit) !== "ahead") return "";
    if (missing.length) {
      const named = missing.slice(0, 2).map(other => `Unit ${other.number}`).join(" and ");
      const more = missing.length > 2 ? `, and ${missing.length - 2} more` : "";
      return `<p class="notice"><span aria-hidden="true">⚠</span> Builds on ${named}${more}, not finished yet. Nothing is locked. <button type="button" class="link" data-tab-go="practice">Test out a topic</button></p>`;
    }
    if (recommended.length) return `<p class="notice soft">Unit ${recommended[0].number} would make this easier, but it isn't required.</p>`;
    return "";
  }

  function unitActions(unit, { replayThumb = false } = {}) {
    const replay = status(unit) === "done"
      ? `<button type="button" class="chip-action" data-open="${esc(`Chapter replay · Unit ${unit.number}`)}">${replayThumb ? `<img src="${asset(unit.painting)}" alt="">` : '<span aria-hidden="true">❦</span>'}Replay chapter</button>`
      : "";
    const commands = unit.commandCount
      ? `<button type="button" class="chip-action" data-open="${esc(`Commands in Unit ${unit.number}`)}"><span aria-hidden="true">⌘</span>${unit.commandCount} commands</button>`
      : "";
    return replay || commands ? `<div class="unit-actions">${replay}${commands}</div>` : "";
  }

  // ---- Practice tab ------------------------------------------------------

  // Sample mastery: Units 1–4 in a mix of states with two topics due, the
  // first topics of Unit 5 in progress, the rest unseen.
  const cycle = ["integrated", "practiced", "practiced", "integrated", "learning", "practiced", "practiced"];
  const concepts = D.concepts.map((concept, index) => {
    const unit = unitsById.get(concept.unitId);
    const inUnit = D.concepts.filter(other => other.unitId === concept.unitId).indexOf(concept);
    let conceptState = "unseen";
    if (state.finished.has(concept.unitId)) conceptState = cycle[index % cycle.length];
    else if (concept.unitId === state.unitId && inUnit < 3) conceptState = inUnit < 1 ? "practiced" : "learning";
    const due = (concept.unitNumber === 1 && inUnit === 2) || (concept.unitNumber === 3 && inUnit === 1);
    return { ...concept, unit, state: conceptState, due, pinned: concept.unitNumber === 4 && inUnit === 0 };
  });
  const stateLabel = { unseen: "Unseen", learning: "Learning", practiced: "Practiced", integrated: "Integrated" };
  const applied = concept => concept.state === "practiced" || concept.state === "integrated";

  function topicRow(concept, { showUnit }) {
    const action = applied(concept) ? "Drill" : "Test out";
    return `<div class="topic${concept.due ? " is-due" : ""}">
      <div class="topic-text">
        ${showUnit ? `<span class="topic-unit">Unit ${concept.unitNumber}</span>` : ""}
        <strong>${inline(concept.concept)}</strong>
        <span class="topic-chips">
          <span class="chip state-${concept.state}">${stateLabel[concept.state]}</span>
          ${concept.due ? '<span class="chip due">Due for a refresh</span>' : ""}
        </span>
      </div>
      <div class="topic-actions">
        <button type="button" class="${applied(concept) ? "" : "quiet"}" data-open="${esc(`${action} · ${concept.concept.replace(/`/g, "")}`)}">${action}</button>
        <button type="button" class="pin${concept.pinned ? " pinned" : ""}" aria-pressed="${concept.pinned}" aria-label="Pin for mixed review" title="Pin for mixed review">${concept.pinned ? "★" : "☆"}</button>
      </div>
    </div>`;
  }

  function topicsByUnit() {
    return D.arcs.map(arc => {
      const rows = unitsOfArc(arc).map(unit => {
        const own = concepts.filter(concept => concept.unitId === unit.id);
        if (!own.length) return "";
        const done = own.filter(applied).length;
        const due = own.filter(concept => concept.due).length;
        return `<details class="p-unit${due ? " has-due" : ""}">
          <summary>
            <span class="p-unit-num" style="--accent:${unit.palette.warm}">${unit.number}</span>
            <strong>${inline(unit.title)}</strong>
            <small>${done}/${own.length}${due ? ` · <b>${due} due</b>` : ""}</small>
            <span class="meter" aria-hidden="true"><i style="width:${Math.round(done / own.length * 100)}%"></i></span>
          </summary>
          <div class="p-unit-topics">${own.map(concept => topicRow(concept, { showUnit: false })).join("")}</div>
        </details>`;
      }).join("");
      return `<h4 class="p-arc"><span>Arc ${arc.number}</span> ${esc(arc.title)}</h4>${rows}`;
    }).join("");
  }

  function topicsByNextStep() {
    const groups = [
      { id: "due", title: "Due for a refresh", note: "Practised a while ago. A short drill keeps them.", items: concepts.filter(concept => concept.due), open: true },
      { id: "learning", title: "Learning", note: "Met in a lesson, not yet applied on your own.", items: concepts.filter(concept => concept.state === "learning" && !concept.due), open: true },
      { id: "kept", title: "Practiced and integrated", note: "Replay any of these whenever you like.", items: concepts.filter(concept => applied(concept) && !concept.due), open: false },
      { id: "unseen", title: "Not started yet", note: "Test out of a topic before its lesson. Passing counts.", items: concepts.filter(concept => concept.state === "unseen"), open: false }
    ];
    return groups.map(group => `<details class="p-group p-group-${group.id}"${group.open ? " open" : ""}>
      <summary><strong>${group.title}</strong><small>${group.items.length}</small></summary>
      <p class="p-group-note">${group.note}</p>
      <div class="p-unit-topics">${group.items.slice(0, group.id === "unseen" || group.id === "kept" ? 12 : 99).map(concept => topicRow(concept, { showUnit: true })).join("")}
      ${group.items.length > 12 && (group.id === "unseen" || group.id === "kept") ? `<p class="p-more">and ${group.items.length - 12} more…</p>` : ""}</div>
    </details>`).join("");
  }

  function practiceTab(arrange) {
    const pool = concepts.filter(applied).length;
    const due = concepts.filter(concept => concept.due).length;
    return `
      <p class="tab-lede"><strong>Drills and reviews of what you've met.</strong> Every result is kept. Nothing here moves the story or unlocks a unit.</p>
      <div class="sessions">
        <button type="button" class="session primary" data-open="Mixed review">
          <span class="session-kicker">Session</span>
          <strong>Mixed review</strong>
          <small>Five of your ${pool} practised topics, interleaved.${due ? ` Starts with the ${due} due.` : ""}</small>
          <span class="session-go">Start →</span>
        </button>
        <button type="button" class="session" data-open="Tool choice">
          <span class="session-kicker">Session</span>
          <strong>Tool choice</strong>
          <small>Name the mechanism before touching the keys.</small>
        </button>
      </div>
      <div class="p-head">
        <h3>Topics</h3>
        <div class="seg" role="group" aria-label="Arrange topics">
          <button type="button" data-arrange="unit" aria-pressed="${arrange === "unit"}">By unit</button>
          <button type="button" data-arrange="next" aria-pressed="${arrange === "next"}">By next step</button>
        </div>
      </div>
      <div class="p-topics">${arrange === "next" ? topicsByNextStep() : topicsByUnit()}</div>
      <button type="button" class="scratch" data-open="Free practice · a random file">
        <span class="scratch-icon" aria-hidden="true">✎</span>
        <span><strong>Scratchpad</strong><small>A real file, no goal. Untracked.</small></span>
        <span class="scratch-browse" data-open="Free practice · browse the files">Browse</span>
      </button>`;
  }

  // ---- Reference tab -----------------------------------------------------

  function deckBlock({ kicker, title, summary, cards, label }) {
    const list = cards.length > 1
      ? `<ol class="deck-cards">${cards.map((card, index) => `<li><button type="button" data-open="${esc(`${title} · ${card}`)}"><span>${index + 1}</span>${inline(card)}<i aria-hidden="true">›</i></button></li>`).join("")}</ol>`
      : "";
    const head = `<span class="deck-kicker">${esc(kicker)}</span><strong>${inline(title)}</strong><small>${inline(summary)}</small>`;
    return cards.length > 1
      ? `<section class="deck"><div class="deck-head">${head}</div>${list}</section>`
      : `<section class="deck single"><button type="button" class="deck-head" data-open="${esc(label || title)}">${head}<i aria-hidden="true">›</i></button></section>`;
  }

  function referenceTab() {
    const decks = D.decks.map(deck => deckBlock({ kicker: deck.kicker, title: deck.title, summary: deck.summary, cards: deck.cards }));
    const notes = deckBlock({
      kicker: "Field notes",
      title: "Batch and command-line Vim",
      summary: "Briefings on multi-file work this single-buffer app can't drill.",
      cards: D.fieldNotes.map(note => note.title)
    });
    const units = D.units.map(unit => `<button type="button" data-open="${esc(`Commands in Unit ${unit.number}`)}" title="${esc(unit.title)}"><b>${unit.number}</b><span>${inline(unit.title)}</span></button>`).join("");
    return `
      <p class="tab-lede"><strong>Cards to read.</strong> Nothing here is scored, tracked, or practised.</p>
      ${decks.join("")}
      ${notes}
      <section class="deck">
        <div class="deck-head"><span class="deck-kicker">By unit</span><strong>Commands each unit teaches</strong></div>
        <div class="unit-commands">${units}</div>
      </section>`;
  }

  // ---- Sheet ------------------------------------------------------------

  function toast(message, prefix = "Would open: ") {
    let node = document.querySelector(".toast");
    if (!node) {
      node = document.createElement("div");
      node.className = "toast";
      document.body.append(node);
    }
    node.textContent = `${prefix}${message}`;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 1600);
  }

  function mount({ course, onCourse = () => {}, kicker = "Course map" }) {
    const finishedCount = state.finished.size;
    const tab = params.get("tab") || "course";
    let arrange = params.get("arrange") || "unit";
    document.body.insertAdjacentHTML("afterbegin", `
      <div class="sheet" role="dialog" aria-labelledby="sheetTitle">
        <header class="sheet-head">
          <div>
            <span class="kicker">${esc(kicker)}</span>
            <h2 id="sheetTitle">Contents</h2>
          </div>
          <span class="head-progress"><b>${finishedCount}<span> of ${D.units.length}</span></b><small>chapters</small></span>
          <button type="button" class="close" aria-label="Close">×</button>
        </header>
        <nav class="tabs" role="tablist">
          <button type="button" role="tab" data-tab="course">Course</button>
          <button type="button" role="tab" data-tab="practice">Practice</button>
          <button type="button" role="tab" data-tab="reference">Reference</button>
        </nav>
        <div class="panel" data-panel="course" role="tabpanel"></div>
        <div class="panel" data-panel="practice" role="tabpanel"></div>
        <div class="panel" data-panel="reference" role="tabpanel"></div>
      </div>`);

    const panel = name => document.querySelector(`[data-panel="${name}"]`);
    panel("course").innerHTML = course();
    panel("practice").innerHTML = practiceTab(arrange);
    panel("reference").innerHTML = referenceTab();

    const select = name => {
      document.querySelectorAll("[data-tab]").forEach(button => button.setAttribute("aria-selected", String(button.dataset.tab === name)));
      document.querySelectorAll("[data-panel]").forEach(node => { node.hidden = node.dataset.panel !== name; });
    };
    select(tab);
    onCourse(panel("course"));

    document.addEventListener("click", event => {
      const tabButton = event.target.closest("[data-tab]");
      if (tabButton) return select(tabButton.dataset.tab);
      const go = event.target.closest("[data-tab-go]");
      if (go) return select(go.dataset.tabGo);
      const arrangeButton = event.target.closest("[data-arrange]");
      if (arrangeButton) {
        arrange = arrangeButton.dataset.arrange;
        panel("practice").innerHTML = practiceTab(arrange);
        return;
      }
      const pin = event.target.closest(".pin");
      if (pin) {
        pin.classList.toggle("pinned");
        pin.textContent = pin.classList.contains("pinned") ? "★" : "☆";
        return;
      }
      const open = event.target.closest("[data-open]");
      if (open) {
        event.preventDefault();
        toast(open.dataset.open);
      }
    });
  }

  // Scroll a panel so `node` sits near its top, as the real map should on open.
  function landOn(panelNode, node, offset = 8) {
    if (!node) return;
    const top = node.getBoundingClientRect().top - panelNode.getBoundingClientRect().top + panelNode.scrollTop;
    panelNode.scrollTop = Math.max(0, top - offset);
  }

  window.MapMock = {
    D, state, esc, inline, asset, portrait, status, unitsOfArc, unitsById, activityCount, position,
    unmet, lessons, activities, unitNotice, unitActions, mount, landOn, toast
  };
})();

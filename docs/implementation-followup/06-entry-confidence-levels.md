# Session 06 — Entry confidence levels

**Size:** M. **Depends on:** nothing.

## Why

`docs/curriculum-and-progression.md:118` makes a promise the product does not
keep:

> Users choose an initial confidence level: new to Vim, familiar with basics, or
> experienced. This choice changes the suggested entry point, not content
> availability. A user may preview any topic, manually request its test-out
> challenge, or skip it with a visible prerequisite warning.

The last two clauses shipped. The first did not. There is **no selector, no
stored level, and no test** — a repo-wide search finds the three words only in
that document. Session 18 listed it as the last bullet of its §4 and its own
validation step ("walk the three entry confidence levels end to end") was never
performable.

Everything the feature needs already exists:

- `prerequisiteNotice` (`app.js:2047`) computes the full `requiredUnitClosure`,
  names the direct unmet prerequisite before the upstream ones, prints "Nothing
  is locked — open this now, or test out of what you skipped", and — per the
  comment above it — **never disables the button beside it**.
- `recommendedSkillIds` renders as a separate soft line.
- `data-mastery-open` offers test-out from inside the warning, and
  `tests/curriculum-graph.spec.js` already asserts an unreached topic's test-out
  actually starts and does not widen the review pool.

So the machinery for "skip safely" is done and tested. What is missing is the
one question at the front: *where should this person start?*

An experienced Vim user who installs this app currently lands on Unit 1, lesson
1, modal model — and the only way to discover that Arc 3 exists is to open the
contents dialog and scroll. That is the gap worth closing, and it is worth
closing before the app meets anyone who already knows `dw`.

## Scope

### 1. Ask once, at first run

Three levels, matching the document's wording so the promise and the product
agree: **new to Vim**, **familiar with the basics**, **experienced**.

Ask it once, on first open, and make it skippable — a learner who dismisses the
question is "new to Vim", which is the current behavior and needs no ceremony.
It must be changeable afterwards; `#settingsDialog` is the obvious home, beside
the existing Story replay row.

### 2. The level selects a landing point and nothing else

**This is the invariant that must not be violated.** The document is explicit:
"This choice changes the suggested entry point, not content availability."
Concretely:

- No unit becomes unavailable at any level.
- No progress is marked complete that was not earned. An experienced user who
  lands in Arc 2 has **not** completed Arc 1, and `prerequisiteNotice` should
  say so in its usual voice when they open something that reaches back. That
  warning is the feature working, not a bug to suppress.
- The level is a suggestion about *where to open*, so it belongs wherever
  "Continue" is decided, not in the completion store.

Pick the landing points from the arc structure in `content/unit-index.json`
rather than inventing them: Arc 1 Foundations, Arc 2 Fluency and tracks, Arc 3
Automation, Arc 4 Integration. "Familiar with the basics" and "experienced"
map naturally onto the starts of Arcs 2 and 3.

Add the level to `window.VimWilds.getState()` so it is testable, following how
`freePracticeState()` and `masteryState()` are exposed.

### 3. Decide what "preview any topic" means

The same paragraph promises "A user may preview any topic." Today that is served
by the contents dialog's deep links (`?unit=`, `?activity=`, and
`data-activity-index`), which do reach any activity — but there is no affordance
named "preview" and no test asserting the promise. The `?preview=` parameter in
`app.js` is unrelated; it previews story, art and completion states.

Two acceptable outcomes, and the session must pick one and land it:

- add a named preview affordance and a test that asserts any topic is
  reachable without touching progress, or
- **reword the document** so it describes the deep links that exist.

Do not leave a third undocumented state.

## Out of scope

- Adaptive scheduling, placement scoring, automatic promotion, knowledge
  tracing, forgetting curves. The curriculum document itself calls these "future
  adaptation work", and session 17 shipped the five progress states as *state*
  rather than as a scheduling algorithm. Keep that line.
- A placement *test*. The level is self-reported. Test-out already exists for
  learners who want to prove a topic.
- Any new lesson content.
- Changing `prerequisiteSkillIds` or `recommendedSkillIds`. The graph is
  reconciled and test-guarded; this session reads it.

## Validation

- `node --check app.js`, `git diff --check`.
- `npm test`.
- `npm run test:targeted -- tests/curriculum-graph.spec.js` at one worker.
  Extend it: walk all three levels end to end and assert each reaches a sensible
  first lesson — the validation step session 18 wrote and could not run.
- Assert that choosing "experienced" completes nothing: after entry, the
  prerequisite warning for an Arc 3 unit still names the unmet closure, and
  the saved lesson position is the landing point rather than a fabricated
  history.
- Confirm first-run entry and a later change from Settings both work, and that
  dismissing the question leaves today's behavior exactly as it is.
- Inspect the selector at 360×740 and 430×932. Three options with real prose
  descriptions is a tight fit on the narrow phone; functional labels stay at
  10–11px minimum and critical guidance at 16px.

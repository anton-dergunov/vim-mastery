# Session 07 — Unit 9: split, mark, and narrow

**Status:** complete · **Depends on:** nothing · **Blocks:** 18
**Touches:** `content/units/09-position-memory.json` (new),
`content/units/10-viewport-control.json` (new), the five renumbered unit files,
`content/unit-index.json`, `content/unit-content.schema.json`,
`content/presentation.json`, `app.js`, `styles.css`, `tests/`
**Size:** L

## What the brief got wrong

The original brief proposed demoting four lessons' worth of material to
reference: section and method motions, the scroll chords, and the bracket marks.
Three corrections, agreed with the author before executing it.

**"Demote to reference" is deletion today.** `unit.reference` is parsed, schema
-validated, and checked by tests — and rendered **nowhere** in `app.js`. The
Reference surface that would give demoted material a home is session 14, which
runs *after* this session. So every "move to reference" in briefs 07, 08, and 10
removes material from the product with no destination. The review itself says
the opposite (`curriculum-review-automation-focus.md` Part 4: *"The
recommendation is not deletion — the reference value is real"*); the briefs
escalated it.

**The VS Code justification does not hold.** The scroll chords were demoted
because *"all four are bound away by VS Code defaults"*. The course never
mentions VS Code and should not: it teaches Vim, including terminal Vim, where
`Ctrl-f`, `Ctrl-b`, `Ctrl-e`, and `Ctrl-y` are native and unclaimed. A chord one
host happens to claim is a portability note attached to a command that is still
taught. This is now constraint 8 in [README.md](README.md).

**The prerequisite cascade does not exist.** The brief warned that "several units
in Arc 2 and 3" name `long-range-navigation` in `prerequisiteSkillIds`. None do.
Only Units 12–14 name specific upstream units, and none of them is Unit 9.

**Three things the brief missed.** Unit 9's "18 challenges" anomaly is a
labelling bug, not a content surplus — four activities are named `*-mix` and
carry `phase: "challenge"`. Its viewport-dependence markers were already
complete (session 02 did all 51). And every one of its 51 activities shipped
lines up to 59 columns into a slab that clips at 30, which was the largest real
defect in the unit and is not mentioned in the brief at all.

## What was done instead

### 1. A `track` marker, so nothing is removed

`lesson.track` (`core` | `advanced` | `optional`) plus a required `trackNote`.
Core is the default and is expressed by the field's absence, so the marker stays
meaningful. The vocabulary is not new — `curriculum-and-progression.md` has
defined Core/Advanced/Optional in prose since the start; this moves it into data.

`trackNote` opens with a fixed lead phrase per track — `Advanced and less
commonly used:` or `Optional — depends on configuration or file type:` — so
marked material is greppable from the content, not only from the schema. The
table of contents renders a badge; the lesson's first activity renders the note.
A marked lesson keeps its full five-phase cycle, which a test enforces.

Three lessons are marked, all `advanced`: `revisit-operated-ranges` (bracket
marks), `navigate-code-structure` (section and method motions), and
`scroll-under-cursor` (`Ctrl-e`/`Ctrl-y`). `travel-by-pages` stays **core** —
`Ctrl-d`/`Ctrl-u` are core by any account and `Ctrl-f`/`Ctrl-b` are native paging.

### 2. The split

**Unit 9 Position memory** (6 lessons, 31 runnables) and **Unit 10 Viewport
control** (5 lessons, 20 runnables). Position memory goes first because it is the
more valuable half. Units 10–14 renumbered to 11–15; Arc 2 is now `[7,8,9,10,11]`
and Arc 3 `[12,13,14,15]`.

The integration lesson went to Unit 10 — it composes both halves
(`` `a zt ``), so it only integrates once viewport control has been taught. Unit
9 gained a closing `summary` activity, which it needed for a structural reason
worth recording: `renderUnitContinuation` fires only from the summary branch of
`renderFieldNote`, so a unit whose last activity is not a summary never renders
its continuation and the progression stops dead.

Activity payloads moved byte-identically. Two ids were renamed with their lesson:
`integrate-long-range-navigation` → `integrate-navigation-and-viewport` and
`long-range-navigation-summary` → `navigation-and-viewport-summary`.

### 3. Shared art, deliberately

Both units keep Luma, `archive-of-echoes`, and the `far-beacons` scene until
[session 20](20-viewport-control-art.md) draws Unit 10 its own. Two constraints
shaped how: the presentation test requires a story image at
`assets/worlds/story/units/{unitId}.webp`, and it requires a landmark id to
belong to exactly one unit. So the story asset was renamed and copied, and Unit
10 took a new landmark id (`beacon-glass`) pointing at Unit 9's artwork. The
story chain still reads: Unit 9 hands off to Unit 10, and Unit 10 keeps the old
hook into the Echo Clock.

### 4. Re-phasing, not trimming

`reselect-last-visual-mix`, `block-open-mix`, `paren-open-mix`, and
`method-start-mix` were named as mixes and phased as challenges. Their phases now
match their names, and the coverage arrays follow. `navigate-code-structure` goes
from 7 challenges to 4 mixes and 4 challenges. **No activity was removed.**

### 5. Narrowing to the 30-column window

All three of the unit's shared buffers were re-authored to 30 columns, and the
`long-range-navigation` exemption in `tests/content-data.test.mjs` is gone.

This was safe to do cheaply because of a property of the content: no cursor in
either unit passes **column 20**, and every over-wide line was over-wide past
column 30. Rewriting under three invariants therefore moved no authored
coordinate:

- the same 30 rows, with the same blank rows and the same brace rows — the
  method-boundary fixture asserts exact columns for `[m`, `]m`, `[M`, `]M`, so
  rows 10, 12, 17, and 19 of the `Store` buffer are untouched;
- the same leading indentation on every row, because `H`/`M`/`L` and the paging
  commands land on a row's first non-blank column;
- every row at least one character longer than the deepest column any cursor,
  setup, target, or checkpoint places on it.

One trap worth recording: the change-list setups run `rt` at row 4, column 9 — a
deliberate no-op edit that registers a change without altering the text. The
narrowed line has to keep a `t` in that column, which is why the array is named
`routes` and not `urls`. Native Vim caught it; nothing else would have.

## Out of scope

- Building the Reference surface (session 14) or Free Practice (session 15).
- Unit 10's own artwork — [session 20](20-viewport-control-art.md).
- Any content change to Units 1–8 or 11–15 beyond the renumbering.

## Acceptance criteria

- Unit 9 is two units of 6 and 5 lessons, position memory first. ✅
- No activity was removed; three lessons carry `track: "advanced"`. ✅
- Scroll chords and section motions are still taught, with host-neutral notes. ✅
- Phases match activity names; coverage arrays follow. ✅
- Every buffer line is at most 30 columns and the test exemption is gone. ✅
- `unit-index.json`, `presentation.json`, and every spec reflect the numbering. ✅

## Validation

```bash
node --check app.js && node --check vim-engine.js && git diff --check
npm test
npm run test:targeted -- tests/editor-conformance.spec.js --workers=1 \
  --grep "Unit 9|Unit 10|position|viewport|backtick|method-boundary|drift|clipping|marks advanced"
```

531 content tests pass, including all 51 canonicals replayed through native Vim
against the narrowed buffers, and the 30-column guard with no exemption. The
browser suite replays both units activity by activity, walks Unit 8 → 9 → 10 →
11, and the `@exhaustive` case confirms every production activity fits 360×740,
390×844, 412×915, 430×932, and 432×960 with no clipping or overflow.

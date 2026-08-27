# Session 13 — Visual Block `$` and `g Ctrl-a`

**Depends on:** 01 (conformance verdict), 09 (Unit 7 restructure) · **Blocks:** nothing

> **Session 01 verdict.** Both halves are verified. `g Ctrl-a` did not need to
> be dropped — and note that plain `Ctrl-a` over a selection was *also* missing
> and is now patched, so section 2's contrast works. Visual Block `$` needed a
> cursor fix for `d` only; `A` and `I` already conformed.
**Touches:** `content/units/07-visual-selection.json`, possibly `patches/`
**Size:** M

## Context

Two additions to Visual Block, both aimed at the gap between what the unit
teaches and what Visual Block is actually for.

**Visual Block `$` — the ragged right edge.** Unit 7 only ever teaches aligned
rectangles. Every block exercise operates on text where the target columns line
up. The learner reasonably concludes Visual Block works only on tables. But
appending to lines of *differing* length — `Ctrl-v}$A;⏎` to add a semicolon to a
block of statements — is the canonical real-world use, and it is absent.

**`g Ctrl-a` — sequential numbering.** Unit 3 teaches `Ctrl-a` on a single number
and stops there. `g Ctrl-a` over a Visual selection turns a column of identical
numbers into a sequence. Renumbering a list after a reorder is a frequent, fully
deterministic task with no clean non-Vim equivalent — exactly the kind of thing
this product exists to teach.

## Scope

Both are gated on session 01.

### 1. Visual Block `$`

Add to `insert-across-rows` (and touch `edit-rectangular-columns`):

- `Ctrl-v` + motion + `$` + `A` + text — append to every line regardless of
  length.
- Contrast directly with a fixed-column `A` on the same ragged buffer, so the
  learner sees the failure mode `$` fixes.

Engine note: block `I` and `A` are already patched — the existing hunk remembers
the upper-left corner and restores it after the replicated insert. `$` extends
the same code path, so this should be a small addition rather than new
machinery.

### 2. `g Ctrl-a`

Add to `edit-rectangular-columns` or as a short lesson:

- Visual selection over a column of identical numbers, then `g Ctrl-a` to
  produce 1, 2, 3…
- Contrast with plain `Ctrl-a` over the same selection, which increments every
  line by the same amount. The difference *is* the lesson.
- Pair with Visual Block so the learner sees the column-selection and the
  increment as one workflow.

**If `g Ctrl-a` requires a large or fragile patch, drop it.** Session 01 flags
this as the lowest-value item on the conformance list. Visual Block `$` is the
one worth pushing for.

### 3. Realistic buffers

Both additions want code: a block of statements missing semicolons, a numbered
test-case list after a reorder, an enum needing sequential values. Session 09
already rebalances this unit toward code — build on that.

## Out of scope

- Other `g`-prefixed operators.
- Visual Block `c` and `r` — already covered.

## Acceptance criteria

- Visual Block `$` is taught with an explicit ragged-versus-aligned contrast, or
  documented as dropped with a conformance reason.
- `g Ctrl-a` is taught with an explicit contrast against plain `Ctrl-a`, or
  documented as dropped.
- `supported-commands.json` and `patches/README.md` updated for anything patched.

## Validation

```bash
node --check app.js && git diff --check
npm test
npm run test:targeted -- <unit spec> --grep "visual|block" # one worker
```

Per `AGENTS.md`, Visual Block selections end at the checkpoint cursor. A `$`
block has no fixed right edge, so confirm the checkpoint contract still holds and
that the selection renders correctly on ragged rows at 360px. Exercise the
latched-Ctrl touch path for `Ctrl-v` and for `g Ctrl-a`.

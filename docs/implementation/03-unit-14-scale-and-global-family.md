# Session 03 — Unit 14: scale and the `:global` family

**Depends on:** 01 (fixtures for `:g/pat/t$`, `m0`), 02 (viewport, impact readout)
**Blocks:** 16 · **Touches:** `content/units/14-global-normal-automation.json`, `content/unit-index.json`
**Size:** L

## Context

Unit 14 is where the product's whole purpose lands, and it is currently taught
at a scale that argues against itself. Measured: **average 4.0 lines, maximum 7,
most commonly 3.** Canonical solutions include `:g/TODO/normal I// ` on a
three-line buffer.

The unit also omits the `:global` family that best demonstrates what `:global`
is for: combining a predicate with `:copy`/`:move`.

## Goal

Make `:global` visibly worth using, and complete the command family.

## Scope

### 1. Re-scale every exercise (the main work)

Target shape for automation exercises:

- **16–24 buffer lines**, using `scenario.initial.viewport` to keep the visible
  window at whatever the phone already shows. Do not add visible rows.
- **5–9 matching lines**, and critically **non-adjacent**: matches must be
  interleaved with non-matching lines.
- Adjacency matters as much as count. If matches are contiguous, `V3j:normal`
  or plain `3.` wins and `:g` still looks pointless. **The predicate has to do
  work that position cannot do.** That is the entire pedagogical point of the
  unit.
- Keep line width modest — the review found existing buffers up to 91 characters,
  which risks horizontal overflow at 360px.

Realistic sources: a config file with scattered deprecated keys, a log with
interleaved severities, a stylesheet with vendor-prefixed rules among normal
ones, a test file with a mix of skipped and active cases.

### 2. Add the collect-and-reorder lesson

New lesson between `global-normal` and `choose-automation`:

- `:g/pat/t$` — copy every matching line to the end (gather).
- `:g/pat/m0` — move every matching line to the top, reversing their order.
- `:g/pat/m$` — move matching lines to the end, preserving order.

Explain the reversal in `m0` explicitly; it surprises people and understanding
why is the lesson. This is the cheapest addition in the whole review — every
component is already verified, only the composition is new.

### 3. Add dry-run habits

Unit 12 already teaches `:s///gn` to count before editing, which is an excellent
habit. `:g` is the more dangerous command and has no equivalent. Add `:g/pat/p`
and `:g/pat/nu` as a preview step, ideally woven into the existing lessons
rather than as a separate one.

### 4. Add undo grouping

Theory plus a choice activity in `choose-automation`: one `u` undoes an entire
`:g` run, but a macro replayed ten times needs ten undos. Learners currently
discover this expensively. No engine work required.

### 5. Verify the rendering artifact

Several canonicals render as `: g/^const/s /old/ new/ ↵` — with spaces after `s`
and inside the replacement. This is probably a `commandGroups` display boundary
rather than the real key stream, but **confirm it**, because if the learner sees
it as shown it teaches an invalid command. Fix the grouping if the display is
wrong.

## Out of scope

- `:argdo` / `:bufdo` / quickfix — deliberately conceptual, session 17.
- New `:normal` semantics.

## Acceptance criteria

- Every exercise has 16–24 buffer lines with 5–9 non-adjacent matches.
- No exercise shows more code rows than it does today.
- The collect-and-reorder lesson exists and its canonicals replay exactly.
- Dry-run and undo-grouping material is present.
- The `s /old/ new/` rendering is confirmed correct or fixed.
- `unit-index.json` `lessonCount` updated.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "global" # one worker
```

Replay every changed canonical solution and confirm exact target buffer, cursor,
mode, and register state. Inspect the full viewport matrix — a 24-line buffer
with wide lines is the most likely place in the product for overflow.

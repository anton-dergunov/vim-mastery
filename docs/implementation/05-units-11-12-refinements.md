# Session 05 — Units 11–12: scale and sort flags

**Depends on:** 01 (`:sort` flag fixtures), 02 (viewport) · **Blocks:** 16

> **Session 01 verdict.** All three flags are verified: `:sort n`, `:sort u`,
> and `:sort /pat/` (which needed a patch — Vim sorts on the text *after* the
> match). Nothing to drop.
>
> **Revised during execution.** This brief originally mandated "re-scale to
> 14–20 buffer lines" for all of Unit 12 and "8–12 lines" for Unit 11. That was
> the wrong instruction and it has been replaced by constraint 5 in
> [README.md](README.md): a buffer is sized from its own exercise, never from a
> per-unit target. Unit 12's re-scale is confined to the two lessons whose
> subject is scope; the rest of the unit teaches pattern mechanics on one to
> three lines and is correct as it stands. Unit 11 is windowed only where a
> range needs room to mean anything.
>
> The brief also asked to *reduce* the exercise count in `compose-ranges`. That
> was blocked by the per-lesson phase-coverage contract, which puts a hard floor
> of five activities on every lesson. The floor was the real problem: it is a
> minimum coverage contract that had been read as a lesson template. It is now
> documented as a minimum with no maximum, and `compose-ranges` was retargeted
> in place rather than shrunk.
**Touches:** `content/units/11-command-line-ranges-line-operations.json`,
`content/units/12-substitution-practical-regex.json`, `content/unit-index.json`
**Size:** M

## Context

Unit 11 is the best-constructed unit in Arc 3 — genuinely varied addresses
across `.`, `$`, numbers, marks, searches, offsets, `%`, `,` and `;`. It needs
little. Unit 12 is well-sequenced but runs on 2.1-line buffers on average, where
a `%` range and a single-line range are visually indistinguishable, so the
learner cannot see what scoping bought them.

## Scope

### Unit 12

1. **Give `scope-the-lines` the room its subject needs** — a window over a
   buffer long enough that matches sit outside it, with
   `scenario.initial.viewport` holding the visible rows at their current size.
   Matches should be scattered so that a `%` range, a numeric range, and a
   Visual range produce *visibly different* outcomes — that difference is the
   lesson and it currently cannot be seen. Lessons whose subject is the pattern
   rather than the scope keep their present size.
2. The `preview-and-confirm` lesson benefits most: `:%s///gn` reporting a count
   across 20 lines is meaningful; across 2 lines it is noise. Pair it with the
   impact readout from session 02.
3. Confirm `c`-flag confirmation stepping still behaves when matches are
   off-screen — the window must follow the confirmation cursor.

### Unit 11

4. **Add `:sort n`, `:sort u`, and `:sort /pat/`** to `join-and-sort-ranges`.
   `:sort` and `:sort!` are taught; numeric sort and dedupe are the two variants
   people actually reach for and both are missing. Gate on session 01's verdict —
   if a flag fails conformance, drop that flag and note it.
5. **Trim the offset drilling** in `compose-ranges`. One clear `,` versus `;`
   contrast is the valuable part; beyond that it is trivia. Retarget the
   redundant offset exercises onto that contrast rather than removing them.
6. **Scale only where a range needs room.** Line operations stay legible at 4–6
   lines, so most of this unit changes nothing. Window the sort work, where
   `:2,4sort` and `:%sort` over four rows demonstrate nothing about sorting, and
   leave the rest alone.

## Out of scope

- `:g` — session 03.
- `\=` expression replacement — correctly last and advanced; leave as is.

## Acceptance criteria

- A `%` range and a numeric range produce visibly different results in at least
  one paired exercise, which requires `scope-the-lines` to run over a buffer
  with matches outside its window. Visible rows are unchanged.
- Every buffer that grew can name the reach its exercise needs. No buffer grew
  to match another activity's length.
- `:sort n` and `:sort u` are taught, or explicitly dropped with a recorded
  conformance reason.
- `unit-index.json` `lessonCount` updated if lesson counts change.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "substitut|sort" # one worker
```

Replay every changed canonical. For Unit 12 specifically, verify confirmation
flag behavior (`y`/`n`/`a`/`q`/`l`/Escape) still works when the confirmation
walks off-screen.

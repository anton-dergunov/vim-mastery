# Session 05 — Units 11–12: scale and sort flags

**Depends on:** 01 (`:sort` flag fixtures), 02 (viewport) · **Blocks:** 16
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

1. **Re-scale to 14–20 buffer lines** with `scenario.initial.viewport` holding
   the visible window at its current size. Matches should be scattered so that a
   `%` range, a numeric range, and a Visual range produce *visibly different*
   outcomes — that difference is the `scope-the-lines` lesson and it currently
   cannot be seen.
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
   contrast is the valuable part; beyond that it is trivia. Keep the lesson,
   reduce the exercise count, and reallocate to the sort work.
6. **Modest re-scale only.** Line operations stay legible at 4–6 lines, so this
   unit does not need the full treatment. Take it to 8–12 lines where a range
   genuinely needs room to mean something (`:2,4sort` reads better against a
   longer list), and leave the rest.

## Out of scope

- `:g` — session 03.
- `\=` expression replacement — correctly last and advanced; leave as is.

## Acceptance criteria

- Unit 12 buffers are 14–20 lines with visible rows unchanged.
- A `%` range and a numeric range produce visibly different results in at least
  one paired exercise.
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

# Session 07 — Unit 9: split and trim

**Depends on:** nothing · **Blocks:** 18
**Touches:** `content/units/09-long-range-navigation.json`, `content/unit-index.json`,
possibly a new unit file
**Size:** L

## Context

Unit 9 is the largest unit in the product: 11 lessons, 40 exercises, 393 KB —
78% larger than the next file. Its 30-line buffers with `viewport` blocks are
correct and are the proof that long buffers work on a phone.

But roughly four lessons cover material that is either syntax-dependent and
unreliable in emulators, or bound away by the primary target host:

- **Section and method motions** `[[ ]] [] ][ [{ ]} [( ]) [m ]m [M ]M` —
  syntax-dependent, unreliable in emulators, rarely used even by fluent Vim
  users. `curriculum-and-progression.md` already calls these *"advanced and
  syntax-dependent"*; this session follows through.
- **Scroll chords** `Ctrl-f`, `Ctrl-b`, `Ctrl-e`, `Ctrl-y` — all four are bound
  by VS Code defaults (Find, sidebar, quick open, redo).
- **Bracket marks** `` '[ '] `[ `] `` — genuinely useful (`` `[v`] `` reselects a
  put) but not a lesson's worth.

Meanwhile the high-value half — marks, jump list, change list, `gi`, `gv` — is
buried in the same chapter.

## Goal

Separate two different skills that currently share a chapter, and stop spending
full five-phase cycles on host-blocked material.

## Scope

### 1. Split along the natural seam

Two coherent units instead of one:

- **Viewport control** — `H M L`, `zt zz zb`, `Ctrl-d`/`Ctrl-u`. Roughly 3
  lessons.
- **Position memory** — marks, jump list (`Ctrl-o`/`Ctrl-i`), change list
  (`g;`/`g,`), `gi`, `gv`, bracket marks. Roughly 4 lessons.

Position memory is substantially more valuable than viewport control and should
be recommended earlier. If the split proves disruptive to `unit-index.json`
numbering, an acceptable fallback is one trimmed unit of ~7 lessons with the two
groups as clearly separated lesson clusters — but prefer the split.

### 2. Demote section and method motions

Move `navigate-code-structure` to reference. Keep at most `[{` / `]}` as one or
two activities inside the marks lesson, since brace-pair jumping is the one
member of the family that behaves predictably.

### 3. Compress the scroll chords

`travel-by-pages` and `scroll-under-cursor` become one lesson. Keep `Ctrl-d` and
`Ctrl-u`, `zz`/`zt`/`zb`, and `H M L` as core. `Ctrl-f`, `Ctrl-b`, `Ctrl-e`,
`Ctrl-y` drop to reference with a host note.

### 4. Fold bracket marks

`revisit-operated-ranges` folds into `set-and-use-marks` as one or two
activities. Keep `` `[v`] `` — reselecting what you just put is the useful case.

### 5. Preserve viewport-dependent correctness

Unit 9 is the one place where exercise correctness depends on the visible-row
count. Every `H`/`M`/`L`/`zt`/`zz`/`zb` exercise must carry the viewport-dependence
marker introduced in session 02, so a future desktop-enlargement change cannot
silently break them.

### 6. Reduce the challenge surplus

Unit 9 has 18 challenge exercises against 11 isolate and 11 mix — the only unit
weighted this way. Several are near-duplicates. Bring it into line with the rest
of the curriculum.

## Out of scope

- Removing marks, jump list, or change list material — these are core and
  underrated; keep them intact.
- Desktop editor enlargement.

## Acceptance criteria

- Unit 9 is either split into two units of ~3 and ~4 lessons, or trimmed to ~7.
- Section and method motions are reference-only except `[{` / `]}`.
- Scroll chords occupy one lesson; the four host-bound chords carry a portability
  note.
- Every viewport-dependent exercise is marked as such.
- `unit-index.json` reflects new numbering, titles, and lesson counts.
- Downstream `prerequisiteSkillIds` referencing `long-range-navigation` are
  updated. Several units in Arc 2 and 3 name it — check all of them.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "navigation|viewport|mark" # one worker
```

Because this renumbers units, run the full content-integrity check and confirm
no unit references a stale id. Inspect the full viewport matrix: viewport
exercises are the most size-sensitive content in the product.

# Session 01 — Engine conformance spike

**Depends on:** nothing · **Blocks:** 03, 05, 11, 12, 13
**Touches:** `patches/`, `supported-commands.json`, `docs/vim-conformance.md`, conformance fixtures
**Size:** M · **Authoring:** none — this session writes no lesson content

## Context

The curriculum review proposes seven command families that are absent from the
content. Before any of them is authored into a lesson, the project rule from
`AGENTS.md` applies: *a command is supported only after it passes both the
native-Vim fixture and the browser conformance test.* This session establishes
which of the seven the patched `@replit/codemirror-vim` already handles, which
need a patch, and which should be dropped.

Doing this as one spike avoids three later sessions each discovering an engine
problem mid-authoring.

## Goal

A decision, backed by fixtures, for every candidate command. Sessions 03, 05,
11, 12, and 13 should be able to start authoring without further investigation.

## Scope

Write a native-Vim fixture and a browser conformance test for each candidate.
Record the result. Where the engine diverges, add the smallest patch to
`patches/@replit+codemirror-vim+6.3.0.patch` following the existing conventions
in `patches/README.md`.

### Candidates, in priority order

| Candidate | Used by session | Prior signal |
| --- | --- | --- |
| `:g/pat/t$`, `:g/pat/m0`, `:g/pat/m$` | 03 | `:g`, `:t`, `:m` are each already verified — this is composition only. Expect a pass. |
| `:sort n`, `:sort u`, `:sort /pat/` | 05 | `:sort` / `:sort!` verified; flags unverified. |
| Read-only registers `".` `":` `"/` `"%` | 08, 11 | Engine `validRegisters` already lists `-  "  .  :  _  /  +`. Expect a pass for `.`, `:`, `/`; `%` may be absent. |
| Insert-mode `Ctrl-r{register}` | 11 | Not present in content. Core need — patch if required. |
| Insert-mode `Ctrl-o`, `Ctrl-w`, `Ctrl-u` | 11 | Not present in content. |
| Search as an operator range: `d/pat⏎`, `y/pat⏎`, `c?pat⏎` | 12 | Search motions verified standalone; operator-pending pairing unverified. |
| Search offsets `/pat/e`, `/pat/+1` | 12 | Unverified. Lower priority than the base pairing — may be deferred. |
| Visual Block `$` (ragged right edge) | 13 | Block `I`/`A` already patched; same code path. |
| `g Ctrl-a` over a Visual selection | 13 | `Ctrl-a`/`Ctrl-x` verified for a single number. `g Ctrl-a` likely absent. |

### For each candidate, produce

1. A native-Vim fixture capturing real Vim's buffer, cursor, and mode result.
2. A browser conformance test asserting the same.
3. One of three verdicts:
   - **passes** — move to `supported-commands.json` `verified`.
   - **patched** — smallest possible patch, documented in `patches/README.md`
     with the session and the fixture it satisfies, then `verified`.
   - **dropped** — record why in `docs/vim-conformance.md` and note it in this
     file so the dependent session removes it from scope.

### Note on `g Ctrl-a`

If this one requires a large or fragile patch, prefer dropping it over forcing
it. It is the lowest-value item on the list. Everything above it in the table
should be pursued harder.

## Out of scope

- Any lesson, exercise, theory, or demo authoring.
- Refactoring existing verified command support.
- Multi-file or `:argdo` support — that is deliberately conceptual, see session 17.

## Acceptance criteria

- Every candidate has a recorded verdict.
- `supported-commands.json` `verified` and `pending` lists reflect reality.
- `patches/README.md` documents any new patch hunk, its motivating unit or
  session, and its fixture.
- This file is updated in place with the verdict table filled in, so dependent
  sessions read scope from here.

## Validation

```bash
node --check app.js && node --check exercise-data.js && git diff --check
npm test
```

`npm test` covers native-Vim conformance and the content checks. Follow the
browser-process hygiene rules in `AGENTS.md`: one browser command at a time, and
confirm no orphaned Playwright or Vite process remains afterwards.

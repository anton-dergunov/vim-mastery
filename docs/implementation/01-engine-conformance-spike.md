# Session 01 — Engine conformance spike

**Status:** complete · **Depends on:** nothing · **Blocks:** 03, 05, 08, 11, 12, 13
**Touches:** `vim-engine.js`, `patches/`, `supported-commands.json`,
`docs/vim-conformance.md`, conformance fixtures
**Size:** L (planned M; see "What the brief got wrong") · **Authoring:** none —
this session wrote no lesson content

## Context

The curriculum review proposes seven command families that are absent from the
content. Before any of them is authored into a lesson, the project rule from
`AGENTS.md` applies: *a command is supported only after it passes both the
native-Vim fixture and the browser conformance test.* This session established
which of them the patched `@replit/codemirror-vim` already handles, which needed
work, and which should be dropped.

## What the brief got wrong

The original brief framed every candidate as either an adapter pass or an
adapter patch. That is not where the Ex commands live. `executeEx` in
`vim-engine.js` tries the app's own `:global`, `:normal`, and line-operation
parsers *before* falling through to `Vim.handleEx`, and the adapter has no
`:copy`/`:t`, `:move`/`:m`, or `:put` at all. `executeGlobalOperation`
recognized only nested `delete`, `normal`, and `substitute` and silently
discarded everything else, so `:g/pat/t$` was inert rather than "composition
only". That candidate was app-engine work, and `vim-engine.js` was missing from
the brief's `Touches` list.

## Verdicts

Every candidate has a fixture in `conformanceFixtures` in
`tests/vim-fixtures.mjs`, asserted against real Vim by
`tests/native-vim.test.mjs` and against the browser engine by
`tests/editor-conformance.spec.js`.

| Candidate | Session | Verdict |
| --- | --- | --- |
| `:g/pat/t$`, `:g/pat/m0`, `:g/pat/m$` | 03 | **engine work** — `executeGlobalOperation` now dispatches nested `copy`/`move` with Vim's mark-then-execute ordering. Any `{addr}` works, not just these three. One transaction, so one `u` undoes the run. |
| `:g/pat/p`, `:g/pat/nu` | 03 | **dropped** — no Ex output surface, and no adapter `:print`/`:number` to delegate to. See "Scope changes" below. |
| `:sort n`, `:sort u` | 05 | **passes** |
| `:sort /pat/` | 05 | **patched** — the adapter sorted on the matched text; Vim sorts on the text that follows it. |
| Read-only registers `".` `":` `"/` | 08, 11 | **passes** |
| `"%` | 08 | **dropped** — not a valid adapter register, and there is no file name to report. |
| Insert-mode `Ctrl-r{register}`, `Ctrl-o`, `Ctrl-w` | 11 | **passes** |
| Insert-mode `Ctrl-u` | 11 | **patched** — the adapter deleted to the start of the line instead of the start of the insert. |
| Command-line `Ctrl-r{register}` | 08, 11 | **engine work** — added to `vim-engine.js`, which owns the command-line text. |
| `d/pat⏎`, `y/pat⏎`, `c?pat⏎` | 12 | **passes**, with Vim's exclusive match boundary |
| Search offsets `/pat/e`, `/pat/+1` | 12 | **dropped** — see "Scope changes". |
| Visual Block `$` (ragged right edge) | 13 | **passes** for `A` and `I`; **patched** for `d`, which left the cursor one column past the end of a shortened line. |
| `g Ctrl-a` over a Visual selection | 13 | **patched** — and so is plain `Ctrl-a`, which was *also* missing over a selection. |

Five of these needed a versioned adapter patch; `patches/README.md` records each
hunk and the fixture that motivates it. Full reasoning, including the three
drops, is in `docs/vim-conformance.md`.

## Scope changes for dependent sessions

- **Session 03** — `:g/pat/t{addr}` and `:g/pat/m{addr}` are ready, including
  the `m0` order reversal the lesson is built around. **Its dry-run material
  needs a different mechanism:** `:g/pat/p` and `:g/pat/nu` are dropped, so the
  acceptance criterion "dry-run and undo-grouping material is present" cannot be
  met with `:g/pat/p`. Undo grouping is genuinely available — a whole `:g` run
  is one transaction and one `u` undoes it — so the undo half stands. For the
  preview half, use Unit 12's `:s///gn` counting habit as the model, or teach the
  predicate with a `:g` that only reorders rather than deletes.
- **Session 05** — all three `:sort` flags are available, including `/pat/`,
  which the brief expected might be dropped. No scope reduction.
- **Session 08** — drop `"%` from the read-only registers lesson. `".`, `":`,
  and `"/` are verified, and Ex-line `Ctrl-r` *is* supported, so the
  `:%s/‹Ctrl-r›//new/g` payoff the session wants can be taught directly. The
  fallback to `:registers` inspection is not needed.
- **Session 11** — all four Insert-mode keys are available. No scope reduction.
- **Session 12** — ship the base operator+search pairing without offsets. The
  lesson can still teach exclusivity, which is verified; it just cannot present
  `/pat/e` as the fix for it. Say that offsets exist in real Vim and are not
  practiced here, rather than implying they do not exist.
- **Session 13** — both halves are available, and the planned contrast between
  plain `Ctrl-a` and `g Ctrl-a` over a selection works. The brief expected
  `g Ctrl-a` to be the likely drop; it was not.

## Out of scope

- Any lesson, exercise, theory, or demo authoring.
- Refactoring existing verified command support.
- Multi-file or `:argdo` support — deliberately conceptual, see session 17.
- Giving `:global` an output surface, which is a product change.

## Validation

```bash
node --check app.js && node --check exercise-data.js && node --check vim-engine.js && git diff --check
npm test
npx playwright test tests/editor-conformance.spec.js --workers=1 --grep-invert "@exhaustive"
```

All node tiers pass (525 content, 7 effects, 55 native, 3 media) along with the
browser smoke suite, and all 83 non-exhaustive browser conformance tests pass,
which replays every canonical solution in all 14 published units. No regression
came from the five patch hunks, including the `insertStart` association change
that Unit 9's `'[` mark depends on and the blockwise-delete clamp that Unit 7
exercises.

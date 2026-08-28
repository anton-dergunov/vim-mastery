# Session 21 — Search offsets

**Depends on:** 01 · **Blocks:** a follow-up beat in Unit 5
**Touches:** `vim-engine.js`, `patches/`, `tests/vim-fixtures.mjs`,
`tests/native-vim.test.mjs`, `tests/editor-conformance.spec.js`,
`supported-commands.json`, `docs/vim-conformance.md`
**Size:** M

## Context

Session 01 dropped search offsets, and `docs/vim-conformance.md` records why:

> The adapter reads everything after an unescaped `/` as search flags and
> understands only `i`, so an offset is discarded and the search silently
> succeeds at the wrong position.

That is the right call for a session that could not fix it — shipping `/pat/e`
while the engine ignores the `e` would teach a learner a command that does
nothing, which is worse than not teaching it. But it left a real gap, and unlike
the `"%` drop it was never given a route back. Session 12 ships
`d/pattern⏎` without offsets and says offsets exist in real Vim but are not
practiced here.

The gap matters more than its size suggests. Session 12 teaches that an operator
plus search is **exclusive** — the match itself is not included — and offsets are
the reason that surprise is survivable in practice. `d/pat/e⏎` is how you delete
*through* the match. Teaching the exclusivity without the fix leaves the learner
with a sharp edge and no tool.

## Goal

Make `/pat/e`, `/pat/+1`, and `/pat/-1` behave as they do in Vim, so Unit 5 can
close the loop it currently opens.

## Scope

1. **Parse the offset.** The adapter's query parsing splits on an unescaped
   delimiter and treats the tail as flags. It needs to separate a *flag* run
   (`i`, `I`) from an *offset* (`e`, `s`/`b`, an optional signed count, or a bare
   signed count for line offsets). Vim's grammar is small and worth following
   exactly rather than approximating.
2. **Apply it to the search motion.** `e` lands on the match end, `s`/`b` on its
   start, `+n`/`-n` move by lines and make the motion linewise — that last part is
   the one an approximation gets wrong.
3. **Apply it to operator-pending inclusivity.** `d/pat/e` is *inclusive*, which
   is the whole point. Changing the motion without changing inclusivity produces
   an off-by-one that fixtures will catch and a learner would not.
4. **`n` and `N` keep the offset.** Vim remembers the offset with the pattern, so
   repeating the search repeats the offset.
5. **Fixtures both ways.** Native fixtures in `tests/vim-fixtures.mjs` for the
   motion alone and for `d`/`y`/`c` with each offset form, plus browser
   conformance cases. Follow the five patch hunks from session 01 as the model,
   and record each hunk in `patches/README.md` with the fixture that motivates it.
6. **Move search offsets from `dropped` to `verified`** in
   `supported-commands.json` and rewrite the paragraph in
   `docs/vim-conformance.md`.

## Out of scope

- Content authoring. Once verified, Unit 5's `search-as-a-range` lesson can carry
  an offset beat; that belongs in its own pass.
- Search offsets on Ex addresses (`:/pat/+1d`), which is a different parser.

## Acceptance criteria

- `/pat/e`, `/pat/+1`, `/pat/-1`, and `d/pat/e⏎` match native Vim for the
  fixtures, including operator-pending inclusivity and linewise promotion.
- `n` after an offset search repeats the offset.
- A malformed offset fails visibly rather than being silently discarded.
- `supported-commands.json` lists search offsets under `verified`.
- No existing activity changes behavior.

## Validation

```bash
node --check vim-engine.js && git diff --check
npm test
npm run test:targeted -- tests/editor-conformance.spec.js --workers=1 --grep "search|offset"
```

Replay every existing Unit 5, 11, and 12 canonical that contains a search: this
touches shared query parsing, so the regression risk is in commands that do not
use offsets at all.

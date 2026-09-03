# Session 12 — Search as an operator range

**Status:** complete · **Depends on:** 01 (conformance verdict), 10 (Unit 5 demotions) · **Blocks:** nothing

> **Session 01 verdict.** The base pairing is verified, exclusivity included.
> **Section 2's search offsets are deferred, not abandoned** — the engine
> discards them today and the search silently lands in the wrong place, so they
> cannot ship as-is. [Session 21](21-search-offsets.md) fixes the engine. Until
> it lands, ship the base pairing and say offsets exist in real Vim but are not
> practiced *yet*; do not imply they do not exist. See
> [01](01-engine-conformance-spike.md).
**Touches:** `content/units/05-precision-motions-search.json`, possibly `patches/`
**Size:** M

## Context

Unit 5 teaches search as *navigation* (`/`, `?`, `n`, `N`) and `gn` as a *match
object*. It never teaches `d/pattern⏎`.

That omission leaves a real gap in the curriculum's logic. The composition
`operator + search` is the insight that folds search into the operator grammar —
the same grammar Unit 4 established with `d` + motion. It is also the direct
conceptual precursor to Ex search addresses in Unit 12
(`:/obsolete/delete`) and line predicates in Unit 15 (`:g/pattern/...`).

As it stands, **Unit 12 asks the learner to use a search as a range without ever
having used a search as a range.** The bridge is missing.

## Scope

### 1. New lesson: search as a range

Placed after `search-explicit-patterns` and before `operate-on-search-matches`,
so the progression reads: search moves → search delimits → `gn` captures.

- `d/pattern⏎` — delete from the cursor up to the next match.
- `y/pattern⏎`, `c/pattern⏎` — the same shape with other operators.
- `c?pattern⏎` — backward, and why the range flips.

Teach the exclusivity explicitly: the match itself is *not* included, which
surprises people and is the reason offsets exist.

### 2. Search offsets

- `/pattern/e` — land on the match end, making the range inclusive.
- `/pattern/+1`, `/pattern/-1` — line offsets.

Gate on [session 21](21-search-offsets.md). Until it lands, ship the base
pairing without offsets — it carries most of the value — and leave the lesson
shaped so an offset beat slots in afterwards without a restructure. This matters
because the exclusivity the lesson teaches is exactly what offsets exist to fix:
teaching the sharp edge without the tool is the weaker half of the lesson.

### 3. Make the bridge explicit

The lesson's closing theory should state the connection forward: *the same
pattern that delimits a range here will address lines in Unit 12 and select
lines in Unit 15.* One sentence, but it is the sentence that makes Arc 3 feel
inevitable rather than new.

### 4. Sequencing note

Session 10 marks Unit 5's sentence motions optional and de-duplicates
`trim-debug-suffix` / `cut-vine`. Run that first so this session slots into a
settled unit.

## Out of scope

- `gn` / `gN` — already correct in Unit 5.
- `:g` predicates — Unit 14, session 03.
- Very-magic `\v` and pattern syntax — Unit 12's job.

## Acceptance criteria

- Unit 5 teaches `d/pattern⏎` and at least two other operator-search pairings.
- The exclusive-versus-inclusive distinction is taught explicitly.
- Offsets are taught, or deferred to session 21 with the reason recorded and the lesson left ready for them.
- The forward connection to Ex addresses and `:global` is stated.
- `supported-commands.json` updated.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "search|precision" # one worker
```

Operator-pending plus search is a multi-mode composition: confirm the
operator-pending visual state during pattern entry, that Escape cancels cleanly
at each stage, and that a failed search leaves the buffer untouched.

## Implementation notes

**The lesson.** `search-as-a-range` — *"Let a pattern end the range"* — sits at
`lessons[4]`, after `search-cursor-word` and immediately before
`operate-on-search-matches`. The brief said "after `search-explicit-patterns`",
which both index 3 and 4 satisfy; `*` and `#` are still search-as-*navigation*,
so index 4 is the one that reads as the brief's stated progression — search
moves, search delimits, `gn` captures.

Eight activities, five of them runnable: `search-range-meaning` (theory),
`search-range-demo` (two forward `d/` beats), `trim-to-level-tag` (`d/`,
isolate), `copy-row-prefix` (`y/` then `P`, mix), `widen-field-visibility`
(forward `c/`, mix), `collapse-arguments-backward` (`c?`, challenge),
`predict-search-range-boundary` (a range-prediction choice — typing the keys
would answer the question before it is asked), and `search-range-reach`
(closing theory). Unit 5 goes to 10 lessons, 42 runnable activities, 87 runtime
activities.

**Offsets deferred, seam left open.** Session 21's beat inserts between
`collapse-arguments-backward` and `search-range-reach` as theory + demo +
exercise, and appends its ids to the existing coverage entry. Three things were
written to keep that from becoming a restructure: exclusivity is never stated
as universal (every occurrence says *a plain search range*), the coverage
concept is `"operator plus search range"` rather than command-shaped, and
`search-range-demo` stays on two plain `d/` beats so the offset demo still has
the "same delete, one changes the boundary" contrast to show.
`search-range-reach.contrast` names `/pattern/e` as real and practised later —
that is the sentence session 21 rewrites.

**`c/pat` is now fixture-covered.** The shipped family had no fixture for the
forward change. `change-to-search-match-is-exclusive` passes both tiers, so
`supported-commands.json` and `docs/vim-conformance.md` now claim `c/pat`
alongside `d/pat`, `y/pat`, and `c?pat`.

**The failed-search fixture survived headless Vim.**
`failed-search-range-leaves-buffer-untouched` (`d` `/zeta` `Enter`) raises
`E486`, but the runner's existing tolerance for a non-zero exit is enough — the
script still reaches `writefile`, so the fixture stays in the native tier and
needed no `silent!` or `try`/`catch` in `native-vim-runner.mjs`. Note that the
runner flushes typeahead after an Escape at the search prompt, so keys sequenced
*after* a cancelled search cannot be asserted natively; that behaviour was
verified in the browser instead.

**One engine defect found and fixed.**
`escape-cancels-operator-pending-search` failed the browser tier. This bridge
owns the prompt text, so the adapter never saw Escape close a prompt and never
ran its abort handler; `inputState.operator` stayed armed. The buffer and cursor
were correct, but the mode still read `operator-pending` and **the next key was
silently eaten as the operator's range** — after `d` `/pat` `Escape`, `w`
deleted a word and `x` deleted the whole line. The fix is
`VimEngine.abortCommandLine()`, which replays Escape on the adapter's own prompt
input exactly as the confirming Enter is already replayed; the adapter then
restores the previous query and highlight and clears the input state. No
`patches/` hunk was needed — the vendored adapter was correct and the app was
bypassing it. Recorded in `docs/vim-conformance.md` beside the other
app-side divergence.

**A mid-Insert checkpoint carries no cursor.** `collapse-arguments-backward`'s
`afterStep: 9` checkpoint asserts lines, mode, and a caption but no cursor: the
native runner implicitly leaves Insert mode when its replay ends, so it reports
column 6 while the browser — what the learner actually sees — reports 7. The
two tiers cannot both hold one value, and the cursor is optional, so it was
omitted rather than encoding the runner's artifact. Unit 7's `append-block-demo`
records that artifact (`[0, 2]` where the browser shows `[0, 3]`); it was left
alone as out of scope.

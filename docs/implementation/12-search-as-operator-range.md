# Session 12 — Search as an operator range

**Depends on:** 01 (conformance verdict), 10 (Unit 5 demotions) · **Blocks:** nothing
**Touches:** `content/units/05-precision-motions-search.json`, possibly `patches/`
**Size:** M

## Context

Unit 5 teaches search as *navigation* (`/`, `?`, `n`, `N`) and `gn` as a *match
object*. It never teaches `d/pattern⏎`.

That omission leaves a real gap in the curriculum's logic. The composition
`operator + search` is the insight that folds search into the operator grammar —
the same grammar Unit 4 established with `d` + motion. It is also the direct
conceptual precursor to Ex search addresses in Unit 11
(`:/obsolete/delete`) and line predicates in Unit 14 (`:g/pattern/...`).

As it stands, **Unit 11 asks the learner to use a search as a range without ever
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

Gate on session 01. If offsets failed conformance, ship the base pairing without
them and note the drop — the base pairing carries most of the value.

### 3. Make the bridge explicit

The lesson's closing theory should state the connection forward: *the same
pattern that delimits a range here will address lines in Unit 11 and select
lines in Unit 14.* One sentence, but it is the sentence that makes Arc 3 feel
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
- Offsets are taught or explicitly dropped with a recorded conformance reason.
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

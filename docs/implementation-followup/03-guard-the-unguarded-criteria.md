# Session 03 — Guard the unguarded criteria

**Size:** S. **Depends on:** nothing.

## Why

Two properties that the curriculum review treated as load-bearing hold in the
content today but are not asserted anywhere. An author — human or agent — could
break either one and every test would still pass. Every other acceptance
criterion from the closed plan is test-guarded; these two are the exceptions the
audit found.

This is a tests-only session. If either assertion fails when first written,
**fix the test's expectation to match reality and say so** — do not edit content
to satisfy a newly invented rule. The point is to freeze what is already true.

## Scope

`tests/content-data.test.mjs` only.

### 1. `:global` predicates must do work a range cannot

The review's central finding about Unit 15 was that a `:g`/`:v` exercise only
teaches anything if the matching lines are **scattered**. If the matches are
contiguous, a plain line range does the same job and the predicate is
decoration. Session 03 authored the unit to that property — every `:g`/`:v`
activity matches 5–9 lines, none of them adjacent — and then never asserted it.

Assert, for every `:g` or `:v` activity in
`content/units/15-global-normal-automation.json`:

- the pattern matches more than one line of `scenario.initial.lines`, and
- the matching line numbers are **not all contiguous**.

There are 27 activities with a `:g`/`:v`-shaped canonical, so derive the pattern
from the canonical keys rather than hand-listing activities — a hand-list rots
the moment an exercise is retargeted. Prefer the weaker, robust form (more than
one match, not contiguous) over pinning the exact 5–9 range: the property that
matters is "position could not have done this," and a hard count would
manufacture exactly the padding constraint 5 forbids.

Put the reasoning in a comment. The comment is the part that survives.

### 2. Arc 3 units keep their tool-choice questions

Session 06 was described in the review as the highest return-on-effort item in
the whole plan: it took each Arc 3 unit from one `choice` activity to five, so
that a learner is asked *which tool* rather than only *how to drive one*.
All four units carry exactly five today.

Assert that each Arc 3 unit — 12 command-line ranges, 13 substitution, 14
macros, 15 global and Normal — carries at least four `choice` activities. Four,
not five, so that a deliberate re-authoring can still move one without a test
failure, while removing the tool-choice layer wholesale cannot pass.

Note that `tests/content-data.test.mjs:2074` already counts choices for Unit 7;
follow that shape.

## The pattern to follow

`tests/content-data.test.mjs:1218-1224` is the model:

```js
// `:sort` and `:sort!` alone leave out the two variants people actually reach
// for and the one that ignores a prefix. Each flag is asserted through the
// canonical it is taught by, so retargeting an exercise cannot quietly drop it.
```

A comment naming what would be lost, then an assertion tied to the thing that
teaches it. Match that register.

## Out of scope

- Any change to `content/`. If content genuinely violates one of these
  properties, report it rather than fixing it here — that is a content session.
- New properties. Two assertions, both already true.
- Backfilling guards for the other minor divergences the audit listed (Unit 8's
  `track` values are browser-tested rather than content-tested; Unit 16 has no
  90-second assertion). Those are recorded in `README.md` and are not worth a
  test each.

## Validation

- `npm test`. Both new assertions must pass on unmodified content — that is the
  whole result.
- Deliberately break each property in a scratch copy of the unit file (make two
  matched lines adjacent; delete four choices) and confirm the test fails with a
  message that names the activity. A guard that does not fail is not a guard.
  Revert the scratch edits.
- `git diff --check`.

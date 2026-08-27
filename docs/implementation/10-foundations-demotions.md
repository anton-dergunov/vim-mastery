# Session 10 — Foundations demotions and de-duplication

**Depends on:** nothing · **Blocks:** 12, 18
**Touches:** `content/units/03`, `04`, `05`, `06`, `content/unit-index.json`
**Size:** M

## Context

Four demotions across Arc 1, plus the remaining duplicate canonicals. Together
these reclaim roughly four lessons from material that is rare in both target
environments, without losing reference coverage.

None of this weakens the foundations. The grammar-first spine is correct and
stays intact.

## Scope

### 1. Unit 3 — Replace mode `R`

Currently a co-equal of `s` and `S` in `substitute-and-replace`. Rare in
practice; `r` and `c` cover nearly all real cases. Reduce to one activity.

Also add **counted insert and open** (`3i-⏎`, `5o⏎`) — a cheap generator for
dividers and scaffolding that reinforces that counts apply to Insert commands,
which is non-obvious and currently never shown.

### 2. Unit 4 — `gq` / `gw` reflow

`reflow-text-ranges` is a core-path lesson for a command family that requires an
authored `textwidth` and is effectively inert under VS Code defaults. Mark the
lesson optional and add a portability note stating the configuration
requirement.

Unit 4 is also **68% non-code** (19 of 28). For the unit that teaches operator
grammar over code structure, rebalance toward code buffers — roughly 40%
non-code.

### 3. Unit 5 — sentence motions

`(` and `)` are near-useless in code and matter only in Markdown and commit
messages. Keep paragraph motions `{` and `}` as core; mark sentence motions
optional. Adjust `move-by-sentences-and-paragraphs` so paragraphs carry the
lesson and sentences are the optional tail.

Also de-duplicate: `trim-debug-suffix` and `cut-vine` share the canonical
`f- dt"`.

### 4. Unit 6 — angle-bracket objects

`angle-bracket-objects` is a full lesson whose mechanics are identical to the
other delimiter pairs, so it teaches nothing new; `i<`/`a<` matter only for
generics and JSX attributes. Fold into `bracket-and-brace-objects` as activities.

De-duplicate two pairs:

- `cit Ready Esc` — `change-inside-tag` (isolate) and `integration-replace-tag`
  (**challenge**). This is an isolate-to-challenge duplicate: the coverage
  contract records escalation that did not happen.
- `ya{` — `around-open-brace` and `integration-yank-object-literal`.

Also: **`ip`/`ap` and `it`/`at` run on ≤4-line buffers.** These are the two
object families whose entire point is spanning structure; at that size the
learner cannot see them do anything a line operator would not. Give them 10–14
line buffers with `scenario.initial.viewport` holding visible rows constant.

### 5. Unit 5 — mark optional, do not delete

Sentence motions, `gq`, `R`, and angle brackets all keep their reference entries
and remain available in Free Practice. "Optional" means off the recommended path
and out of the five-phase cycle, not removed.

## Out of scope

- Search as an operator range — session 12 adds it to Unit 5.
- Unit 5's `cgn` material — correct as is; session 06 handles the Unit 10 side.

## Acceptance criteria

- `R` is one activity; counted insert/open is taught.
- `gq`/`gw` is marked optional with a `textwidth` portability note.
- Unit 4 non-code content is roughly 40%, down from 68%.
- Sentence motions are optional; paragraphs remain core.
- Angle-bracket objects are folded into the bracket lesson.
- No duplicate canonicals remain in Units 5 and 6.
- `ip`/`ap` and `it`/`at` run on 10–14 line buffers with visible rows unchanged.
- `unit-index.json` `lessonCount` updated for every changed unit.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "text-object|operator|precision" # one worker
```

Replay every changed canonical. Confirm optional-marked lessons still render and
remain reachable from Reference and Free Practice.

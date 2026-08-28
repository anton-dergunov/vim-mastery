# Session 10 — Foundations marking and de-duplication

**Depends on:** nothing · **Blocks:** 12, 18
**Touches:** `content/units/03`, `04`, `05`, `06`, `content/unit-index.json`
**Size:** M

## Context

Four markings across Arc 1, plus the remaining duplicate canonicals.

> **Rewritten after session 07.** This brief originally reclaimed roughly four
> lessons by reducing `R` to one activity, folding `angle-bracket-objects` into
> another lesson, and demoting sentence motions and `gq` to reference. Constraint
> 7 in [README.md](README.md) now applies: material judged rare is **marked**
> with `lesson.track`, never merged away or moved to a Reference surface that
> does not exist until session 14. The author has not walked the course yet.
>
> The `gq` justification also needed correcting. It is not *"inert under VS Code
> defaults"* — it needs an authored `textwidth`, which is true in terminal Vim
> too, and the schema already supports `editor.textWidth` for deterministic
> formatting. That is a real portability note; the host name was never the point.

None of this weakens the foundations. The grammar-first spine is correct and
stays intact.

## Scope

### 1. Unit 3 — Replace mode `R`

Currently a co-equal of `s` and `S` in `substitute-and-replace`. Rare in
practice; `r` and `c` cover nearly all real cases. Keep every activity and say so
in the lesson's theory; if `R` is separable into its own lesson, mark that
`advanced`.

Also add **counted insert and open** (`3i-⏎`, `5o⏎`) — a cheap generator for
dividers and scaffolding that reinforces that counts apply to Insert commands,
which is non-obvious and currently never shown.

### 2. Unit 4 — `gq` / `gw` reflow

`reflow-text-ranges` teaches a command family whose behavior depends on an
authored `textwidth`. Mark the lesson `track: "optional"` with a note naming the
configuration requirement — not a host. The lesson stays on the path and keeps
every activity.

Unit 4 is also **68% non-code** (19 of 28). For the unit that teaches operator
grammar over code structure, rebalance toward code buffers — roughly 40%
non-code.

### 3. Unit 5 — sentence motions

`(` and `)` are near-useless in code but matter in Markdown, prose, and commit
messages — all of which the author writes. Keep paragraph motions `{` and `}` as
core and mark the sentence material `track: "optional"`. Adjust
`move-by-sentences-and-paragraphs` so paragraphs carry the lesson and sentences
are the marked tail; do not remove sentence exercises.

Also de-duplicate: `trim-debug-suffix` and `cut-vine` share the canonical
`f- dt"`.

### 4. Unit 6 — angle-bracket objects

`angle-bracket-objects` is a full lesson whose mechanics are identical to the
other delimiter pairs; `i<`/`a<` matter for generics and JSX attributes. Keep the
lesson and mark it `track: "advanced"` — a lesson that is easy because the
learner already knows the shape is cheap to pass, not wasted.

De-duplicate two pairs:

- `cit Ready Esc` — `change-inside-tag` (isolate) and `integration-replace-tag`
  (**challenge**). This is an isolate-to-challenge duplicate: the coverage
  contract records escalation that did not happen.
- `ya{` — `around-open-brace` and `integration-yank-object-literal`.

Also: **`ip`/`ap` and `it`/`at` run on ≤4-line buffers.** These are the two
object families whose entire point is spanning structure; at that size the
learner cannot see them do anything a line operator would not. Give them 10–14
line buffers with `scenario.initial.viewport` holding visible rows constant.

### 5. Mark, do not delete — and keep the five phases

Sentence motions, `gq`, `R`, and angle brackets keep their lessons, their
activities, their reference entries, and their full five-phase cycle. A `track`
marker changes how a lesson is *presented*, not whether it is taught. This is
stricter than the original brief, which took "optional" to mean out of the
five-phase cycle.

## Out of scope

- Search as an operator range — session 12 adds it to Unit 5.
- Unit 5's `cgn` material — correct as is; session 06 handles the Unit 10 side.

## Acceptance criteria

- `R` keeps its activities; counted insert/open is taught.
- `gq`/`gw` is marked `optional` with a `textwidth` note that names no host.
- Unit 4 non-code content is roughly 40%, down from 68%.
- Sentence motions are marked `optional`; paragraphs remain core.
- Angle-bracket objects keep their lesson, marked `advanced`.
- Every marked lesson still carries all five phases.
- No duplicate canonicals remain in Units 5 and 6.
- No activity was removed from any unit.
- `ip`/`ap` and `it`/`at` run on 10–14 line buffers with visible rows unchanged.
- `unit-index.json` `lessonCount` updated for every changed unit.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "text-object|operator|precision" # one worker
```

Replay every changed canonical. Confirm optional-marked lessons still render and
remain reachable from Reference and Free Practice.

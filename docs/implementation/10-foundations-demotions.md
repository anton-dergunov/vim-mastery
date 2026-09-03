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

## Implementation notes

Two acceptance lines above were met in substance rather than literally. Both
deviations are deliberate and were agreed with the author.

### De-duplication is a quality repair, not a quota

"No duplicate canonicals remain in Units 5 and 6" turned out to name six exact
key-sequence collisions, not two. Four were the same real defect — an
**integration lesson replaying a single-family lesson verbatim**, so the coverage
contract recorded an escalation that never happened — and one side of each was
re-authored. Nothing was removed.

| Keys | Re-authored | Now |
| --- | --- | --- |
| `f- dt"` | `cut-vine` (U5 integration, isolate) | `f, ; dt)` — trims a call's trailing argument, integrating the repeat-find family the original never touched |
| `gUiw` | `integration-word-demo` → `integration-object-choice-demo` (U6, demo) | `yi( da(` — the same object read both ways, which is the lesson's stated objective |
| `ya{` | `integration-yank-object-literal` (U6, mix) | `ca{null` — the braces must go, so only the around reading works |
| `cit Ready` | `integration-replace-tag` (U6, challenge) | `/pending⏎ cit Docs ready` — retrieves an element below the window, then operates on it |

Two collisions were left alone on purpose, because repeating a command is what
Vim practice *is* and neither is the defect above:

- Bare `%` in `match-closing-brace` (isolate, three-line block) and
  `match-next-delimiter-on-line` (challenge, inline `if ready { run(); }`). Same
  key, different behaviour: the challenge teaches that `%` scans forward to the
  first delimiter on the line. A false positive of matching on keystrokes.
- `/build⏎ f( %` in `precision-navigation-demo` and `search-then-match-pair`.
  Demonstrate-then-practise inside one lesson is the five-phase cycle working as
  designed, and the buffers differ.

### The engine set the limits, not the brief

Constraint 6 decided three authoring questions that the brief could not.

- **`{count}O` is not taught.** Native Vim leaves the cursor on the last opened
  line; the pinned adapter leaves it on the first. `{count}i`, `{count}a`, and
  `{count}o` all conform and carry the lesson. Recorded under `pending` in
  `supported-commands.json`.
- **Multi-line tag work uses `it`, not `at`.** `dit` and `cit` resolve a
  multi-row element identically in both engines, so `inside-tag-demo` collapses a
  three-item list whose closing tag sits below the window. `at` over an element
  spanning whole lines leaves a residual indentation line in the adapter, so the
  `at` activities use a single-line element.
- **Tag-object yanks keep the cursor at the range start.** The adapter does not
  move the cursor into a yanked tag range, so `yank-around-tag` begins on the
  opening `<`, where both engines agree.

### Unit 4's rebalance

Non-code fell from 68% to **40.5%** of runnable activities (15 of 37) and 39.3%
of exercises (11 of 28), by moving `put-captured-text`,
`repeat-one-complete-change`, and the `log` activities in
`integrate-operator-grammar` onto real code. `character-put-demo` stays on
neutral text: its canonical `yeep` doubles a word in place, and no honest code
buffer wants a word doubled with no separator. The counts and reflow lessons stay
on prose, where isolating counting from syntax and hard-wrapping actually need
it. No ratio is asserted in a test — per constraint 5, the number is an outcome,
not a target to author against.

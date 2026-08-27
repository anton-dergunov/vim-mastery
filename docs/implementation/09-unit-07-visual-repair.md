# Session 09 — Unit 7: visual selection repair

**Depends on:** nothing · **Blocks:** 13, 18
**Touches:** `content/units/07-visual-selection.json`
**Size:** M

## Context

Unit 7 is a structural outlier in three measurable ways.

**1. It has zero challenge-phase exercises.** Activity distribution: 9 theory,
9 demo, 9 `exercise/isolate`, 19 `exercise/mix`, 9 `choice/challenge`,
1 summary. Every other unit uses exactly one choice activity and delivers its
challenge phase as exercises. Unit 7 delivers its entire challenge phase as
multiple choice.

Visual selection is the most tactile skill in the curriculum — selecting a range
and watching it grow is inherently a doing skill — and it is the one unit that
never asks the learner to *perform* a challenge edit. This reads as an authoring
inconsistency rather than a decision.

**2. Five pairs of byte-identical canonical sequences:**

| Sequence | Exercises |
| --- | --- |
| `v e d` | `select-character-range`, `delete-selected-token`, `integrated-character-edit` |
| `V j d` | `select-line-range`, `change-selected-lines` |
| `Ctrl-v 2j rx` | `select-block-range`, `integrated-column-marker` |
| `V j > gv <` | `reselect-line-correction`, `integrated-reselect-correction` |
| `Ctrl-v 2j A! Esc` | `append-block-demo`, `append-csv-markers` |

The `integrated-*` exercises are named as integrations but are keystroke-identical
to an earlier isolate or mix in the same unit.

**3. It is 71% non-code** (20 of 28 exercises are prose, log, csv, or markdown).
For the unit most about operating on *code* structure — argument lists, aligned
declarations, indented blocks — that ratio is inverted.

## Goal

Bring Unit 7 in line with the rest of the curriculum and make its challenges
real.

## Scope

### 1. Restore challenge exercises

Convert the challenge phase to exercises. Keep 1–2 choice activities (matching
every other unit's pattern), and let session 06 add the tool-choice questions
that belong in Arc 3 rather than here.

Each challenge must require the learner to select the selection *shape* as well
as the operation — that is the unit's actual learning outcome
(*"decide when selection is clearer than operator-motion"*).

### 2. De-duplicate

No two exercises share a canonical sequence. Every `integrated-*` exercise must
compose at least two ideas, or be renamed to stop claiming integration it does
not deliver.

### 3. Rebalance toward code

Move from 71% non-code to roughly 40%. Visual Block's best cases are code:
aligned struct fields, a column of imports, repeated assignment operators,
argument lists across rows. CSV and logs remain legitimate for column work —
just not the majority.

### 4. Prepare space for session 13

Session 13 adds Visual Block `$` (ragged right edge) and `g Ctrl-a` to this
unit. Leave `edit-rectangular-columns` and `insert-across-rows` structured so
those additions slot in without another restructure. Do not add them here —
they are gated on session 01's conformance verdict.

## Out of scope

- Visual Block `$` and `g Ctrl-a` themselves — session 13.
- `o` / `O` selection-end control — moderately rare but cheap and correct as is.

## Acceptance criteria

- Unit 7 has challenge-phase exercises, and at most 2 choice activities.
- No duplicate canonical sequences within the unit.
- Every `integrated-*` exercise composes at least two ideas.
- Non-code content is roughly 40%, down from 71%.
- Every challenge requires choosing a selection shape, not just an operation.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "visual" # one worker
```

Per `AGENTS.md`: Visual Block selections must end at the checkpoint cursor and
Visual Line selections on its row. Confirm both on every changed exercise, and
exercise the sticky-modifier path for `Ctrl-v` on touch.

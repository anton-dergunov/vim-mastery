# Implementation plan — curriculum review

Execution plan for [../curriculum-review-automation-focus.md](../curriculum-review-automation-focus.md).
Every finding and recommendation in that review is accepted and scheduled here.

Each numbered file is a **self-contained task brief for one coding session**.
Hand a session file to a coding agent as the task description; it should not
need the review document to act, though the review is linked for rationale.

## Design constraints that shape this plan

These are product invariants. No session may weaken them.

1. **Phone-first.** Portrait 360–430 CSS px is the design target. The on-screen
   physical-style keyboard, the instruction, and the code slab must all fit
   within `100dvh` with no document scrolling.
2. **Bite-sized.** A lesson is 2–5 minutes; an exercise is 15–90 seconds. The
   product exists to use small pockets of time away from a desk.
3. **Visible lines are scarce and stay scarce.** No session increases the number
   of code rows shown at once on a phone.
4. **Buffer length is not visible-line count.** `scenario.initial.viewport`
   (`topLine`/`bottomLine`) already decouples the two. Unit 9 ships 30-line
   buffers on a phone today across 51 activities. The automation units simply
   never adopted this mechanism — that is a content gap, not a platform limit.
5. **Deterministic correctness.** A command is exposed only after it passes both
   the native-Vim fixture and the browser conformance test
   (`docs/vim-conformance.md`). No session ships a command on assumption.

Constraint 4 is the one worth internalizing: **the review's "bigger buffers"
finding is satisfied by scrolling a small window over a longer file, not by
showing more rows.** Sessions 02–05 spell out how.

## Session list

### Track A — Enablement (do first; unblocks the rest)

| # | Session | Size | Depends on | Blocks |
| --- | --- | --- | --- | --- |
| 01 | [Engine conformance spike](01-engine-conformance-spike.md) | M | — | 03, 05, 11, 12, 13 |
| 02 | [Scale mechanics: viewport and impact readout](02-scale-mechanics.md) | M | — | 03, 04, 05 |

### Track B — Automation arc repair (the core of the review)

| # | Session | Size | Depends on | Blocks |
| --- | --- | --- | --- | --- |
| 03 | [Unit 14: scale and the `:global` family](03-unit-14-scale-and-global-family.md) | L | 01, 02 | 16 |
| 04 | [Unit 13: macro rework](04-unit-13-macro-rework.md) | L | 02 | 16 |
| 05 | [Units 11–12: scale and sort flags](05-units-11-12-refinements.md) | M | 01, 02 | 16 |
| 06 | [Tool-choice activities across Arc 3](06-tool-choice-activities.md) | M | — | — |

### Track C — Restructuring and demotions

| # | Session | Size | Depends on | Blocks |
| --- | --- | --- | --- | --- |
| 07 | [Unit 9: split and trim](07-unit-09-split-and-trim.md) | L | — | 18 |
| 08 | [Unit 8: register rebalance](08-unit-08-register-rebalance.md) | M | — | 11, 18 |
| 09 | [Unit 7: visual selection repair](09-unit-07-visual-repair.md) | M | — | 13, 18 |
| 10 | [Foundations demotions and de-duplication](10-foundations-demotions.md) | M | — | 12, 18 |

### Track D — Engine-dependent additions

| # | Session | Size | Depends on | Blocks |
| --- | --- | --- | --- | --- |
| 11 | [Insert-mode command keys](11-insert-mode-commands.md) | L | 01, 08 | — |
| 12 | [Search as an operator range](12-search-as-operator-range.md) | M | 01, 10 | — |
| 13 | [Visual Block `$` and `g Ctrl-a`](13-visual-block-dollar-and-increment.md) | M | 01, 09 | — |

### Track E — New surfaces

| # | Session | Size | Depends on | Blocks |
| --- | --- | --- | --- | --- |
| 14 | [Reference card decks](14-reference-decks.md) | M | — | — |
| 15 | [Free practice mode](15-free-practice-mode.md) | L | — | — |
| 16 | [Unit 15: capstones](16-unit-15-capstones.md) | XL | 03, 04, 05 | 17 |
| 17 | [Unit 16: mastery loops and CLI field notes](17-unit-16-mastery-and-cli.md) | L | 16 | — |
| 18 | [Curriculum graph and portability surfacing](18-curriculum-graph-and-portability.md) | M | 07, 08, 09, 10 | — |

## Recommended execution order

The strict dependency order is encoded above. This is the recommended
*sequence*, which front-loads cheap high-value work:

```
01 ─┬─────────────────────────────────────────────┐
    │                                             │
02 ─┼─→ 03 ─→ 05 ─┐                               │
    │             │                               │
    └─→ 04 ───────┤                               │
                  │                               │
06 (any time) ────┤                               │
                  ├─→ 16 ─→ 17                    │
07 ─┐             │                               │
08 ─┼─→ 18        │                        08 ─→ 11 ←┘
09 ─┤             │                        09 ─→ 13 ←┘
10 ─┘             │                        10 ─→ 12 ←┘
                  │
14, 15 (any time, fully independent)
```

Practical advice: **06, 14, and 15 have no dependencies at all.** If you want a
session that delivers visible value with no prerequisites, start with 06 (the
highest return-on-effort item in the whole review) or 15 (free practice, the
feature you asked for).

## Grouping rationale

Sessions are grouped by **file touched**, not by theme, so that two sessions
never edit the same unit file. The one deliberate exception is Unit 8
(sessions 08 then 11) and Unit 7 (sessions 09 then 13), where a restructure must
land before an addition slots into the space it frees. Those pairs are ordered,
never parallel.

Engine work is always separated from content authoring, because the two have
different validation costs: engine work needs native-Vim fixtures and patch
review, content work needs canonical-solution replay and the viewport matrix.

## Progress

- [ ] 01 Engine conformance spike
- [ ] 02 Scale mechanics
- [ ] 03 Unit 14
- [ ] 04 Unit 13
- [ ] 05 Units 11–12
- [ ] 06 Tool-choice activities
- [ ] 07 Unit 9
- [ ] 08 Unit 8
- [ ] 09 Unit 7
- [ ] 10 Foundations demotions
- [ ] 11 Insert-mode commands
- [ ] 12 Search as operator range
- [ ] 13 Visual Block `$` and `g Ctrl-a`
- [ ] 14 Reference decks
- [ ] 15 Free practice mode
- [ ] 16 Unit 15 capstones
- [ ] 17 Unit 16 mastery loops
- [ ] 18 Curriculum graph and portability

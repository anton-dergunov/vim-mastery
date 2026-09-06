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
3. **Visible lines are scarce and stay scarce.** Seven code rows is the maximum
   a 360×740 phone accepts, and seven is already tight on real hardware: the
   instruction, the board, and the fixed keyboard compete for the same `100dvh`,
   and at seven rows the board and character art are fully displaced. No session
   increases the number of code rows shown at once.
4. **Buffer length is not visible-line count.** `scenario.initial.viewport`
   (`topLine`/`bottomLine`) already decouples the two, which is how Unit 9 ships
   30-line buffers on a phone across 51 activities. Windowing is the tool for
   lessons whose subject is reach beyond the visible rows; it is not a house
   style to be applied unit-wide.
5. **Sizes come from the lesson, never from a target.** Buffer length is an
   outcome of what an exercise edits plus the context that makes the edit
   legible; activity count is an outcome of what a concept needs to stick. No
   session picks a number for a unit and authors its content to fit — matching a
   buffer to its neighbors' length is not a reason to grow it, five activities
   is not a lesson's shape, and a test asserting a minimum size manufactures
   padding rather than preventing thinness.
6. **Deterministic correctness.** A command is exposed only after it passes both
   the native-Vim fixture and the browser conformance test
   (`docs/vim-conformance.md`). No session ships a command on assumption.
7. **Nothing is removed for being rare; it is marked.** A lesson judged advanced,
   niche, or configuration-dependent keeps its full five-phase cycle and carries
   `lesson.track` (`advanced` or `optional`) plus a one-sentence `trackNote`.
   Core is the default and is expressed by the field's absence. The author has
   not yet walked the course end to end, so a reviewer's judgement that material
   is rarely used is a label, not a deletion. Note also that `unit.reference` is
   parsed and validated but **rendered nowhere** until session 14 builds the
   Reference surface: until then, "demote to reference" is not an available
   disposition, it is deletion under another name.
8. **Host-neutral.** The curriculum teaches Vim, not Vim inside one editor. No
   `content/units/*.json` file names a host, and none should. That a particular
   editor claims a chord by default is a portability note attached to a command
   that is still taught — never a reason to stop teaching it. `Ctrl-f`,
   `Ctrl-b`, `Ctrl-e`, and `Ctrl-y` are native, everyday terminal-Vim commands.

Constraints 4 and 5 work together: **the review's "bigger buffers" finding is
satisfied by scrolling a small window over a longer file where the lesson needs
one — not by showing more rows, and not by lengthening buffers whose exercises
never reach past what they already show.** Session 05 revised the blanket
re-scale mandates that briefs 03–05 originally carried; treat any remaining
line-count range in a brief as subject to constraint 5.

## A note on unit numbers

Session 07 split the old Unit 9 into **Unit 9 Position memory** and **Unit 10
Viewport control**, which pushed every later unit up by one:

| Was | Is now |
| --- | --- |
| 9 Long-range navigation | 9 Position memory + 10 Viewport control |
| 10 Repeatable editing | 11 Repeatable editing |
| 11 Command-line ranges | 12 Command-line ranges |
| 12 Substitution | 13 Substitution |
| 13 Macros | 14 Macros |
| 14 Global and Normal | 15 Global and Normal |

**Session briefs 03, 04, 05, and 06 keep the numbers they were written with**,
because they record what was done at the time. Read a unit number in a brief
dated before session 07 against this table.

## Session list

### Track A — Enablement (do first; unblocks the rest)

| # | Session | Size | Depends on | Blocks |
| --- | --- | --- | --- | --- |
| 01 | [Engine conformance spike](01-engine-conformance-spike.md) | L | — | 03, 05, 08, 11, 12, 13 |
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
| 07 | [Unit 9: split, mark, and narrow](07-unit-09-split-and-trim.md) | L | — | 18 |
| 08 | [Unit 8: register rebalance](08-unit-08-register-rebalance.md) | M | 01 | 11, 18 |
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
| 16 | [Unit 16: capstones](16-unit-15-capstones.md) | XL | 03, 04, 05 | 17 |
| 17 | [Mastery loops and CLI field notes](17-unit-16-mastery-and-cli.md) | L | 16 | — |
| 18 | [Curriculum graph and portability surfacing](18-curriculum-graph-and-portability.md) | M | 07, 08, 09, 10 | — |
| 19 | [An Ex output surface for `:global` dry runs](19-ex-output-surface.md) | M | 01, 02 | — |
| 20 | [Viewport control art and story beat](20-viewport-control-art.md) | M | 07 | — |
| 21 | [Search offsets](21-search-offsets.md) | M | 01 | — |
| 22 | [The file-name register `"%`](22-file-name-register.md) | M | 01 | 08, 11 |
| 23 | [Five future unit boards and animation seeds](23-future-unit-boards-and-animation-seeds.md) | L | 07 | — |
| 24 | [Story continuity and unit endings](24-story-continuity-and-unit-endings.md) | L | 07, 16, 23 | — |

Sessions 20, 23, and 24 are complete. Unit 17, story continuity, boards,
animations, packaging, review tooling, and promotion automation are implemented.
The owner-approved Unit 10/16/17 paintings (candidates 4/2/5) are promoted, and
the final regression and PWA validation pass.

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

- [x] 01 Engine conformance spike
- [x] 02 Scale mechanics
- [x] 03 Unit 14
- [x] 04 Unit 13
- [x] 05 Units 11–12
- [x] 06 Tool-choice activities
- [x] 07 Unit 9 split, marked, and narrowed
- [x] 08 Unit 8 register rebalance
- [x] 09 Unit 7 visual selection repair
- [ ] 10 Foundations demotions
- [x] 11 Insert-mode commands
- [ ] 12 Search as operator range
- [x] 13 Visual Block `$` and `g Ctrl-a`
- [ ] 14 Reference decks
- [ ] 15 Free practice mode
- [x] 16 Unit 16 capstones
- [ ] 17 Unit 16 mastery loops
- [ ] 18 Curriculum graph and portability
- [x] 19 Ex output surface
- [ ] 20 Viewport control art and story beat
- [ ] 21 Search offsets
- [ ] 22 The file-name register
- [ ] 23 Future unit boards and animation seeds
- [ ] 24 Story continuity and unit endings

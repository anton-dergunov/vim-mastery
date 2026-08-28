# Session 16 — Unit 15: real-code workflow capstones

**Depends on:** 03, 04, 05 (automation content settled) · **Blocks:** 17
**Touches:** new `content/units/15-capstones.json`, `content/unit-index.json`
**Size:** XL — consider splitting into two sessions of four capstones each

## Context

`unit-index.json` stops at Unit 14. Units 15 and 16 are fully specified in
`docs/curriculum-and-progression.md` and have no content.

**This is the largest single win for automation judgment in the plan.** Isolated
unit lessons teach mechanisms one at a time; judgment forms only by repeatedly
choosing between mechanisms on realistic buffers. Nothing in the product
currently does that. The sixth step of the product's own lesson loop — *revisit* —
has no home in the data model at all.

## Goal

Eight capstones that combine existing skills without introducing new command
families.

## Scope

### The eight capstones

Specified in `curriculum-and-progression.md`; restated with emphasis:

1. **Function calls and arguments** — change, delete, copy, reorder arguments
   with motions and delimiter text objects; combine search, registers, and
   repeat across several calls.
2. **Strings and identifiers** — change quoted values, operate on words with
   punctuation, repeat a rename-like local edit; contrast text substitution with
   structural text-object changes.
3. **Formatting and indentation** — indent blocks, reflow comments, join or
   split prepared lines, normalize case or numeric sequences.
4. **Irregular repeated structures** — build macros around anchors rather than
   absolute columns; detect an instance that violates the macro's assumptions
   and stop safely. Session 04 built the irregular-structure material this
   depends on.
5. **Search-driven cleanup** — navigate matches, change them with `gn`, then
   compare against a confirming substitution. Session 06's `cgn` contrast feeds
   this directly.
6. **Register-preserving refactors** — move two distinct snippets while
   protecting the original yank from intervening deletions.
7. **Predicate-based batch editing** — combine ranges, `:global`, `:normal`,
   substitutions, or a macro to edit only qualifying lines. Session 03's
   re-scaled buffers make this one work.
8. **Review and surgical correction** — navigate a larger generated sample, mark
   important sites, inspect changes, make several small corrections without
   losing context.

### Design rules

- **No new commands.** A capstone that introduces a command has failed.
- **Several meaningful stages** per capstone, each with an explicit target.
- **Buffers of 20–40 lines** with `scenario.initial.viewport` holding visible
  rows at the phone-safe count. This is where the viewport mechanism earns its
  keep — capstones need scale and the phone cannot show it.
- **Each capstone opens with a mechanism choice.** Before any keys, ask which
  tool fits. This is the review's central recommendation and capstones are its
  natural home.
- **Explain why the teaching solution was chosen.** Compare alternatives by
  clarity, setup cost, repeatability, and risk — *not* keystroke count alone.
  The curriculum doc is explicit that keystroke count is feedback, not a
  definition of quality.
- **Respect the bite-sized promise.** A capstone is several short stages, not
  one long sitting. A learner with five minutes must be able to complete a stage
  and stop cleanly.

### Splitting this session

Capstones 1–4 and 5–8 are independent. If the session runs long, split there.
Capstones 4, 5, and 7 have the strongest dependencies on earlier sessions, so if
splitting, put those in the second half.

## Out of scope

- New command families.
- Mastery loops, focused drills, mixed review, scheduling — session 17.
- Generated or adaptive content — deferred by the curriculum doc.

## Acceptance criteria

- Eight capstones exist, each with multiple staged targets.
- No capstone introduces a command not already taught in Units 1–14.
- Each opens with a mechanism-choice activity.
- Each closes with a rationale comparing alternatives on clarity, setup cost,
  repeatability, and risk.
- Buffers are as long as each capstone's own staged work needs, with visible
  rows unchanged from lesson mode. A capstone that has to reach across a file
  may well land at 20–40 lines, but that range is a consequence to check
  against, not a target to author to — see constraint 5 in [README.md](README.md).
- Every stage is independently completable in under 90 seconds.
- `unit-index.json` includes Unit 15 and its arc.

## Validation

```bash
npm test
npm run test:targeted -- <capstone spec> --grep "capstone" # one worker
```

Capstones are the most complex content in the product: replay every stage's
canonical solution and confirm exact buffer, cursor, mode, selection, and
register state at every checkpoint. Inspect the full viewport matrix with the
largest capstone buffer.

# Session 17 — Unit 16: mastery loops and CLI field notes

**Depends on:** 16 · **Blocks:** nothing
**Touches:** new `content/units/16-*.json`, `content/unit-index.json`, `app.js`
**Size:** L

## Context

Two things land here.

**Mastery loops.** The curriculum doc specifies focused drills, mixed sessions,
maintenance sessions, advanced variants, tool-choice challenges, and personal
focus lists. None exist. Every concept in the product is introduced and never
scheduled to return — the per-unit `coverage` arrays track five phases but the
sixth, *revisit*, has no representation in the data model.

**The command-line automation gap.** This is the clearest mismatch between the
stated product goal and the built curriculum. The goal names two targets —
automation inside VS Code, and automation from the command line — and only the
first is served. Everything in Arc 3 operates on a single buffer. There is no
`:argdo`, `:bufdo`, quickfix, `:cdo`, `vim -c`, or `ex -sc` anywhere.

The whole reason to reach for Vim at the command line rather than staying in
VS Code is to apply one tested transformation to fifty files. That story is
currently untold.

## Scope

### Part A — Mastery loops

Build the retention layer the curriculum specifies:

- **Focused drills** — any topic directly replayable; allow pinning a command or
  concept.
- **Mixed sessions** — interleave two to five learned families so the learner
  must retrieve *and select*.
- **Advanced variants** — larger buffers, fewer hints, varied cursor placement,
  distractors, longer compositions.
- **Tool-choice challenges** — present a transformation before revealing which
  family is expected. Session 06 built the activity type; this makes it a mode.
- **Personal focus lists** — let the learner declare what to practice regardless
  of the recommended queue.

Implement the five product-facing progress states from the curriculum doc —
unseen, learning, practiced, integrated, maintenance due — as **state, not as a
scheduling algorithm**. The doc is explicit that proficiency formulas, decay
curves, and review intervals are deliberately deferred. Surface "maintenance
due" using a simple, replaceable rule and do not build a knowledge model.

### Part B — Batch and multi-file field notes

Five conceptual lessons:

1. **The argument list and `:argdo`** — `vim *.js`, then
   `:argdo %s/old/new/ge | update`, and why `e` and `update` are not optional.
2. **Buffers and `:bufdo`** — and how it differs from `:argdo`.
3. **Quickfix as a work list** — populate from a search, then `:cdo` / `:cfdo`.
4. **Non-interactive Vim** — `vim -c 'commands' file`, `ex -sc`, `vim -es`; when
   a scripted Vim run beats a shell pipeline.
5. **When to leave Vim** — `sed`, `awk`, `jq`, or a real script. The honest
   counterpart to Unit 14's `choose-automation`.

**Feasibility, stated plainly:** the app's editor is one CodeMirror buffer, so
this material cannot use the normal exercise type. Build it from `theory`,
`demo`, and `choice` activities — predict the outcome, choose the mechanism,
spot the missing `| update`. That is a weaker learning mode than the guided
exercises elsewhere, and **the content should be honest about being a briefing
rather than a drill.**

It is still worth building: the failure mode here is not fumbling keystrokes, it
is not knowing the mechanism exists. A learner who has never heard of `:argdo`
will hand-edit fifty files.

Presenting this as "field notes" inside the mastery layer, rather than as a
numbered unit, avoids ending the recommended path on a unit without real
practice. Prefer that framing.

## Out of scope

- Scheduling algorithms, forgetting curves, knowledge tracing, telemetry,
  next-exercise selection — all explicitly deferred by the curriculum doc.
- Actually executing multi-file commands in the browser.
- Endless generated challenges — later work.

## Acceptance criteria

- Focused drills, mixed sessions, and tool-choice challenges are reachable.
- The five progress states are represented and visible.
- No scoring, decay, or scheduling algorithm is presented as settled.
- Five batch/CLI field notes exist, built from theory, demo, and choice.
- The field notes state their own limitation explicitly.
- Chapter completion and long-term mastery read as visibly different concepts.

## Validation

```bash
node --check app.js && git diff --check
npm test
npm run test:targeted -- <mastery spec> --grep "mastery|drill|review" # one worker
```

Confirm mixed sessions draw only from completed topics, that free practice and
mastery activity never lower progression, and that every completed topic remains
directly replayable.

# Make the taught command the shortest route

**Size:** L. **Depends on:** nothing. The solver in step 2 is the long pole.

Feedback: `58cb0446` (`change-after-colon`, reported from its recall pass).

## Why

`change-after-colon` (unit 5, lesson `find-nearby-characters`, `challenge`
phase, primary skill `till-backward`) asks the learner to turn `status: pending`
into `status: ready`. It teaches:

```
$ T : l c $ ready <Esc>        12 keys
```

That is beaten by `W C ready <Esc>` (8 keys), or `w w C …`. Every command in
those routes is taught before unit 5: `W` and `w` in unit 2, `C` in unit 4. The
learner tried shorter routes first (`f`, `t`, `D`, `A` all appear as refused
keys in the report).

Anton's rule, from the report:

> The commands that we show must be shorter and easier, this is the whole point
> of this app.

An exercise whose taught answer loses to a route the learner already knows
teaches the wrong lesson: that the new command is ceremony. Every exercise
should be checked, with the advanced ones first.

## Two causes, kept separate

- **Content.** The buffer and target don't make the taught skill the natural
  choice. Here, the value sits one `W` from the start of the line, so there is
  no reason to go backward from the end. This is what the brief fixes.
- **Checker.** `processToken()` in `src/lesson/practice.js` refuses any key that
  isn't the next authored one, in every phase, including `challenge`.
  `isTargetSnapshot()` in the same file already compares the full target state
  (text, mode, cursor, registers, viewport), but nothing uses it to accept
  another route. `verification.inputPolicy` and `requiredEvidence` are read
  only by `tests/content-data.test.mjs`, never at runtime. Changing the checker
  is a larger decision and is not part of this brief (see step 5).

## Scope

### 1. Fix `change-after-colon`

Re-author the buffer so that `T` from the line end is the shortest way in. For
example, the target sits after the last of several colons, or it follows a long
key whose word count varies. Or, if no honest buffer makes `T` win, re-scope
what this challenge teaches. Keep the checkpoints (AGENTS.md: cursor-moving
steps need explicit checkpoints). Its `-recall` twin is generated at runtime
from the same entry (`src/app/context.js`), so one fix covers both.

### 2. Build the audit tool before auditing by hand

Hand-auditing 464 exercises won't find what a search finds. Build the offline
shortest-path search described in `docs/ideas/exercise-verification.md`
("Offline solver design" and "Phase 3: solver-assisted authoring"):

- **State:** buffer, cursor, mode, and registers where relevant.
- **Actions:** the commands the course has taught *up to that exercise*, taken
  from the units' skill and coverage data, with costs.
- **Search:** from the exercise's start state to its target; a bounded BFS or
  A\* is enough for short buffers.
- **Execution:** use the same Vim adapter the app runs, so the search can't
  find a route real Vim wouldn't take. The native-Vim conformance rules
  (`docs/vim-conformance.md`) apply to anything the solver treats as taught.
- **Output:** a report under `scripts/`, listing each exercise whose
  canonical is longer than the best route found, the length difference, and
  the route. Keep it out of `npm test` until it is fast and trusted.

The idea doc's "Why raw length is not enough" section applies here. Rank
routes by keys first, then by how many distinct commands they need, so the
report doesn't flag an exercise for a route that is one key shorter but an
arcane chord.

### 3. Triage what it flags

- Start with unit 11 (repeatable editing) onward, and with the 142 `challenge`
  exercises in every unit. There are 464 exercises across 17 units in all.
- Fix each flagged exercise in one of three ways: re-author its buffer, move
  it later (after the competing command stops being shorter), or split it so
  one exercise meets the case the new skill actually wins.
- AGENTS.md puts no cap on how many activities a lesson holds. If the fix is
  more exercises, add them.
- An exercise that is deliberately about a longer but more repeatable route
  (dot, macros, `:normal`) should say so in its instruction. It is not a
  failure of this rule.

### 4. Write the rule down

Add the rule to `docs/lesson-content-design.md`: *the taught route must be the
shortest route available from what the course has taught so far, or the
exercise must say why it is not.* It sharpens
`docs/curriculum-and-progression.md` ("Teach efficient canonical solutions…
Keystroke count is feedback, not the sole definition of quality"), so update
that passage too.

Reconcile it with the unit 16 check in `tests/content-data.test.mjs` that
forbids capstone summaries from arguing by keystroke count (`/keystroke|fewer
keys|shortest/`). The rule governs how exercises are authored; it doesn't
require the copy to brag about key counts.

### 5. Out of scope unless decided: accept any correct route in challenges

The idea doc's hybrid verifier, Layer 1, would let `challenge` accept any
state-reaching route. That would remove the "refused" experience entirely. It
is a product decision with its own brief. Note it here so the audit doesn't
drift into it.

## Done when

- `change-after-colon` teaches a route that nothing taught earlier beats.
- The solver runs over every unit and its report is committed.
- Every flagged exercise has been fixed, or carries a written reason for being
  longer.
- The rule is in `docs/lesson-content-design.md`.
- `npm test` passes, with every changed canonical solution exercised in the
  browser.

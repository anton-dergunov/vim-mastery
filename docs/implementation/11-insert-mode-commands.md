# Session 11 — Insert-mode command keys

**Depends on:** 01 (conformance verdict), 08 (Unit 8 read-only registers), 22 (`"%`) · **Blocks:** nothing

> **Session 01 verdict.** All four keys are verified — `Ctrl-r{register}`,
> `Ctrl-o`, `Ctrl-w`, and `Ctrl-u` (the last needed a patch; the adapter deleted
> to the start of the line instead of the start of the insert). Command-line
> `Ctrl-r{register}` is verified too. Nothing to drop.
**Touches:** `content/units/03-entering-changing-text.json`,
`content/units/08-registers-putting.json`, possibly `patches/`
**Size:** L

## Context

The review's highest-priority missing topic.

**Registers currently stop at the mode boundary.** Every put in Unit 8 happens
from Normal mode. The most common real-world register use — storing a value and
typing it into a new string with `Ctrl-r0` from Insert mode — never appears
anywhere in the curriculum. Grep confirms `Ctrl-r` occurs in the content **only
as redo**, in Unit 3; `Ctrl-o` occurs **only as jumplist**, in Unit 9.

This is the difference between a learner who understands registers and one who
uses them.

The curriculum doc excludes *"Insert-mode completion, abbreviations, digraphs,
or editor-specific text entry systems"*. That exclusion is right and stays —
completion is host-specific and unportable. But `Ctrl-r`, `Ctrl-o`, `Ctrl-w`,
and `Ctrl-u` are none of those things: they are core, portable, and heavily used.

## Scope

Gate all of this on session 01's verdict. If a key failed conformance and could
not be patched cheaply, drop it and note the drop here.

### 1. Unit 3 — a new "commands inside Insert mode" lesson

- `Ctrl-w` — delete the word before the cursor.
- `Ctrl-u` — delete to the start of the inserted text.
- `Ctrl-o` — run one Normal-mode command and return to Insert.

`Ctrl-o` is the conceptual centerpiece: it is the mode bridge that keeps one long
insert from becoming three separate commands. Teach it as *"borrow Normal mode
for exactly one command"*, which connects directly to Unit 1's modal model.

`Ctrl-w` and `Ctrl-u` are corrective and belong beside `x`, `X`, and `u` — they
are what a fluent user does instead of holding Backspace.

### 2. Unit 8 — a new "registers from Insert mode" lesson

Slots into the space session 08 freed.

- `Ctrl-r0` — type the last yank, the highest-value case by a wide margin.
- `Ctrl-r"` — type the unnamed register.
- `Ctrl-ra` — type a named register.

Frame the lesson around the workflow it enables: yank a value, navigate
elsewhere, start a new expression, and drop the value in without leaving Insert
mode and without disturbing the register state. That is a complete, realistic
editing sentence and the unit currently cannot express it.

### 3. Connect to the read-only registers

Session 08 added `".`, `":`, `"/`, and [session 22](22-file-name-register.md)
adds `"%`. With Insert-mode `Ctrl-r` available, close the loop: `Ctrl-r/` on the
Ex line to reuse the pattern you just searched for, `Ctrl-r.` to retype what you
last inserted, and `Ctrl-r%` to drop in the file name.

### 4. Host portability note

In terminal Vim all four keys are native and unclaimed. An editor that *embeds*
Vim may claim some of them for itself — VS Code takes `Ctrl-r`, `Ctrl-w`, and
`Ctrl-u` by default, and other hosts make their own choices — so the learner has
a decision to make in whichever host they use.

State that plainly and generically per unit: name the command, say that some
hosts claim the chord, and stop. Do not name one host as *the* host, and do not
teach configuration — the per-host table belongs on the reference card in session
14. Per constraint 8 in [README.md](README.md), no unit content names a host.

## Out of scope

- Insert-mode completion (`Ctrl-n`, `Ctrl-p`, `Ctrl-x` family), abbreviations,
  digraphs — correctly excluded by the curriculum.
- `Ctrl-a` (insert last inserted text) and `Ctrl-t`/`Ctrl-d` indent shifts —
  lower value; defer unless session 01 found them free.

## Acceptance criteria

- Unit 3 teaches `Ctrl-w`, `Ctrl-u`, `Ctrl-o`, or documents why one was dropped.
- Unit 8 teaches `Ctrl-r0`, `Ctrl-r"`, `Ctrl-ra`.
- At least one exercise composes yank → navigate → insert → `Ctrl-r0` as a single
  workflow.
- Every affected unit carries a host-neutral chord-conflict note that names no editor.
- `supported-commands.json` lists the new families as verified.
- `unit-index.json` `lessonCount` updated.

## Validation

```bash
node --check app.js && git diff --check
npm test
npm run test:targeted -- <unit spec> --grep "insert|register" # one worker
```

These are Ctrl chords on a touch keyboard: per `AGENTS.md`, Ctrl latches for
touch chords and releases after the final key. Exercise the latched path
explicitly, and confirm the on-screen keyboard never opens the native phone
keyboard during an Insert-mode chord.

## Implementation notes

Shipped as two new lessons and nothing else: no patch, no schema change, and no
`supported-commands.json` change. Session 01 had already verified all four keys
and shipped the `Ctrl-u` hunk, and line 41 of `supported-commands.json` already
listed the family as verified, so the only engine-side work left was two extra
fixtures.

### `"%` was deferred, not dropped

Session 22 has not landed, so `"%` is still recorded as dropped in
`supported-commands.json` and `docs/vim-conformance.md`. Per session 08's
instruction, Unit 8 teaches three read-only registers through `Ctrl-r` — `".`,
`":`, and `"/` — and **no content describes `"%` as unsupported**. Section 3 of
this brief is otherwise satisfied: `Ctrl-r/` and `Ctrl-r.` are both taught from
Insert mode. When session 22 lands, `Ctrl-r%` joins the same lesson.

### What each lesson teaches

**Unit 3 — `insert-mode-commands`**, lesson 8, after `undo-and-redo` so the
learner already knows the Normal-mode repairs these replace. Seven activities:
`Ctrl-w` and `Ctrl-o` demos, `Ctrl-w` and `Ctrl-u` isolates, a `Ctrl-u` mix that
throws away a whole argument list, a `Ctrl-o D` mix that truncates a line
mid-insert, and a challenge combining `Ctrl-w` with `Ctrl-o $`.

**Unit 8 — `type-registers-while-inserting`**, lesson 11, between
`reuse-read-only-registers` and the integration lesson. Eight activities:
`Ctrl-r0`, `Ctrl-r"`, `Ctrl-ra`, `Ctrl-r.`, and `Ctrl-r/`. Two of them compose
the full yank → navigate → insert → `Ctrl-r0` sentence the acceptance criteria
ask for, and `reach-past-the-newest-delete` puts a `dd` between the yank and the
insert so the unnamed register holds the deleted line while `"0` still holds the
value — the register choice is the exercise.

### Mid-insert checkpoints cannot assert a mode

`tests/native-vim-runner.mjs` drives Vim with `feedkeys(..., "xt")`, which ends
any open insert before reporting state. A checkpoint that stops mid-insert
therefore comes back as `mode: "normal"` with the cursor shifted one column
left, and Unit 3's replay loop asserts `checkpoint.mode` whenever it is
authored. **Mid-insert checkpoints in these lessons carry `lines` and `cursor`
but omit `mode`**, which is what the oracle can actually testify to. The cost is
that `app.js:1590` cannot slow demo playback at those steps; the alternative was
authoring a mode the test would reject.

### Host-neutrality

No new field was invented — the schema is `additionalProperties: false`
throughout. The chord-conflict note lives in each unit's
`curriculumDefinition.priorityAndPortability`, in every new activity's
`portability`, in both new reference entries, and once in each theory body so a
learner actually reads it. It names no editor, matching the phrasing Units 9 and
10 already use. This brief names VS Code as rationale at line 72; that name does
not appear in any content file.

### Verification

- `npm test` — 588 content, 7 effects, 67 native, 3 media, plus the browser smoke
  suite. The content tier replays all 15 new runnables against real Vim,
  asserting text, cursor, mode, and (Unit 8) full register state at the target
  and at every checkpoint.
- Two new `conformanceFixtures` entries, `insert-register-last-inserted` and
  `insert-register-search-pattern`, cover the read-only registers from Insert
  mode; both tiers agree.
- Two new browser tests exercise the latched touch path and the physical path:
  `enters Unit 3 Insert-mode command chords from touch and physical keyboards`
  and `types a register into an open insert from touch and physical keyboards`.
  Both confirm Ctrl releases after the final key, and the first asserts
  `inputmode="none"` so no native keyboard opens over an insert.
- 135 activity/viewport combinations (every new activity and its recall variant
  across 360×740, 390×844, 412×915, 430×932, and 432×960) showed no document
  scrolling and no horizontal overflow.

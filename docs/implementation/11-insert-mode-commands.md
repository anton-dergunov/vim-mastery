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

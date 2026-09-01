# Session 08 — Unit 8: register rebalance

**Depends on:** 01 (read-only register verdict) · **Blocks:** 11, 18
**Touches:** `content/units/08-registers-putting.json`, `content/unit-index.json`
**Size:** M

> **Session 01 verdict.** `".`, `":`, and `"/` are verified. Ex-line
> `Ctrl-r{register}` *is* supported, so teach the `:%s/‹Ctrl-r›//new/g` payoff
> directly; the `:registers`-only fallback is not needed. See
> [01](01-engine-conformance-spike.md).
>
> **`"%` is deferred, not dropped.** Session 01 dropped it because the buffer had
> no name; [session 22](22-file-name-register.md) gives each activity an authored
> `fileName` so it reports something true. Teach four read-only registers if 22
> has landed, three if it has not — and do not describe `"%` as unsupported.
>
> **Nothing here is removed.** Constraint 7 in [README.md](README.md) applies:
> the demotions below are now `lesson.track` markers, not merges or deletions.
> The author has not yet walked the course, and `unit.reference` renders nowhere
> until session 14.

## Context

Unit 8 spends two full lessons on recovery paths people rarely take, and a
lesson-share on `gp`/`gP`, while the single most common real-world register use
is absent entirely.

Mark as `advanced` — keep every lesson and every activity:

- **Numbered registers `"1`–`"9`** (`recover-numbered-deletes`) and
  **small-delete `"-`** (`control-small-and-discarded-deletes`) — in practice
  people reach for `u`, not `"2p`.
- **`gp` / `gP`** — rare. The `p` versus `P` distinction is the part that
  matters.

Keep `"_` black-hole as core: it is the one register in that group that changes
daily behavior.

This session runs **before session 11** so that the space it frees is available
when Insert-mode `Ctrl-r` arrives.

## Scope

### 1. Mark the recovery lessons

`recover-numbered-deletes` and `control-small-and-discarded-deletes` both stay,
both keep their five phases, and both take `track: "advanced"` with a note saying
that `u` is what people actually reach for. `"_` stays core — it is the one
register in the group that changes daily behavior.

Note that `numbered-three` (canonical `dd dd dd "3P`) is a *good* exercise — it
demonstrates exactly what numbered registers are for. Keep it.

### 2. Mark `gp` / `gP`

Keep the activities; mark their lesson-share `advanced` if it is separable, and
otherwise say so in the lesson's own theory. Do not reduce it to one activity.

### 3. Add read-only registers

A new lesson: `".` (last inserted text), `":` (last Ex command), `"/` (last
search pattern), and `"%` once [session 22](22-file-name-register.md) lands.

This adds a lesson rather than reusing space freed by a merge, because nothing is
being merged. Unit 8 gets longer, which is the correct outcome: the material is
good and the unit was not too long, it was unevenly weighted.

The payoff is a safety habit worth teaching directly:
`:%s/‹Ctrl-r›//new/g` — reuse the pattern you just confirmed visually with `/`,
instead of retyping it. Retyping is where substitutions actually go wrong.

This lesson also completes `@:` from Unit 11 by explaining what `":` holds — a
connection the curriculum currently never makes. (This brief was written before
session 07 renumbered the later units; see the table in [README.md](README.md).)

Note: `Ctrl-r` *inside Insert mode* is session 11. This session covers the
read-only registers themselves and their use on the Ex command line. If session
01 found Ex-line `Ctrl-r` unsupported, teach the registers via `:registers`
inspection and put-based access, and defer the `Ctrl-r` insertion to session 11.

### 4. Keep the strong parts untouched

`understand-unnamed-register`, `preserve-yank-zero`, `store-named-snippets`, and
`append-named-snippets` are well-built. `append-three-lines`
(`"ayy j "Ayy j "Ayy j "ap`) is a correct and clear demonstration of uppercase
append. Leave these alone.

## Out of scope

- Insert-mode `Ctrl-r{register}` — session 11.
- The emulated `"+` clipboard decision — the current approach (never touching
  the device clipboard) is right; leave it.

## Acceptance criteria

- Both recovery lessons survive, marked `advanced` with notes.
- `"_` carries more weight than `"1`–`"9` and `"-` combined.
- `gp`/`gP` keeps its activities and is marked rather than cut.
- A read-only registers lesson exists and links `":` to `@:`.
- No activity was removed from the unit.
- `unit-index.json` `lessonCount` updated.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "register" # one worker
```

Register exercises need explicit register-state assertions, not just buffer
comparison — confirm `scenario.target.registers` expectations on every changed
exercise.

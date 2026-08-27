# Session 08 — Unit 8: register rebalance

**Depends on:** 01 (read-only register verdict) · **Blocks:** 11, 18
**Touches:** `content/units/08-registers-putting.json`, `content/unit-index.json`
**Size:** M

> **Session 01 verdict.** `".`, `":`, and `"/` are verified. **`"%` is
> dropped** — it is not a valid engine register and there is no file name to
> report — so section 3 teaches three registers, not four. Ex-line
> `Ctrl-r{register}` *is* supported, so teach the `:%s/‹Ctrl-r›//new/g` payoff
> directly; the `:registers`-only fallback is not needed. See
> [01](01-engine-conformance-spike.md).

## Context

Unit 8 spends two full lessons on recovery paths people rarely take, and a
lesson-share on `gp`/`gP`, while the single most common real-world register use
is absent entirely.

Demote:

- **Numbered registers `"1`–`"9`** (`recover-numbered-deletes`) and
  **small-delete `"-`** (`control-small-and-discarded-deletes`) — in practice
  people reach for `u`, not `"2p`. Two lessons for this is too much.
- **`gp` / `gP`** — rare. The `p` versus `P` distinction is the part that
  matters.

Keep `"_` black-hole as core: it is the one register in that group that changes
daily behavior.

This session runs **before session 11** so that the space it frees is available
when Insert-mode `Ctrl-r` arrives.

## Scope

### 1. Merge the recovery lessons

`recover-numbered-deletes` and `control-small-and-discarded-deletes` become one
"recovery registers" lesson covering `"1`–`"9`, `"-`, and `"_`, with `"_`
carrying the emphasis and the most exercises.

Note that `numbered-three` (canonical `dd dd dd "3P`) is a *good* exercise — it
demonstrates exactly what numbered registers are for. Keep it.

### 2. Reduce `gp` / `gP`

From a lesson-share to a single activity inside `choose-put-landing`.

### 3. Add read-only registers

New lesson using the freed space: `".` (last inserted text), `":` (last Ex
command), `"/` (last search pattern), and `"%` if session 01 verified it.

The payoff is a safety habit worth teaching directly:
`:%s/‹Ctrl-r›//new/g` — reuse the pattern you just confirmed visually with `/`,
instead of retyping it. Retyping is where substitutions actually go wrong.

This lesson also completes `@:` from Unit 10 by explaining what `":` holds — a
connection the curriculum currently never makes.

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

- Recovery registers occupy one lesson, not two.
- `"_` carries more weight than `"1`–`"9` and `"-` combined.
- `gp`/`gP` is one activity, not a lesson-share.
- A read-only registers lesson exists and links `":` to `@:`.
- `unit-index.json` `lessonCount` updated.

## Validation

```bash
npm test
npm run test:targeted -- <unit spec> --grep "register" # one worker
```

Register exercises need explicit register-state assertions, not just buffer
comparison — confirm `scenario.target.registers` expectations on every changed
exercise.

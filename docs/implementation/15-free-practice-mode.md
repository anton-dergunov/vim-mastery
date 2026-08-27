# Session 15 — Free practice mode

**Depends on:** nothing · **Blocks:** nothing
**Touches:** `app.js`, `styles.css`, `index.html`, new sample-buffer content
**Size:** L

## Context

`docs/curriculum-and-progression.md` already specifies Free Practice: always
callable from primary navigation, available before the curriculum begins, a
playground rather than a gated reward, with no canonical solution and no effect
on progression. It has never been built.

The existing **Explore** mode (`practicePolicyValues.explore` in `app.js`) is the
nearest thing, but it is a per-activity override: it starts from the current
exercise's buffer and keeps watching for that exercise's target. That is useful
for experimenting *within* a lesson and is not what this session builds.

The requirement here is a genuine scratchpad: pick a realistic file, edit it with
whatever commands exist, no goal and no judgment.

## Goal

A stripped-down surface for open-ended experimentation on a phone.

## Scope

### 1. The layout — deliberately minimal

Two elements, nothing else:

- An **expanded editor** at the top, taller than the lesson editor because it no
  longer shares space with an instruction, a title, or the game board.
- The **existing physical-style keyboard** below it, unchanged.

Drop the board, the character scene, the title, the instruction, the hint tray,
and the step controls. This is the one surface in the product where the code
slab can take the whole screen, and it should.

Keep only: reset, pick a different file, and leave.

Note that the extra vertical space is exactly what makes this mode useful for
practicing multi-line automation on a phone — `:g` and macros need rows.

### 2. Bundled sample files

Roughly 20 realistic buffers shipped locally — no network, no external loading,
consistent with the offline-capable rule in `AGENTS.md`.

Spread across languages already represented in the curriculum: TypeScript,
JavaScript, Python, Go, Rust, YAML, JSON, TOML, CSS, HTML, SQL, shell, CSV, a
log file, Markdown, prose. Each 20–60 lines — long enough that automation
commands have something to bite on, which is the whole reason to use this mode.

Prefer buffers with the irregular structure sessions 03 and 04 call for:
scattered matches, uneven rows, a mix of cases. A perfectly uniform sample file
is a poor practice target.

Offer a random pick and a browsable list. Random is the default — it removes the
setup step, matching the curriculum doc's rule that setup must not become a
barrier to a spare-minute session.

### 3. The compatibility disclaimer

State plainly, once, on entry: this is the **Vim Wilds supported command set**,
not complete Vim or Neovim. Some commands are unimplemented and some behave
differently from real Vim.

Do not restrict input to the verified command list. Being unable to try something
is worse than trying it and finding it imperfect — the disclaimer covers it. This
is a deliberate departure from the strict conformance gate that governs lesson
content, and it is correct: lessons must not teach wrong behavior, but a
scratchpad only has to be honest about its limits.

### 4. Behavior

- Undo, reset, new buffer, and leave are always available.
- No canonical solution, no correctness checking, no success state.
- Never affects progression, never consumes a review opportunity, never unlocks
  or locks anything.
- Reachable from primary navigation at all times, including before Unit 1.
- Preserve the `window.VimWilds` testing interface (`emit`, `goTo`,
  `solveCurrent`, `getState`) per `AGENTS.md`.

## Out of scope

- Generated buffers, prompts, session recaps, or command-usage analysis — all
  described in the curriculum doc as later work. Ship the playground first.
- Language or theme filters. Random plus a list is enough.
- Removing or changing the existing per-exercise Explore mode.

## Acceptance criteria

- Free Practice is reachable from primary navigation before any lesson is
  completed.
- The surface shows only the expanded editor and the keyboard.
- 20 local sample buffers across at least 12 languages, each 20–60 lines.
- Random pick is the default entry path.
- The compatibility disclaimer appears on entry.
- No progression state changes on entry, edit, or exit.
- The editor is meaningfully taller than in lesson mode at 360×740.

## Validation

```bash
node --check app.js && git diff --check
npm test
npm run test:targeted -- <free practice spec> --grep "free" # one worker
```

Inspect 360×740, 390×844, 412×915, 430×932, 432×960 and landscape. Confirm the
keyboard stays fixed and never opens the native phone keyboard, that latched
Ctrl/Shift/Alt and Caps Lock behave as in lesson mode, and that a 60-line buffer
scrolls inside the editor without scrolling the document.

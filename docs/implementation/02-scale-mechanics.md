# Session 02 — Scale mechanics: viewport and impact readout

**Depends on:** nothing · **Blocks:** 03, 04, 05
**Touches:** `app.js`, `styles.css`, `content/unit-content.schema.json`, `tests/`
**Size:** M

## Context

The review's central finding: the automation units teach automation at a scale
where automation loses. Units 11–14 average 4.0–4.8-line buffers. `:g/TODO/normal
I// ` over a 3-line buffer with two matches costs more keystrokes than `I// ` `j`
`.`. The learner is asked to take scaling on faith while the evidence in front of
them says the opposite.

**This is not in tension with the phone-first constraint.** The schema already
separates the two concepts:

- `scenario.initial.lines` — the whole buffer.
- `scenario.initial.viewport` — `{topLine, bottomLine}`, the visible window.

Unit 9 uses this across 51 activities and ships 30-line buffers on a phone
today. The automation units simply never adopted it. **No session in this plan
increases the number of rows visible at once.**

What is genuinely missing is the second half: when a `:global` command edits
nine lines and six of them are off-screen, the learner currently gets no signal
that anything happened beyond the visible window.

## Goal

Make a long buffer with a small window legible on a phone, so sessions 03–05 can
author realistic automation scale without changing the layout.

## Scope

### 1. Impact readout

After a command completes, report its buffer-level effect the way Vim itself
does — `7 fewer lines`, `9 substitutions on 6 lines`, `3 more lines`. Real Vim
prints exactly this, so the affordance is authentic rather than a teaching
crutch.

- Place it in the existing status area; do not add a new region that costs code
  rows.
- Show it only when the effect extends beyond the visible window, or when it
  affects more than one line. A single-line edit needs no readout.
- Announce it to screen readers, matching the pattern used for choice feedback
  (`IMPROVEMENTS.md` item 7).

### 2. Match map

A one-character-wide gutter strip beside the code slab, marking which buffer
lines match the active pattern or were touched by the last command, including
off-screen ones.

This is what lets a learner perceive *"nine matches scattered across twenty-two
lines"* through a seven-row window. Without it, scattered-match exercises read as
arbitrary. It is the single highest-value piece of UI in this plan for the
automation arc.

- Must cost at most a few CSS pixels of width; the code slab remains the visual
  priority.
- Must degrade cleanly to nothing when no pattern is active.

### 3. Viewport adoption for non-Unit-9 exercises

Confirm `scenario.initial.viewport` renders correctly for exercises whose
content is *not* about viewport commands, and that:

- The window follows the cursor when a command moves it off-screen.
- `topLine`/`bottomLine` are honored on reset and on backward stepping.
- Demo playback scrolls sensibly rather than jumping.

### 4. Declare viewport dependence

Add an explicit marker distinguishing exercises whose *correctness* depends on
the visible-row count (Unit 9's `H`, `M`, `L`, `zt`, `zz`, `zb`) from those where
the window is merely presentation.

This matters for the desktop mode you mentioned: a larger editor on desktop
would silently break `H`/`M`/`L` exercises. Marking the dependence now means a
later desktop-enlargement change has something safe to check against. Do not
implement desktop enlargement in this session — only make it safe to attempt.

## Out of scope

- Changing the number of rows visible on a phone.
- Desktop editor enlargement itself.
- Any content authoring. Sessions 03–05 consume this work.

## Acceptance criteria

- A 22-line buffer with a 7-line window renders correctly at 360×740 with no
  document scrolling and no horizontal overflow.
- The impact readout appears for off-screen effects and is screen-reader
  announced.
- The match map marks off-screen matches and disappears when no pattern is live.
- Unit 9's existing 51 viewport activities are unchanged in behavior.
- Schema and `docs/lesson-content-design.md` document viewport dependence.

## Validation

```bash
node --check app.js && git diff --check
npm test
npm run test:targeted -- <viewport spec> --grep "viewport" # one worker
```

Inspect 360×740, 390×844, 412×915, 430×932, and 432×960. Confirm no clipping,
document scrolling, or horizontal overflow — the review flagged existing buffer
lines up to 91 characters wide, so check a wide automation buffer specifically.

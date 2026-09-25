# Manual testing plan

**This is Anton's own testing plan, not a task for a coding agent.** Each item
is a manual check to perform while walking the course on a real phone. An
agent can help fix what a check finds, but it cannot perform the check — each
one is a judgement about whether something reads and feels right at 360 CSS
pixels.

Status: not started (as of 2026-09-25). Items 1, 3, 4 and 5 were checked and
passed earlier; **the numbering gaps are deliberate**, so that a note referring
to "item 7" still means item 7.

File anything a check turns up through the in-app feedback sheet rather than
here — that is what it is for, and a report carries its own context, buffer and
screenshot.

---

## 2. Practice copy describes outcomes, not canonical keystrokes

Sample guided and recall activities across all units — movement, editing,
registers, search, ranges, macros, automation. Confirm titles and task
instructions state the desired **text, cursor, mode, viewport, or register
result** without spelling out the authored key sequence.

Demos, hints, theory, and post-success explanations may still teach commands.
The rule applies to the prompt, not to the teaching.

## 6. Inserted demo text fast-forwards as one run

Open an Insert- or Replace-mode demo, such as the assignment-framing example.
Confirm one Step enters the mode and the next Step enters the consecutive
printable text run **at once**.

Confirm each of these stops a run: Escape, Enter, Tab, Backspace, a checkpoint,
a command-group boundary, a mode change. Confirm Search and Ex text remains
key-by-key.

## 7. Choice feedback explicitly reports correctness

Select a wrong option: confirm `Not quite.` appears with incorrect styling,
remediation, and another selectable attempt. Select the correct option: confirm
`Correct.` appears with correct styling, its explanation, and Next.

Confirm the live status is announced by a screen reader.

## 8. Semantic command assemblies stay readable and bounded

At 360px, open the six-part home-row demo. Confirm `3×`, `right`, `2×`, `down`,
`left` and `up` remain inside compact cells with no clipping and no tray
overflow. Check several other structured commands for the same behavior.

## 9. The impact readout restates a command's reach

Run `:g/DEBUG/delete` on a multi-line buffer and confirm `2 fewer lines` appears
in the status tray. Run `:%s/var/const/g` and confirm
`3 substitutions on 3 lines`. Run a single-line `:s` in a fully visible buffer
and confirm **no readout appears**.

Confirm the readout retires on the next keystroke and on reset, that the console
height does not jump when it appears, and that the live status is announced by a
screen reader.

## 10. The match map marks off-screen matches

In a windowed buffer, make a pattern live with a search or `:g`. Confirm the
position rail ticks **every** matching buffer line, including lines outside the
window, while visible matches are highlighted in the code.

Confirm a tick inside the window thumb is always an on-screen match; that the
map disappears once nothing matches and after `:nohlsearch`; and that no rail or
tick appears for a fully visible buffer. At 360px confirm the rail adds no width
and nothing clips.

---

## Two things the walkthrough will expose that are already known

Not defects to file — they are scheduled:

- **Units 5–17 boards do not progress and their landmarks never light.** Only
  the four Arc 1 scenes have a patch layer. See
  [in-board-landmark-plates.md](in-board-landmark-plates.md).

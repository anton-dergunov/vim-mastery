# Session 04 — Unit 13: macro rework

**Status:** complete · **Depends on:** 02 (viewport) · **Blocks:** 16
**Touches:** `content/units/13-macros.json`
**Size:** L

> **Corrected by session 05.** This brief's "12–20 buffer lines" was enforced as
> a test assertion, and it padded nineteen of Unit 13's thirty-two activities
> with rows their macros never touch. Buffer length is now sized from each
> exercise (constraint 5 in [README.md](README.md)); the assertion was replaced
> with one about the number of rows a macro actually transforms, and the padded
> buffers were trimmed. The per-activity window finding below stands.

## What executing it changed

**The window is per activity, not seven everywhere.** Session 03 put all of Unit
14 on a uniform seven-row window. Unit 13 instead takes the smallest window each
activity needs: five rows for short recordings, six as the default, and seven
only for the three activities whose lesson *is* reach beyond the window
(`count-scattered-csv`, `failed-semicolon-demo`, `selective-error-log`).
Measured at 360×740, a seven-row window leaves the board 246px and a six-row one
268px, with the keyboard bottom at 733px of 740 either way. Nothing overflows at
seven rows, but rows are not free, so the unit only spends them where they teach.

**A macro register cannot be seeded by recording during setup.** Vim stores
K_SPECIAL prefixes inside a recorded register. `getreg` readouts hide them (the
native runner strips them), but `"ap` puts the raw bytes into the buffer, so an
inspect-or-repair activity seeded that way shows mojibake. The lesson therefore
keeps macro text as *buffer* text and yanks it with `"ay$` — which is also the
workflow `docs/vim-conformance.md` records as verified. `put-macro-demo` makes
that the teaching point rather than a workaround: a yanked line of commands
replays exactly like a recorded one.

**A self-advancing search has to change the row it just edited.** A macro that
edits and *then* searches for the same anchor re-finds its own row, because the
search starts at the cursor and the anchor is still there. Two shapes avoid it,
and the unit teaches both deliberately: search first, then edit (Unit 13's
counted lessons), or edit the row's start so the anchored pattern stops matching
it (`final-search-errors`, `selective-*`).

**Long buffers import the 30-column cap.** Same gate session 03 hit: setting
`editor.viewportRows` makes every authored line at most 30 characters, so the
rows are terse — `user: alice, admin`, not a realistic log line. It is what
shaped the content.

**Exercises stayed `guided-then-recall`.** Recall-only delivery would have been
the sharpest hint-level escalation for the challenges, but a 25-key macro
recalled from memory is not a 15–90 second phone exercise. Challenges escalate on
buffer size, replay count, irregularity, and hint count instead.

**Out of scope but fixed:** `tests/vim-effects.spec.js` still expected two
`:g/DEBUG/delete` match ranges from Unit 14's pre-session-03 buffer. That spec is
not in the quick tier, so it went unnoticed; it now expects the six ranges the
current buffer produces.

## Context

This is the sharpest content-level contradiction the review found.

**Every one of Unit 13's 24 exercises is a uniform single-line transformation
over adjacent lines.** The curriculum's own decision framework
(`docs/curriculum-and-progression.md`) says a macro is for *"a multi-step edit
repeated over differing local structure"*, and that `:normal` is the right tool
for *"the same Normal command on a known line range"*. So Unit 13 consistently
demonstrates macros on exactly the case where Unit 14 will later, correctly, tell
the learner to use `:normal` instead.

The repetition compounds it. These are **byte-identical** canonical sequences:

| Sequence | Exercises | Phases |
| --- | --- | --- |
| `qa 0 f: r= j q 3@a` | `final-go-fields`, `final-php-records`, `final-prose-labels` | isolate → mix → challenge |
| `qa 0 f: r= q qA j q 3@a` | `append-csharp-fields`, `append-xml-attributes` | mix, challenge |
| `qa I# Esc q j @a j @@` | `comment-python-jobs`, `comment-yaml-flags` | isolate, challenge |

The escalation across phases is a language reskin. And because `0f:` is the
answer nearly every time, the `stable-anchors` lesson trains skeleton
pattern-matching rather than the structural analysis it intends to teach.

## Goal

Teach macros on the case where macros actually win, and make the phase
progression real.

## Scope

### 1. Introduce irregular structure — the core change

At least half the unit's exercises must operate on rows that **differ from each
other**: differing field counts, differing delimiters, an extra wrapper on some
rows, a line that legitimately needs nothing done to it.

This is what makes a macro the right answer instead of `:normal` or `:s`, and it
is what gives the `failure-as-guard` lesson something real to bite on. A failed
`f:` on a row that has no colon is only instructive when some row genuinely has
no colon.

### 2. De-duplicate the phases

No two exercises in the unit may share a canonical key sequence. Each
`challenge` must differ from its lesson's `isolate` in at least one real
dimension: buffer size, distractor presence, cursor distance, hint level, or
number of composed commands. **A language reskin is none of those** and no
longer counts as escalation.

### 3. Diversify the anchors

`0f:` currently dominates. Spread across `0f{char}`, `/pattern⏎`, `$`, `^`,
text objects (`ci(`, `ct,`), and `%`. The `stable-anchors` lesson should require
the learner to notice *why* a given anchor survives row variation while another
does not.

### 4. Re-scale

12–20 buffer lines with `scenario.initial.viewport` keeping the visible window
unchanged. `3@a` on a five-line buffer does not motivate recording; `12@a` over
sixteen irregular rows does.

### 5. Strengthen the tool-choice ending

`selective-macro-workflows` should now contrast honestly: when the rows are
uniform, `:normal` or `:s` is better and the learner should say so. A macro
lesson that admits when not to record a macro is more useful than one that does
not.

## Out of scope

- Recursive macros — correctly optional in the curriculum; leave as is.
- `:g/pat/normal @a` — that is Unit 14's `global-macros`, session 03.

## Acceptance criteria

- No duplicate canonical sequences within the unit.
- At least half the exercises operate on structurally irregular rows.
- At least one exercise has a row the macro must safely skip or fail on.
- Anchor variety: `0f:` appears in no more than a quarter of canonicals.
- Buffers are 12–20 lines; visible rows unchanged.
- Every challenge differs from its isolate on a named dimension.

## Validation

```bash
npm test
npm run test:targeted -- tests/editor-conformance.spec.js --grep "Unit 13|window|rail|recording state"
npm run test:targeted -- tests/vim-effects.spec.js
```

Every target, checkpoint, and register expectation was derived by replaying the
canonical through native Vim rather than reasoned about, then replayed again
through the browser engine, where all 32 activities reproduce the same buffer,
cursor, and register state. Command-only macros assert register `a`; macros that
record Insert text do not, because the adapter stores recorded Insert changes
separately from its printable register text.

The acceptance criteria are now guarded by tests rather than by review: unique
canonicals across the unit, 12–20 line buffers, a five-to-seven row presentation
window opening on the authored lines, `0f:` in no more than a quarter of the
exercise canonicals, and counted replays that stop with untouched rows below.

Fit was measured, not assumed: 360×740, 390×844, 412×915, 430×932, and 432×960,
for five-, six-, and seven-row activities. No document scrolling, no horizontal
overflow, keyboard fully on screen.

# Session 04 — Unit 13: macro rework

**Depends on:** 02 (viewport) · **Blocks:** 16
**Touches:** `content/units/13-macros.json`
**Size:** L

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
npm run test:targeted -- <unit spec> --grep "macro" # one worker
```

Replay every canonical. Macro exercises are the most fragile in the product:
confirm register contents, the final cursor position after each replay, and that
counted replays stop where the lesson says they stop.

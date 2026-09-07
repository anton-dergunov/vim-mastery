# Session 02 — Teach the verified commands

**Size:** L, splittable at the part boundary. **Depends on:** nothing.

Two command families passed both conformance tiers and are taught nowhere. One
of them is worse than absent: a shipped lesson tells the learner the material
is coming.

The two parts touch different unit files, so they can be split into two
sessions without either blocking the other. Neither part needs engine work —
the fixtures already exist. If a canonical fails to replay, that is a bug in the
canonical, not a missing capability.

---

## Part A — Unit 5 search offsets

### Why

`docs/vim-conformance.md` records session 21 verifying search offsets, and
`supported-commands.json` lists them under `verified`: `/pat/e`, `/pat/s`,
`/pat/b`, `/pat/+n`, `/pat/-n`, the bare line-count form, offsets repeating with
`n` and `N`, a plain search clearing a previous offset, and a malformed offset
reporting `Trailing characters:`. Sixteen `search-offset-*` fixtures back all of
it in `tests/vim-fixtures.mjs`.

Session 12 built `search-as-a-range` and deliberately left the seam open: its
opening theory says "**A plain** search range is exclusive" rather than "a
search range is exclusive," so an offset beat could slot in without
contradicting anything. Session 21 then shipped the engine and declared content
authoring out of scope. Nobody picked it up.

The result is a false promise in shipped copy. `search-range-reach` closes the
lesson with:

> Real Vim can also move where a search lands: an offset such as `/pattern/e`
> finishes on the match's last character, which makes the range include the
> match. **That form is real and gets its own practice later**; every range in
> this lesson uses the plain pattern.

There is no later. This is the sharpest single defect the audit found.

### Scope

`content/units/05-precision-motions-search.json`. The unit has 10 lessons;
`search-as-a-range` is index 4 with 8 activities, and its order is:

```
search-range-meaning          theory   explain
search-range-demo             demo     demonstrate
trim-to-level-tag             exercise isolate
copy-row-prefix               exercise mix
widen-field-visibility        exercise mix
collapse-arguments-backward   exercise challenge
predict-search-range-boundary choice   challenge
search-range-reach            theory   explain      ← the false promise
```

**1. Author the offset material as a new lesson placed immediately after
`search-as-a-range`.** Session 21's note suggested a beat inside the existing
lesson, between `collapse-arguments-backward` and `search-range-reach`. Prefer a
new lesson instead, for two reasons: offsets need their own full
`explain / demonstrate / isolate / mix / challenge` cycle rather than a beat
appended to a lesson that already has a challenge and a choice; and
`search-range-reach` is a forward bridge to Units 12 and 15 that should remain
the last word of the lesson it closes. If the executing session judges otherwise
after reading the lesson, an in-lesson beat goes before `search-range-reach` —
never after it.

Cover, at minimum:

- `/pat/e` — the range becomes inclusive, so the match survives *inside* the
  range instead of surviving outside it. This is the whole point, and it is the
  direct contrast with the exclusive boundary the previous lesson just taught.
- `/pat/+n` and the linewise line-offset form. A line offset makes the operator
  linewise, which `delete-to-search-line-offset-is-linewise` pins — that change
  of kind is a teaching point, not a footnote.
- At least one activity where an offset repeats with `n`, since
  `search-offset-repeats-with-n` verifies that the offset is remembered and it
  is the behavior a learner will trip over.

**2. Rewrite the `contrast` field of `search-range-reach`.** It must stop
promising future practice. Point at the new lesson, or state what offsets do and
where they were practised. Do not simply delete the sentence — the contrast
between the exclusive plain range and the inclusive `/e` range is worth keeping.

**3. Decide the track.** Offsets are real, everyday Vim but meaningfully rarer
than plain search ranges. Constraint 7 exists for exactly this: prefer
`lesson.track: "advanced"` with a one-sentence `trackNote`, which keeps the full
five-phase cycle and marks it honestly. Reference entries in
`content/reference.json` are optional here and should follow the pattern the
other marked lessons use.

### Out of scope for Part A

- **Search offsets on Ex addresses** (`:/pat/+1d`). A different parser. Out of
  scope by design — see the settled decisions in `README.md`.
- Any change to `patches/`, `vim-engine.js`, or the fixtures. The engine is done.
- `gn` / `gN`, which are already taught and correct.

---

## Part B — Unit 15 `:g/pat/p`

### Why

Session 01 dropped `:g/pat/p` and `:g/pat/nu` because there was nowhere to
render Ex output. Session 03 authored Unit 15 around that gap, using
`:%s/TEMP/TEMP/gn` as a substitute dry run, and wrote down that "`:g/pat/p`
remains worth having." Session 19 then built the Ex output surface and lifted
the drop — `renderExOutput` at `app.js:2369`, the overlay at
`play/index.html:156`, five native fixtures including
`global-print-previews-matches` and `global-bare-pattern-defaults-to-print`, and
a browser case asserting a nine-match list does not widen the page.

Session 19's own §4 named the content follow-up and left it. So the product can
print Ex output and no lesson ever asks it to.

### Scope

`content/units/15-global-normal-automation.json`, lesson `global-delete`
(index 2), which currently reads:

```
global-delete-meaning              theory   explain
global-delete-demo                 demo     demonstrate
preview-global-scope               exercise isolate
global-delete-comments             exercise isolate
range-global-delete                exercise mix
global-delete-alternation          exercise challenge
choose-global-over-visual-predicate choice  challenge
```

**Add a `:g/DEBUG/p` beat beside `preview-global-scope`, and name the idiom in
`global-delete-meaning`.**

**Add, do not replace.** `:%s/…/gn` and `:g/…/p` answer different questions —
one counts how many lines match, the other shows *which* lines match — and the
difference between a count and a list is the teaching point. A learner who has
seen both knows which to reach for when the predicate looks wrong.

Note that `:g/pat` with no command defaults to print
(`global-bare-pattern-defaults-to-print`), and `:g!`/`:v` previews the
non-matching lines (`global-invert-previews-unmatched-lines`). Both are cheap
additions once the beat exists; neither is required.

### Out of scope for Part B

- Any general Vim message line — `:messages`, error reporting, `'report'`.
- `@:` replaying a print. It cannot, and that is brief 05's problem.
- Changing `preview-global-scope` itself.

---

## Constraints on both parts

- **Seven code rows is the maximum**, and `tests/content-data.test.mjs` fails an
  activity that exceeds it. Use `editor.viewportRows` with
  `scenario.initial.viewport` where a buffer is longer than its window.
- **The 30-column authoring cap** is enforced at
  `tests/content-data.test.mjs:2517` for every unit that sets `viewportRows`.
  It is a gate, not advice.
- **Size each buffer to its own exercise.** Do not grow one to match a
  neighbour, and do not pick a length for the lesson and author to it. Unit 15
  runs 13–20 lines because its exercises reach past the window; Unit 5's offset
  work may well need three rows.
- **Every cursor-moving canonical step needs an explicit checkpoint**, and
  `editor.viewportDependent` must agree with whether the activity asserts a
  viewport. Both are test-enforced.
- Set `provenance.nativeValidation` and `browserConformance` honestly. Unit 15
  asserts both are `passed` on every runnable.

## Validation

- `node --check app.js`, `git diff --check`.
- `npm test`. This tier replays every canonical through native Vim; a new
  activity whose canonical does not reproduce its own target fails here.
- `npm run test:targeted -- tests/editor-conformance.spec.js --grep "offset|Ex output"`
  at one worker.
- Exercise each new canonical by hand and confirm exact target code, success
  state, mode, cursor, and every checkpoint — including the mode change when a
  line offset makes an operator linewise.
- Inspect 360×740, 390×844, 412×915, 430×932 and 432×960 for every new activity.
  No clipping, no document scrolling, no horizontal overflow. For Part B,
  confirm the Ex output overlay does not change the console height and retires
  on the next keystroke.
- Confirm no workspace-owned Playwright or Vite process survives the run.

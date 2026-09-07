# 25 — In-app feedback capture

## Why

Reviewing all 17 units end to end means finding a lot of problems, and the old
loop lost the most useful half of each one. A screenshot went into Google Keep
with a typed note, and nothing in the picture said which unit, lesson or
activity it came from. `feedback_example/example-extracted.md` is that loop's
output: three screenshots, three one-line notes, and no context. One of them —
*"Text for instructions is overflowing and showing strange things"* — cannot be
diagnosed at all without knowing the viewport and the font scale.

Reporting from inside the app fixes that at the source. The app already knows
where it is and what state it is in, so the report carries it automatically.

## What was built

A flag button in the board's bottom-right corner, mirroring the character's
empty grid slot, plus a **Report a problem** row in Settings. Both open one
sheet: a note, a kind, an optional screenshot, and a **What will be sent** panel
holding the editor contents in an editable field.

Four modules, each with one job:

| Module | Responsibility |
| --- | --- |
| `feedback-report.js` | The envelope and the Markdown. Pure — no DOM, no network. |
| `feedback-capture.js` | Reads the page: environment, layout scan, screenshot. |
| `feedback-transport.js` | POST, IndexedDB outbox, share/download/clipboard. |
| `feedback-ui.js` | The sheet. |

Reports go to a Cloudflare Worker (`worker/`) which writes D1 rows and R2
objects; `scripts/pull_feedback.py` syncs them into a gitignored `feedback/`
directory as Markdown. Nothing writes to GitHub: the repository is public and
the review backlog is not.

Triage state (`new` / `done` / `wontfix` plus a resolution note) lives in D1
rather than in the local directory, because "pulled to a laptop" and "dealt
with" are different facts and only the second is worth keeping. A pull re-reads
it for every report, so marking from a phone shows up on the next sync, and
`scripts/mark_feedback.py` addresses a report by its directory name or any
unambiguous id prefix — nobody should have to retype a uuid while reading a
report.

## Three things that were not obvious

**The global keydown handler eats typing.** `app.js` registers a capture-phase
`keydown` listener on `document` that bails out only for named dialogs. Its
escape hatch matches `select` and `button`, so a `<textarea>` falls through: in
a theory activity every character is swallowed, and in an exercise every
character is *typed into the Vim buffer*. Two different failures, so the browser
suite pins both. The fix is one guard, but nothing about it is discoverable from
outside — this is the first free-text field in the product.

**The refused key was being thrown away.** `state.history` records accepted keys
only, because `processToken` returns before `sendKey` when the key is wrong. So
the one fact a report like *"iw is not suggested"* is actually about did not
exist anywhere. A capped ring buffer in `flashError()` now keeps it.

**A DOM rasterizer drops pseudo-element backgrounds.** The board's scene art is
painted by `.world-backdrop::before`, so the first working capture showed every
lesson floating on a flat gradient — a misleading picture of a product whose
visual polish is the thing under review. `materializePseudoBackgrounds()`
restates those pseudos as real elements for the duration of the capture and
suppresses the originals so they cannot double-paint. Only absolutely
positioned pseudos are handled, because their box is fully determined by
computed insets; anything else is skipped rather than guessed at, since a
misplaced backdrop is worse than a missing one. Two tests assert the page is
left exactly as it was found, including when the capture times out.

## The screenshot is optional

Not a degraded state — a first-class outcome. Capture runs asynchronously and
never blocks the sheet or the Send button. Safari applies a stricter
`foreignObject` security model, so failure is ordinary on iPhone and iPad rather
than exceptional; the sheet then offers a file picker so the OS screenshot can
be attached instead. The layout scan is attached either way, and it is what
actually diagnoses an overflow bug: it names the element and gives its content
and box sizes.

## Privacy

Nothing sensitive is persisted to disk by the app today, so the entire exposure
is what a report chooses to serialise from memory.

| Field | Treatment |
| --- | --- |
| Unit, lesson, activity, mode, progress, keys | Always sent. Authored identifiers. |
| Build version, viewport, DPR, font scale, user agent | Always sent. |
| Buffer, registers, command line | Sent, shown in an editable field, cleared in one tap. |
| Free-practice and explore buffers | Flagged, and the panel opens itself. |
| Per-command keystrokes in the effect log | Redacted on the free-practice surface. |
| Mastery completions | Never sent — a learning-history profile. |
| Client IP | Not stored by the Worker. |

Registers deserve their own note: they are module-global in `codemirror-vim`, so
text yanked in free practice is still there during a later lesson. Clearing the
buffer field withholds registers and the command line along with it.

## Follow-ups

- The story, contents and reference dialogs have no entry point. They are modal
  and sit in the browser top layer, so no floating button can reach them; each
  needs its own affordance.
- In free practice the button necessarily overlaps the scratchpad text, since
  the buffer fills the board and the top bar has swapped Settings out for the
  file picker. It recedes until touched. Worth revisiting if it grates.
- Turnstile is deliberately absent. It would pull a script from
  `challenges.cloudflare.com` into the app shell, breaking the local-assets-only
  rule and failing offline. The Origin allowlist, rate limit and size cap are
  the trade while the app has no users.

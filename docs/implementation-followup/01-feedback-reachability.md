# Session 01 — Feedback reachability

**Size:** S. **Depends on:** nothing. **Blocks:** the author's end-to-end
walkthrough.

## Why

In-app problem reports are the mechanism the author is about to use to review
the whole course. There are exactly two ways to open the sheet today: the
floating flag button beside the board (`#feedbackButton`, `play/index.html`) and
a row in Settings (`#feedbackSettingsButton`).

Both are unreachable from inside a dialog. A `<dialog>` renders in the browser
top layer, above the flag button and above the top bar that holds Settings, so
while the table of contents, the mastery panel, the practice file picker, the
story card, or a reference deck is open there is **no way to report the thing
you are looking at**. Those five surfaces hold a large share of what a reviewer
will want to comment on: lesson ordering and track badges in the contents,
progress-state wording in mastery, the sample list in practice, story copy and
art, and every reference card.

The original brief listed this as a known follow-up. It is now the thing
standing between the author and a usable review pass, so it goes first.

## Scope

### 1. A reporting affordance in each of the five dialogs

Add one to each, in `play/index.html`:

| Dialog | id | Line (at time of writing) |
| --- | --- | --- |
| Table of contents | `#tocDialog` | 241 |
| Mastery | `#masteryDialog` | 252 |
| Practice files | `#practiceFilesDialog` | 263 |
| Story | `#storyDialog` | 403 |
| Reference | `#referenceDialog` | 434 |

`#practiceNoticeDialog` and `#settingsDialog` are excluded: the notice is a
one-time compatibility statement, and Settings already has a row.

**Reuse the Settings pattern, not a second floating button.** The row at
`play/index.html:334-337` is a `note-action secondary-action` button inside a
titled `section`; it is already styled, already keyboard-reachable, and it does
not cover content. A floating button would repeat the free-practice problem
below in five more places. Where a dialog has a `.dialog-head` (contents,
mastery, practice files) a small control in the head is acceptable if it reads
better than a footer row — decide per dialog by looking at it on a 360×740
phone, not by making all five identical.

Every new control needs `data-feedback-exclude`, so it does not appear in its
own screenshot. `#feedbackDialog` itself already carries the attribute.

### 2. Opening the sheet from another dialog

The sheet is its own `<dialog>`. Opening it while a dialog is already open puts
two dialogs in the top layer at once. Decide and implement one behavior:

- close the originating dialog first, or
- stack, and return focus to the originating dialog on close.

Whichever is chosen, verify against `feedback-ui.js`: `open()` (line 84) and the
`close` handler (line 220, which calls `onClose`) are the seams. Do not
duplicate the open path — call the existing one.

### 3. The report should say where it came from

`createFeedbackSurface` takes a `getContext` callback. A report filed from the
reference deck or the story card should carry that surface in its context, or
the author will get reports whose subject cannot be identified. Check what the
current context records for the two existing entry points before adding a field.

Screenshot capture runs over the live page (`feedback-capture.js`). Confirm what
it produces when a dialog is open — an image of the dialog is the useful
picture, an image of the lesson behind it is not.

### 4. The free-practice overlap

`styles.css:5055-5065` already documents the problem and its current mitigation:
free practice is the one surface where the buffer fills the whole board, so the
flag button sits over text the learner is editing, and it recedes to 50% opacity
until touched. The original brief said this was "worth revisiting if it grates."
Now that the practice file picker gains its own row (item 1), the flag button is
no longer the only way in there — the top bar's file-picker button leads to a
dialog that can report. Re-evaluate: either move the button out of the text area
or drop it on this surface. Do not leave it merely smaller.

## Out of scope

- Turnstile or any other bot mitigation. See the settled decisions in
  [README.md](README.md) — the origin allowlist, rate limit and size cap are the
  trade while the app has no users.
- Any change to the report payload, redaction rules, transport, outbox, or the
  Cloudflare receiver in `worker/`.
- Making the feedback endpoint a requirement. It stays optional.

## Watch out for

**The capture-phase `keydown` handler will eat typing.** `app.js:2842-2851`
carries the bail-out and a comment explaining it: without
`if (elements.feedbackDialog?.open) return;` every character is swallowed in a
theory activity and typed into the Vim buffer in an exercise. The bail-out list
above it names `storyDialog`, `practiceFilesDialog`, `practiceNoticeDialog` and
`masteryDialog` — but **not** `tocDialog` or `referenceDialog`, which have no
text fields of their own. Confirm the feedback bail-out fires for every new
caller, including when the sheet is opened from a dialog that is not itself on
the list.

## Validation

- `node --check app.js` and `git diff --check`.
- `npm test`.
- `npm run test:targeted -- tests/feedback.spec.js` at one worker. Extend it:
  from each of the five dialogs, open the sheet, type a note, and assert the
  note reached `#feedbackNote` and not the Vim buffer — this is the assertion
  `tests/feedback.spec.js:34` already makes for the lesson surface, applied to
  each new caller.
- Assert the page is restored exactly after the sheet closes from each dialog.
  `tests/feedback.spec.js:168` and `:184` already do this for the existing
  entries, including on capture timeout.
- Inspect 360×740, 390×844, 412×915, 430×932 and 432×960 for every dialog
  changed. No clipping, no document scrolling, no horizontal overflow. The
  contents and reference dialogs are the tightest.
- Confirm no workspace-owned Playwright or Vite process survives the run.

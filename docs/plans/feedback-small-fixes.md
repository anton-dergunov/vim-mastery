# Small fixes from phone feedback

**Size:** S. **Depends on:** nothing. Three independent items; each can ship on
its own.

## 1. The last keystroke taps Next

Feedback: `d6432f52` (`repeat-separator-edit`, Android). The reporter says the
last key of an exercise goes straight to the next one, and guesses the old
phone is too slow.

**It is not slowness, and it isn't limited to that phone.**

1. The touch keyboard acts on `pointerdown` (`src/keyboard/keyboard.js`,
   `elements.keyboard` listener). That calls `preventDefault()` and emits the
   key.
2. The final key completes the exercise synchronously inside that handler
   (`processToken` → `completeActivity` in `src/lesson/practice.js`).
3. `renderActivityControls()` in `src/app/render.js` then hides the keyboard and
   fills `#activityControls` with the completion panel. The panel sits over the
   keyboard's exact area (`src/styles/keyboard.css`), with **Next** at its
   bottom right (`src/styles/lesson.css`).
4. `preventDefault()` on `pointerdown` doesn't cancel the `click` that follows
   the same touch. That click is hit-tested where the finger lifts, which is now
   on Next. The `click` listener on `#activityControls` (`src/app/events.js`)
   advances, and so does the one on `#completionHost`.

Any final key that sits under Next skips the completion screen on every touch
device.

**Fix:**

- Honor a Next activation only when its own `pointerdown` started on the button.
  Record that on a `pointerdown` inside the completion panel, and check it in
  the `click` handler. Keyboard (Enter) activation should still work.
- A time guard (ignore activation for about 400ms after `completeActivity`) is
  the simpler fallback, but it would also eat a deliberate fast tap.
- Keep the physical-key advance in `keyboard.js` (any key on a completed
  exercise) as it is. It doesn't go through `click`.

**Test:** use Playwright with touch emulation. Solve an exercise whose final key
lies under Next's rectangle, tapping that key through touch events, then assert
the completion panel is still showing. Also assert that a fresh tap on Next
does advance.

## 2. Reference cards: chips split and text is small

Feedback: `765a655f` (reference, survival · leaving-safely, 392px Android). The
report says the font is too small. The screenshot also shows the `:w` and `:q`
chips broken: the `:` alone in the chip and the letter below it, printed over
the "IN VIM" label.

- **The split.** `.reference-row-command code` in `src/styles/dialogs.css` sets
  `white-space: normal; overflow-wrap: anywhere`. Inside the flex
  `.reference-row-command`, that lets the chip shrink to one character, even for
  a bare `:w`. Make it `nowrap`.
- **Long entries.** Nine commands in `content/reference.json` join alternatives
  with ` · ` (`:wq  ·  :x`, `:qa  ·  :wqa`). In `renderReferenceRows()`
  (`src/dialogs/reference.js`), render each alternative as its own chip, so the
  row wraps between chips and never inside one.
- **Sizes.** At phone width the cell labels are 10px uppercase, and the row
  text, notes and host note are 13px. Raise the labels to 11px, and the text to
  14px to match the card's body paragraphs. Give the label a little space
  above, so a wrapped command can never touch it.
- The report's layout check also flagged document scrolling, with
  `#referenceBackdrop` 4px wider than its box. Confirm the document doesn't
  scroll at 360×740 with a two-column card open.

Check every deck at 360 and 430 wide, especially the rows with the longest
commands: `Ctrl-w h j k l`, `:b {number|name}`.

## 3. "remembers" for a repeated search

Feedback: `8115d17f` (`repeat-find-meaning`). "Is remembers the correct word
here? I would say 'reproduces'."

- In `content/units/05-precision-motions-search.json`, the `repeat-find-meaning`
  contrast reads "The repeat remembers both the target character and the
  direction of the original find". It is Vim that keeps the last character
  search; `;` replays it. Something like "`;` repeats the last find: the same
  character, in the same direction. `,` repeats it in reverse."
- Same unit, a hint: "`;` still remembers the character search." Fix it the same
  way.
- `content/units/11-repeatable-editing.json` says the same of dot three times
  ("Dot remembers how Insert mode started…", the title "Dot remembers the
  previous count", "Dot remembers the count attached to the change"). There the
  metaphor is closer (dot replays a stored change), but make it consistent with
  whatever unit 5 settles on.
- Leave unit 16's "the editor already remembers where you last changed
  something" and "the last-change mark only remembers one place" as they are:
  in both, something really is stored.

## Done when

- A touch tap on a final key under Next no longer skips the completion screen,
  and a test proves it.
- Reference chips never break inside a command.
- The reference text meets the sizes above, and nothing clips or scrolls at the
  representative viewports.
- The repeat wording is fixed in units 5 and 11, and `npm test` passes.

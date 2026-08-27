# CodeMirror Vim patches

`patch-package` runs after dependency installation and applies only
version-specific files named `@replit+codemirror-vim+<version>.patch`.

No upstream patch is needed for the initial Visual Block failure: it was caused
by the host editor omitting CodeMirror's `allowMultipleSelections` extension.
When a native-Vim fixture demonstrates an upstream engine mismatch, add the
smallest patch here and reference the fixture in its header and in
`docs/vim-conformance.md`.

`@replit+codemirror-vim+6.3.0.patch` adds the missing native `g_` motion used by
Unit 2, including counted line movement and last-nonblank cursor placement. It
also restores native `gn`/`gN` behavior for Unit 5: match selection always
moves forward/backward respectively, regardless of whether `/` or `?` created
the previous search, and it chooses the correct neighboring match when the
cursor sits between matches. Unit 6 extends the same versioned patch so
around-quote text objects include trailing whitespace, or leading whitespace
when no trailing whitespace is available, matching native Vim. It also parses
the complete CodeMirror buffer before resolving an enclosing HTML tag, so
`it`/`at` can see closing tags beyond the cursor.

Unit 7 extends the patch for Visual-mode conformance. Visual Block `I` and `A`
remember the original upper-left corner and restore it after the replicated
insert finishes, block shifts use CodeMirror's configured indentation unit,
and characterwise Visual `gq` treats the formatter's end row as exclusive so
the cursor finishes at the start of the last formatted row.

Unit 12 extends the patch for substitution conformance. Vim regex is
case-sensitive by default, `i` and `I` select case behavior explicitly, and
`n` counts matches without editing. Confirmation keeps native `g`/`c`
semantics and cursor placement, unescaped replacement `&` expands even in the
first position, `\\r` advances replacement scanning across inserted lines, and
patterns containing the active Ex delimiter remain valid with `nopcre`.

Unit 13 extends the patch for macro conformance. Uppercase `qA` preserves and
appends to the lowercase register, while a failed find or search aborts the
rest of the macro and stops any remaining counted repetitions.

Session 01's conformance spike extends the patch for five native-Vim mismatches
found by `conformanceFixtures` in `tests/vim-fixtures.mjs`. Each fixture runs on
both the native and the browser tier.

- `:sort /pat/` sorted on the matched text. Vim sorts on the text that *follows*
  the match; comparing the match itself is Vim's `r` flag, which this command
  does not accept. Fixture: `sort-pattern-sorts-on-text-after-match`.
- Insert-mode `Ctrl-u` deleted to the start of the line. Vim removes only the
  text entered during the current insert, falling back to the first non-blank
  and then to column zero. The new `deleteInsertedText` action reads the
  `vim.insertStart` bookmark that the Unit 9 hunk already records. Fixture:
  `insert-delete-inserted-text`.
- That same `vim.insertStart` bookmark was created with `insertLeft: true`,
  which the adapter maps to a *forward* association, so it drifted along with
  the text being typed instead of staying anchored to the start of the insert.
  It now uses the default backward association. This also makes the `'[` mark it
  feeds point at the first inserted character, as Vim does.
- A blockwise `d` left the cursor one column past the end of a line the delete
  had just shortened, because `clipCursorToContent` still saw Visual mode and
  allowed the extra column. The blockwise branch now clips to Normal-mode
  bounds. Fixture: `visual-block-dollar-delete-ragged`.
- `Ctrl-a`, `Ctrl-x`, `g Ctrl-a`, and `g Ctrl-x` did nothing over a Visual
  selection; the adapter only incremented a single number under the cursor. The
  new `incrementNumbersInSelection` action adds the count to the first number on
  each selected line, and the `g` variants make the addend cumulative so a
  column of identical numbers becomes a sequence. Fixtures:
  `visual-increment-sequence` and `visual-increment-uniform`.

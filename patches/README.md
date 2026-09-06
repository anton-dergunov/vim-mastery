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

Unit 8's read-only registers extend the patch once more. After a substitution
the adapter left its own internally encoded query in the last-search register,
so `:%s/draft/entry/g` reported `draft/g` where Vim reports `draft`. The flag
suffix is an encoding `parseQuery` needs, not part of the pattern, so
`substitute` now remembers the bare pattern and restores it to `"/` once the
query is installed. Fixture: `substitute-leaves-bare-pattern-in-search-register`.

Session 21 extends the same versioned patch to honor search offsets, which
session 01 had dropped. Six hunks, each motivated by a fixture in
`conformanceFixtures`:

- The search state now carries an offset beside the query, and
  `resetVimGlobalState` clears it, so `n` and `N` repeat the offset the pattern
  was searched with and an activity reset does not inherit one. Fixtures:
  `search-offset-repeats-with-n`, `search-line-offset-repeats-with-n`, and
  `search-offset-repeats-backward-with-N`.
- `processSearch` splits a typed query into pattern, this adapter's `i`/`I`
  case flags, and Vim's offset grammar before compiling the pattern, using the
  delimiter that opened the search so `?pat?e` works too. A word-under-cursor
  search clears the offset instead of inheriting it. Fixtures:
  `search-offset-leaves-bare-pattern-in-search-register` and
  `plain-search-clears-a-previous-offset`.
- `findNext` can report the whole match rather than only its start, which an
  `e` offset needs. Fixture: `search-offset-end-lands-on-the-last-matched-character`.
- The `findNext` motion applies the offset and sets `motionArgs.inclusive` for
  `e` and `motionArgs.linewise` for a line offset, which `evalInput` reads after
  the motion runs. This is the hunk that makes `d/pat/e` delete through the
  match and `d/pat/+1` delete whole lines. Fixtures:
  `search-offset-end-is-inclusive` and `delete-to-search-line-offset-is-linewise`.
- Character counts walk with Vim's own `incl`/`decl` rule, which steps over the
  end-of-line position instead of resting on it. Fixture:
  `search-offset-end-plus-count-crosses-the-line-end`.
- `Vim.parseSearchQuery` exposes the same split to `vim-engine.js`, which owns
  the command-line text and needs the bare pattern for the highlight, `"/`, and
  a later `:s//`.

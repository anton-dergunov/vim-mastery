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

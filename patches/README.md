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
cursor sits between matches.

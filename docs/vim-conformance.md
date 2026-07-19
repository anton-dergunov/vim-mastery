# Vim Conformance

Vim Wilds renders with CodeMirror and interprets commands through
`@replit/codemirror-vim`. The supported-command contract is not inferred from
the package's advertised coverage: each command family needs a native Vim
fixture and a browser fixture for physical and virtual input.

Run `npm test` to execute the current native-Vim and Chromium checks. The
browser tests use Google Chrome on macOS; on another platform, configure a
Playwright Chromium executable before running them.

`supported-commands.json` is the release gate. A command moves from pending to
verified only with fixture coverage for text, cursor/selection, mode, registers
when relevant, and undo grouping when relevant. Package defects are patched
with `patch-package`, kept version-specific under `patches/`, and linked to the
fixture that demonstrates the upstream mismatch.

Unit 2 configures a fixed character wrap width for `gj`/`gk` fixtures so their
display-line destinations remain deterministic across supported phone widths.
The pinned `@replit/codemirror-vim` 6.3.0 package omits `g_`; the compatibility
patch in `patches/` restores its native last-nonblank and counted-line behavior.

Unit 3 enables CodeMirror history explicitly so `u` and `Ctrl-r` operate on
complete Vim changes. Its local keyboard injection also delegates Replace-mode
literals to the adapter's overwrite operation; this preserves native `R`
behavior while keeping the editor surface non-editable and preventing the phone
keyboard from opening. The remaining Unit 3 families run through the pinned
adapter without a dependency patch. Numeric fixtures use decimal values because
other formats can depend on Vim's `nrformats` option.

Unit 4 fixes CodeMirror's indentation unit at two spaces to match its native
fixtures. Reflow activities also provide an explicit `editor.textWidth`, which
is applied to both native Vim and the browser adapter so `gq` and `gw` produce
the same phone-readable lines. The adapter supplies the operator, register,
put, indentation, reindent, reflow, count, and dot semantics without a Unit 4
compatibility patch.

Unit 5 uses the adapter's native find/till, explicit search, cursor-word search,
delimiter matching, sentence, and paragraph motions. The pinned adapter's
`gn`/`gN` implementation incorrectly inherited the direction of the previous
`/` or `?` command and could choose the match on the wrong side when the cursor
was between matches. The versioned compatibility patch makes `gn` unconditionally
forward and `gN` unconditionally backward, matching Vim, while leaving the
direction-sensitive `n`/`N` behavior unchanged. Browser fixtures also assert
ordered, end-exclusive Visual match ranges for both directions.

Unit 6 enables CodeMirror's HTML language parser for HTML activities so the
adapter can resolve balanced `it`/`at` objects from the syntax tree. The
versioned patch asks CodeMirror to parse the complete buffer before resolving
an enclosing tag, ensuring its closing tag is available beyond the cursor. Tag
fixtures deliberately use well-formed, lowercase HTML and avoid malformed
tags, comments, and ambiguous angle brackets. The pinned adapter also omitted
Vim's adjacent-whitespace rule for around-quote objects: `a"`, `a'`, and
``a` `` now include following horizontal whitespace when present, otherwise
preceding whitespace. The versioned compatibility patch applies that behavior
to all three quote forms. Demo checkpoints may expose an `affectedRange`; the
playback controller renders that range through the editor's existing preview
decoration and clears it at the next checkpoint or reset.

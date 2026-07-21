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

Unit 7 relies on CodeMirror multiple selections for Visual Block geometry and
uses the existing latched Ctrl key to make `Ctrl-v` available on touch screens.
The pinned adapter needed three native-conformance corrections: blockwise
`I`/`A` now return the cursor to the original upper-left block corner after
Escape, block shifts use the configured two-space indentation unit instead of
the four-column tab size, and characterwise Visual `gq` lands at column zero of
the final formatted row. Focused native and browser fixtures cover those
cursor and text results in addition to `o`, `O`, and `gv` selection geometry.

Unit 8 exposes register contents and characterwise, linewise, or blockwise
shape through the `VimEngine` snapshot so register state can be part of an
activity target rather than inferred only from final text. The adapter's
unnamed, yank-zero, numbered, small-delete, black-hole, and named registers are
reset for every activity. Its `+` register is intentionally part of the same
internal register bank: Vim Wilds never reads or writes the device clipboard,
while lesson copy explains that real Vim integrations connect `"+` to their
host clipboard. The compatibility patch also adds native cursor placement for
characterwise and linewise `gp` and `gP`. Native fixtures alias `+` to an
ordinary named register solely to provide a deterministic oracle on headless
systems where the OS clipboard is unavailable.

Unit 9 fixes authored viewport activities to seven 24px logical rows and exposes
zero-based top and bottom visible lines through `VimEngine` and
`window.VimWilds.getState()`. Native wheel/scrollbar/touch scrolling is hidden
and canceled while adapter-initiated scrolling remains active; a pointer-
transparent rail reports the visible fraction and whether text continues above
or below. Headless Vim verifies text, marks, histories, and structural cursor
results, while Chromium owns exact viewport assertions because Ex mode has no
reliable rendered window geometry.

The versioned adapter patch adds native-conforming change-list traversal for
`g;` and `g,`, records the Insert-exit mark used by `'^`, backtick-`^`, and
`gi`, and maintains the previous operated range marks used by `'[` and `']`.
It also corrects odd-row centering, page-size movement, and nested method
boundaries. Activity reset clears marks, jump/change lists, insertion and
selection history, and viewport state before deterministic setup is replayed.
Specialized comment and preprocessor motions remain outside Unit 9.

Unit 12 configures every editor instance with `nopcre`, making the adapter use
Vim regular-expression syntax instead of its JavaScript-regex default. The
versioned patch makes substitution case-sensitive by default, implements the
`i`, `I`, and count-only `n` flags, and preserves `g` and interactive `c`.
Confirmation choices (`y`, `n`, `a`, `q`, `l`, and Escape) pass through the
same lesson input boundary for touch, demo playback, and physical keyboards;
the reported mode remains Command-line until the prompt closes. Reset also
disposes an active prompt with the rest of the editor instance.

The verified replacement subset includes literal and alternate delimiters,
empty pattern and replacement history, unescaped `&`, `\\0`–`\\9` captures,
and line-breaking `\\r`. Its verified Vim-pattern subset includes the practical
atoms, quantifiers, anchors, character classes, negation, `\\d`, `\\w`, `\\s`,
groups, alternation, word boundaries, `\\v`, `\\zs`, and `\\ze` taught by the
unit. Replacement case conversion and `\\=` expressions are intentionally
orientation/reference material only and remain outside executable lessons.

Unit 13 uses the adapter's named-register macro recorder for `q{register}…q`,
`@{register}`, `@@`, and counted replay. The app buffers `@` for one key so its
existing `@:` bridge can coexist with ordinary macro registers, and it detects
real search inputs rather than mistaking the recorder's `recording @a` message
for a search prompt. The versioned adapter patch preserves existing register
contents for uppercase `qA` recording and aborts the current macro plus any
remaining counted iterations when a find or search motion fails. Fixtures
cover Insert text containing `/`, touch and physical entry of `@`, reset
isolation, and command-only macro text put/edit/yank workflows. Insert-heavy
macros are validated through their text and cursor results because the adapter
stores recorded Insert changes separately from its printable register text.
Recursive macros remain optional explanatory material and are not part of the
supported progression.

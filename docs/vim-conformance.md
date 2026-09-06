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
other formats can depend on Vim's `nrformats` option. Counted Insert commands
are exposed for `{count}i`, `{count}a`, and `{count}o`, where the adapter applies
the repetition when Insert mode ends, exactly as Vim does. `{count}O` is not
exposed: the adapter interlaces the repeated opens but leaves the cursor on the
first new line where Vim leaves it on the last.

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
tags, comments, and ambiguous angle brackets. Tag and paragraph objects run on
buffers taller than their fixed window so the matching close lies off screen;
`it` with a text-changing operator resolves that range exactly, including
collapsing a multi-row element onto one line. Two tag behaviors remain outside
the contract and are not authored: a tag-object yank whose range begins before
the cursor does not move the cursor to the range start, and `at` over an element
spanning whole lines leaves the leading indentation as a residual line instead
of removing the emptied rows. The pinned adapter also omitted
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

Unit 7 also teaches the two families session 01 verified for it. Visual Block
`$` releases the block's right edge so `A` appends after each line's own last
character and `d` removes each line's tail; the unit contrasts it directly with
a fixed-column `A` on the same ragged buffer, which is the result
`visual-block-fixed-column-append-ragged` pins. `Ctrl-a` and `g Ctrl-a` over a
selection add to the first number on every selected line, uniformly or
cumulatively. The governing fixtures are `visual-block-dollar-append-ragged`,
`visual-block-dollar-delete-ragged`, `visual-increment-uniform`, and
`visual-increment-sequence`; no further patch was needed to author them.

Two reporting conventions differ between the tiers wherever these lessons place
an intermediate checkpoint, and both predate this material. A Visual Block `$`
cursor sits one column past the last character, which is the column the authored
checkpoints record. A Visual Line head is reported by native Vim at the logical
cursor column and by the browser at the end of the last selected line, so the
authored checkpoint and the browser assertion for the same step legitimately
name different columns and the same row.

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
Inspection content therefore never seeds a register by recording: Vim writes
K_SPECIAL prefixes into a recorded register, and while `getreg` readouts hide
them, `"ap` puts those raw bytes into the buffer. Unit 13 keeps macro text as
buffer text and loads it with `"ay$`, which is the verified round trip.
Recursive macros remain optional explanatory material and are not part of the
supported progression.

## Session 01 — engine conformance spike

Session 01 verified the command families that the curriculum review proposes
before any of them is authored into a lesson. Its fixtures live in
`conformanceFixtures` in `tests/vim-fixtures.mjs` and run on both tiers:
`tests/native-vim.test.mjs` asserts them against real Vim, and
`tests/editor-conformance.spec.js` replays the identical fixtures through the
browser engine. A fixture that records an accepted divergence carries a
`browserVerdict` holding what the engine actually does, so a future adapter
version that closes the gap fails the test instead of passing silently.

`:global`, `:copy`/`:t`, `:move`/`:m`, `:put`, and `:sort` are interpreted by
`vim-engine.js`, not by the adapter — `executeEx` tries the app's own parsers
before falling through to `Vim.handleEx`. `executeGlobalOperation` previously
recognized only nested `delete`, `normal`, and `substitute` and silently
discarded anything else, so `:g/pat/t$` was inert. It now dispatches nested
`copy`/`move` through Vim's actual two-phase rule: every matching line is marked
first, then the command runs on each mark in turn while the remaining marks are
tracked across the edits. The order reversal of `:g/pat/m0` is a consequence of
that ordering rather than a special case, and the whole run lands in one
transaction so a single `u` undoes it. Destination addresses are parsed with the
existing Ex address parser, so any `{addr}` works, not only the three forms the
lessons teach.

The Ex and search command lines accept `Ctrl-r{register}`, which
`vim-engine.js` owns because the app owns the command-line text. Linewise
register contents lose their trailing newline when inserted this way.

`:sort` flags are owned by `vim-engine.js` for the same reason plain `:sort`
already was: the adapter sorts the right lines but leaves the cursor where it
started, while Vim moves it to the first sorted line. Session 01 verified the
flags only through `:%sort`, which sorts from line 1 and hides that difference.
The engine now parses `[flags] [/pattern/]` itself and declines anything outside
`n`, `u`, `i`, and a pattern, so an unmodelled flag still delegates rather than
sorting on a guess. `sort-numeric-flag-in-range` and its neighbours pin the
cursor against a range that starts lower down.

One divergence was the app's, not the adapter's. The document key handler
interprets a physical keydown and stops it before the adapter's prompt input
sees it, but the matching keyup still arrived there, and the adapter re-parses
its prompt on every keyup. For a `:s` command that reparse writes the
half-typed pattern into `"/`, so physically typing `:%s/` cleared the pattern
that `Ctrl-r/` was about to insert — while touch input, which produces no
keyup, worked. The handler now suppresses keyup for the same keys it already
owns, gated on `VimEngine.ownsPrompt()`.

A second divergence was also the app's. This bridge owns the text of an open
prompt, so the adapter never saw Escape close one and never ran its own abort
handler. The buffer and cursor were right, but `inputState.operator` stayed
armed: after `d` `/pat` `Escape` the mode still read `operator-pending`, and the
next key was silently consumed as the delete's range — `w` deleted a word and
`x` deleted the line. `VimEngine.abortCommandLine()` now replays Escape on the
adapter's own prompt input, which restores the previous query and highlight and
clears the input state, the same way the confirming Enter is already replayed.
Fixture: `escape-cancels-operator-pending-search`.

The last-search register needed a sixth patch hunk once Unit 8 started asserting
`"/`. The adapter encodes a substitution's flags into the query string it hands
to `parseQuery`, and `parseQuery` writes that string straight into `"/`, so
`:%s/draft/entry/g` left `draft/g` where Vim leaves `draft`. The behaviour built
on the query was already right — `n` and the highlight both parsed the suffix
back off — so only the register was wrong, which is exactly what a lesson about
reusing `"/` would have taught incorrectly. `substitute` now restores the bare
pattern after installing the query. Fixture:
`substitute-leaves-bare-pattern-in-search-register`.

Verified: `:g` with `:t`/`:m`; `:sort n`, `:sort u`, `:sort i`, and `:sort /pat/`;
the read-only registers `".`, `":`, and `"/`; Insert-mode `Ctrl-r{register}`,
`Ctrl-o`, `Ctrl-w`, and `Ctrl-u`; command-line `Ctrl-r{register}`; search as an
operator range (`d/pat`, `y/pat`, `c/pat`, `c?pat`) with Vim's exclusive match
boundary;
Visual Block `$` with `A`, `I`, and `d`; and `Ctrl-a`, `Ctrl-x`, `g Ctrl-a`, and
`g Ctrl-x` over a Visual selection. Five of these needed a versioned adapter
patch; see `patches/README.md`.

Four candidates are deliberately dropped, each with a fixture recording the
divergence:

- **Search offsets** (`/pat/e`, `/pat/+1`). The adapter reads everything after
  an unescaped `/` as search flags and understands only `i`, so an offset is
  discarded and the search silently succeeds at the wrong position. Honoring
  offsets means changing query parsing, the search motion, and its
  operator-pending inclusivity together. Search as an operator range is verified
  without them.
- **The `"%` register.** It is not one of the adapter's valid registers, and Vim
  Wilds has no file name to report. Real Vim returns an empty string here too.
- **`:global` dry runs** (`:g/pat/p`, `:g/pat/nu`). Vim leaves the buffer alone,
  prints the matched lines, and moves the cursor to the last match. Vim Wilds
  had no Ex output surface and the adapter has no `:print` or `:number` command
  to delegate to, so the command was inert. Giving `:global` a preview is a
  product change, not a conformance fix — **session 19 made that change, and
  this family is now verified.**
- **The cursor after a confirmed substitution.** Vim leaves the cursor at the
  start of the last line a `c`-flag run changed; the adapter leaves it wherever
  the first prompt appeared. The two agree only when the run changes one line
  whose first match is at column 0, which is why every existing confirm fixture
  passed. Correcting it means reaching into the adapter's prompt loop rather
  than its command parsing. Unit 12 keeps its confirm exercises on the shape
  where the two agree, and
  `substitute-confirm-accept-all-lands-on-the-last-changed-line` records the
  divergence with a `browserVerdict` so it cannot widen unnoticed.

Known debt: `AGENTS.md` states that the adapter owns Vim command interpretation,
yet `vim-engine.js` implements `:t`, `:m`, `:put`, `:sort`, and `:global`
itself. The cleaner arrangement is to register those as adapter Ex commands with
`Vim.defineEx` and let the adapter's own `:global`, which already tracks line
handles, compose them. That re-routes code every verified Unit 11 fixture
depends on, so it was left alone here.

## Session 19 — an Ex output surface

Session 01 dropped `:g/pat/p` and `:g/pat/nu` for a product reason rather than a
conformance one: Vim prints the matched lines, and there was nowhere to print.
Session 19 built that surface and lifted the drop.

The surface is Vim's own message screen, not a listing pane. A pane beside or
below the code slab would cost one row per matched line, and the longest listing
the curriculum can produce is nine — which is more rows than a 360×740 phone has
in total. Real Vim does not reserve space for `:p` output either: it paints over
the buffer and waits for a key. The overlay is absolutely positioned inside the
world, hidden by `visibility` rather than `display`, and dismissed by any key,
so the layout with it closed is the layout without it. It is announced through
the same `role="status"` live region the impact readout uses.

`executeGlobalOperation` now dispatches a nested `print`/`number` branch beside
`delete`, `normal`, `substitute` and the session 01 `copy`/`move` relocation. It
edits nothing and moves the cursor to the last line it printed, which is what
makes the native cursor result reachable and why the fixture's `browserVerdict`
is gone. `:print` is Vim's default Ex command, so an empty or absent nested
command prints: `parseGlobalOperation` no longer requires a closing delimiter,
and `:g/pat`, `:g/pat/` and `:g/pat/p` are one behaviour. Fixtures:
`global-print-previews-matches`, `global-number-previews-matches-with-line-numbers`,
`global-bare-pattern-defaults-to-print`, and
`global-invert-previews-unmatched-lines`.

`:p` and `:nu` are exposed outside `:global` too, through `parseLineOperation`
and the existing Ex address parser — supporting them only inside `:g` would be a
divergence a learner can trip on. Vim's trailing print flags (`l`, `#`, `p`) are
not modelled, so an argument declines and delegates rather than printing on a
guess. Fixtures: `print-range-lists-addressed-lines` and
`print-without-a-range-lists-the-current-line`.

The output is held on the snapshot as `lastExOutput`, with the same lifecycle as
`lastImpact`: set on execution, retired at the top of `sendKey` before the next
key runs. It is stored semantically, as buffer line number plus text, so the app
owns presentation and no test depends on Vim's column padding.

Verifying the printed text needed a new channel out of headless Vim. The native
runner exports state by writing a JSON blob from inside Vim, and `-es` discards
the message area entirely, so `global-print-previews-matches` had only ever
proved "buffer unchanged, cursor on last match". The runner now wraps the fixture
keys in `redir`, in a `try`/`finally` so the redirect closes even when a
fixture's own keys raise, and exports the captured messages. The capture is
opt-in — only a fixture declaring `targetExOutput` pays for it — so the authored
content replays that share the runner are untouched. Two formatting details are
measured rather than assumed, and `formatNativeExOutput` in
`tests/vim-fixtures.mjs` is the single place both tiers agree on them: `:number`
right-aligns in a minimum-width-three field followed by a space, and an empty
buffer line prints as a single space rather than as nothing. `redir` emits each
message as a leading newline plus its text, so the interior empties the split
leaves behind are dropped — lossless, precisely because Vim never prints an
empty message.

Known gap, unchanged by this session: `@:` calls `Vim.handleEx` directly instead
of going through `executeEx`, so replaying a print through it produces no
output. The same is already true of `:t`, `:m`, `:put` and `:sort`, and the fix
is the `Vim.defineEx` re-routing recorded as debt above.

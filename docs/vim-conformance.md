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

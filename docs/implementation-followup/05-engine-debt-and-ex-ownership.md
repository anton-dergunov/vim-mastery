# Session 05 — Engine debt and Ex ownership

**Size:** M. **Depends on:** nothing.

## Why

`AGENTS.md` states a clear rule:

> CodeMirror 6 renders the editor and `@replit/codemirror-vim` owns Vim command
> interpretation. Do not recreate Vim command semantics in lesson code.

`vim-engine.js` does not follow it. It implements `:t`, `:m`, `:put`, `:sort`
and `:global` itself — `executeGlobalOperation` (line 1130),
`executeNormalOperation`, `executeLineOperation` and `parseLineOperation`
(line 293) — falling through to `Vim.handleEx` only for commands it does not
recognise (line 1031). Session 01 saw this, priced the fix, and declined it:
re-registering those commands through `Vim.defineEx` would re-route code that
every verified command-line-range fixture depends on. `docs/vim-conformance.md`
records it as "Known debt."

That is a defensible engineering decision. What is not defensible is the current
state: **a rule in `AGENTS.md` that the code contradicts, and a user-visible
consequence nobody has pinned.**

The consequence: `@:` replays the last Ex command by calling
`Vim.handleEx(this.cm, this.lastExCommand)` at `vim-engine.js:866` — bypassing
`executeEx` (line 1023), which is where the app's own `:t`, `:m`, `:put`,
`:sort` and `:global` implementations live, along with Ex output reporting, the
substitution report, and the match-pattern retire. So **`@:` silently does
nothing useful for exactly the commands the app implements itself**, and prints
nothing when replaying a `:g/pat/p`. Unit 8 teaches `":` as a register and its
reference note says "`":` is what Unit 11's `@:` replaces" — the two are taught
as equivalent and are not.

## Scope

Two options, priced very differently. **Do the first. Do the second only if it
turns out to be easy, which session 01's evidence says it will not be.**

### Option A (recommended) — route `@:` through `executeEx`, then write the exception down

The fix at `vim-engine.js:866` looks like one line: call `this.executeEx(...)`
instead of `Vim.handleEx(this.cm, ...)`. Treat that as the starting point, not
the answer. Check each of these before believing it:

- **Reentrancy.** `executeEx` captures `before` and calls `reportBufferChange`.
  Confirm a replay reports its own change once, not twice, and that the impact
  readout says the right thing.
- **`lastExCommand` capture.** Confirm replaying does not overwrite the register
  it is replaying from, and that `@:` twice in a row still replays the original
  command.
- **The cursor move.** Both paths call `moveCursorToFirstNonBlank()`. Confirm the
  replay lands where native Vim lands, with a fixture — this is exactly the kind
  of divergence the conformance tiers exist to catch.
- **`:nohlsearch` and the match map.** `executeEx` retires the live pattern;
  `Vim.handleEx` does not. Replaying `:nohlsearch` through `@:` will now clear
  the match map. That is correct, and it is a behavior change.

Then **amend `AGENTS.md`** so the stated rule matches the code. The honest
version is narrower than the current one: the adapter owns Normal-mode and
motion semantics; the app owns a named, closed set of Ex commands, and adding to
that set needs both conformance tiers. Record the same in
`docs/vim-conformance.md` where the debt note currently sits, replacing "left
alone here" with the decision and its reason.

**Add a fixture either way.** Whatever `@:` does after this session, pin it:
either `@:` replaying a `:g/pat/p` produces the same Ex output as running it
directly, or it demonstrably does not and the limitation cannot regress into
something worse. `tests/vim-fixtures.mjs` has the `formatNativeExOutput` helper
(line 183) and five Ex-output fixtures to copy from.

### Option B — the full `Vim.defineEx` re-route

Register `:t`, `:m`, `:put`, `:sort` and `:global` as adapter Ex commands and
let the adapter's own `:global`, which already tracks line handles, compose
them. This is the arrangement `AGENTS.md` describes and the reason the rule was
written.

**Only take this on if the fixtures come along quietly.** Every verified
command-line-range fixture runs through the current code path, and the native
tier is the thing that makes this product's correctness claim true. If the
re-route means adjusting fixtures to match the adapter rather than native Vim,
stop and take Option A — a green test suite that agrees with the adapter instead
of with Vim is a loss, not a win.

## Out of scope

- The substitute-confirm cursor divergence. It is an accepted divergence,
  recorded with a `browserVerdict` on
  `substitute-confirm-accept-all-lands-on-the-last-changed-line`, and correcting
  it means reaching into the adapter's prompt loop. Leave it.
- Search offsets on Ex addresses (`:/pat/+1d`). Different parser, out of scope
  by design.
- Any new Ex command. This session moves or documents what exists.
- Content. If `@:` starts working properly, a lesson could be written about it —
  that is a separate content session, and Unit 8's reference note is the only
  copy that needs a second look here.

## Validation

- `node --check vim-engine.js`, `git diff --check`.
- `npm test` — in particular `npm run test:native`, which replays every fixture
  against real Vim. Nothing in the existing 55+ fixtures may change verdict.
- `npm run test:targeted -- tests/editor-conformance.spec.js --grep "Ex output"`
  at one worker.
- Exercise `@:` by hand after each of `:t`, `:m`, `:put`, `:sort`, `:global`,
  `:g/pat/p`, `:s`, and `:nohlsearch`, and compare against real Vim rather than
  against expectation.
- Replay Unit 8's `rerun-last-ex-command` and Unit 11's `@:` material, and
  confirm every checkpoint still holds.
- If `AGENTS.md` changed: re-read it end to end and confirm no other rule now
  contradicts the code. A stale invariant is the problem this session exists to
  remove, not to relocate.

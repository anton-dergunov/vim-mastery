# Session 22 — The file-name register `"%`

**Depends on:** 01 · **Blocks:** 08, 11 (both teach it once it exists)
**Touches:** `content/unit-content.schema.json`, `vim-engine.js`, `app.js`,
`styles.css`, `tests/native-vim-runner.mjs`, `tests/vim-fixtures.mjs`,
`tests/editor-conformance.spec.js`, `supported-commands.json`,
`docs/vim-conformance.md`
**Size:** M

## Context

`"%` holds the current file's name. It is how you write `:!node <C-r>%`,
`:e <C-r>%`, or drop a path into a comment with `"%p`. It is a real habit for
anyone who lives in a terminal, and unknown to plenty of otherwise fluent users —
roughly Tier 2 value: below `"0` and `"/`, above `"1`–`"9`.

Session 01 dropped it, and `docs/vim-conformance.md` records the reason: it is
not one of the adapter's valid registers, and *"Vim Wilds has no file name to
report. Real Vim returns an empty string here too."*

The second half of that is true and is also the thing to fix. An exercise already
declares a `languageId`; declaring `fileName: "main.py"` alongside it is not
inventing a fiction, it is finishing a description that was always half-written.
A buffer with a name is more realistic than one without, not less.

Both ends can be made honest, which was checked before scoping this:

- **Browser.** The adapter exports `Vim.defineRegister(name, register)`, which
  pushes the name onto its `validRegisters` list. That is the single hook needed
  to make `%` legal for `"%p`, Insert-mode `Ctrl-r%`, and the Ex command-line
  `Ctrl-r` path that `vim-engine.js` already implements itself.
- **Native.** `tests/native-vim-runner.mjs` starts Vim on an *unnamed* buffer via
  `setline()`, which is precisely why `%` came back empty when session 01 probed
  it. Adding `execute "file " . fnameescape(name)` to the generated script names
  the buffer without touching disk, so a fixture can assert `main.py` against
  real Vim.

## Goal

Make `"%` report something true, and let Units 3 and 8 teach it with the other
read-only registers.

## Scope

### 1. Schema

An optional `fileName` on the runnable activity, beside `languageId`. Constrain
it to a plain relative name — no directories, no traversal — with an extension
consistent with the declared language, and enforce that consistency in a test
rather than in prose. Absent means an unnamed buffer, which every existing
activity keeps.

### 2. Engine

Define `%` once at `VimEngine` construction as a read-only register whose text is
the active activity's `fileName`, empty when absent. Writes to it are ignored, as
in Vim. Follow the `lastImpact` precedent from session 02 for how per-activity
state reaches the engine.

### 3. Surfacing — the part that decides whether this teaches anything

A learner must be able to see the name, or `"%p` pastes `main.py` out of nowhere
and the exercise teaches a magic trick. Render it as a small label positioned
inside the code slab, using the same absolute-positioning trick `.buffer-position`
already uses, so it **costs no code row**. Visible rows are the scarcest resource
on the page and this must not spend one.

If it cannot be made legible at 360×740 without taking a row, fall back to naming
the file in the activity instruction, and record that decision here rather than
shipping an unreadable label.

### 4. Conformance

Native fixtures for `"%p`, Insert-mode `Ctrl-r%`, and Ex-line `Ctrl-r%`, plus
browser conformance cases for each. Move `"%` from `dropped` to `verified` in
`supported-commands.json` and rewrite its paragraph in `docs/vim-conformance.md`.

### 5. Content follow-up

Sessions 08 and 11 currently say `"%` is dropped and teach three read-only
registers instead of four. Once this lands, both teach four, and session 08's
`:%s/‹Ctrl-r›//new/g` payoff gains a natural sibling in `:!node ‹Ctrl-r›%`.
Update both briefs to depend on this one.

## Out of scope

- Paths, directories, or `%:h`/`%:t` filename modifiers — a different parser and
  a much longer tail.
- `:w`, `:e`, or anything that implies the file exists. The name is a label, not
  a filesystem.
- Naming every existing activity. Add `fileName` where it teaches something;
  leave the rest unnamed.

## Acceptance criteria

- `"%p`, `Ctrl-r%` in Insert mode, and `Ctrl-r%` on the Ex line all report the
  authored file name and match native Vim for the fixtures.
- An activity without `fileName` behaves exactly as it does today.
- The name is visible to the learner and costs no code row.
- `supported-commands.json` lists `"%` under `verified`.
- Free Practice (session 15) names its sample buffers, so `"%` works there too.

## Validation

```bash
node --check app.js && node --check vim-engine.js && git diff --check
npm test
npm run test:targeted -- tests/editor-conformance.spec.js --workers=1 --grep "register|file name"
```

`defineRegister` mutates adapter-global state, so confirm that `resetVimEngineState`
leaves no stale register between activities, and that an activity without a
`fileName` reports an empty `%` rather than the previous activity's name.

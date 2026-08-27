# Session 19 — An Ex output surface for `:global` dry runs

**Depends on:** 01 (which dropped the commands and recorded why), 02 (impact
readout and match map, whose patterns this follows)
**Blocks:** a `:g/pat/p` dry-run beat in Unit 14 · **Touches:** `vim-engine.js`,
`app.js`, `index.html`, `styles.css`, `tests/vim-fixtures.mjs`,
`tests/editor-conformance.spec.js`, `supported-commands.json`,
`docs/vim-conformance.md`
**Size:** M

## Context

Vim's own `:global` dry run is `:g/pat/p` — or bare `:g/pat`, since `:print` is
the default command. It lists every matching line so you can confirm the
predicate before giving it something destructive. `:g/pat/nu` prints the same
list with line numbers.

Session 01 dropped both, for two reasons recorded in `supported-commands.json`:

> dropped: :global dry runs (:g/pat/p, :g/pat/nu). Vim prints the matched lines;
> Vim Wilds has no Ex output surface and the adapter has no :print or :number
> command to delegate to.

Session 03 therefore taught the habit with the two mechanisms that do exist: a
confirmed search, which lights every matching line on the position rail
including the off-screen ones, and `:%s/pat/pat/gn`, which counts without
editing. That is a good substitute on a phone — it shows *where*, not just how
many — but it is a substitute. A learner who reaches for `:g/pat/p` at a real
terminal should have met it here.

## Goal

Give Vim Wilds a place to print Ex output, then expose `:print` and `:number`
inside `:global`, without spending a single code row.

## Scope

### 1. A transient overlay, not a listing pane

The obvious design — a pane beside or below the code slab listing the matched
lines — is wrong. Five to nine matched lines cost five to nine rows on a 360px
phone. That breaks design constraint 3 in [README.md](README.md) ("visible lines
are scarce and stay scarce") and Unit 14's own acceptance criterion.

Real Vim does not reserve space for `:p` output either. It paints over the
buffer and waits for `Press ENTER or type command to continue`. Match that:

- A transient overlay above the world art and the code slab, dismissed by any
  key, exactly as Vim's message screen is.
- Reuse the existing help and reward overlay infrastructure in `index.html` and
  `styles.css` rather than adding a third overlay mechanism.
- Scrollable inside itself when the list is longer than the overlay, with no
  document scrolling and no horizontal overflow.
- Announce it to screen readers, matching the impact readout's pattern.
- Zero permanent rows. The layout with the overlay closed must be byte-identical
  to the layout today.

### 2. Engine support for `:print` and `:number`

Follow the `lastImpact` precedent from session 02 exactly.

- `executeEx` in `vim-engine.js` is already the single funnel and already tries
  the app's own parsers before `Vim.handleEx`.
- `executeGlobalOperation` already dispatches nested `delete`, `normal`,
  `substitute`, and the session 01 `copy`/`move` relocation branch. Add a
  `print`/`number` branch that collects the matched lines rather than editing.
- Expose the collected lines as `lastExOutput` on the snapshot, with the same
  lifecycle as `lastImpact`: set on execution, retired by the next key.
- Bare `:g/pat` must behave as `:g/pat/p`, because that is the form people
  actually type.
- `:p` and `:nu` outside `:global` should print the addressed lines too;
  supporting them only inside `:g` would be a divergence a learner can trip on.

### 3. Conformance

- Native fixtures in `tests/vim-fixtures.mjs`. `global-print-previews-matches`
  already exists there, carrying `browserVerdict: { targetCursor: [0, 0] }` and
  a DROPPED comment block — reuse it and remove the comment.
- Browser conformance case in `tests/editor-conformance.spec.js`, comparing the
  collected output against the native fixture's printed lines.
- Move `:global` dry runs from `pending` to `verified` in
  `supported-commands.json` and record the session in
  `docs/vim-conformance.md`.

### 4. Content follow-up (not this session)

Once verified, Unit 14's `global-delete` lesson can carry `:g/DEBUG/p` as its
preview step instead of, or alongside, the search-first demo, and the theory can
name the idiom a learner will meet in real Vim. That is content authoring and
belongs in its own pass.

## Out of scope

- Any Unit 14 content change.
- A general Vim message line. This session prints Ex output; it does not
  reimplement `:messages`, error reporting, or `'report'`.
- Search offsets and the other session 01 drops. They failed for unrelated
  reasons.

## Acceptance criteria

- `:g/pat/p`, `:g/pat/nu`, and bare `:g/pat` list the matching lines, matching
  native Vim for the fixture.
- The overlay costs no code rows: the closed layout is unchanged at 360×740.
- The overlay is dismissed by any key and is screen-reader announced.
- `supported-commands.json` lists `:global` dry runs under `verified`.
- No existing activity changes behavior.

## Validation

```bash
node --check app.js && git diff --check
npm test
npm run test:targeted -- tests/editor-conformance.spec.js --grep "print|dry run" # one worker
```

Inspect 360×740, 390×844, 412×915, 430×932, and 432×960 with the overlay open
over a 20-line buffer with nine matches — the longest list the curriculum can
produce — and confirm no clipping, document scrolling, or horizontal overflow.

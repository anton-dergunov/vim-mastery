# Continue the shortest-route audit

**Size:** L. **Depends on:** `docs/plans/shortest-canonical-audit.md` (first pass
done, see "State at handoff"). Run this in a cloud session that has room for long
browser runs.

## State at handoff

What the first pass built:

- **The solver.** `scripts/route-audit/` holds it (`npm run audit:routes`):
  - `grammar.mjs` parses traces into taught atoms.
  - `taught.mjs` works out what is taught at each point in the course.
  - `actions.mjs` holds the action grammar and its gating.
  - `search.mjs` runs the bounded A* search, with the edit budget, the
    distance rule, and the final-edit bound.
  - `page-runner.js` replays paths in the app's own editor markup, reusing
    one editor per exercise and checking the reset against fresh editors.
  - `audit.mjs` runs the audit, confirms every route in native Vim, and keeps
    a trace cache.
  - `report.mjs` writes the report.
  - `rebuild.mjs` recomputes an exercise's target and checkpoints from
    native Vim after a buffer change.
- **Shared target check.** `src/lesson/target.js` (`matchesTarget`) is shared
  by the lesson and the audit.
- **The rule.** It is written into `docs/lesson-content-design.md` ("The taught
  route is the shortest") and `docs/curriculum-and-progression.md`.
- **The note field.** `verification.routeNote` is in the schema, with a test.
- **The two bugs from feedback `58cb0446`.**
  - `change-after-colon` is re-authored as `T:D` (3 keys, `none-shorter`).
  - The old version is flagged with `W C ready <Esc>`.
- **Triage of all 98 flags** (82 `shorter`, 16 `trivial`). Buffers were
  re-authored in units 3–9 and 14–16. Where the target can't record the lesson,
  the exercise got a `routeNote` (49 are now `justified`).

Report at handoff (`scripts/route-audit/report.json` and `report.md`):

| Verdict | Exercises |
| --- | --- |
| none-shorter | 154 |
| justified | 49 |
| inconclusive | 259 |
| engine-mismatch | 2 |
| shorter | 0 |
| trivial | 0 |

**Caveat:** the report was built over several runs while the grammar changed
(the off-screen `{n}G` rule, jumps, `@:`, and canonical register prefixes came
late). The final consistency pass over all units was interrupted, so step 1
below comes first.

Verified at handoff:

- `npm test` passed.
- Content tests: 671 passing.
- Targeted Playwright, all passing:
  - "runs every Unit" (14)
  - Unit 7 challenge checkpoints, reworked Unit 7 phone viewports, completes
    every guided and recall practice, Unit 4 operator state, quote and tag
    objects, Unit 9 reset, change-list movements, shifted Unit 6 objects
  - `vim-effects.spec.js`
- A phone-viewport sweep of 14 changed exercises at the five target sizes.
  There is no page overflow. The two `textWidth: 40` reflow exercises clip
  38–40-column lines; this was already true of `format-counted-lines`.

Not verified after the last edits:

- `delete-around-tag`'s `initial.viewport` was corrected to `{0,5}` (its buffer
  is now 6 rows), and tests in `tests/editor-conformance.spec.js` were updated
  (the `dat` case and two Unit 7 checkpoint cases). Re-run the content suite
  and those specs.

## Environment setup (cloud)

1. Run `npm ci`. `postinstall` applies `patches/`, and the patched adapter is
   required.
2. Native Vim 9.x must be on PATH (`vim --version`); install it
   (`apt-get install -y vim`) if missing. Every content test and every route
   confirmation shells out to it.
3. Browsers: off macOS, `playwright.config.js` and `audit.mjs` use Playwright's
   own Chromium, so run `npx playwright install --with-deps chromium`. The
   audit's macOS fallback (`chromium.launch()`) needs the build that matches
   the installed `@playwright/test`.
4. Keep AGENTS.md's browser hygiene. Run one browser command at a time in the
   foreground. The audit spawns its own Vite on port 4177 and closes it on
   exit or signal. After each run, confirm that no `node_modules/.bin/vite`
   or Playwright process is left.
5. Run the audit in chunks that fit the tool timeout. It merges results into
   the report with `--update`. Use `--unit`, `--offset`/`--limit`,
   `--activity a,b,c`, `--verdict inconclusive`, `--phase challenge`, `--pages N`
   (6 worked on 8 cores), `--seconds`, and `--budget`. The trace cache lives in
   `node_modules/.cache/route-audit/`, keyed by content and the audit's own
   sources.

## Steps

### 1. Consistency pass

Re-run every unit with the final grammar:

```
--pages 6 --seconds 45 --budget 200000 --update
```

Split units 7, 8, 16 and any slow unit with `--offset`/`--limit`. Then:

- Confirm there are no `RESET MISMATCH` lines and no `host-mismatch` verdicts.
  A reset mismatch means the reused editor diverged from a fresh one. Fix
  `resetEngine` in `page-runner.js` before trusting any results.
- Fix anything newly flagged, as in step 3.

### 2. Shrink the inconclusive set (259)

Priority order: unit 11 onward, then challenges.

A 120 s budget did not convert unit 11. Budget alone won't do it; the search
needs to get faster or its space needs to get smaller:

- Share prefixes: replay a parent once and fork its children. Options are
  restoring the CodeMirror state with `view.setState` plus a copy of the
  adapter's vim state, or grouping children by parent so each parent is
  replayed once per batch.
- Measure `VimEngine.sendKey`. It builds 2–3 full snapshots per key even with
  effects off. An audit-only lightweight path that doesn't change app
  behaviour would help, and the snapshot should stay the app's.
- Tighten the heuristics for multi-edit canonicals: per-line diffs, and edits
  that must touch the changed region.
- Record `reachedCost` progress in `report.md` for each inconclusive exercise.

Any route found must still pass both the fresh-editor check and native Vim.

### 3. Fix new flags

Use `scripts/route-audit/rebuild.mjs` via a job list: the new `lines`,
`cursor`, `steps`, `commandGroups` and `registers`. It recomputes the target
and checkpoints, and skips mid-Insert and command-line boundaries. At Visual
boundaries it records Visual modes with the native cursor.

Rules learned in the first pass:

- **Yank objects.** Start yank-object drills on the object's first character.
  The adapter doesn't move the cursor to the range start the way Vim does,
  and this applies to quotes and brackets, not just tags.
- **Line width.** Keep lines ≤30 columns in `viewportRows` exercises
  (enforced by a test). Keep them around 33 or less elsewhere.
- **Snapshot counts.** Tests assert some exact counts: languages per Unit 7
  challenge set (6), and growing buffers (now 35). Keep them true or update
  them deliberately.
- **Hardcoded expectations.** Browser specs hardcode some exercises
  (`smoke.spec.js` `repeat-separator-edit`, the Unit 7 checkpoint table, the
  `dat` case). Grep `tests/` for every edited id.
- **Visual Line checkpoints.** Native Vim reports column 0, and the app
  reports the line-end head. The content keeps native values; the spec
  tables keep the app's values.

### 4. Review the 49 notes (needs Anton's judgment)

List them from `report.md` ("Justified"). They fall into these groups:

- **Landmark tours.** Unit 2 (11), several in unit 5, `change-list-newer-mix`.
- **Undo and redo walks.**
- **Ex report and confirm-prompt exercises.**
- **`gv` reselection.**
- **Repeat drills that ask for the repetition.**
- **Unit 7 Visual isolate and mix drills.** The operator-and-motion form is
  shorter.
- **Whole-word search drills.** A line motion or a unique prefix is shorter.
- **Search-offset introductions.**
- **`current-range-join`, `indent-the-body`, `explicit-unnamed-put`,
  `previous-context-exact-challenge`.**
- **Three yank drills** whose note cites the adapter limit.

For each group, propose either a re-author where the taught command genuinely
wins, or keeping the note. The Unit 7 challenge `selection-reindent-code-challenge`
(now `V jjjj >` on a SQL column list) is the model: the win comes from a range
you'd otherwise have to count.

### 5. Conformance findings to fixture

For each, add a native fixture and a browser fixture to
`tests/vim-fixtures.mjs`, then decide whether to patch the adapter or record it
in `docs/vim-conformance.md`.

- **Object yanks and the cursor.** `ya'` (and bracket-object yanks) leave the
  cursor in place. Vim moves it to the start of the range. The doc lists this
  only for tags.
- **`*` on punctuation.** The adapter escapes `)` as `\)`, which is a group in
  Vim regex (`nopcre`), so the search fails. Vim searches the non-blank word.
- **`)` next to a closing brace.** `y)` inside `{one: 1}` is accepted by the
  adapter and differs from Vim (`inside-open-brace` and `inside-big-b-alias`
  are `engine-mismatch`).
- **`=` on hand-aligned continuation lines.** Browser JavaScript indentation
  keeps alignment that Vim's C indenting changes.

### 6. Solver limits to lift (optional)

The search doesn't yet try:

- Visual selections with several motions;
- macros, marks, undo, Replace mode, Insert-mode controls;
- search prefixes longer than 3 letters.

Settle whether "type a unique prefix" counts as taught before offering longer
prefixes: whole-word search drills lose to prefixes otherwise.

## Checks before handoff

- `node --check` on every changed JS file, and `git diff --check`.
- `npm test`.
- `node --test tests/content-data.test.mjs` after every content batch.
- `npm run test:full`, which the user asked for in the cloud run.
  Alternatively, run `tests/editor-conformance.spec.js` in full plus
  `smoke.spec.js` and `vim-effects.spec.js`.
- **Changed canonicals.** For every exercise whose canonical changed, run
  `solveCurrent` in the app and confirm the exact target, success state,
  mode, cursor, and checkpoints. Run the recall twin as well.
- **Touch and physical input.** Exercise each changed canonical with touch
  and physical keys, covering Shift, Ctrl-v and punctuation.
- **Phone sizes.** Sweep every changed exercise at 360×740, 390×844, 412×915,
  430×932, and 432×960, before and after solving. Check for no hidden rows,
  no line past the scroller's right edge, and no document overflow.
- **Audit health.** Re-audit every changed exercise, and confirm there are no
  `shorter`, `trivial`, `host-mismatch` or `RESET MISMATCH` results.
- **Report.** Commit `report.json` and `report.md`. Check that neither
  contains a private path.

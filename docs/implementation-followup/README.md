# Follow-up plan — after the curriculum review

The 25-session plan that executed
[../curriculum-review-automation-focus.md](../curriculum-review-automation-focus.md)
is closed. Every brief in it was audited against the repository and every one
was substantively implemented; the briefs themselves have been deleted, and
this directory replaces them.

Two things live here:

1. **The audit result** — what each of the 25 sessions actually left behind.
2. **Seven follow-up briefs** for the residue, plus the invariants and settled
   decisions that used to live only inside the deleted files.

Each numbered file is a **self-contained task brief for one coding session**.
Hand one to a coding agent as the task description. It should not need any
other document to act.

## Audit result

Audited September 2026, statically, against `content/`, `app.js`,
`vim-engine.js`, `play/index.html`, `styles.css`, `tests/`, `scripts/`,
`worker/`, and `assets/`.

**All 25 sessions: DONE.** The old `Progress` checklist was stale and
contradicted its own prose — it left 11 finished sessions unchecked. Do not
resurrect it from git history to plan work.

| # | Session | Residue found |
| --- | --- | --- |
| 01 | Engine conformance spike | Substitute-confirm cursor divergence still an accepted drop; the `Vim.defineEx` re-route debt is unpaid → brief 05 |
| 02 | Scale mechanics | Desktop editor enlargement deliberately never attempted, only made safe to attempt |
| 03 | Unit 15 scale and the `:global` family | The `:g/pat/p` beat was never added back after session 19 lifted the drop → brief 02; match non-adjacency holds but no test guards it → brief 03 |
| 04 | Unit 14 macro rework | None. Thoroughly test-guarded |
| 05 | Units 12–13 scale and sort flags | None |
| 06 | Tool-choice activities across Arc 3 | 5 choices per Arc 3 unit hold in content, but no test guards the count → brief 03 |
| 07 | Unit 9 split, mark, and narrow | None |
| 08 | Unit 8 register rebalance | The lesson split that resolved a contradictory scope item was recorded only in commit `45ab7dc`; `track` values are browser-tested, not content-tested |
| 09 | Unit 7 visual selection repair | Two sanctioned demo→mix canonical repeats; the brief's literal "no duplicate canonicals" was narrowed to "no two exercises share one, and a challenge never replays its demo" |
| 10 | Foundations marking and de-duplication | Two canonical collisions permanently exempt by decision; `{count}O` not taught because the adapter's cursor disagrees |
| 11 | Insert-mode command keys | Mid-insert checkpoints omit `mode`, so demo playback cannot slow at those steps. Accepted cost |
| 12 | Search as an operator range | The offset beat was deferred to session 21, which then declared content out of scope. Never authored, and shipped copy still promises it → brief 02 |
| 13 | Visual Block `$` and `g Ctrl-a` | None |
| 14 | Reference card decks | `starting-vim-with-work-queued` uses a card-level `hostNote` instead of per-row host cells. Deliberate |
| 15 | Free practice mode | None |
| 16 | Unit 16 capstones | No assertion that a stage completes in under 90 seconds; unverifiable statically |
| 17 | Unit 17 mastery loops and CLI field notes | "Advanced variants" reduced to recall mode — no larger-buffer or distractor variants. Not in the acceptance criteria |
| 18 | Curriculum graph and portability | Entry confidence levels never built → brief 06; "any topic can be previewed" has no named affordance |
| 19 | Ex output surface | Content follow-up §4 never authored → brief 02; `@:` cannot replay Ex output → brief 05 |
| 20 | Viewport control art and story beat | None |
| 21 | Search offsets | Engine shipped; content beat out of scope and still unauthored → brief 02. Ex-address offsets out of scope by design |
| 22 | The file-name register `"%` | None |
| 23 | Five future unit boards and animation seeds | Hosting budget → brief 04; `open-trail-overlook` has 50 approved variants and no unit → brief 04; **13 of 17 scenes ship no in-board patch layer at all** — no phase patches and no landmark plates → brief 07; Veo loops optional and unstarted |
| 24 | Story continuity and unit endings | None. All 17 unit-ending paintings promoted, 17 distinct hashes |
| 25 | In-app feedback capture | Five dialogs have no reporting affordance → brief 01; free-practice button overlaps the scratchpad → brief 01; no Turnstile, by decision |

## Design constraints that shape this plan

These are product invariants carried forward from the closed plan. No session
may weaken them. They are numbered as they were, because other documents cite
them by number.

1. **Phone-first.** Portrait 360–430 CSS px is the design target. The on-screen
   physical-style keyboard, the instruction, and the code slab must all fit
   within `100dvh` with no document scrolling.
2. **Bite-sized.** A lesson is 2–5 minutes; an exercise is 15–90 seconds. The
   product exists to use small pockets of time away from a desk.
3. **Visible lines are scarce and stay scarce.** Seven code rows is the maximum
   a 360×740 phone accepts, and seven is already tight on real hardware: the
   instruction, the board, and the fixed keyboard compete for the same `100dvh`,
   and at seven rows the board and character art are fully displaced. No session
   increases the number of code rows shown at once. *Enforced:*
   `tests/content-data.test.mjs` fails an activity showing more than seven rows.
4. **Buffer length is not visible-line count.** `scenario.initial.viewport`
   (`topLine`/`bottomLine`) decouples the two, which is how Unit 9 ships 30-line
   buffers on a phone. Windowing is the tool for lessons whose subject is reach
   beyond the visible rows; it is not a house style to be applied unit-wide.
5. **Sizes come from the lesson, never from a target.** Buffer length is an
   outcome of what an exercise edits plus the context that makes the edit
   legible; activity count is an outcome of what a concept needs to stick. No
   session picks a number for a unit and authors its content to fit — matching a
   buffer to its neighbors' length is not a reason to grow it, five activities
   is not a lesson's shape, and a test asserting a minimum size manufactures
   padding rather than preventing thinness. The
   `explain / demonstrate / isolate / mix / challenge` contract names five
   *kinds* of activity, not a target of five.
6. **Deterministic correctness.** A command is exposed only after it passes both
   the native-Vim fixture and the browser conformance test
   ([../vim-conformance.md](../vim-conformance.md)). No session ships a command
   on assumption.
7. **Nothing is removed for being rare; it is marked.** A lesson judged
   advanced, niche, or configuration-dependent keeps its full five-phase cycle
   and carries `lesson.track` (`advanced` or `optional`) plus a one-sentence
   `trackNote`. Core is the default and is expressed by the field's absence. A
   reviewer's judgement that material is rarely used is a label, not a deletion.
8. **Host-neutral.** The curriculum teaches Vim, not Vim inside one editor. No
   `content/units/*.json` file names a host, and none should. That a particular
   editor claims a chord by default is a portability note attached to a command
   that is still taught — never a reason to stop teaching it. `Ctrl-f`,
   `Ctrl-b`, `Ctrl-e`, and `Ctrl-y` are native, everyday terminal-Vim commands.

Constraints 4 and 5 work together: **a lesson that needs reach gets a small
window over a longer file — not more rows, and not a longer buffer whose
exercises never reach past what they already show.**

## Settled decisions and accepted divergences

Rulings that were made once and should not be re-litigated. Each was recorded
inside a brief that no longer exists.

- **`unit.reference` now renders.** The Reference surface exists, so "demote to
  reference" is finally an available disposition rather than deletion under
  another name. It stays unused on material the author has not walked.
- **The Unit 9 split is settled.** Old Unit 9 became Unit 9 Position memory and
  Unit 10 Viewport control, pushing every later unit up by one. The course is 17
  units. The old renumbering table is history; a unit number in this directory
  means the current number.
- **Accepted conformance divergence:** cursor placement after a confirmed
  substitution. `substitute-confirm-accept-all-lands-on-the-last-changed-line`
  carries a `browserVerdict` recording it.
- **Search offsets on Ex addresses** (`:/pat/+1d`) are out of scope by design —
  a different parser from the one session 21 patched.
- **`"+` and `"*` deliberately never touch the device clipboard.**
- **A macro register cannot be seeded by recording during setup** (K_SPECIAL
  bytes), which is why Unit 14 keeps macro text as buffer text and yanks it.
- **Feedback:** `VITE_FEEDBACK_ENDPOINT` stays optional — Send hides and Save
  and Copy take over. No Turnstile while the app has no users; the origin
  allowlist, rate limit and size cap are the trade. A report with no screenshot
  is complete, not degraded. The client IP is deliberately not recorded.
- **Two different things in this repo are called "restoration."** Do not
  confuse them:
  - A unit-ending restoration **painting** —
    `assets/worlds/story/units/<unit>.webp`, generated from a
    `*-restoration-3x4` candidate set. The full-frame image shown when a unit
    completes. **All 17 exist and are promoted.**
  - An in-board **patch plate** — `phase-a/b/c.webp`,
    `landmark-dormant.webp` and `landmark-restored.webp` *inside a scene
    directory*. Transparent overlays that composite onto the gameplay board as
    a lesson progresses and when a unit completes. **Only the four Arc 1
    (Moonroot) scenes have any of them**; the other 13 declare
    `patchRegions` and ship `patches: {}`. That is what brief 07 is about.

## Session list

| # | Session | Size | Depends on |
| --- | --- | --- | --- |
| 01 | [Feedback reachability](01-feedback-reachability.md) | S | — |
| 02 | [Teach the verified commands](02-teach-the-verified-commands.md) | L | — |
| 03 | [Guard the unguarded criteria](03-guard-the-unguarded-criteria.md) | S | — |
| 04 | [Asset and hosting budget](04-asset-and-hosting-budget.md) | M | — |
| 05 | [Engine debt and Ex ownership](05-engine-debt-and-ex-ownership.md) | M | — |
| 06 | [Entry confidence levels](06-entry-confidence-levels.md) | M | — |
| 07 | [In-board landmark plates](07-in-board-landmark-plates.md) | L | 04 |

Also here: [validation-walkthrough.md](validation-walkthrough.md), a checklist
of author-run manual checks. It is not a coding session.

**Recommended order: 01 first.** The author is about to walk the whole course
filing problem reports, and five surfaces currently cannot file one. After that,
02 is the only brief that changes what a learner is taught, and 03 is cheap.
07 is gated on 04, because 78 new plates add shipped bytes to a build that is
already close to its hosting limit. Everything else is independent.

## Progress

- [x] 01 Feedback reachability
- [ ] 02 Teach the verified commands
- [ ] 03 Guard the unguarded criteria
- [ ] 04 Asset and hosting budget
- [ ] 05 Engine debt and Ex ownership
- [ ] 06 Entry confidence levels
- [ ] 07 In-board landmark plates

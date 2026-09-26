# Design constraints and settled decisions

Product invariants and rulings that were made once and should not be
re-litigated. Open work lives in [plans/](plans/); this file records what every
piece of work inherits.

## Design constraints

No change may weaken these. They are numbered because other documents cite them
by number.

1. **Phone-first.** Portrait 360–430 CSS px is the design target. The on-screen
   physical-style keyboard, the instruction, and the code slab must all fit
   within `100dvh` with no document scrolling.
2. **Bite-sized.** A lesson is 2–5 minutes; an exercise is 15–90 seconds. The
   product exists to use small pockets of time away from a desk.
3. **Visible lines are scarce and stay scarce.** Seven code rows is the maximum
   a 360×740 phone accepts, and seven is already tight on real hardware: the
   instruction, the board, and the fixed keyboard compete for the same `100dvh`,
   and at seven rows the board and character art are fully displaced. Nothing
   increases the number of code rows shown at once. *Enforced:*
   `tests/content-data.test.mjs` fails an activity showing more than seven rows.
4. **Buffer length is not visible-line count.** `scenario.initial.viewport`
   (`topLine`/`bottomLine`) decouples the two, which is how Unit 9 ships 30-line
   buffers on a phone. Windowing is the tool for lessons whose subject is reach
   beyond the visible rows; it is not a house style to be applied unit-wide.
5. **Sizes come from the lesson, never from a target.** Buffer length is an
   outcome of what an exercise edits plus the context that makes the edit
   legible; activity count is an outcome of what a concept needs to stick.
   Nobody picks a number for a unit and authors its content to fit — matching a
   buffer to its neighbors' length is not a reason to grow it, five activities
   is not a lesson's shape, and a test asserting a minimum size manufactures
   padding rather than preventing thinness. The
   `explain / demonstrate / isolate / mix / challenge` contract names five
   *kinds* of activity, not a target of five.
6. **Deterministic correctness.** A command is exposed only after it passes both
   the native-Vim fixture and the browser conformance test
   ([vim-conformance.md](vim-conformance.md)). No command ships on assumption.
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

## Settled decisions

- **`unit.reference` renders.** The Reference surface exists, so "demote to
  reference" is an available disposition rather than deletion under another
  name. It stays unused on material the author has not walked.
- **The Unit 9 split is settled.** Old Unit 9 became Unit 9 Position memory and
  Unit 10 Viewport control, pushing every later unit up by one. The course is 17
  units. A unit number anywhere in `docs/` means the current number.
- **Accepted conformance divergence:** cursor placement after a confirmed
  substitution. `substitute-confirm-accept-all-lands-on-the-last-changed-line`
  carries a `browserVerdict` recording it. Correcting it would mean reaching
  into the adapter's prompt loop.
- **Search offsets on Ex addresses** (`:/pat/+1d`) are out of scope by design —
  a different parser from the one that handles `/pat/e`.
- **`"+` and `"*` deliberately never touch the device clipboard.**
- **A macro register cannot be seeded by recording during setup** (K_SPECIAL
  bytes), which is why Unit 14 keeps macro text as buffer text and yanks it.
- **Feedback:** `VITE_FEEDBACK_ENDPOINT` stays optional — Send hides and Save
  and Copy take over. No Turnstile while the app has no users; the origin
  allowlist, rate limit and size cap are the trade. A report with no screenshot
  is complete, not degraded. The client IP is deliberately not recorded.
- **The entry question rides on the opening reference deck.** It is asked once,
  after the story intro and the orientation deck, and never on a plain
  `isDefaultArrival` check — that fires for every returning learner. A learner
  already past the first run changes their level in Settings. `entryLevel: null`
  means "never asked" and behaves as `new`; every exit path from the question
  writes a value, so dismissing it is "new to Vim". The level lives in
  `vim-wilds.session.v1` beside the saved position, never in a progress store,
  and resolves to the first unit of its arc through `content/unit-index.json`.
  The level is self-reported: no placement test, and no adaptive scheduling or
  knowledge tracing — progress states are state, not a scheduling algorithm.
- **"Preview any topic" is the contents dialog and the deep links**, not a named
  affordance. A test asserts that opening an unreached unit records no progress.
- **A unit ends with its painting.** Each unit's restoration painting,
  `assets/worlds/story/units/<unit>.webp` (from a `*-restoration-3x4` candidate
  set), is the full-frame image shown when it completes; all 17 exist. The
  finale, `story/ending/restored-wilds.webp`, follows the last unit.
- **Boards carry no overlay plates.** A board is three base images plus
  optional remote variants. Two overlay layers were tried and removed, both
  local brightness-and-tint proofs rather than generated art: lesson-phase
  plates (`phase-a/b/c`, meant to add detail as a lesson progressed; unrendered
  since `06471e9`) and dormant/restored landmark plates (meant to crossfade at
  a unit's end; never shown once every unit had a painting, from `967b951`).
  Reviving either idea would need real generated art.
- **The fallback is plain colour.** A board or story surface whose image is
  missing shows the world's plain `fallbackGradient`, never a drawn pattern.
- **Hosting stays on GitHub Pages, whole build included (2026-09-26).** The
  published build is 877 MiB against Pages' 1 GiB: 39 MiB of precached core
  media, 832 MiB of optional media (character reactions 376, character
  animations 246, 900 scene variants 210), and ~6 MiB of everything else. There
  is no CDN, no Git LFS, and `variantsPerSite` stays at 5. The margin moves only
  when art is added, and the art is essentially final; new exercises and
  features add kilobytes. `tests/pwa-build.test.mjs` fails CI at 1 GiB, and an
  oversized Pages deploy is rejected while the previous site stays live, so
  nothing new watches the number. Revisit on either of two conditions:
  - **New art would push the build past ~950 MiB.** First lever: lower
    `variantsPerSite` from 5 to 3 in `content/presentation.json`, which frees
    ~84 MiB with no architectural change, and update the variant count asserted
    in `tests/pwa-build.test.mjs`. Beyond that, the character frames are the
    bulk.
  - **The product takes payments.** Pages' terms exclude commercial use, so the
    whole static site moves to a commercial host
    ([ideas/launch-and-monetization.md](ideas/launch-and-monetization.md#hosting-and-payments)).
- **`open-trail-overlook` stays in reserve (2026-09-26).** Its approved board
  and 50 variants (5.4 MB in `assets/`) ship nowhere, are pinned `reserve-only`
  by `tests/media-policy.test.mjs`, and cost nothing in the build. It is the
  one ready board if new exercises ever grow into a new unit. Assign it when a
  unit whose content is real needs a board, or delete it if the unit list is
  declared final. A board is never a reason to create a unit.

### Smaller accepted trade-offs

Each was a deliberate call, not an oversight:

- Canonical solutions: no two exercises share one, and a challenge never replays
  its demo. Unit 7 has two sanctioned demo→mix repeats, and Foundations has two
  canonical collisions that are permanently exempt.
- `{count}O` is not taught, because the adapter's cursor disagrees with Vim's.
- Mid-insert checkpoints omit `mode`, so demo playback cannot slow down at
  those steps.
- The `starting-vim-with-work-queued` reference card uses a card-level
  `hostNote` instead of per-row host cells.
- Unit 17's "advanced variants" are recall mode only — no larger-buffer or
  distractor variants.
- A larger editor on desktop has been made safe to try but was never tried.

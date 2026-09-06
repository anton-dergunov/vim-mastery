# Vim Wilds lesson content design

## Purpose

This document defines the authoring contract for every curriculum unit in Vim
Wilds. A unit file is complete product content rather than a loose collection
of prompts: it contains the theory, executable demonstrations, practice,
challenges, reference material, verification intent, and coverage evidence that
a lesson UI needs.

The first conforming unit is Unit 10, Repeatable Editing, in
`content/units/10-repeatable-editing.json`. Unit files use a two-digit numeric
prefix for course ordering; Unit 1 is `content/units/01-modal-model.json`. The JSON Schema is
`content/unit-content.schema.json`, and the shared language registry is
`content/language-profiles.json`.

The lesson renderer and playback controller are deliberately outside this
contract. Content describes what can be shown and executed; it does not prescribe
DOM structure or implement Vim behavior.

## Learning sequence

A lesson normally moves through these roles:

1. **Explain** the editing intention and the command grammar.
2. **Demonstrate** it against a real, deterministic buffer.
3. **Isolate** the new idea in convenient conditions.
4. **Mix** it with prerequisite commands.
5. **Challenge** retrieval or tool choice with less guidance.

This is guidance, not a fixed card count. Use as many cards and activities as a
concept needs. Keep theory concise but clear, and prefer several focused cards
over one dense lecture. A card should usually present one coherent editing idea,
a command shape, and one useful contrast, warning, or practical reason.

Every procedural explanation should point to a playable demonstration. A
renderer may also derive a static before/after presentation from the same
scenario. Theory must explain the editing idea instead of dumping commands.

## Shared unit contract

Every unit preserves its curriculum row verbatim in `curriculumDefinition`:
commands and concepts, prerequisites, learning outcome, representative
exercises, and priority/portability. The authored lesson may explain those
fields but may not silently narrow or expand them.

Stable IDs use lowercase kebab case and never encode display order. The unit
owns lesson IDs; activity IDs are unique across the whole unit. References,
coverage records, telemetry, and later progress migrations depend on this
stability.

Activities are one of:

- `theory`: compact explanatory copy, optional grammar, and a demonstration
  reference;
- `demo`: a deterministic editor scenario with a complete teaching script;
- `exercise`: an executable isolate, mix, or challenge;
- `choice`: a deterministic tool-choice question for cases where typing keys
  would reveal or distort the intended judgment;
- `summary`: a concise synthesis and transfer guidance.

Runnable activities share an editor scenario:

- a registered language profile and source kind (`complete`, `fragment`, or
  `neutral`);
- initial lines, zero-based cursor, and initial mode;
- target lines and the terminal state fields that matter;
- a key-level teaching script;
- logical command groups and meaningful checkpoints;
- staged hints and post-success explanation;
- primary/supporting skills, difficulty dimensions, portability, and generation
  provenance.

Ranges use zero-based `[line, column]` positions and an exclusive end. Incidental
cursor or mode properties should not be required. Cursor-moving teaching steps
must have checkpoints so demonstrations and conformance fixtures cannot drift.

Runnable activities may use the optional `editor` configuration:

- `editor.wrapColumns` is a positive integer that fixes the visible character
  width for the activity, allowing `gj` and `gk` checkpoints to remain stable
  across phone sizes.
- `editor.textWidth` is an integer from 20 to 80 that fixes Vim's formatting
  width for deterministic, phone-readable `gq` and `gw` activities.
- `editor.visualizeWhitespace: true` shows spaces as faint dots and tabs as
  arrows, using CodeMirror's built-in whitespace highlighter. Use it only when
  visible whitespace is itself teaching evidence—for example, contrasting `$`
  with `g_` on a line with trailing spaces.
- `editor.viewportRows` fixes the editor to that many 24px logical rows. Unit 9
  uses seven rows so the middle row and every viewport command remain identical
  at all supported phone widths. Initial states, targets, and checkpoints may
  include a semantic `viewport` with zero-based `topLine` and `bottomLine`.
  Windowing exists for lessons whose subject is reach beyond the visible rows —
  bulk substitution, `:global`, a macro replayed over many records — where the
  buffer has to be longer than the window for the lesson to exist at all.
  Rows are not free. Seven is the ceiling a 360x740 phone accepts and is already
  tight on real hardware, and each row spent comes out of the board, so a window
  takes the smallest row count that still shows the activity's work.
  Both numbers are sized from the lesson: the window from what must be seen at
  once, the buffer from what the command must reach. Neither is sized from what
  neighboring activities happen to use. **Do not pick a buffer length for a unit
  and author its activities to it** — a buffer padded past what its exercise
  touches spends the page's scarcest resource on rows the learner must read and
  then discard. Uniform lengths within a unit are fine when they fall out of the
  lessons and worth nothing when they are engineered, and a test that asserts a
  minimum length manufactures exactly that padding.
- `editor.viewportDependent: true` declares that the activity's *correctness*
  depends on how many rows are visible, as opposed to the window being mere
  presentation. An activity is viewport-dependent exactly when it asserts a
  semantic `viewport` in `scenario.target` or in a `script` checkpoint, because
  those assertions are what a larger editor would silently break. Declare it
  alongside `viewportRows`; the flag and that derived signal are asserted to
  agree, so a presentation-only windowed activity must omit it and must not
  assert a viewport.
- Lines in a windowed activity must fit the fixed window horizontally. At
  360x740 a 306px scroller less the 26px gutter and 18px of padding leaves
  261px, and the 14px monospace advance is 8.65px, so **30 columns** is the
  authoring limit. Overflow is unrecoverable there: the scroller hides it and
  direct scrolling is suppressed. Unit 9 predates this limit and is exempt.

Activities without these fields retain the normal unwrapped editor with
whitespace hidden. Editor indentation is fixed at two spaces so shift and
reindent exercises match the native Vim fixture.

Authored copy is inline Markdown: `` `code` ``, `**bold**`, and `*emphasis*`.
Code spans follow CommonMark's fence rule, so a command that contains a backtick
is written with a longer fence — ``` ``a`` ``` for the mark jump, ``` `da` ```
for the backtick text object — and one space at each end of the fence is a
separator rather than text.

Unit files also carry an explicit `unitNumber`; the two-digit filename prefix
must match it. Introductory content may use the reusable `mode-compass` or
`command-assembly` theory presentations, scenario-backed inspection choices,
routes to alternate activities, and remediation references. These additions
describe learning behavior rather than unit-specific DOM branches.

A runnable or inspection state may seed otherwise invisible Vim state through
`initial.setup`. Its cursor is the pre-setup Normal cursor and its steps are
replayed silently before the activity begins. The surrounding `initial.cursor`,
`initial.mode`, and optional `initial.viewport` are the expected learner-visible
state after setup. Setup may create marks, selections, jump/change history, and
viewport position. Temporary edits are allowed only when the setup restores the
authored visible text before control reaches the learner. Setup never appears in
attempt history or replaces a normal teaching script. Reset reconstructs and
verifies the seeded state.

`initial.viewport` is an assertion, not an instruction: the window position
comes from replaying `initial.setup.steps`, and the authored value records where
that replay is expected to land. A mismatch is reported as setup drift rather
than being silently corrected.

## Reporting a command's reach

Three affordances make an edit legible when most of the lines it touches sit
outside the window, and none of them costs a code row.

- The **impact readout** restates a command's buffer-level effect the way Vim
  does—`7 fewer lines`, `9 substitutions on 6 lines`, `3 more lines`. It shares
  the reserved history-label row in the status tray and is announced to screen
  readers. It appears only when the effect spans more than one line or reaches a
  line outside the window, so a single-line edit stays quiet. That threshold is
  a deliberate superset of Vim's `'report'` default of 2.
- The **match map** marks every buffer line the live pattern hits on the
  existing position rail, off-screen lines included, and highlights the matched
  lines that are currently visible. The pattern comes from a confirmed search or
  from `:s`, `:g`, and `:v`; `:nohlsearch` retires it. Matching lines are
  rescanned from the current buffer, so the marks can never go stale, and the
  map disappears on its own once nothing matches. Rail ticks and the window
  thumb share one line-proportional mapping: a tick inside the thumb is a match
  that is currently on screen.
- The **Ex output overlay** is where `:print` and `:number` list lines, whether
  addressed directly (`:2,8p`) or through a predicate (`:g/pat/p`, `:g/pat/nu`,
  or a bare `:g/pat`, since `:print` is Vim's default Ex command). It is Vim's
  message screen rather than a listing pane: it paints over the world and the
  code slab, is dismissed by any key, scrolls inside itself when the list is
  long, and is announced to screen readers. A listing pane would have cost one
  row per matched line, which is why session 01 dropped these commands instead
  of guessing at a layout for them. Because the command edits nothing, it
  produces no impact readout — the listing is the whole result.

## Scripts, playback, and reset

`script.steps` is the source of truth. Each step contains one normalized input
token, such as `d`, `N`, `Escape`, `Enter`, or `Ctrl-v`. Literal Insert, search,
and Command-line characters remain individual steps. This supports:

- normal and slow autoplay;
- pause and restart;
- manual forward movement one Vim input at a time, grouping a consecutive
  Insert- or Replace-mode text run into one visible step;
- deterministic backward movement to the previous visible step;
- a visible grouping of keys into complete Vim commands.

`commandGroups` partitions the complete step list with zero-based, end-exclusive
indexes. Groups carry the displayed command and a short explanation. Playback
timings are semantic (`literal`, `key`, and command-boundary pauses); the future
UI owns the actual timers.

Reset restores the initial buffer, cursor, mode, search state, registers, and
repeat state, then starts again at step zero. Back reconstructs that authored
initial/setup state and deterministically replays raw steps to the preceding
manual-step boundary, preserving registers, search state, cursor, mode,
viewport, and checkpoints. Insert- and Replace-mode text runs stop at Escape,
Enter, Tab, Backspace, a checkpoint, a command-group boundary, or a mode
change. Search and Ex command-line text remains key-by-key. The raw
`playbackStep` continues to identify the authored key index.

Runnable delivery can be `guided`, `guided-then-recall`, or `recall`. This lets
an orientation avoid duplicating trivial transitions while preserving paired
practice for commands that benefit from retrieval.

The initial guided flow uses `exact-sequence`: a different key is rejected. Unit
data nevertheless records target state and required skill evidence so later
isolated and mixed practice can accept equivalent conformant solutions without
rewriting the catalog.

## Language profiles and selection

The registry separates language choice from lesson structure. Each profile
records its category, extensions, structural affordances, comments, strings,
delimiters, indentation behavior, suitable exercise families, syntax-validation
strategy, and future CodeMirror identifier.

Generation filters profiles by the structure the exercise actually needs:
quotes, delimiters, significant indentation, columns, repeated records, prose
paragraphs, tags, comments, or search-friendly tokens. The model then chooses
from those candidates and explains why. The choice is rejected when it makes
the task unnatural, requires domain trivia, or turns a Vim exercise into a
language quiz.

Authors should monitor the language histogram for a unit, include Python
regularly, and use documentation, configuration, structured data, logs, CSV,
and prose where they are natural. Diversity is a diagnostic rather than a hard
quota: pedagogical fit wins over rotation for its own sake.

The initial registry reflects languages prominent in GitHub's 2025 Octoverse
and Stack Overflow's 2025 Developer Survey, supplemented by formats that expose
useful text structures. TypeScript, Python, and JavaScript occupy the top of the
current GitHub activity ranking, while the broader set represents common
professional, systems, mobile, scripting, data, documentation, and configuration
work. Sources:

- [GitHub Octoverse 2025](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/)
- [Stack Overflow 2025 technology survey](https://survey.stackoverflow.co/2025/technology/)

The registry is versioned. Adding a profile requires renderer highlighting or a
documented plain-text fallback, an authoring validation strategy, and at least
one reviewed example.

## LLM authoring workflow

LLMs generate candidates during authoring, never as the correctness authority
and never as a runtime dependency for shipped lessons.

The provider-neutral prompt receives:

1. the exact curriculum definition and the lesson objective;
2. known prerequisites and commands that may appear;
3. the activity phase and desired difficulty dimensions;
4. display constraints and required text structures;
5. eligible language profiles and the unit's current language histogram;
6. the unit schema and normalized key vocabulary.

It requests multiple candidates with a language choice and rationale, natural
initial buffer, intended transformation, cursor, teaching keys, concise copy,
hints, and a portability note. Candidates must avoid real credentials, harmful
commands, copyrighted passages, opaque domain knowledge, and semantic refactors
whose correctness cannot be expressed as deterministic text state.

The authoring pipeline then:

1. parses and schema-checks each candidate;
2. checks language/profile eligibility and cursor bounds;
3. runs the keys in native Vim and derives the authoritative output;
4. compares the proposed target and every authored checkpoint;
5. performs syntax or structural validation appropriate to the profile;
6. verifies curriculum coverage and content readability;
7. runs the same fixture in the browser adapter before release;
8. requires human review for realism, clarity, and pedagogical fit.

Accepted runnable content records `method: "llm-authored"`, prompt version,
language rationale, deterministic validation state, browser-conformance state,
and review state. A model may propose an explanation, but it may not overrule
editor output or claim an unverified command is supported.

### Canonical generation request

The authoring tool should render a prompt equivalent to:

> Generate several candidate Vim Wilds activities for the supplied lesson
> objective. Choose only from the eligible language profiles and explain the
> structural fit. Return schema-conforming JSON. Keep the buffer realistic,
> small, ASCII unless Unicode is itself relevant, and solvable by the supplied
> canonical command family. Provide exact normalized keys, but treat the target
> and checkpoints as proposals that native Vim will verify. Keep learner copy
> concise and clear. Do not require language trivia or semantic interpretation.

## Verification and release

Authoring validation has three independent gates:

- **Content validity:** schema, IDs, references, phase order, language profile,
  copy, cursor bounds, key groups, hints, and complete coverage.
- **Native behavior:** every demo and teaching solution reaches its target in a
  clean native Vim fixture, including relevant cursor/search/repeat state.
- **Browser conformance:** the supported browser engine matches the native
  fixture for every taught primitive and combination.

`releaseStatus: "authoring"` is required while any browser fixture is pending.
Content authoring must not promote a command in `supported-commands.json`.

Syntax validation is profile-specific. `complete` sources should parse when a
maintained parser is available. `fragment` sources use a fragment-aware parser
or documented lexical checks. `neutral` text receives structural checks only.
Exact target text remains the authority for the current lessons.

A complete unit must map every curriculum concept to theory, demonstration,
isolated practice, mixed practice, and challenge or explain why a phase is not
applicable. This manifest is tested rather than inferred from titles.

That mapping is a **minimum coverage contract, not a lesson template.** It says
which kinds of activity a concept must include; it says nothing about how many.
It imposes no maximum, and satisfying it with exactly one activity per phase
produces a five-activity lesson — a floor, and usually too thin for a concept to
stick. A lesson carries as many exercises as its concept needs, and the coverage
arrays hold as many ids per phase as it takes. Do not treat five as a lesson's
shape, and do not decline to add practice because a lesson already covers every
phase.

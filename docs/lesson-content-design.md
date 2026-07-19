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

Activities without these fields retain the normal unwrapped editor with
whitespace hidden. Editor indentation is fixed at two spaces so shift and
reindent exercises match the native Vim fixture.

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

## Scripts, playback, and reset

`script.steps` is the source of truth. Each step contains one normalized input
token, such as `d`, `N`, `Escape`, `Enter`, or `Ctrl-v`. Literal Insert, search,
and Command-line characters remain individual steps. This supports:

- normal and slow autoplay;
- pause and restart;
- manual forward movement one input key at a time;
- a visible grouping of keys into complete Vim commands.

`commandGroups` partitions the complete step list with zero-based, end-exclusive
indexes. Groups carry the displayed command and a short explanation. Playback
timings are semantic (`literal`, `key`, and command-boundary pauses); the future
UI owns the actual timers.

Reset restores the initial buffer, cursor, mode, search state, registers, and
repeat state, then starts again at step zero. Backward stepping and arbitrary
seeking are not part of the first design.

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

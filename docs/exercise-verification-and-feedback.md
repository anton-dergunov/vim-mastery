# Exercise Verification and Feedback

## Purpose and decision

Vim Wilds should use a **hybrid verifier**. A successful attempt is not one
binary question but three separate judgments:

1. **Validity:** did the editor reach the required state?
2. **Skill evidence:** did the attempt demonstrate the capability this exercise
   is intended to teach?
3. **Coaching:** what can the learner understand or improve after the attempt?

Validity must remain deterministic. The CodeMirror Vim engine executes the
input, the lesson system compares observable state, and the native-Vim
conformance suite establishes that taught behavior matches Vim. Rules, solvers,
small learned models, and LLMs may interpret an attempt or improve feedback,
but no probabilistic model should be the authority that decides whether the
buffer is correct.

The verification policy should change with the pedagogical purpose:

| Lesson phase | Default verification | Feedback emphasis |
| --- | --- | --- |
| First guided introduction | Canonical sequence or a deliberately narrow set of equivalents, with checkpoints | What each key contributes to the command grammar |
| Isolated practice | Required editor state plus evidence of the featured command family | Whether the learner recalled and applied the new skill |
| Mixed review | Required editor state with broad equivalent-solution acceptance | Strategy recognition and one useful comparison |
| Challenge or capstone | Any conformant solution that reaches the state; constraints only when stated in the task | Clarity, efficiency, repeatability, setup cost, and risk |
| Free Practice | No pass/fail judgment | Optional recap of commands, repeated manual patterns, and relevant drills |

This policy follows the curriculum's progression from explicit guidance to
independent tool choice. It also preserves the product's honest scope: mobile
practice primarily develops command recall, composition, and editing judgment,
not physical-keyboard muscle memory.

## Three different meanings of verification

The product should keep three kinds of verification conceptually separate.

### Engine conformance

This asks whether the supported browser engine behaves like native Vim for a
taught command. It belongs in development and CI, not in learner scoring. Every
supported command family needs fixtures for the state it can affect: text,
cursor, selection, mode, registers, search, marks, and undo grouping where
relevant. This is the contract described in
[Vim Conformance](./vim-conformance.md) and
[Vim Engine Choice](./vim-engine-choice.md).

### Attempt verification

This asks whether one exercise attempt reached its required state and satisfied
the lesson's explicit constraints. It runs locally and synchronously. It must be
stable enough that the same trace always receives the same validity result.

### Mastery estimation

This asks what the attempt implies about the learner over time. It can use
recall latency, hints, recovery, repeated errors, skill evidence, and delayed
review performance. Knowledge tracing and scheduling belong here. They should
not be embedded into the definition of whether the current buffer is correct.

Separating these questions avoids several category errors: a conformant command
can be pedagogically irrelevant, a valid alternative solution can differ from
the hint, and one successful attempt does not prove durable mastery.

## Current prototype baseline

The current implementation is already closer to outcome-based verification
than its command tray suggests:

- `app.js` records normalized key tokens in `state.history`.
- `canonicalProgress()` advances only while the entire history is a prefix of
  the teaching solution. A divergent key resets visual progress to zero.
- The canonical sequence drives next-key guidance, help highlights, scenery,
  `solveCurrent()`, and regression fixtures. It does **not** gate success.
- `isTargetSnapshot()` completes an exercise when the live text exactly equals
  `targetCode` and the engine has returned to Normal mode.
- `VimEngine` exposes text, cursor, primary selection, all selection ranges,
  normalized mode, keys, document changes, selection changes, and
  command-completion events.
- The public `window.VimWilds` test surface exposes normalized history, code,
  cursor, selection, mode, modifiers, and completion.

Important information is not yet represented in a lesson-facing trace:

- Logical command spans are not assembled from raw keys and
  `command-complete` events.
- Before/after state is not retained for every logical command.
- Registers, search state, marks, dot-repeat state, macro state, and undo groups
  are not part of `EditorSnapshot`.
- Hint openings, reset/retry events, undo recovery, and elapsed time are not
  recorded as attempt events.
- Checkpoints in `exercise-data.js` validate authored canonical solutions but
  are not applied to arbitrary learner traces at runtime.

This means target-state validation is ready now, while trustworthy command
family classification, richer constraints, and learned feedback require a
small telemetry and adapter layer first.

## Verification option catalogue

No single option is appropriate for every exercise. The useful choices form a
ladder from strict reproduction to open-ended coaching.

### Exact canonical sequence

Compare every normalized key against one authored solution, normally as a
prefix so the app can react immediately.

**Best for:** the first demonstration of a command, typing along with an
animation, or a task whose literal objective is to recall one exact sequence.

**Strengths:** simple, fully deterministic, precise next-key guidance, and easy
to test.

**Weaknesses:** rejects equivalent Vim, turns editing into transcription, and
can teach that a hint is the only correct solution. It handles recovery poorly:
an accidental key followed by a successful undo no longer matches the prefix.

Use exact matching sparingly and label it as a guided reproduction rather than
as general editing correctness.

### Several explicitly accepted sequences

Maintain a small list of known-good token sequences.

**Best for:** narrow introductory exercises with two or three ordinary Vim
spellings, such as count placement alternatives.

**Strengths:** deterministic and more humane than one sequence.

**Weaknesses:** the list grows combinatorially, misses recovery paths, and
requires ongoing curation whenever the supported command set expands.

This is useful as an authoring convenience, not a scalable general verifier.

### DFA or command-grammar acceptance

Represent acceptable input as a finite-state machine or a small grammar. This
can accept families such as either count placement, optional cursor motions, or
several ways to leave Insert mode without enumerating every trace.

**Best for:** command-composition drills where the accepted language is narrow
but has structured variation.

**Strengths:** immediate feedback, explainable states, and much better coverage
than a flat allow-list.

**Weaknesses:** Vim's full behavior is stateful and exceeds a simple regular
language once registers, macros, search, dot-repeat, and buffer-dependent
motions matter. A grammar can also accidentally duplicate semantics already
owned by the editor engine.

Use a grammar to describe pedagogical evidence, never as a second Vim
interpreter.

### Required intermediate checkpoints

Check text, cursor, selection, or mode at selected points in the attempt.

**Best for:** Visual selections, operator-pending explanations, macro recording,
multi-stage automation, and exercises where the intermediate construction is
the learning objective.

**Strengths:** confirms process without requiring every key and supports visual
feedback tied to meaningful states.

**Weaknesses:** an equivalent strategy may never pass through the same states;
the verifier must know whether checkpoints are ordered requirements, optional
milestones, or canonical-demonstration fixtures.

Runtime checkpoints should therefore be explicitly marked as required or
advisory.

### Final text only

Accept as soon as the buffer equals the target text.

**Best for:** open challenges where cursor placement and mode truly do not
matter.

**Strengths:** maximal solution freedom and trivial deterministic evaluation.

**Weaknesses:** the learner can delete and retype the answer, finish in an
unsafe mode, or leave important Vim state wrong. It cannot represent motion-only
tasks or register lessons.

Final text is a useful core signal but is too weak as the universal contract.

### Full required editor state

Compare target text plus whichever terminal properties are pedagogically
relevant:

- Mode.
- Cursor position or row.
- Characterwise, linewise, or blockwise selection.
- Register contents and register type.
- Search pattern and current match.
- Marks, macro recording state, or repeat state.
- Undo grouping when the lesson teaches atomic recovery.

**Best for:** the default validity layer of guided and scored exercises.

**Strengths:** deterministic, solution-independent, and aligned with actual Vim
effects.

**Weaknesses:** the snapshot must expose every state the lesson claims to test.
Over-specifying incidental cursor placement can reject otherwise sound
solutions, so authors must mark only meaningful fields as required.

This should become the primary correctness mechanism.

### Outcome plus required skill evidence

First validate the required editor state, then require trace evidence such as a
text object, Visual Block, named register, dot-repeat, macro replay, or
substitution.

**Best for:** isolated practice and maintenance drills for a named skill.

**Strengths:** accepts alternative implementations within a command family and
prevents delete-and-retype from counting as evidence for an automation skill.

**Weaknesses:** raw key substring matching is unreliable. The same token can
mean different things by mode, and nested behavior such as a macro can execute
commands that do not appear directly in the outer trace. Evidence should come
from logical commands plus state transitions, not from regexes over key text.

Failure of skill evidence should normally produce “target reached, practice
goal not yet demonstrated,” not “wrong answer.”

### Outcome plus forbidden actions

Disallow a mode, command family, reset, excessive insertion, direct replacement,
or another shortcut.

**Best for:** deliberately constrained drills, such as “without entering Insert
mode” or “preserve the yank in register zero.”

**Strengths:** clear guardrails and simple explanations when the constraint is
part of the stated task.

**Weaknesses:** hidden prohibitions feel arbitrary and can reject authentic Vim
workflows. Insert mode is not generally cheating; it is merely not evidence for
a motion, text-object, repeat, or automation objective.

Every forbidden action must be visible in the instruction or lesson framing.

### Absolute efficiency budgets

Require no more than a fixed number of raw keys, logical commands, document
changes, mode transitions, or edit operations.

**Best for:** explicit efficiency challenges and placement tests.

**Strengths:** deterministic and easy to communicate.

**Weaknesses:** raw keys mix different costs. Typing a required identifier adds
many keys but little strategic complexity; one Ex command may contain many
characters while representing one strong automation decision. Accessibility,
recovery, and clarity can also legitimately add actions.

Prefer logical-command and strategy budgets to raw-key budgets.

### Relative budgets around par

Accept an attempt within a configurable factor or additive margin of a teaching
solution or solver-derived par.

**Best for:** graduated challenge bands such as “efficient,” “solid,” and “try
another route.”

**Strengths:** adapts to exercise size and supports non-binary feedback.

**Weaknesses:** a single par embeds a cost function and can turn the product into
Vim golf. Ratios are also unstable for tiny pars: two additional keys are a
large percentage of a one-key solution.

Use additive margins for short tasks, ratios for longer tasks, and never hide
which quantity is being compared.

### Pareto or rubric-based strategy scoring

Compare solutions on several dimensions rather than collapse them immediately
to one number:

- Total keys, separated into command keys and inserted literals.
- Logical command count.
- Navigation/setup cost.
- Mode transitions.
- Undo and recovery cost.
- Use of the lesson's target skill.
- Repeatability across multiple instances.
- Robustness to spacing or cursor-position variation.
- Scope and risk of a destructive operation.
- Readability or explainability of the strategy.

**Best for:** mixed review, tool-choice exercises, automation, and capstones.

**Strengths:** reflects how experts actually choose editing tools and avoids
declaring an obscure golf solution universally best.

**Weaknesses:** some dimensions, especially clarity and risk, require authored
strategy tags, symbolic analysis, or advisory model judgment.

The UI should usually surface one comparison, not a dashboard of every metric.

### Offline shortest-path and diverse-solution search

Search the bounded editor state space during exercise authoring to discover
short solutions, prove solvability, and find unanticipated alternatives.

**Best for:** generated exercises, par estimation, regression testing, and
building a gold solution catalogue.

**Strengths:** systematic, engine-grounded, and capable of finding solutions an
author missed.

**Weaknesses:** the state space grows rapidly with Insert text, registers,
search, macros, and Ex commands. The shortest result may be brittle or
pedagogically poor.

The solver should produce candidates and metrics, not dictate one universal
teaching answer.

### Semantic or test-based targets

For future exercises with several acceptable textual outputs, run a parser,
formatter-independent predicate, or small test suite instead of requiring one
exact target string.

**Best for:** intentionally open transformations where behavior matters more
than formatting.

**Strengths:** permits meaningful variation.

**Weaknesses:** language tooling, sandboxing, execution safety, and semantic
equivalence add substantial complexity. Most bite-sized Vim exercises are
better served by deterministic target text.

This is an optional future capability, not a requirement for the core
curriculum.

### Counterfactual robustness checks

Extract or classify the learner's strategy and replay an equivalent strategy
against small validated variations: different spacing, identifier lengths,
cursor columns, distractors, or instance counts.

**Best for:** macros, absolute-column navigation, search, text objects, and
automation tool-choice challenges.

**Strengths:** distinguishes a structural solution from one that accidentally
works on a single buffer.

**Weaknesses:** literal traces often cannot be replayed unchanged, so the system
needs a strategy skeleton or parameterized command representation. Variation
generation must also preserve the original learning objective.

Use this mostly for exercise generation, research, and advanced feedback rather
than synchronous pass/fail.

### Cloud LLM judgment

Send a compact attempt trace, task metadata, and deterministic comparison to a
hosted model, asking for structured strategy labels and feedback.

**Best for:** optional explanations of unusual but valid solutions, authoring
support, and offline analysis of uncategorized traces.

**Strengths:** flexible natural-language explanation and broad recognition of
strategy variants.

**Weaknesses:** cost, latency, privacy, network dependence, version drift, and
hallucinated Vim claims. An LLM can confidently praise a sequence that the
engine did not execute as described.

LLM output must be advisory, schema-constrained, cached where appropriate, and
grounded in deterministic facts supplied by the verifier. Offline use must
retain complete rule-based feedback.

### Local learned classifier or ranker

Run a compact model over the structured trace to classify strategy,
misconception, or feedback template.

**Best for:** recurring trace patterns that become too numerous for hand-written
rules, once a trustworthy labeled dataset exists.

**Strengths:** low marginal cost, privacy, offline use, and predictable bounded
outputs.

**Weaknesses:** cold-start data requirements, distribution shift as the command
set grows, and harder explanations than deterministic rules. A model should be
allowed to abstain when confidence is low.

This is the strongest learned runtime option if telemetry demonstrates a real
gap that rules and solver metadata cannot cover.

### Human-reviewed gold solution sets

Have experienced Vim users review representative strategy families and their
feedback.

**Best for:** flagship lessons, macros, regex, `:normal`, `:global`, and
evaluation datasets.

**Strengths:** high pedagogical quality and a reliable basis for automated
evaluation.

**Weaknesses:** limited coverage and ongoing editorial cost.

Human review is especially valuable for defining “clear,” “safe,” and
“repeatable,” which cannot be recovered from shortest-path search alone.

## Why raw length is not enough

Keystroke count is useful telemetry but a poor universal objective.

Consider three attempts that reach the same target:

- A text-object change may use few command keys plus many literal insertion
  keys.
- A substitution is one logical automation command but contains a long pattern
  and replacement.
- A macro has setup cost that becomes worthwhile only when replayed enough
  times.

Other complications include counts versus repetition, shifted or modified
keys, accidental keys followed by undo, physical versus touch input, and
solutions that are shorter only because they rely on a fragile column or
incidental cursor location.

The product should therefore record at least:

| Metric | Meaning |
| --- | --- |
| Raw input keys | Physical/touch interaction burden |
| Command keys | Vim grammar entered outside literal text spans |
| Inserted literal characters | Required content entry, reported separately |
| Logical commands | Completed Vim decisions rather than characters |
| Document-changing commands | Operations that actually changed the buffer |
| Navigation/setup commands | Cost paid to position or prepare an operation |
| Mode transitions | Interaction complexity and possible recovery risk |
| Undo/retry/reset count | Recovery behavior, not automatically a failure |
| Hint level used | Amount of scaffolding required |
| Strategy family | Text object, Visual, repeat, macro, substitution, and so on |
| Robustness result | Whether the strategy generalizes to validated variants |

Efficiency should normally produce coaching bands, not rejection. Make it a
progression gate only when the exercise explicitly tests efficiency, such as a
challenge to replace several edits with dot-repeat or one macro.

## Recommended hybrid design

### Layer 1: deterministic validity

Each exercise declares only the terminal fields that matter. Validation may
compare:

- Exact text, or a deterministic target predicate in a future semantic task.
- Required mode.
- Exact cursor, cursor row, or an allowed cursor region.
- Selection kind and endpoints.
- Named register contents and character/line/block type.
- Search, mark, macro, repeat, or undo state when explicitly taught.

Validity is independent of canonical solution history. If an alternative
sequence produces the full required state, the UI should acknowledge that fact
even when skill evidence is still missing.

### Layer 2: deterministic skill evidence

The attempt trace is segmented into logical commands. Evidence rules operate on
commands and state deltas, for example:

- `ci"` followed by an Insert span demonstrates a quote text object.
- Entering Visual Block, forming a multi-range selection, and applying `r`
  demonstrates block replacement.
- A document change attributed to `.` demonstrates dot-repeat more strongly
  than merely pressing `.` where it has no effect.
- Recording a register and observing changes caused by `@a` demonstrates macro
  replay.
- Executing an Ex command whose state delta changes all intended matches
  demonstrates substitution.

Rules can require, forbid, count, or merely tag evidence. The exercise must
declare whether missing evidence blocks progression or only changes coaching.

### Layer 3: advisory coaching

Once validity and evidence are fixed facts, the app may compare the recognized
strategy with authored solutions, solver candidates, rubric metrics, or a
learned ranker. Coaching can say:

- “Correct — you used Visual Block to change four rows at once.”
- “Correct result. This drill is practicing dot-repeat; try making the first
  change once and replaying it with `.`.”
- “Your macro works here, but it depends on an absolute column. A search anchor
  would survive different identifier lengths.”
- “The substitution is longer than the local edit for one match, but it scales
  better when the buffer has many matches.”

The model never needs to invent whether the attempt worked; it receives that as
input.

### Learner-facing result states

A two-dimensional result is clearer than one `correct` boolean:

| Outcome validity | Skill evidence | Learner-facing result |
| --- | --- | --- |
| Valid | Satisfied | Complete; acknowledge the strategy and award normal progression |
| Valid | Not required | Complete; optionally compare the alternative with the teaching solution |
| Valid | Missing but required | “Target reached; now demonstrate the practice skill,” with reset or replay from the same start |
| Invalid | Present or absent | Continue the attempt and explain the nearest observable mismatch |

This distinction is especially important for manual retyping. Reaching the
target by replacing the entire buffer is a valid text outcome, but it is not
evidence that the learner can use a text object, macro, substitution, or repeat.
The product can say both facts without accusing the learner of cheating or
pretending that the resulting buffer is wrong.

## Conceptual exercise contract

The exact JavaScript schema should be designed when this feature is implemented.
Conceptually, an exercise will need metadata equivalent to:

```js
{
  verification: {
    mode: "guided-sequence" | "constrained-state" | "outcome" | "coached-outcome",
    target: {
      text: ["..."],
      mode: "normal",
      cursor: { kind: "any" | "exact" | "row" | "region", value: null },
      selection: null,
      registers: null,
    },
    requiredEvidence: ["text-object:inside-quotes"],
    forbiddenEvidence: [],
    checkpoints: [],
    efficiency: {
      role: "informational" | "required",
      budget: null,
    },
  },
  teachingSolutions: [
    {
      keys: ["c", "i", "\"", "...", "Escape"],
      strategy: "change-inside-quotes",
      rationale: "Changes only the contents and preserves the delimiters.",
      role: "primary",
    },
  ],
}
```

This is a design sketch, not a public runtime interface. Important properties
are:

- Verification policy is authored data rather than exercise-specific DOM logic.
- Target state and skill evidence are separate.
- Several teaching solutions may represent genuinely different strategies.
- Efficiency explicitly says whether it is informational or required.
- Incidental editor properties remain unconstrained unless named.

## Attempt trace and telemetry contract

Rule-based coaching, solvers, and later models all benefit from the same local
structured trace. A logical attempt record should contain:

- Exercise and content version identifiers.
- Initial state or its stable hash.
- Input source: virtual keyboard, physical keyboard, or test harness.
- Normalized key and optional modifier information.
- Monotonic timing or coarsened duration.
- Mode, cursor, selection, and relevant state before and after the event.
- Document change ranges and inserted/deleted text for app-authored buffers.
- Logical command start and completion boundaries.
- Command-family and strategy tags produced by deterministic analysis.
- Hint opened or advanced, undo, retry, reset, and completion events.
- Final state, validity result, constraint results, and feedback shown.

Telemetry for product research is not the same as local attempt state. The
browser may retain a complete trace temporarily to give feedback without
uploading it. Any upload should be opt-in, minimized, versioned, and documented.
User-authored Free Practice buffers should remain local and be excluded from
telemetry by default. If future free-practice analysis is offered, derived
command statistics should be preferred over raw user text.

## Feedback design

### During command composition

Immediate feedback should explain invisible Vim state without judging an
unfinished attempt:

- Current mode and submode.
- Pending count, register, operator, or motion.
- Current selection and affected-range preview.
- Macro recording and command-line state.
- Accepted touch chord and modifier release.

For strict guided exercises, a divergent key may pause the guided animation and
say what concept was expected. The learner should be able to reset immediately
or continue in an explicitly ungraded exploration state. Do not send an
alternative but valid command through an error animation merely because it
differs from the hint.

### After an invalid or incomplete attempt

Feedback should identify the nearest deterministic fact:

- Target text has not been reached.
- Correct text, but still in Insert or Visual mode.
- Selection covers the wrong rows or columns.
- Required register was overwritten.
- Target reached without the skill this drill is practicing.

Hints should escalate from intention to grammar to next action:

1. Restate the structural idea.
2. Name the relevant command family.
3. Show the command shape.
4. Highlight the next key or demonstrate the canonical sequence.

Errors should never remove rewards, health, or long-term progress. Recovery
through undo is useful Vim practice and should be visible in the recap rather
than treated as moral failure.

### After a valid attempt

Lead with success. Then provide at most one high-value observation by default:

1. Confirm the outcome.
2. Name the recognized strategy.
3. Compare it with the teaching goal only if that comparison is useful.
4. Offer one replay or variant when practice value remains.

Detailed metrics and alternate strategies can live behind an optional review
control. Bite-sized sessions should not become mandatory post-hoc lectures.

## Offline solver design

### Purpose

The solver is primarily an authoring and validation tool. It should:

- Prove that generated exercises are solvable with the allowed command set.
- Find short and diverse solution families.
- Estimate par under several cost functions.
- Discover unintended shortcuts and delete-and-retype paths.
- Generate positive, negative, and near-miss traces for tests and model data.
- Replay candidates against native Vim and the browser engine before they are
  accepted into the supported solution catalogue.

It should not perform an expensive search on the learner's phone after every
attempt.

### State

The search state must include every Vim property that can change future
behavior for the allowed action set:

- Buffer text.
- Cursor and selections.
- Mode and pending operation.
- Relevant registers and register types.
- Search and character-find state.
- Dot-repeat state.
- Macro recording and register content.
- Marks or jump state when allowed.
- Undo state only when undo is part of the search language.

Omitting relevant state can merge nodes that look identical now but behave
differently on the next command.

### Actions and costs

Search over logical commands where possible, not the entire keyboard alphabet
at every step. The allowed action grammar comes from the exercise's prerequisites
and learning objective. Insert runs should be collapsed into candidate literal
spans derived from target differences rather than branching over arbitrary
Unicode.

Use multiple cost functions:

- Raw keys.
- Command keys excluding literal insertion.
- Logical commands.
- Weighted setup plus replay cost.
- Mode transitions.
- A pedagogical cost that prefers introduced and portable commands.

This makes the solver return a Pareto frontier or several strategy families
rather than only one golfed trace.

### Algorithms and bounds

- BFS is suitable when every action has equal cost and the bounded state space
  is small.
- Dijkstra handles weighted costs.
- A* can use text edit distance, unresolved target regions, cursor distance, and
  remaining instances as admissible or approximately useful heuristics.
- Beam search is appropriate when exact optimality is less important than
  quickly finding diverse candidates.

Bound the search by command families, maximum depth/cost, buffer size, insert
span candidates, and relevant state. Canonicalize state for hashing. Use
symmetry reduction and dominance pruning when two paths reach equivalent state
and one is no better on any recorded cost.

Native Vim is too expensive to launch for every search edge. Search should run
through a deterministic supported-engine adapter or a purpose-built abstract
transition layer, then replay finalists through both the browser engine and
native Vim. A candidate is teachable only after conformance succeeds.

### Diverse solutions and counterfactuals

Cluster results by strategy features—text object, character find, Visual,
repeat, macro, substitute, `:normal`, `:global`—rather than by exact token
sequence. Review the best representative of each cluster.

For robustness analysis, generate controlled variants of the initial buffer and
cursor. Re-solve them or replay a parameterized strategy skeleton. This can
identify brittle absolute-column navigation, unsafe broad substitutions, and
macros that lack stable anchors.

## ML and LLM research directions

### Should this use an LLM at runtime?

Not for the core verifier. The problem has exact state, a deterministic
interpreter, short traces, and a small command language. Those are unusually
favorable conditions for symbolic rules and search.

A runtime LLM becomes interesting only for the remaining fuzzy task: explaining
an unusual valid strategy in friendly language. Even there, a safe pipeline is:

1. Deterministic code computes validity, constraints, state differences, and
   known strategy tags.
2. The model receives those facts and a compact trace.
3. It returns schema-constrained labels and feedback.
4. The product rejects malformed output and falls back to a local template.
5. The model's prose may not contradict deterministic results or claim
   unsupported Vim behavior.

Cloud judgment introduces cost, latency, privacy, availability, and model-version
drift into a product designed to be local and offline-capable. Make it optional,
cache repeated trace classes, and prefer batch use during authoring.

### Can a model be trained from scratch?

Yes, if “model” means a compact domain-specific sequence model rather than a
general-purpose conversational LLM.

The task can be formulated as supervised multi-task learning over an attempt
trace:

- Classify strategy family or families.
- Classify misconception or failure mode.
- Predict rubric dimensions or rank two valid solutions.
- Select an authored feedback template.
- Estimate confidence and abstain on unfamiliar traces.

A reasonable starting experiment is a Transformer encoder with:

- 4–6 layers.
- Hidden dimension around 128–256.
- 4–8 attention heads.
- Relative or learned positional features.
- Approximately 5–20 million parameters, depending on vocabulary and heads.
- Separate classification, regression/ranking, and template-selection heads.

These numbers are starting hypotheses, not performance or deployment
guarantees. A GRU, temporal convolution, gradient-boosted tree over aggregated
features, or even deterministic rules may outperform the Transformer at the
available data scale. All should be baselines.

Use a staged model ladder rather than committing immediately to one neural
architecture:

| Model | Role | Why try it | Main limitation |
| --- | --- | --- | --- |
| Deterministic rules | Strategy and evidence tags | Fully explainable and strong on known commands | Editorial coverage grows with the curriculum |
| Logistic regression or boosted trees | Misconception and feedback-template classification from aggregate features | Fast baseline and easy feature attribution | Loses event order unless sequence features are engineered |
| GRU or temporal convolution | Short trace classification | Compact and naturally sequential | Less flexible representation of long-range macro or repeat relationships |
| Transformer encoder | Multi-task trace classification and ranking | Captures relationships among commands, state deltas, and distant events | Needs more data and careful calibration |
| Small encoder-decoder | Constrained short feedback generation | Can produce compositional language from structured facts | Larger, harder to make faithful, and unnecessary if templates suffice |
| Fine-tuned pretrained decoder | Rich advisory explanation | Reuses existing language knowledge | Laptop/server-sized and still unsuitable as a correctness authority |

For the from-scratch encoder experiment, begin with solver-generated pretraining
and a modest supervised set rather than waiting for a huge user population. A
useful experimental corpus could contain hundreds of thousands to low millions
of traces, with exercise families, identifiers, and buffer templates split so
the test set measures structural generalization rather than memorization. The
right scale should be established with learning curves; these are experimental
ranges, not a claim that a particular sample count guarantees quality.

Training a fluent decoder from scratch is a different project. It must learn
English generation as well as Vim trace interpretation, consumes far more data
and compute, and still requires factuality controls. If natural-language
generation is the goal, fine-tuning or distillation from a pretrained model is
the sensible comparison.

### Input representation

Use a compact event vocabulary rather than natural-language prompts. Each event
may combine embeddings or features for:

- Normalized key or logical command.
- Command family and argument slots.
- Mode before and after.
- Cursor displacement and line/column buckets.
- Selection kind and size change.
- Document delta shape: insertion, deletion, replacement, affected lines, and
  length buckets.
- Literal insertion span, abstracted from its exact identifier where possible.
- Register, search, repeat, or macro event.
- Command completion boundary.
- Hint, undo, retry, or reset.
- Time since the previous event in coarse buckets.
- Exercise skill tags and target-difference features.

Keep the exact before/after state available to deterministic validation; the
model generally needs abstractions, not an entire code buffer copied into every
token.

### Training data

The solver and engine can generate much of the initial corpus:

- Optimal and near-optimal solutions under several cost functions.
- Diverse valid strategy clusters.
- Solutions that reach the target without required skill evidence.
- Prefix truncations and one-command corruptions.
- Inefficient repeated manual actions.
- Delete-and-retype shortcuts.
- Accidental input followed by successful or unsuccessful recovery.
- Brittle solutions tested on controlled variants.
- Engine-conformance failures, excluded from positive data and retained as
  diagnostics.

Add simulated novice policies rather than relying only on uniform random
corruption. Examples include repeated `x`, repeated `w`, overshooting then
moving back, entering Insert too early, forgetting `Escape`, and replaying a
macro from the wrong location.

Synthetic data will overrepresent what the generator can imagine. Reserve an
exercise- and strategy-disjoint human test set, collect consented real traces,
and periodically compare their distribution with synthetic training data.

### Using a larger LLM as teacher

A larger model can generate candidate rationales, misconception labels, novice
traces, and pairwise preferences between already-valid strategies. It should
receive engine-derived facts and emit structured records.

Programmatic filters should verify:

- Every proposed key trace by replay.
- Every claimed state change.
- Mentioned commands against the supported-command catalogue.
- Strategy labels against deterministic evidence where possible.
- Feedback length, tone, and absence of invented product capabilities.

Human review should sample every label class and all advanced automation
families. The resulting dataset can distill a teacher's breadth into a smaller
classifier or feedback selector without paying for a live call on every lesson.

### Fine-tuning a pretrained small language model

If free-form feedback proves materially better than templates, parameter-efficient
fine-tuning is more practical than language-model pretraining. Apple's
[MLX-LM](https://github.com/ml-explore/mlx-lm) supports generation, quantization,
and low-rank or full-model fine-tuning on Apple silicon. A quantized small
pretrained model with LoRA can therefore be an approachable laptop experiment,
subject to the machine's unified memory and the selected model size.

The training examples should pair structured verifier facts with short reviewed
feedback. Optimize for faithfulness and concision rather than conversational
breadth. Evaluate against held-out command families and adversarial traces.

This model is unlikely to be the best mobile-web runtime initially. It may be
useful as an offline authoring assistant, a laptop-local coach, or a teacher for
a much smaller template selector.

### Local inference

A compact classifier or ranker can be exported to ONNX and evaluated in the
browser. [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) supports
WebAssembly and GPU-oriented execution providers including WebGPU, with operator
and browser support that must be tested on the target phones.

Practical deployment gates include:

- Download and cache size.
- Cold-start latency.
- Median and tail inference latency on representative iOS and Android devices.
- Memory pressure alongside CodeMirror and visual effects.
- WebAssembly fallback when WebGPU is absent.
- Battery use.
- Offline behavior and model versioning.

Small-model research such as
[TinyStories](https://arxiv.org/abs/2305.07759) shows that narrow, synthetic
corpora can make small language models surprisingly capable within a restricted
domain. It does not imply that a few-million-parameter model will generate
reliably factual Vim coaching. Classification and ranking remain much easier
targets than fluent explanation.

### Vim trace language model experiment

An especially relevant research project is a model pretrained on the Vim trace
language itself. Given an exercise state and prior events, train it to predict:

- The next logical command.
- The next abstract state delta.
- Whether a command will make progress toward the target.
- The strategy family of the full trace.

Then fine-tune heads for misconception classification, solution ranking, and
feedback selection. This self-supervised stage can exploit a much larger corpus
of solver- and policy-generated traces than the human-labeled dataset.

Useful experiments include masked command prediction, contrastive learning
between two traces that reach the same state, and representations invariant to
renamed identifiers or changed literal values. This is a legitimate from-scratch
ML project and potentially publishable, but it should begin only after the
deterministic trace format, solver, and evaluation suite are stable.

### Knowledge tracing is a different model

Attempt interpretation describes what happened now. Knowledge tracing predicts
what the learner is likely to recall later. Models such as
[Deep Knowledge Tracing](https://arxiv.org/abs/1506.05908) operate over a
sequence of exercise outcomes and skill tags.

Inputs for a future learner model may include:

- Skill evidence and attempt validity.
- Guided versus independent success.
- Hint and retry use.
- Response latency.
- Strategy efficiency bands.
- Time since prior practice.
- Performance on delayed and varied transfer tasks.

Start with interpretable per-skill heuristics or Bayesian models. Compare more
complex sequence models only when enough longitudinal data exists. Do not train
the trace judge and mastery estimator as one opaque model until both tasks have
strong independent baselines and evaluation sets.

## Evaluation

### Gold attempt suite

Create a reviewed suite for each verification policy containing:

- The primary teaching solution.
- Ordinary equivalent valid solutions.
- Valid but inefficient solutions.
- Short, obscure golf solutions.
- Correct target state reached without required skill evidence.
- Correct text with wrong mode, cursor, selection, or register.
- Temporary wrong states followed by undo recovery.
- Accidental input, retries, resets, and incomplete attempts.
- Unsupported or engine-divergent commands.
- Touch and physical-keyboard forms of relevant chords.

Every solver-discovered accepted candidate must replay through the browser
engine and the native-Vim fixture. Advanced state such as registers and undo
groups requires corresponding oracle output before it can gate lessons.

### Rule and model metrics

Measure at least:

- False rejection of valid alternative solutions.
- False acceptance when required skill evidence is absent.
- Strategy and misconception classification precision/recall.
- Calibration and abstention quality.
- Feedback factuality and agreement with deterministic facts.
- Feedback usefulness in expert review.
- Runtime latency, offline availability, and failure rate.
- Stability across exercise versions and unseen command combinations.

False rejection deserves particular attention: telling a learner that valid Vim
is wrong damages trust and can teach bad habits. Missing skill evidence should
produce a nuanced result rather than erase valid outcome recognition.

### Product and learning metrics

Do not optimize only for shorter attempts. Evaluate:

- Exercise completion and voluntary retry.
- Hint escalation and reset rates.
- Time to independent success.
- Delayed recall of the featured command.
- Transfer to varied buffers and cursor positions.
- Selection of an appropriate strategy in mixed review.
- Retention after days or weeks.
- Frustration, perceived fairness, and feedback usefulness.
- Where possible, later use on a physical keyboard or in an editor companion.

An A/B test that reduces keys today but harms delayed recall is not a successful
trainer improvement.

### Learned-feedback failure tests

Any LLM or local model path needs tests for:

- Malformed or missing structured output.
- Hallucinated commands and incorrect Vim explanations.
- Contradiction of deterministic validity or evidence.
- Unsupported command-family recommendations.
- Prompt injection through future user-authored text.
- Network timeout, quota exhaustion, and model unavailability.
- Excessive latency and output length.
- Privacy leakage and unintended inclusion of Free Practice text.
- Deterministic template fallback.

## Rollout

### Phase 1: explicit deterministic policies

- Preserve target-state validation.
- Add authored verification modes and meaningful terminal-state fields.
- Distinguish “valid outcome” from “practice goal demonstrated.”
- Keep canonical solutions for hints, demonstrations, and fixtures.

### Phase 2: structured trace and rule feedback

- Segment raw keys into logical command spans.
- Retain relevant before/after state deltas.
- Record hints, undo, retry, reset, and timing locally.
- Add deterministic command-family evidence and concise feedback templates.

### Phase 3: solver-assisted authoring

- Implement bounded search for small, controlled exercises.
- Produce diverse solution families and multi-metric pars.
- Detect shortcuts and generate conformance fixtures.
- Add counterfactual variants for robustness analysis.

### Phase 4: consented data and evaluation

- Establish versioned, privacy-safe attempt records.
- Build a human-reviewed, strategy-disjoint gold set.
- Compare rule coverage with real uncategorized traces.
- Define the precise feedback gaps worth learning.

### Phase 5: learned advisory feedback

- Benchmark rules and simple feature models first.
- Train the compact sequence model only if it adds measurable value.
- Compare local inference with optional cloud LLM feedback.
- Ship learned output only when it improves usefulness and false-rejection
  behavior without compromising latency, privacy, offline use, or delayed
  retention.

## Recommended product defaults

- Deterministic full-state validation is the authority.
- Guided reproduction is strict only during first introduction.
- Isolated drills normally require target state plus featured-skill evidence.
- Mixed review and challenges accept equivalent conformant solutions.
- Efficiency is feedback unless explicitly named as the challenge.
- Compare strategy families, not only token strings.
- Prefer one actionable observation after success.
- Use the solver offline for authoring and validation.
- Use an LLM offline as a candidate generator or optional advisory coach, never
  as the pass/fail judge.
- Pursue a small from-scratch trace model as a research project after telemetry
  and solver infrastructure, not as an MVP dependency.
- Keep Free Practice ungraded, local, and excluded from telemetry by default.

This design preserves the trustworthiness of a deterministic Vim trainer while
leaving substantial room for the ML work that is genuinely interesting:
strategy representation, synthetic trace generation, solution ranking,
misconception diagnosis, transfer evaluation, and longitudinal learner
modeling.

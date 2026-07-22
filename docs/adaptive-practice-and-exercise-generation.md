# Adaptive Practice and Exercise Generation

Research and product recommendation for Vim Wilds, current to **22 July 2026**.

## Executive decision

Vim Wilds should not solve its practice-depth problem by turning every lesson's
three scenarios into six or twelve near-identical immediate repetitions. It
should make practice **varied, outcome-based, and recurrent across sessions**.
The best architecture is neuro-symbolic:

- CodeMirror Vim executes learner input and deterministic state predicates
  decide validity.
- Explicit skill-evidence rules decide whether a valid solution practised the
  capability the exercise intended to teach.
- Templates, a typed Vim command DSL, search, statistical models, and LLMs may
  propose or rank exercises and explain already-verified facts.
- No probabilistic model is the authority for whether Vim reached the target.

The recommended order is:

1. audit the fresh catalogue and establish a reviewed gold set;
2. record attempts and accept outcome-valid learner commands in independent
   modes;
3. replace repeated guided scenarios with fresh validated variants;
4. add delayed review with a transparent per-skill scheduler;
5. broaden the activity formats and add exercise-level Explore mode;
6. add realistic multi-goal scenarios and a goal-free sandbox;
7. scale the reviewed pool with offline LLM assistance;
8. add optional model-written coaching only after deterministic facts and
   evaluation sets exist;
9. defer synchronous free-form generation and sophisticated adaptive models
   until real data demonstrates a need.

This document operationalizes the learning and practice portions of
[Curriculum and Progression](./curriculum-and-progression.md). It relies on the
validity/evidence/coaching separation in
[Exercise Verification and Feedback](./exercise-verification-and-feedback.md),
the reviewed authoring flow in
[Lesson Content Design](./lesson-content-design.md), and the release oracle in
[Vim Conformance](./vim-conformance.md). The companion documents cover
[ML experiments and model selection](./ml-experimentation-and-model-strategy.md),
[unit economics and monetization](./monetization-and-unit-economics.md), and
[product validation and launch](./product-validation-and-launch.md).

## What the app has now

### Catalogue audit

The figures below are derived from the 14 JSON files in `content/units/` and
the runtime expansion in [`app.js`](../app.js), not from an estimate.

| Measure | Current value | Consequence |
| --- | ---: | --- |
| Units | 14 | The planned core course is represented. |
| Lessons | 116 | Scheduling should operate below the unit level. |
| Authored exercise records | 362 | Raw record count is not the main shortage. |
| Lessons with exactly three exercises | 102 of 116 | The user's perceived “three per concept” pattern is real. |
| `guided-then-recall` exercises | 353 | Most records are presented twice without a new scenario. |
| Guided-only / recall-only records | 7 / 2 | Exceptions are rare. |
| Runtime guided / recall presentations | 360 / 355 | There are 715 presentations but only 362 authored scenarios. |
| Unit JSON size | 2,072,224 bytes | Naively materializing ten variants would approach 20 MB before assets. |
| Unit release status | 14 `authoring` | The catalogue is not yet a released gold set. |
| Runnable provenance | 478 native passed | This includes 116 demos as well as 362 exercises. |
| Human review | 317 draft; 161 reviewed | Units 1–9 are draft; Units 10–14 are reviewed. |
| Browser conformance | 445 passed; 33 pending | The pending records are Unit 10. |

`activityFlowFor()` currently clones one `guided-then-recall` activity into a
guided presentation and a recall presentation. The clone retains the same
buffer, cursor, goal, target, and script. In addition,
`processToken()` rejects a key before sending it to the editor whenever it is
not the next canonical key. `isTargetSnapshot()` already compares text, mode,
cursor, registers, and viewport, but it is reached for completion only after
the complete canonical script has been accepted.

The content is therefore rich in **command coverage** but shallow in four
different kinds of learning evidence:

- recall after time has passed;
- applying the same idea to a changed surface form;
- choosing a command family without being told which one;
- making, diagnosing, and recovering from an error.

Local persistence currently stores the active unit/activity, theme preference,
and save time. It does not retain completed attempts, hint use, errors, skill
state, or review dates. Durable adaptation must begin with that progress record.

### The stale-design warning

[Exercise Verification and Feedback](./exercise-verification-and-feedback.md)
describes the intended outcome-based architecture and parts of an earlier
runtime baseline. The current `processToken()` implementation is stricter than
that baseline description. When implementation begins, source code and tests
are the current-state authority; the verification document remains the target
design authority.

## What improves learning

These findings support product choices, not universal formulas. Effects vary by
prior knowledge, material, delay, feedback, and transfer distance.

| Principle | Evidence and boundary | Product decision |
| --- | --- | --- |
| Retrieval practice | Practice testing and distributed practice are among the most broadly supported study techniques; retrieval commonly improves delayed retention even where restudy looks competitive immediately. [Dunlosky et al., 2013](https://doi.org/10.1177/1529100612453266), [Roediger & Karpicke, 2006](https://pubmed.ncbi.nlm.nih.gov/16507066/) | Keep recall, but make its first attempt cue-free: no next key, command family, or revealed solution. |
| Repeated retrieval | Dropping material after one successful retrieval produces weaker later retention than retrieving it again. Extra restudy after success does not provide the same benefit. [Karpicke & Roediger, 2008](https://doi.org/10.1126/science.1152408) | A first success creates future review obligations; it does not permanently “master” a skill. |
| Successive relearning | Reaching correct recall again across spaced sessions can produce durable retention efficiently. [Rawson & Dunlosky, 2011](https://pubmed.ncbi.nlm.nih.gov/21707204/), [Rawson et al., 2018](https://pubmed.ncbi.nlm.nih.gov/29431462/) | Prefer a few successful attempts on different days to many identical attempts in one sitting. |
| Spacing | The useful gap depends on the desired retention interval; there is no single scientifically exact interval for every learner and skill. [Cepeda et al., 2008](https://doi.org/10.1111/j.1467-9280.2008.02209.x) | Begin with configurable, explainable intervals and calibrate them from delayed-recall data. |
| Avoiding massed overpractice | Additional same-session practice can show diminishing delayed benefit; in one mathematics experiment, distribution helped where overlearning did not. [Rohrer & Taylor, 2006](https://doi.org/10.1002/acp.1266) | Do not require a fixed large number of repetitions from everyone. Continue only until an initial criterion, then schedule review. |
| Guidance fading | Worked examples help novices, but support should fade toward independent problem solving. [Renkl & Atkinson, 2003](https://doi.org/10.1207/S15326985EP3801_3) | Use demonstration → completion → command-shape hint → independent outcome → transfer, rather than one guided/recall duplicate. |
| Varied examples | Retrieval with different examples can improve transfer to novel examples more than repeatedly retrieving one example. [Butler et al., 2017](https://scholars.duke.edu/publication/1292911) | Change identifiers, cursor position, layout, delimiters, counts, distractors, and language while holding the underlying skill stable. |
| Interleaving | Interleaving is especially useful when learners must discriminate between similar categories; effects depend on the material and comparison. [Brunmair & Richter, 2019](https://pubmed.ncbi.nlm.nih.gov/31556629/) | Mix confusable choices such as `w/W`, `f/t`, `iw/aw`, and `p/P`; do not merely shuffle unrelated tasks. |
| Transfer | Retrieval-practice transfer is positive on average but is moderated by the kind and distance of transfer. [Pan & Rickard, 2018](https://pubmed.ncbi.nlm.nih.gov/29733621/) | Test changed buffers and tool choice. Do not claim that phone drills alone establish physical-keyboard fluency. |
| Productive errors | Failed retrieval can improve later learning when relevant correction follows, while feedback helps prevent retention of wrong alternatives. [Kornell et al., 2009](https://doi.org/10.1037/a0015729), [Butler & Roediger, 2008](https://doi.org/10.3758/MC.36.3.604) | In independent modes, let supported Vim execute, explain the observable mismatch, support undo/recovery, and retest later. |
| Explanatory feedback | In computer-based learning, elaborated feedback generally outperforms correctness-only feedback. [Van der Kleij et al., 2015](https://doi.org/10.3102/0034654314564881) | Give one semantic explanation such as “`aw` included the following space,” not only “wrong key.” |
| Self-explanation | Learners who connect worked steps to principles tend to learn more successfully. [Chi et al., 1989](https://doi.org/10.1207/s15516709cog1302_1) | Use structured prompts—identify count/operator/motion or choose why a range ended there—without requiring mobile free text. |
| Prediction | A randomized programming study found benefits from predicting program behavior before instruction compared with production-first activity. [Tucker et al., 2024](https://doi.org/10.1016/j.learninstruc.2023.101871) | Ask learners to predict cursor, range, mode, register, or text before running a command. |
| Erroneous examples | Detectable, correctable erroneous examples can help, but overly difficult errors are often not diagnosed by novices. [Heitzmann et al., 2021](https://doi.org/10.1016/j.learninstruc.2021.101497) | Introduce one plausible misconception at a time only after its component skills are established. |
| Mastery learning | Mastery approaches show positive average achievement effects but can require more time and can lower self-paced completion. [Kulik et al., 1990](https://doi.org/10.3102/00346543060002265) | Recommend remediation and test-out; do not trap users behind indefinite hard gates. |
| Autonomy | Autonomy support is positively associated with motivation and engagement across a large evidence base. [Mammadov & Schroeder, 2023](https://doi.org/10.1016/j.cedpsych.2023.102235) | Preserve preview, skip, focused practice, test-out, and Free Practice with visible recommendations rather than opaque locks. |

### The replacement for “three guided plus three recall”

Use a variable, criterion-based sequence:

1. **Demonstrate.** Animate one worked solution, including affected range,
   cursor, mode, and why the command shape fits. This is exposure, not mastery.
2. **Predict or discriminate.** Ask what a command changes, or contrast it with
   the nearest plausible alternative.
3. **Fade.** Supply one missing count/operator/motion, then only the command
   shape, then only the editing objective.
4. **Independent near transfer.** Use a different isomorphic buffer, accept any
   supported valid path, and require explicit skill evidence where the lesson
   is about a method rather than only an outcome.
5. **Interleaved transfer.** Mix the new skill with one or two already learned
   confusable or complementary skills without naming the intended family.
6. **Successive relearning.** Schedule a changed independent item in a later
   session. Expand the interval after delayed hint-free success; shorten it and
   offer correction after failure.

A reasonable v1 product heuristic is two first-attempt, hint-free successes on
distinct variants before moving the skill from “Learning” to “Practised.” That
is a testable starting policy, not a scientific constant. Guided completion,
hinted success, immediate recall, delayed recall, and mixed transfer must carry
different evidence weight.

## Exercise format catalogue

The modes are complementary. A lesson need not use all of them.

| Format | What the learner does | What it measures | Implementation summary |
| --- | --- | --- | --- |
| Guided demonstration | Watches or steps through the canonical keys and state changes. | Exposure and comprehension, not retention. | Keep the current script/checkpoint playback. Mark the event as exposure only. |
| Faded completion | Supplies a missing count, operator, motion, object, or control key. | Command grammar with reduced recall burden. | Parameterize which semantic slots are hidden; never split a literal in a misleading way. |
| Prediction | Predicts text, range, cursor, mode, register, or viewport before execution. | Mental simulation of Vim state. | Use structured answer choices derived from deterministic counterfactual executions. |
| Contrast pair | Chooses between two confusable commands and explains the observable difference. | Discrimination, not rote command recall. | Author one minimal pair and verify both outcomes. |
| Outcome challenge | Reaches the deterministic target with any supported conformant path. | Independent command production. | Remove prefix rejection; complete from target predicates and declared constraints. |
| Mixed tool choice | Chooses and runs an approach without being told its command family. | Strategy selection among learned tools. | Hide skill labels; draw supporting skills from compatibility metadata. |
| Mistake clinic | Receives variants aimed at a recently observed misconception. | Correction and later recovery. | Select from deterministic misconception tags and validated remedial templates. |
| Erroneous-solution repair | Diagnoses and repairs one plausible bad command or trace. | Error detection and conceptual contrast. | Execute the bad trace to derive its state; keep difficulty narrowly controlled. |
| Equivalent-strategy comparison | Solves, then compares valid alternatives by setup cost, repeatability, register risk, and clarity. | Editing judgment. | Use authored/solver-derived strategy families; do not let one key count define quality. |
| Efficiency refinement | Solves freely, then optionally improves repetition such as `jjjjj` to `5j`. | Fluency after correctness. | Apply explainable rules to normalized logical commands. Repetition is not universally wrong. |
| Scenario chain | Completes several goals in one persistent buffer. | State management across registers, search, marks, dot, and macros. | Each stage has a target predicate; later stages inherit verified state. |
| Capstone | Completes an unseen realistic multi-skill transformation. | Integration and farther transfer. | Sample only introduced skills and use a reviewed, versioned scenario. |
| Focused drill | Selects a command family and receives controlled variants. | Deliberate remediation or fluency. | Vary one or two explicit difficulty dimensions at a time. |
| Startup review | Completes a short due queue before or instead of new material. | Delayed retention. | Offer roughly three to five items or about two minutes, always skippable. |
| Explore this exercise | Uses unrestricted commands in the current scenario, with optional target detection. | Experimentation around a known goal. | Branch from the authored initial state; disable canonical grading; preserve reset/undo. |
| Realistic scenario practice | Edits a larger buffer through optional mission cards. | Tool choice across a workflow. | Persist editor state between goals and report only verified outcomes. |
| Goal-free sandbox | Edits curated or pasted local content with no required result. | Agency and command exploration, not mastery. | No pass/fail; recap command families without judging unexpressed intent. |
| Real-editor bridge | Copies/downloads a fixture and target for native Vim. | Transfer to a physical keyboard and real editor. | Provide target diff/self-check; treat results as optional self-report unless a local verifier is supplied. |

### Difficulty is a vector

Do not compress difficulty into only `easy/medium/hard`. Manipulate explicit
dimensions:

- guidance level and target highlighting;
- command composition length;
- cursor distance and count size;
- delimiter/text-object ambiguity;
- buffer length and viewport movement;
- similarity of distractors;
- number of skill families integrated;
- state carried from previous goals;
- breadth of accepted solutions;
- speed only after accurate independent performance is stable.

Change one or two dimensions at a time. That makes both remediation and data
interpretation tractable. When a learner struggles, reduce independent
complexity, show a worked contrast, and return to a close variant. When a task
is easy, first remove cues and vary context; do not immediately jump to a new
command family.

## Three kinds of free practice

### 1. Explore this exercise

This is the highest-return first free-command feature because every authored
exercise already supplies an initial state and target.

- “Explore” makes a copy of the initial scenario and sends every supported key
  to the Vim engine.
- The learner may show or hide the goal and may reset or undo freely.
- An optional detector announces when the exercise's target predicate is met.
- Reaching the target in Explore does not automatically count as independent
  mastery unless the learner explicitly started a graded outcome attempt.
- The canonical solution remains available as a hint or replay, not as an
  input gate.

### 2. Realistic scenario practice

Use persistent, medium-sized local buffers with several optional goals. This is
the bridge from isolated commands to actual editing judgment.

Examples include refactoring function calls, cleaning a test table, updating a
configuration file, navigating a log, or normalizing repeated declarations.
The learner can complete missions in any order. Registers, search state, marks,
dot-repeat, macros, and undo history carry across stages when supported and
verified.

### 3. Goal-free sandbox

Offer curated local packs for source code, prose, JSON, configuration, logs,
CSV, tests, and documentation in small/medium/large sizes. A learner may also
paste content that remains on-device. Optional mission cards can supply a goal,
but an entirely open session has no pass/fail and makes no mastery claim.

A recap may safely report:

- command families and modes used;
- repeated manual motion patterns;
- known commands the learner has already studied that might be worth revisiting;
- links to related reviewed drills.

It must not say an edit was “wrong” when the user never declared an intention,
and uploaded analytics must not include their buffer, inserted literals,
search strings, or Ex arguments by default.

## Exercise supply architecture

### Canonical representation

Treat an exercise as:

```text
(S0, G, K, pi)

S0 = deterministic initial editor state
G  = terminal goal predicate and optional constraints
K  = primary and supporting skill evidence
pi = one reviewed teaching strategy, not the only valid solution
```

The generator should normally select `pi` first, construct an `S0` in which
its preconditions hold, execute `pi`, and derive the target from the observed
result. Asking a model to independently invent both a solution and its supposed
target creates avoidable opportunities for inconsistency.

### Supply ladder

| Level | Method | Best use | Runtime dependency | Principal risk |
| --- | --- | --- | --- | --- |
| 1 | Reviewed authored bank | Gold examples, introductions, capstones | None | Limited coverage and author time |
| 2 | Template + seed | High-volume controlled surface variation | None | Templates that vary appearance but not reasoning |
| 3 | Typed Vim DSL, solution-first construction | New counts, layouts, delimiters, command compositions | None | Incomplete preconditions or unrealistic buffers |
| 4 | Constraint/search generation | Cases hard to express with simple slots | None after build | Complexity and generator bugs |
| 5 | Offline LLM authoring | Diverse realistic buffers, instructions, distractors, new template proposals | None in shipped lesson | Hallucination and style drift, contained by rejection |
| 6 | Background validated pool refill | Personalised supply without lesson latency | Optional server | Validation capacity, privacy, and pool fragmentation |
| 7 | Synchronous personalised generation | Experimental long-tail requests | Required server | Latency, retries, low cacheability, and little incremental learning value |

Level 2 is the best next scaling step. A template should define:

- `templateId`, `generatorVersion`, and deterministic `seed`;
- primary skills and compatible supporting skills;
- a typed teaching-program skeleton;
- buffer slots and construction constraints;
- difficulty knobs;
- target and evidence policy;
- instruction/hint/feedback templates;
- supported language/profile families;
- novelty and counterfactual test rules.

For example, a “counted vertical movement” template can vary start row,
distance, line lengths, goal marker, buffer type, and distractors while ensuring
that the target remains visible and that `5j` demonstrates count usage. A
solver can still discover that `jjjjj` reaches the same place; validity accepts
it in outcome mode while evidence/feedback distinguishes the strategy.

### Beyond templates without a language model

Several lightweight model families can help without learning all of English or
all of Vim:

- a weighted grammar or probabilistic context-free grammar learns which typed
  DSL productions are appropriate for a skill and difficulty;
- a constraint solver samples buffers satisfying command preconditions;
- evolutionary/search generation optimizes novelty, robustness, and predicted
  difficulty under hard verifier constraints;
- a gradient-boosted ranker scores a large valid candidate set for likely
  learning value;
- a contextual bandit chooses among validated template families for a learner;
- a small sequence model generates strategy skeletons or simulated novice
  traces in the typed command language.

The important boundary is that learned models select or propose. The executor
contains Vim semantics and the verifier accepts content. A model trained from
scratch over a small command DSL can therefore be tiny; a fluent exercise
author is more realistically obtained by adapting a pretrained language model.
See [ML Experimentation and Model Strategy](./ml-experimentation-and-model-strategy.md)
for the size estimates and experiment ladder.

### Skill mixing instead of a unit matrix

A complete 14 × 14 unit matrix is feasible but wastes authoring effort on
combinations that are either trivial, premature, or incoherent. Model the
mixing contract at atomic skill/template level:

1. choose a primary due or current skill `X`;
2. form eligible supporting skills from `X`'s introduced prerequisites,
   reviewed confusable alternatives, and already-mastered due skills;
3. filter templates by declared compatibility and supported editor state;
4. prefer an unseen surface variant and penalize recently used templates;
5. add a third skill only for integrated learners and capstones.

A pairwise unit matrix can remain a coverage report, but it should not be the
generation mechanism or learner model.

### Storage and delivery

Ten fully materialized copies of the current unit JSON would grow the lesson
data from about 2 MB toward 20 MB. That is avoidable:

- ship compact templates and seeds where the generator is closed and fully
  property-tested at build time;
- keep one core offline fallback pack for every skill;
- lazy-fetch and cache versioned validated variant packs by unit or skill;
- materialize individual variants server-side where exact native/browser
  provenance must be retained;
- never make the entire shared pool part of the service worker's mandatory
  precache.

## Deterministic acceptance and grading

### Three independent judgments

1. **Validity:** required terminal editor fields match. This is deterministic.
2. **Skill evidence:** the trace caused the relevant state transitions or
   document effects. This is deterministic where used for progression.
3. **Coaching:** compare strategies, identify a likely misconception, and give
   one useful suggestion. This may use rules, a solver, a learned ranker, or an
   LLM and must be allowed to abstain.

Key count is neither validity nor complete evidence. `5j` is often a better
teaching strategy than `jjjjj`, but repeated keys may be sensible for an
uncertain one-line adjustment. Record raw keys, logical commands, inserted
literals, mode transitions, setup/navigation, undo/recovery, repeatability, and
robustness separately.

### Candidate acceptance pipeline

Every generated exercise, regardless of generator, follows the same stages:

1. Parse against the versioned JSON schema or typed DSL.
2. Reject unknown commands, profiles, states, skill IDs, and out-of-bounds
   positions.
3. Require nontrivial `S0`, target predicates, and declared skill evidence.
4. Execute the teaching program in an isolated deterministic adapter to derive
   its target where possible.
5. Replay the finalist in native Vim and the pinned headless browser engine.
6. Require agreement for all applicable text, cursor, mode, selection,
   register, search, viewport, and checkpoint fields.
7. Run controlled counterfactuals—identifier length, cursor column, spacing,
   counts, distractors—to expose brittle absolute-position solutions.
8. Search for alternative strategy families and unsatisfiable or trivial
   targets within a bounded state space.
9. Reject duplicates and near-duplicates against reviewed content.
10. Score difficulty, clarity, realism, portability, and unsupported-feature
    risk.
11. Place candidates in quarantine until automatic checks pass and the
    configured human-review sample is complete.
12. Publish a versioned immutable content record with generator and validator
    provenance.

JSON-constrained decoding guarantees shape, not Vim correctness. Native/browser
execution remains mandatory. If future generators can emit search or Ex
literals, use an allowlist parser and a no-network, time/memory-limited native
Vim worker; `vim -Nu NONE` is an oracle configuration, not a security boundary.

## Scheduling and progression

### Per-skill state first

Begin with an interpretable local state for every atomic skill:

- independent successes and failures;
- guided exposures, kept separate from independent evidence;
- hint level, retries, reset, undo/recovery, and abandon;
- latency band and input source;
- last practice time and scheduled due time;
- recent misconception tags;
- latest near-transfer, mixed-transfer, and delayed-recall evidence.

Map scheduling to a stable skill/context family, not to every randomized
exercise instance. A fresh variant is an observation of the same skill; it does
not need an independent forgetting curve.

### Startup behavior

When reviews are due, offer a prominent two-minute warm-up of approximately
three to five varied items. Always retain **Continue lesson**, **Choose
practice**, and **Skip review**. If nothing is due, continue the recommended
lesson or offer a new-user diagnostic.

A session should explicitly reserve slots for:

- due retention;
- the current weak or newly introduced skill;
- one interleaved prerequisite or confusable skill;
- one transfer/mixed item when the learner is ready.

This quota prevents a single score from serving six nearly identical tasks.
Order candidates by overdue risk and weakness while strongly penalizing recent
template reuse.

### Starting update policy

- First independent success: schedule a short-delay or next-session review.
- Delayed first-attempt success without hints: expand the interval.
- Success after hint or recovery: retain or modestly expand it.
- Failure: show one semantic correction, retry a fresh close variant after one
  or two intervening items, and shorten the next interval.
- Mixed-transfer success: treat as stronger evidence than an isolated
  same-family task.
- Guided replay: record exposure but do not infer durable mastery.

Wall-clock intervals must be configurable. “Next session” is a useful fallback
for irregular PWA usage. More advanced scheduling and knowledge-tracing models
belong in the companion [ML strategy](./ml-experimentation-and-model-strategy.md),
after the rule baseline produces real longitudinal data.

### Unlocking

Retain the curriculum's hybrid progression:

- Foundations receive a strong sequential recommendation.
- Later tracks use prerequisite recommendations.
- Every unit remains visible and previewable.
- Learners may test out or skip with a warning.
- “Chapter complete” means exposure and initial competence; “durably mastered”
  requires delayed independent evidence.
- Failure never removes rewards, streaks, or access.

The product-facing states remain `Unseen`, `Learning`, `Practised`, `Integrated`,
and `Maintenance due`. The scheduler supplies evidence for those labels; it
does not turn them into hard locks.

## Proposed implementation contracts

These are forward contracts, not schema changes made by this research task.

### Practice policy

```json
{
  "practicePolicy": {
    "mode": "guided-sequence | faded | constrained-state | outcome | coached-outcome | explore | sandbox",
    "guidanceLevel": 0,
    "countsForMastery": true,
    "allowRecovery": true
  }
}
```

Only `guided-sequence` rejects a divergent next key. `explore` and `sandbox`
never count as mastery by default.

### Target and evidence policy

```json
{
  "targetPolicy": {
    "text": "exact | predicate | ignored",
    "cursor": "exact | row | region | ignored",
    "mode": "exact | allowed-set | ignored",
    "selection": "exact | semantic-range | ignored",
    "registers": ["0", "a"],
    "viewport": "exact | ignored"
  },
  "evidence": {
    "required": ["counted-vertical-motion"],
    "forbidden": [],
    "advisory": ["excessive-single-step-motion"]
  }
}
```

Required evidence must describe an observable logical command/effect, not a raw
substring. Pressing `.` without the relevant document delta is not dot-repeat
evidence; invoking a macro that causes no intended transformation is not macro
evidence.

### Generated instance

```json
{
  "templateId": "counted-vertical-target",
  "generatorVersion": "1.0.0",
  "seed": "u02-l03-r17",
  "primarySkills": ["counted-vertical-motion"],
  "compatibleSupportingSkills": ["line-boundary-motion"],
  "contentHash": "...",
  "provenance": {
    "method": "template | constraint | llm-assisted",
    "generatorModel": null,
    "nativeValidation": "passed",
    "browserConformance": "passed",
    "reviewStatus": "reviewed"
  }
}
```

### Attempt and assignment facts

Persist immutable raw facts locally; derive labels later:

```text
assignment:
  session, policy/version, eligible candidate IDs, selected ID,
  selection probability, learner-state snapshot hash

attempt:
  content/template/generator/version, skills, mode, guidance,
  active duration, validity, evidence, hints, retries, reset,
  recovery, abandon, delayed/varied/mixed flags

command event:
  normalized logical command, mode transition, coarse timing,
  state-delta features, input source

skill observation:
  attempt × skill, evidence strength, label version, due-state update
```

Keep the complete local trace for immediate coaching when the learner permits
it. Uploaded analytics should prefer normalized command families and state
deltas; do not upload user-owned Free Practice buffers or inserted/search/Ex
literals by default. Log the candidate set and selection probability from the
first adaptive release so later off-policy comparisons remain possible.

## Ranked implementation roadmap

### Phase 0 — trustworthy baseline

1. Review Units 1–9, finish Unit 10 browser conformance, and move only audited
   items from `authoring` toward release.
2. Create gold suites for ordinary alternatives, misconception traces,
   generated-item acceptance, and delayed-transfer outcome definitions.
3. Record baseline completion, errors, hint use, and scenario reuse locally.

### Phase 1 — fix the learning loop

4. Segment logical commands and persist versioned attempts/per-skill progress.
5. Keep exact reproduction for demonstrations, but introduce deterministic
   outcome/evidence grading for independent practice.
6. Add template-and-seed variants so recall uses a different scenario.
7. Add startup review with a simple rule-based spacing/interleaving policy.

### Phase 2 — deepen practice

8. Add prediction, faded completion, contrast, mixed tool-choice, recovery, and
   mistake-clinic activities.
9. Add Explore this exercise.
10. Add persistent scenario chains/capstones, then the full curated sandbox.

### Phase 3 — scale and personalize

11. Generate offline LLM candidates into the same quarantine/verifier pipeline.
12. Add optional fact-grounded model coaching with a deterministic local
    fallback and hard spend limits.
13. Compare statistical learner models and candidate rankers against the rule
    baseline using delayed unseen-template outcomes.
14. Experiment with compact local models, fine-tuning, and distillation.
15. Consider background personalised pool refill, then synchronous generation,
    only if a large validated shared bank still fails a measured user need.

## Evaluation and acceptance criteria

The main learning metric is **delayed first-attempt, hint-free success on an
unseen but equivalent template**, with mixed-context transfer as a second key
measure. Immediate completion, keystroke count, time in app, and streak length
are not sufficient learning evidence.

Run these initial product experiments in order:

1. fresh recall variant versus replayed guided scenario;
2. outcome/evidence grading versus exact sequence in independent practice;
3. due-review queue versus fixed sequence for equal practice time;
4. explanatory rule feedback versus correctness-only feedback;
5. template/rule coaching versus model-written coaching after both receive the
   same deterministic facts.

Each experiment should use stable holdout variants, held-out learners where
possible, immediate and delayed measurement, and one predeclared primary
retention outcome. Track frustration, abandonment, false rejection of valid
alternatives, and time cost as guardrails.

The generation system is acceptable only when it reports:

- schema and engine acceptance yield by failure reason;
- native/browser agreement;
- canonical solvability and alternative-strategy coverage;
- required-evidence precision;
- duplicate/novelty and counterfactual robustness;
- difficulty calibration;
- reviewed realism, clarity, and teaching value;
- p50/p95 latency and cost for every model-assisted stage.

## What not to do first

- Do not add six more copies of every current scenario and call that mastery.
- Do not ask an LLM whether arbitrary Vim output is correct when the engine can
  execute and compare it.
- Do not send a model request per keystroke.
- Do not build every unit pair without skill/template compatibility.
- Do not train deep knowledge tracing on one developer's short history.
- Do not ship a multi-gigabyte browser model as a mandatory phone download.
- Do not let simulated learners stand in for evidence from real learners.
- Do not advertise an “85% rule” or fixed spacing interval as settled science.
- Do not hard-lock curious or experienced users out of content.

The durable product advantage is not unlimited generated exercises. It is a
trusted loop that knows what Vim actually did, gives the learner varied chances
to retrieve and choose, revisits weak skills after time has passed, and can
explain its decisions.

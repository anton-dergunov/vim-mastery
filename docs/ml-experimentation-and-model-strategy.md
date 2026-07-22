# ML Experimentation and Model Strategy

**Research snapshot:** 22 July 2026

**Status:** product and experimentation proposal; no model or interface in this
document is implemented

## Executive decision

Vim Wilds should not be designed as an LLM tutor with a Vim-shaped prompt. It
has a much stronger technical advantage: the app owns a deterministic editor
environment, explicit target states, a skill taxonomy, and short observable
command traces. The recommended architecture is therefore **neuro-symbolic**:

1. The Vim engine and conformance fixtures decide what happened and whether the
   result is valid.
2. Rules and an offline solver identify skill evidence, known strategies,
   inefficient patterns, and counterexamples.
3. Statistical learner models estimate what the learner is likely to remember.
4. A ranking policy chooses among already-valid exercises.
5. Small models or LLMs may generate candidates and explain verified facts, but
   they never create truth by assertion.

This division is both safer for learners and more interesting as a data-science
project. It makes it possible to compare a rule baseline, classical models, a
small trace encoder, local open-weight language models, and hosted frontier
models on the same versioned evaluation set.

The current best estimate of the useful model-size floor is:

- **No learned model** for correctness, basic feedback, template generation,
  and the first scheduler.
- **Logistic regression or gradient-boosted trees** for early success
  prediction, exercise difficulty, and mistake or strategy classification.
- **A 5–20M parameter GRU, temporal convolution, or Transformer encoder** for
  command-trace classification, ranking, and feedback-template selection.
- **A tuned 0.6–4B language model** for constrained template filling and short
  coaching grounded in facts supplied by the verifier.
- **A 7–14B model** as the practical first local bracket for diverse exercise
  authoring.
- **A 20–32B model or hosted frontier model** for hard authoring, teacher
  labels, rubric design, and escalation.

Those brackets are **engineering hypotheses, not benchmark results**. Parameter
count is not a universal measure of capability, sparse and dense models are not
directly comparable, and Vim-specific performance may move every boundary. The
way to decide is to build one gold suite and select the smallest model that
meets its quality, latency, and cost gates.

This document focuses on the ML system. The surrounding product decisions live
in:

- [Adaptive Practice and Exercise Generation](./adaptive-practice-and-exercise-generation.md)
  for exercise modes, generation stages, scheduling behavior, and the product
  implementation order;
- [Exercise Verification and Feedback](./exercise-verification-and-feedback.md)
  for the deterministic verifier, command evidence, solver, and feedback
  policies;
- [Vim Conformance](./vim-conformance.md) for native-Vim and browser truth;
- [Curriculum and Progression](./curriculum-and-progression.md) for the skill
  graph and learning progression;
- [Monetization and Unit Economics](./monetization-and-unit-economics.md) for
  provider prices and deployment economics; and
- [Product Validation and Launch](./product-validation-and-launch.md) for user
  research, retention metrics, experiments, and rollout gates.

## How to read the claims

This document deliberately separates four kinds of statement:

- **Repository fact:** observed in the current source or content catalog.
- **Research evidence:** supported by a linked paper or official technical
  source.
- **Engineering proposal:** a recommended architecture or interface for Vim
  Wilds.
- **Hypothesis:** a numerical starting point that must be tested on the Vim
  Wilds evaluation set.

Model families, licenses, runtimes, and hardware support are volatile. Facts in
those sections are timestamped to 22 July 2026 and should be refreshed before a
model is adopted or marketed.

## Current baseline and the ML opportunity

The catalog audit for this research found 14 units, 116 lessons, and 362
authored exercise records. Runtime expansion produces 360 guided and 355 recall
activities, but most concepts still have only three unique authored scenarios.
Guided and recall commonly use the same initial and target states, so immediate
recall often tests reproduction of a just-seen trace rather than transfer to a
new instance.

The content already contains stable skill identifiers, primary and supporting
skills, difficulty dimensions, initial and target editor state, canonical
steps, checkpoints, and provenance. That is unusually strong structured input
for both generation and learner modeling. However:

- `verification.inputPolicy` is currently constrained to `exact-sequence` by
  the unit-content schema.
- `processToken()` rejects a key that differs from the next canonical key
  before the Vim engine executes it.
- A deterministic target-state comparison exists, but it is reached only after
  the canonical sequence has been accepted.
- Persistence stores navigation and session preferences, not an immutable
  attempt history, per-skill mastery, mistakes, or due reviews.
- Most runnable content provenance remains in draft review status, so the
  existing bank must be audited before it becomes training data or a gold set.

The immediate opportunity is not to add an LLM call. It is to turn the existing
structured content and deterministic editor into clean observations. Once the
app can accept and segment alternative commands, one interaction can yield:

- exact final-state validity;
- required and forbidden skill evidence;
- a logical command trace and state deltas;
- strategy and efficiency features;
- hint, retry, recovery, and latency signals; and
- a delayed outcome when the same skill reappears later.

That is enough to build useful baselines before collecting a large user
population.

## Four jobs that must remain separate

“Use AI for exercises” hides four materially different problems. Combining
them into one prompt would make evaluation and failure recovery much harder.

| Job | Ground truth | Best first implementation | Possible learned extension | Must not do |
| --- | --- | --- | --- | --- |
| Correctness verification | Editor state and conformant Vim execution | Deterministic engine replay, target predicates, evidence rules, native/browser fixtures | None required | Ask a model whether a trace “looks correct” |
| Attempt interpretation | Verified command spans, state deltas, solution families, reviewed labels | Rules, solver comparison, feature model | 5–20M trace encoder; fact-grounded LLM prose | Override validity or invent command effects |
| Learner-state estimation | Later performance on the same skills under independent recall | Transparent per-skill counters and forgetting heuristic | PFA, HLR, BKT/DAS3H, IRT, then sequence models | Treat one completion as permanent mastery |
| Next-exercise selection | Delayed learning and workload outcomes | Constrained candidate generation plus deterministic score | Calibrated ranker, then a safe contextual bandit | Let a generative model choose arbitrary unsupported content |

### 1. Correctness verification

Correctness is an execution problem, not a language-understanding problem. The
app can already observe text, cursor, selection, mode, registers, and viewport;
after extending the trace/snapshot contract it can also retain search state,
repeat state, macros, marks, and undo behavior. A full
target predicate can specify only the fields relevant to a task. Logical
command evidence can then answer the separate question “did this attempt
practice the intended skill?”

For example, when the goal is to move down five lines:

- `5j` and `jjjjj` can both be valid Vim and reach the same state;
- a movement lesson can accept both outcomes;
- a count-focused drill can report “target reached, but the count was not
  demonstrated”; and
- an efficiency coach can deterministically identify five repeated `j`
  commands and suggest the counted form.

Raw sequence length is useful evidence, but it is not a correctness rule.
Literal insertion, search patterns, and Ex commands can be long while still
being strategically appropriate. Compare logical commands, mode transitions,
repeated manual actions, setup cost, replay cost, and the solver’s strategy
family instead. The complete verifier design is in
[Exercise Verification and Feedback](./exercise-verification-and-feedback.md).

### 2. Attempt and misconception interpretation

This layer maps a valid or invalid trace to useful, non-authoritative labels:

- strategy families such as counted motion, text object, Visual selection,
  dot-repeat, macro, substitution, or `:normal`;
- misconception classes such as forgotten `Escape`, count attached to the
  wrong command, selection off by one row, register overwritten, premature
  Insert mode, or macro replay from an unstable anchor;
- efficiency dimensions such as repeated manual action, avoidable navigation,
  repeated mode changes, or failure to reuse a prepared change; and
- the most useful next feedback template.

The first implementation should be rules over engine-derived command spans and
state transitions. A solver can provide multiple valid strategy families and
controlled near misses. A compact model becomes useful when real traces reveal
combinations that would make the rule set brittle or expensive to curate.

An LLM is optional at the final prose step. It should receive facts such as:

```json
{
  "validOutcome": true,
  "requiredEvidenceSatisfied": false,
  "recognizedStrategy": ["repeated-motion:j"],
  "repeatedCommandCount": 5,
  "availableAlternative": "5j",
  "teachingSkill": "motion-count",
  "feedbackIntent": "acknowledge-then-compare"
}
```

It may turn those facts into friendly language, but it may not change them.
Malformed output, low confidence, an unknown label, a claimed unsupported
command, or a contradiction must fall back to a reviewed local template. This
matters pedagogically: experimental work on erroneous LLM tutoring feedback
found that more hallucinated feedback increased learner confusion and reduced
perceived usefulness and accuracy
([Wang et al., Learning @ Scale 2025](https://doi.org/10.1145/3698205.3729555)).

### 3. Learner-state estimation

Attempt interpretation asks what happened now. Learner-state estimation asks
what is likely to be recalled later. The label for the second task must come
from a later, sufficiently independent attempt—not from whether the learner
eventually completed the current exercise after hints.

Useful observations include:

- independent success versus guided completion;
- target validity and intended-skill evidence;
- first-attempt success, retries, undo recovery, and reset;
- hint tier reached;
- time to first meaningful command and time to completion;
- exercise template, difficulty dimensions, and supporting skills;
- time since last exposure and distribution of earlier practice;
- whether the buffer and surface form were novel; and
- later hint-free success on the same skill.

The output should be calibrated predictions such as `P(independent success in
7 days | history)`, not a decorative “92% mastered” score whose meaning cannot
be tested.

### 4. Next-exercise selection

Selection should operate only over a deterministic candidate set. Hard filters
enforce supported commands, prerequisites, due skills, recent-duplicate
avoidance, session length, accessibility constraints, and content validation.
A policy then ranks eligible assignments using mastery uncertainty, predicted
recall, review urgency, desired difficulty, transfer value, variety, recent
mistakes, and the learner’s stated goal.

A transparent initial score is preferable to a black box:

```text
score = review_urgency
      + target_skill_need
      + transfer_and_variety_value
      + learner_goal_match
      - recent_template_repetition
      - predicted_frustration
      - session_cost
```

Every assignment must log the full eligible candidate set, the chosen item,
the scoring-policy version, and the probability of selection. Without those
propensities, later off-policy evaluation is either impossible or strongly
biased. Contextual-bandit research shows why logged action probabilities and
overlap matter, and why importance-weighted estimators can become unstable when
the new and logging policies choose very different actions
([Zhan et al., KDD 2021](https://arxiv.org/abs/2106.02029)).

## Model-size ladder: what is likely to be enough?

The correct comparison is task-specific quality per unit of latency and cost,
not one leaderboard score. The following ladder is the recommended experiment
order.

| Tier | Candidate approach | Likely Vim Wilds role | Why it may be enough | Principal risk | Promotion gate |
| --- | --- | --- | --- | --- | --- |
| No learned model | Rules, templates, typed generators, search | Validity, evidence, basic coaching, scheduler | The environment is deterministic and the command language is bounded | Editorial rule coverage | Ship first; retain as permanent fallback |
| Classical ML | Regularized logistic regression, mixed-effects regression, gradient-boosted trees | Success prediction, item difficulty, misconception and template labels | Strong on small tabular datasets; explainable; cheap | Manually engineered sequence features | Beat rules or simple counts on grouped, time-based holdouts |
| 5–20M parameters | GRU, TCN, or 4–6 layer Transformer encoder with 128–256 hidden dimensions | Trace labels, solution ranking, confidence, feedback-template selection | Traces are short and vocabulary is small; no English generation required | Synthetic-data bias and poor out-of-distribution calibration | Improve high-value labels and selective risk at an acceptable on-device budget |
| 0.6–4B parameters | Tuned pretrained decoder or encoder-decoder | Short grounded coaching, DSL completion, template parameter filling | Reuses language ability while remaining laptop/server friendly | Weak reasoning, brittle schema adherence, multi-hundred-MB download | Meet faithfulness and parse gates; never control validity |
| 7–14B parameters | Instruct or reasoning model, optionally LoRA-tuned | Diverse offline exercise candidates, critiques, rationales, teacher labels | More capacity for compositional Vim tasks and varied realistic buffers | Several GB, slower inference, still hallucinates | Higher validator acceptance and human novelty than 3–4B at justified cost |
| 20–32B parameters | Dense or sparse local model | Difficult automation exercises, repair after verifier rejection, high-quality teacher data | Better room for long constraints and unusual strategy combinations | Workstation/server memory and operational burden | Material quality lift over 7–14B on hard strata |
| Frontier hosted model | Provider API selected by evals | Rubric creation, hard offline authoring, adjudication candidates, teacher supervision | Highest general reasoning and language quality available | Price, drift, privacy, network dependence, opaque updates | Use only where smaller models fail and verified value exceeds cost |

### Why a 5–20M trace model is plausible

The trace model does not need to know the world or write English. Its input can
be a small vocabulary of normalized logical commands and state transitions:

- command family and argument slots;
- mode before and after;
- cursor displacement buckets;
- selection kind and affected-range shape;
- insertion, deletion, replacement, and line-count deltas;
- register, search, repeat, macro, and undo events;
- command boundaries, hint tier, retry, and timing buckets;
- exercise skills and abstract target-difference features.

A multi-task encoder can share a representation and expose heads for strategy,
misconception, efficiency band, feedback template, valid-solution ranking, and
abstention confidence. A 4–6 layer, 128–256 dimension model commonly lands in
the proposed 5–20M range depending on vocabulary and heads. That range is an
initial architecture budget, not evidence that it will beat a boosted tree.

Use solver-generated traces for representation pretraining—next-command
prediction, masked command prediction, state-delta prediction, or contrastive
learning between equivalent strategies—then fine-tune on reviewed labels. The
most informative result may be that a tree or rules win at the available data
scale; publishing that negative result would still be good engineering.

### Why natural-language generation needs a pretrained model

Training a fluent decoder from scratch would require learning English as well
as Vim. It is unnecessary. If reviewed templates are insufficient, adapt a
small pretrained model to map structured facts to short feedback. A
sub-billion or few-billion-parameter model might be adequate because the output
is narrow, but it must be compared with template retrieval on factuality,
helpfulness, cold-start latency, and package size.

### Why exercise authoring is harder than feedback

An exercise author must coordinate several constraints at once:

- a realistic initial buffer and an unambiguous instruction;
- a target state that follows from supported Vim behavior;
- one or more solution traces;
- primary and supporting skill coverage;
- difficulty, portability, and prerequisite limits;
- absence of unintended shortcuts;
- novelty without leaking held-out evaluation templates; and
- concise hints and feedback consistent with the solution.

A small model can fill parameters in an existing template. Generating a novel,
coherent combination is harder. The proposed starting bracket is therefore
7–14B for local authoring, with 20–32B or a frontier teacher for difficult
families. Even then, all output is candidate content. Automated programming
exercise research likewise finds value in LLM authoring while retaining the
need for oversight
([Sarsa et al., 2022](https://arxiv.org/abs/2206.11861)).

The most cost-effective learned component may be neither a writer nor a judge,
but a **candidate reranker**: generate broadly with templates or several cheap
models, deterministically validate, then predict verifier acceptance, novelty,
difficulty, and likely human-review score. A reranker can reduce wasted review
without ever shipping an unverified exercise.

## Open-weight model landscape

This is an illustrative evaluation shortlist, not an endorsement. It records
officially documented families available on **22 July 2026**. Before any
experiment, verify the exact checkpoint, instruction format, quantization,
license, commercial-use terms, and runtime support.

| Ecosystem | Officially documented examples | Relevant bracket | Why include in experiments | Important qualification |
| --- | --- | --- | --- | --- |
| Qwen | Qwen3 dense 0.6B, 1.7B, 4B, 8B, 14B, and 32B; MoE 30B-A3B and 235B-A22B | Every local bracket | Dense scale ladder makes controlled size comparisons convenient; official guidance lists MLX, `llama.cpp`, and server runtimes | Use the exact checkpoint’s model card and license; newer family names do not invalidate the need for Vim evals |
| Gemma | Gemma 4 E2B, E4B, 12B, 31B, and 26B-A4B | Edge through workstation | Official memory tables and mobile variants make deployment planning unusually transparent | Gemma uses its own terms; “open weights” is not synonymous with an OSI open-source license |
| Mistral | Ministral 3 dense 3B, 8B, and 14B instruct/reasoning variants | Local authoring and coaching | Clean 3/8/14B ladder; official release states Apache 2.0 | Vendor benchmark claims are not a Vim Wilds benchmark |
| gpt-oss | 20.9B total/3.6B active and 117B total/5.1B active MoE models | Workstation teacher and server | Sparse reasoning models provide a useful total-versus-active-parameter comparison | Total weights still determine storage; official guidance is about roughly 16 GB and 80 GB memory respectively |

Official sources: [Qwen3 release](https://qwenlm.github.io/blog/qwen3/),
[Gemma 4 overview](https://ai.google.dev/gemma/docs/core),
[Mistral 3 release](https://mistral.ai/news/mistral-3/), and
[gpt-oss release and architecture](https://openai.com/index/introducing-gpt-oss/).

Do not run every available family. A useful first bake-off is one model near
3–4B, one near 8B, one near 12–14B, and one strong hosted teacher. Add a 20–32B
local model only if the 14B-to-teacher gap is commercially or scientifically
important.

### Dense versus mixture-of-experts models

For a dense model, all parameters participate in each token. For a sparse
mixture-of-experts model, only some experts are active per token. Active
parameters help explain compute and throughput; **total parameters still have
to be stored or distributed across memory**. This is why a “30B-A3B” model may
compute more like a smaller model but does not fit in the same memory as a 3B
dense model.

Architecture, training corpus, post-training, tokenizer, reasoning mode,
quantization, and serving kernels can matter more than nominal parameter count.
The ladder therefore defines experiment brackets, not a universal ranking.

## Local and in-browser deployment

### Memory planning

For a dense model with `P` parameters, an ideal four-bit weight file is roughly:

```text
raw weight bytes ≈ P × 0.5
```

Real inference also needs quantization scales and metadata, embeddings,
runtime/workspace buffers, the KV cache, tokenizer, and application memory.
Long contexts can substantially increase KV-cache use. The following is a
**planning envelope**, not a measured requirement:

| Dense parameter class | Ideal Q4 weights | Sensible total-memory planning envelope | Likely target |
| --- | ---: | ---: | --- |
| 0.6B | 0.3 GB | 1–2 GB | Experiment-only browser generation; lightweight desktop |
| 2–4B | 1–2 GB | 3–6 GB | Optional laptop/local coach and constrained generation |
| 7–8B | 3.5–4 GB | 6–10 GB | Laptop authoring and server inference |
| 12–14B | 6–7 GB | 10–16 GB | Stronger laptop/workstation authoring |
| 20–21B | 10–11 GB | 16–24 GB | High-memory laptop/workstation; gpt-oss-20b is officially around 16 GB |
| 30–32B | 15–16 GB | 24–40 GB | Workstation or server |
| 70B | 35 GB | 48–80 GB | Server or high-memory workstation; unnecessary for routine runtime use |

Official Gemma 4 documentation illustrates why the envelope is model-specific:
its Q4 table estimates 2.9 GB for E2B, 4.5 GB for E4B, 6.7 GB for 12B, 14.4 GB
for 26B-A4B, and 17.5 GB for 31B, including a documented 20% loading overhead.
Its text-only mobile packages are still approximately 0.84 GB and 2.2 GB for
E2B and E4B respectively
([Gemma 4 memory requirements](https://ai.google.dev/gemma/docs/core#parameter_sizes_and_quantization)).
This is the decisive product point: even an “edge” generative model is enormous
relative to a static mobile-first trainer.

### Phone and PWA recommendation

The default PWA should not download a generative model. A multi-hundred-MB or
multi-GB first load competes with the editor, sprite assets, browser memory,
storage quotas, battery, and slow networks. It also undermines the current
instant, offline-capable experience.

A 5–20M parameter classifier is different. Approximate raw weights are 5–20 MB
at eight-bit precision or 2.5–10 MB at four-bit precision, before runtime and
metadata. That makes an optional, cached, versioned trace model plausible. It
should run in a Web Worker and never block input or editor rendering.

[ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) supports browser
inference through WebAssembly and accelerated providers including WebGPU.
[Transformers.js](https://huggingface.co/docs/transformers.js/guides/webgpu)
also supports WebGPU and common four- and eight-bit model variants. Their own
documentation warns that WebGPU/browser support varies, so production needs a
capability probe and a WebAssembly or deterministic-rule fallback.

Proposed browser release gates are:

- no model required to start, complete, or review the curriculum;
- explicit optional download with visible size and removal control;
- checksum, model card, version pinning, and cache invalidation;
- worker-based inference with cancellation and a timeout;
- measured cold load, warm p50/p95 latency, peak memory, and battery impact on
  representative iOS and Android devices;
- no reduction in keyboard responsiveness or editor frame stability; and
- identical deterministic feedback when the model is unavailable or abstains.

### Apple-silicon experimentation

[MLX](https://github.com/ml-explore/mlx) uses Apple silicon’s unified memory and
supports CPU/GPU computation; its examples include language-model generation
and LoRA fine-tuning. [`llama.cpp`](https://github.com/ggml-org/llama.cpp)
supports Metal, multiple quantization levels, and CPU/GPU hybrid inference.
Both are sensible local research paths.

As a conservative **hypothesis for interactive Q4 experiments**, reserve
roughly 30–40% of unified memory for macOS, the runtime, context, and other
applications:

- 16 GB machine: begin with 3–4B; try 7–8B only with short contexts and measured
  headroom;
- 24–32 GB machine: 7–14B is the useful authoring range;
- 48–64 GB machine: 20–32B experiments become practical; and
- larger models remain possible on high-memory systems but are unlikely to be
  justified for this domain.

These are not performance guarantees. Measure tokens per second, time to first
token, peak resident memory, and thermal behavior on the actual machine.

### Server-side open weights

For early usage, a hosted API or scale-to-zero/serverless open-weight endpoint
usually avoids idle GPU cost and operational work. Dedicated serving becomes
interesting only when sustained traffic, privacy, customization, or predictable
latency offsets engineering and idle capacity. If that point arrives,
[vLLM](https://docs.vllm.ai/) and similar engines provide continuous batching,
quantization, and distributed serving; `llama.cpp` is also suitable for a
simple low-volume local service.

The crossover must be calculated from measured accepted-candidate throughput,
not raw tokens alone. See
[Monetization and Unit Economics](./monetization-and-unit-economics.md) for the
API/serverless/dedicated comparison.

## Generation architecture and model context

### Do not paste “all of Vim” into every prompt

The app does not need a large vector database of generic Vim tutorials. Its
authoritative context is already structured:

- supported command and mode catalogue;
- primary and supporting skill definitions;
- prerequisite graph;
- relevant native/browser conformance fixtures;
- exercise schema and target-predicate vocabulary;
- difficulty dimensions;
- reviewed positive, negative, and near-miss examples; and
- verifier rejection reason codes.

Use keyed retrieval by skill ID, command family, mode, and exercise type to
assemble only the relevant slice. For a `5j` exercise, the model needs count and
vertical-motion rules, the allowed-state contract, and a few varied examples—not
registers, macros, substitutions, and the entire Vim manual.

Vector retrieval may later help search a large narrative corpus, discover
semantically similar real-world buffers, or surface a human-written explanation.
It must not supply correctness authority. A retrieved paragraph can be stale or
misapplied; a replayed state transition is testable.

### Generate a typed intermediate representation

Models should emit an exercise DSL rather than final runtime JSON and prose in
one unconstrained response. A candidate record should contain:

```ts
interface ExerciseCandidateV1 {
  schemaVersion: 1;
  candidateId: string;
  generator: {
    kind: "template" | "solver" | "llm" | "hybrid";
    modelId?: string;
    modelRevision?: string;
    promptVersion?: string;
    seed: string;
  };
  primarySkillIds: string[];
  supportingSkillIds: string[];
  allowedCommandFamilies: string[];
  initialState: EditorState;
  targetPredicate: TargetPredicate;
  teachingSolutions: LogicalCommand[];
  requiredEvidence: string[];
  forbiddenEvidence: string[];
  difficultyFeatures: Record<string, number | string | boolean>;
  surfacePlan: {
    languageId: string;
    scenarioKind: string;
    literalSlots: Record<string, string>;
  };
}
```

The pipeline materializes the buffer, replays every proposed solution, searches
for shortcuts where feasible, differentially checks finalists in browser and
native Vim, derives rather than trusts state facts, renders hints from verified
commands, detects duplicates, and quarantines failures. Constraint-based
procedural generation has been used in educational games specifically because
well-formed rules can define valid content
([Smith et al., 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7334711/)).

### Constrained decoding is a syntax aid, not a semantic proof

JSON-schema or grammar-constrained decoding can prevent missing braces, unknown
enumerations, and many parse failures. It cannot prove that a Vim trace reaches
the target, that an instruction is unambiguous, or that an exercise teaches the
claimed skill. Research on constrained generation also shows that forcing
structure can interact with model performance, so constrained and unconstrained
plus repair variants should be benchmarked rather than assumed equivalent
([Schall and de Melo, 2025](https://aclanthology.org/2025.ranlp-1.124/)).

### Rejection is training data

Every failed candidate should receive deterministic reason codes such as:

- `SCHEMA_INVALID`;
- `UNSUPPORTED_COMMAND`;
- `TEACHING_SOLUTION_DID_NOT_REACH_TARGET`;
- `BROWSER_NATIVE_DIVERGENCE`;
- `REQUIRED_EVIDENCE_MISSING`;
- `UNINTENDED_SHORTCUT`;
- `AMBIGUOUS_TARGET`;
- `DUPLICATE_TEMPLATE`;
- `DIFFICULTY_OUT_OF_RANGE`; or
- `HUMAN_REVIEW_REJECTED:{reason}`.

These records support three improvements without weakening safety:

1. feed concise verifier feedback into one bounded repair attempt;
2. train a classifier or reranker to predict rejection and review value; and
3. fine-tune a generator on accepted/rejected pairs.

Cap repairs and fall back to a known-good template. An on-demand learner session
must never wait through an unbounded generate-reject loop.

## Fine-tuning, distillation, and quantization

### When fine-tuning is justified

Fine-tuning is not the first solution to a long prompt. Keyed context,
structured output, examples, and deterministic repair should be tested first.
Fine-tune only when a stable evaluation shows a repeatable gap such as:

- poor DSL parse or schema adherence;
- low verifier acceptance on specific command families;
- repetitive scenarios or weak difficulty control;
- inaccurate misconception labels;
- feedback that is too long, generic, or poorly grounded; or
- hosted-model quality that a smaller local model cannot match with prompting.

Fine-tuning can shorten prompts, improve format consistency, and specialize a
model. It does not eliminate inference context entirely and never replaces Vim
execution validation. Output quality and accepted-candidate rate matter more
than the number of prompt tokens saved.

### Data required first

Do not fine-tune directly on the fresh catalog. Build a reviewed corpus with:

- accepted and rejected exercise candidates;
- exact verifier and human-review reasons;
- diverse valid teaching solutions;
- near misses and unintended shortcuts;
- fact records paired with reviewed feedback;
- strategy and misconception labels;
- model, prompt, seed, and content versions; and
- a license and provenance record for every source.

A sensible learning-curve experiment is to train at approximately 500, 2,000,
and 10,000 reviewed examples rather than guess the required scale. Split by
buffer template, exercise family, and command composition before generation so
near-duplicates cannot leak into evaluation. Keep a final human trace test set
untouched by teacher labeling and tuning.

### LoRA and QLoRA

[LoRA](https://arxiv.org/abs/2106.09685) freezes base weights and learns
low-rank adapters; [QLoRA](https://arxiv.org/abs/2305.14314) backpropagates
through a frozen quantized base into adapters, reducing fine-tuning memory. They
make 3–14B experiments approachable on one workstation or rented GPU.

Compare at least:

- base prompting;
- few-shot prompting with keyed examples;
- constrained decoding;
- LoRA/QLoRA with the same context;
- LoRA/QLoRA with reduced context; and
- the deterministic template/solver baseline.

Report schema pass, verifier acceptance, human acceptance, novelty, factual
feedback error, latency, energy/runtime, and cost per **accepted** candidate.
Reporting only training loss or raw generation cost would hide the main product
failure modes.

### Teacher distillation

A frontier or 20–32B teacher can label already-verified traces, propose
rationales, rank valid solution families, and generate hard negatives. A small
student can learn strategy labels or short feedback from that corpus. Knowledge
distillation is a well-established way to transfer behavior from larger models
to smaller ones
([Hinton et al., 2015](https://research.google/pubs/distilling-the-knowledge-in-a-neural-network/));
reasoning or rationale supervision can reduce the data required in some tasks
([Hsieh et al., 2023](https://research.google/pubs/distilling-step-by-step-outperforming-larger-language-models-with-less-training-data-and-smaller-model-sizes/)).

For Vim Wilds, “rationale” should mean a short reviewed reason code or strategy
explanation derived from engine facts—not private chain-of-thought. The student
should predict labels and concise explanations that can be audited.

### Quantization

Quantization should be tested after task quality is established. Compare at
least FP16/BF16, eight-bit, and one or more four-bit variants on the exact task
suite. Measure class-specific regressions: a small aggregate loss can conceal a
large failure on macro, register, or substitution traces. Retain the
full-precision evaluation output and quantizer version for reproducibility.

## Learner-model progression

Knowledge tracing has a large literature; a current survey covers Bayesian,
factor-analysis, and deep approaches and their assumptions
([Liu et al., ACM Computing Surveys](https://doi.org/10.1145/3569576)). Vim
Wilds should progress from interpretable models to flexible ones only when each
stage has enough longitudinal data to evaluate.

| Stage | Model | What it adds | Vim-specific advantage | Important limitation / gate |
| --- | --- | --- | --- | --- |
| 0 | Per-skill rules and spacing | Due date, recent success, hint and lapse counters | Works locally from the first user | Hand-tuned; use as permanent baseline |
| 1 | PFA / regularized logistic model | Separate success and failure opportunities per skill | Naturally supports multiple primary/supporting skill tags | Needs repeated observations and careful treatment of guided attempts |
| 2 | HLR and FSRS comparator | Explicit forgetting or retrievability over elapsed time | Directly targets startup review timing | Developed mainly for vocabulary/flashcards; procedural transfer is unproven |
| 3 | DAS3H and/or time-aware BKT | Skill learning plus forgetting; interpretable latent state | DAS3H handles temporal practice across multiple skills | More parameters and identifiability risk; validate calibration, not only AUC |
| 4 | IRT or multidimensional IRT | Learner ability, item difficulty, possibly discrimination | Separates hard exercises from weak learners; useful for generated variants | Cold-start items and small samples need priors or content features |
| 5 | Contextual ranker/bandit | Learns which eligible exercise yields the best delayed result | Can personalize review, challenge, modality, and hint policy | Requires propensities, exploration, delayed reward, overlap, and safety rules |
| 6 | Deep knowledge tracing / sequence models | Nonlinear interactions and cross-skill temporal patterns | Research value if the catalog and population become large | Data hungry, less interpretable, and predictive lift may not improve learning |

### Stage 0: transparent per-skill state

Begin with a state that a learner can understand:

```ts
interface LearnerSkillStateV1 {
  schemaVersion: 1;
  learnerScopeId: string;
  skillId: string;
  state: "unseen" | "acquiring" | "reviewing" | "retained" | "lapsed";
  independentSuccesses: number;
  guidedCompletions: number;
  lapses: number;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  intervalDays: number | null;
  estimatedRecall: number | null;
  estimatorId: string;
  estimatorVersion: string;
  updatedFromEventId: string;
}
```

Treat supporting-skill evidence as a weaker observation than primary-skill
recall. A guided completion should not advance the interval as much as a
hint-free varied recall. A failure should schedule a short corrective retry and
then a later independent attempt; it should not punish progress.

### Stage 1: Performance Factors Analysis

Performance Factors Analysis models correctness using skill-tagged counts of
prior successes and failures, and can support multiple skills per item
([Pavlik, Cen, and Koedinger, 2009](https://files.eric.ed.gov/fulltext/ED506305.pdf)).
It is a strong first data-science model because its features and coefficients
are inspectable. Extend it with elapsed-time buckets, guided/independent flags,
template novelty, hints, and hierarchical regularization only after a basic
version is calibrated.

### Stage 2: HLR and FSRS-style memory models

Duolingo’s Half-Life Regression predicts a memory half-life from learner/item
features and schedules practice from predicted recall
([Settles and Meeder, 2016](https://research.duolingo.com/papers/settles.acl16.pdf)).
It maps naturally to questions such as “what is the predicted chance this
learner independently uses `ciw` after seven days?”

FSRS is a practical open comparator built around difficulty, stability, and
retrievability. It is deployed in Anki and exposes a desired-retention control
([Anki manual](https://docs.ankiweb.net/deck-options.html#fsrs),
[open benchmark](https://github.com/open-spaced-repetition/srs-benchmark)). It
should be treated as an implementation baseline, not assumed superior for Vim.
Vim tasks are multi-skill, procedural, and strategy-dependent rather than
binary flashcards.

### Stage 3: DAS3H and Bayesian Knowledge Tracing

Bayesian Knowledge Tracing represents mastery as a latent state updated through
observed correct/incorrect responses, with slip and guess behavior
([Corbett and Anderson, 1995](https://doi.org/10.1007/BF01099821)). Standard
BKT’s binary mastery and no-forgetting assumptions need adaptation for this
domain.

DAS3H combines additive skill factors with practice distributed across time
windows and explicitly addresses multi-skill items and forgetting
([Choffin et al., 2019](https://arxiv.org/abs/1905.06873)). That makes it a
particularly relevant interpretable benchmark for Vim compositions such as
operator + motion + count + repeat.

### Stage 4: item response models

Generated variants will not have reliable difficulty labels on day one. An IRT
model can separate a latent learner ability from item difficulty, and a
multidimensional version can reflect several skill dimensions. Applied
educational-data-mining work uses IRT specifically to estimate student ability
and problem difficulty
([Lee, 2019](https://doi.org/10.1108/IDD-08-2018-0030)).

Start with strong priors from authored difficulty features and partial pooling
by template. Do not fit an unconstrained difficulty parameter to an exercise
seen by five people and call it calibrated. A generated item earns a stable
difficulty estimate only after enough independent responses across ability
levels.

### Stage 5: contextual selection

A contextual bandit can choose among safe candidate exercises while balancing
learning and exploration. Educational experiments have used bandits to adapt
tutoring policies, but the reward and experimental design—not the algorithm
name—determine value
([Cai et al., 2021](https://www.hks.harvard.edu/publications/bandit-algorithms-personalize-educational-chatbots)).

For Vim Wilds:

- context includes per-skill state, elapsed time, session budget, recent
  mistakes, prior modality, and device/input method;
- actions are already-valid assignments or policy choices, never arbitrary
  generated text;
- immediate completion is a diagnostic outcome, not the main reward;
- primary reward is later hint-free recall or unseen-template transfer;
- exploration is bounded to pedagogically appropriate options;
- learners can choose a unit or focused-practice goal at any time; and
- the policy logs candidate sets, probabilities, and model versions.

Do not deploy a bandit merely because simulated regret is low. Require an
offline replay/OPE study, an A/A logging test, a small randomized safety trial,
and a pre-registered online comparison against the transparent scheduler.

### Stage 6: deep knowledge tracing

Deep Knowledge Tracing introduced recurrent sequence models for learner-event
histories
([Piech et al., 2015](https://arxiv.org/abs/1506.05908)). Such a model may
capture cross-skill and long-range patterns that hand-designed models miss. It
also creates more ways to learn user identity, content order, or template
frequency instead of mastery.

Only evaluate deep KT after there is enough longitudinal human data to support:

- user-grouped and time-forward splits;
- template- and skill-composition holdouts;
- calibration by skill, delay, and learner-history length;
- ablations against elapsed time, item difficulty, and simple counts;
- uncertainty for cold-start learners and exercises; and
- evidence that a better prediction actually supports a better selection
  policy.

Prediction AUC alone is not a product result. A model can predict the app’s old
scheduler very well without learning how to improve retention.

## Data and interface contracts

These are proposed versioned contracts, not current public APIs. They define
the minimum facts needed to keep deterministic authority, learning state, and
experimentation reproducible.

### Event flow

```text
touch / physical input
        |
        v
CodeMirror Vim engine ---> immutable local command events
        |                            |
        v                            v
editor snapshots ----------> deterministic attempt summary
                                     |
                         +-----------+-----------+
                         |                       |
                         v                       v
                 skill observations      optional trace model
                         |                       |
                         v                       v
                  learner state          advisory feedback
                         |
                         v
              constrained assignment policy
```

Store immutable events in IndexedDB rather than repeatedly mutating one
`localStorage` object. Derived learner state can be recomputed when an estimator
changes. Keep raw local events, upload-safe derived events, and optional cloud
feedback payloads as separate representations.

### Command event

```ts
interface CommandEventV1 {
  schemaVersion: 1;
  eventId: string;
  attemptId: string;
  ordinal: number;
  elapsedMsBucket: string;
  inputSource: "touch" | "physical" | "test";
  command: {
    family: string;
    roles: string[];
    countBucket?: string;
    registerClass?: "default" | "named" | "numbered" | "black-hole";
    literalShape?: {
      kind: "insert" | "search" | "ex" | "character";
      lengthBucket: string;
      characterClasses: string[];
    };
  };
  before: AbstractEditorState;
  after: AbstractEditorState;
  delta: AbstractEditorDelta;
  deterministicTags: string[];
}
```

The full exact key and text trace may exist locally for app-authored exercises
and testing. The upload-safe record replaces inserted text, search strings, Ex
arguments, filenames, register contents, and buffer text with shapes or
allowlisted app-authored IDs.

### Attempt summary

```ts
interface AttemptSummaryV1 {
  schemaVersion: 1;
  attemptId: string;
  learnerScopeId: string;
  contentVersion: string;
  exerciseId: string;
  templateId: string;
  generatorVersion?: string;
  seed?: string;
  practicePolicy: "guided-sequence" | "faded" | "constrained-state" |
    "outcome" | "coached-outcome" | "explore" | "sandbox";
  primarySkillIds: string[];
  supportingSkillIds: string[];
  startedAt: string;
  durationBucket: string;
  result: {
    targetSatisfied: boolean;
    requiredEvidenceSatisfied: boolean;
    forbiddenEvidenceTriggered: string[];
    terminalMode: string;
    strategyFamilies: string[];
    misconceptionCodes: string[];
    efficiencyFeatures: Record<string, number | string | boolean>;
    hintTier: number;
    retries: number;
    resets: number;
    recoveredWithUndo: boolean;
  };
  verifierVersion: string;
  traceModelVersion?: string;
}
```

`traceModelVersion` records an advisory label source. It cannot alter the target
or evidence results.

### Skill observation

```ts
interface SkillObservationV1 {
  schemaVersion: 1;
  observationId: string;
  attemptId: string;
  skillId: string;
  role: "primary" | "supporting";
  opportunityType: "guided" | "independent" | "mixed" | "transfer";
  outcome: "success" | "partial" | "failure" | "not-observed";
  hintTier: number;
  novelty: "same-template" | "variant" | "unseen-template";
  responseTimeBucket: string;
  priorExposureGapBucket: string;
  deterministicEvidence: string[];
}
```

This is the learner-model input. It prevents a text-correct result that omitted
the target skill from silently becoming a successful mastery observation.

### Assignment decision and propensities

```ts
interface AssignmentDecisionV1 {
  schemaVersion: 1;
  decisionId: string;
  learnerScopeId: string;
  occurredAt: string;
  sessionIntent: "startup-review" | "continue-unit" | "focused-practice" |
    "challenge";
  contextFeatureVersion: string;
  policyId: string;
  policyVersion: string;
  candidates: Array<{
    assignmentId: string;
    exerciseId: string;
    templateId: string;
    targetSkillIds: string[];
    eligibilityReasonCodes: string[];
    score: number;
    selectionProbability: number;
  }>;
  selectedAssignmentId: string;
  exploration: boolean;
}
```

Log even deterministic policies with probability `1` for the selected action
and `0` for others, but recognize that such logs have no overlap for evaluating
different choices. A later randomized policy must record its actual propensity,
not reconstruct it from a changed model.

### Model decision and feedback

```ts
interface AdvisoryModelDecisionV1 {
  schemaVersion: 1;
  decisionId: string;
  task: "trace-label" | "feedback-select" | "feedback-generate" |
    "candidate-rank" | "exercise-generate";
  modelId: string;
  modelRevision: string;
  adapterRevision?: string;
  promptOrFeatureVersion: string;
  inputRecordIds: string[];
  outputSchemaVersion: string;
  labels: Array<{ name: string; confidence: number }>;
  abstained: boolean;
  fallbackUsed: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  validatorReasonCodes: string[];
}
```

Store the reviewed feedback template ID and verifier facts separately from any
generated prose. This makes it possible to reproduce a decision even after a
hosted model changes.

## Privacy and data governance

The default product should work without an account and without uploading a
trace. Product analytics and model-training consent are separate choices. A
learner may permit aggregate product events without donating attempts for
research.

### Never upload by default

- user-authored Free Practice or sandbox buffer text;
- pasted code, prose, logs, configuration, filenames, paths, or repository
  identifiers;
- exact Insert-mode literals;
- search patterns or Ex-command arguments;
- register or macro contents that can contain user text;
- arbitrary clipboard content; or
- a physical-key timing stream fine-grained enough to act as a biometric.

For authored exercises, the server already knows the initial/target content
from `exerciseId`, `contentVersion`, `templateId`, and `seed`. It needs derived
command roles and deltas, not another copy of the buffer.

### Upload-safe transformations

- replace literal strings with kind, length bucket, and character classes;
- replace cursor positions with deltas or coarse buckets where exact position
  is unnecessary;
- bucket latency and timestamps for research exports while retaining exact due
  times locally;
- rotate or delete pseudonymous installation IDs;
- keep consent version and data-purpose tags with every uploaded event;
- publish retention periods and model-training use;
- support export and deletion; and
- prevent research exports with rare combinations from being treated as
  anonymous without disclosure-risk review.

Local differential privacy, federated learning, or secure aggregation may be
interesting later, but they are not substitutes for minimization. The best way
to protect free-practice text is not to collect it.

### Dataset lineage

Every training row should be traceable to:

- source class: solver, template mutation, simulated learner, consented human,
  teacher model, or human author;
- content and verifier versions;
- transformation/redaction version;
- label source and review status;
- allowed training purposes;
- train/validation/test split assignment; and
- deletion or exclusion tombstones.

Dataset splits must be immutable within a reported experiment. If a user later
withdraws data, rebuild the affected artifact or document why an already
released aggregate/model cannot be reversed, according to the consent terms.

## Simulated learners

Simulation is valuable here because both the environment and intended commands
are executable. It can test pipelines and generate trace diversity before
there are many users. It cannot prove that a scheduler teaches real people.

### Controlled learner state

A simulated learner should have explicit latent variables rather than only a
role-play prompt:

```ts
interface SimulatedLearnerStateV1 {
  skillMastery: Record<string, number>;
  skillStabilityDays: Record<string, number>;
  learningRate: Record<string, number>;
  slipProbability: Record<string, number>;
  guessProbability: Record<string, number>;
  misconceptionWeights: Record<string, number>;
  strategyPreferenceWeights: Record<string, number>;
  fatigue: number;
  persistence: number;
  hintSeeking: number;
  inputNoise: number;
  transferStrength: number;
}
```

Sample archetypes from distributions rather than naming one “beginner agent”:

- fast learner with rapid forgetting;
- slow but stable learner;
- count-averse repeated-key user;
- Insert-mode overuser;
- learner who knows commands but forgets Normal-mode return;
- learner with weak operator-motion composition;
- learner who solves guided traces but fails surface-form transfer;
- fatigued mobile learner with input slips; and
- experienced user testing out of foundational units.

At each step, the policy chooses a logical command or requests a hint. The real
engine executes the command, so the simulated trace cannot assert an impossible
state transition. Rule policies produce controlled misconceptions; a language
model can later propose novel actions, but its actions still pass through the
same engine.

### What simulation can establish

- event schemas and migrations handle long histories;
- the scheduler avoids starvation, loops, and review overload;
- propensity logging and off-policy estimators recover known synthetic policy
  values;
- cold-start and lapse behavior are sensible;
- trace classifiers recognize generator-known strategies and misconceptions;
- a solver or generator covers the intended state space; and
- experimental power and metric sensitivity under stated assumptions.

### What simulation cannot establish

- that a synthetic misconception distribution resembles real learners;
- that simulated engagement predicts return behavior;
- that a policy improves human delayed recall;
- that LLM role-play reproduces learning, fatigue, emotion, or motor behavior;
  or
- that results transfer to robotics merely because both use policies and
  simulators.

Synthetic knowledge-tracing research shows both the utility and limitations of
generated histories; one study found only minor gains from adding synthetic
data and emphasized the data-distribution problem
([Pagonis et al., 2024](https://arxiv.org/abs/2401.16832)). Keep a human-only,
time-forward test set and report the synthetic-to-real gap by label and skill.

There is a legitimate conceptual bridge to robotics—partially observed latent
state, action selection, simulators, off-policy evaluation, and sim-to-real
shift—but the portfolio claim should be “transferable methodology,” not
evidence of robotics expertise or performance.

## Evaluation suite

One versioned evaluation harness should compare rules, classical models, local
models, and hosted providers. Provider switching then becomes an experiment,
not a rewrite.

### Split policy

Use several deliberately difficult splits:

- **user-grouped:** no learner appears in both train and test;
- **time-forward:** evaluate on events after the training cutoff;
- **template-disjoint:** hold out buffer templates and literal slots;
- **composition-disjoint:** hold out selected combinations such as count +
  operator + text object while retaining components in training;
- **skill-family holdout:** measure true out-of-domain abstention;
- **source-disjoint:** keep a human-only set when training uses synthetic or
  teacher-labeled data; and
- **model-blind gold set:** do not include evaluation examples in prompts,
  fine-tuning data, repair examples, or public demos.

Report confidence intervals by user bootstrap where learners contribute
multiple correlated attempts. Never randomly split individual attempts and
then claim generalization to new learners.

### Exercise generation

Measure the funnel, not only final examples:

| Stage | Metric |
| --- | --- |
| Decode | Parse rate, schema pass rate, repair count |
| Static validation | Supported-command and content-policy pass rate |
| Execution | Proposed-solution replay success; target-predicate agreement |
| Conformance | Browser/native agreement across fixtures |
| Pedagogy | Required evidence, prerequisite fit, difficulty, ambiguity, hint consistency |
| Robustness | Shortcut rate, controlled-variant success, brittle absolute-position dependence |
| Diversity | Template/strategy coverage, semantic duplicate rate, surface-form diversity |
| Human review | Accept/edit/reject rate and reason; inter-rater agreement on a sampled set |
| Operations | Latency, tokens, energy, cost per generated and per accepted exercise |

Every shipped candidate must pass deterministic validation. The model-level
research outcome is accepted-candidate yield and quality, not “99% correctness”
from an LLM judge.

### Attempt interpretation

Evaluate:

- macro and per-class precision, recall, and F1 for strategies and
  misconceptions;
- pairwise ranking accuracy or NDCG across valid solutions;
- Brier score, expected calibration error, and reliability diagrams;
- selective risk: error rate as low-confidence cases abstain;
- rule coverage and incremental model coverage;
- false claims on unseen command families;
- robustness to renamed identifiers and changed literals;
- consistency across touch and physical-key input; and
- p50/p95 latency, cold load, peak memory, and fallback rate.

High-cost classes need explicit gates. A model must not label a register as
preserved, a macro as repeatable, or a substitution as scoped safely unless the
deterministic trace supplies that fact.

### Generated feedback

Build adversarial records for:

- valid outcome but missing target-skill evidence;
- invalid final mode despite correct text;
- efficient unfamiliar solution;
- temporary error followed by correct undo recovery;
- unsupported command in the user trace;
- empty, malformed, or contradictory model output;
- prompt-like text inside app-authored buffers; and
- future user-text fields replaced by redaction sentinels.

Primary automated gates are schema validity, no contradiction of verifier
facts, no unsupported command recommendation, length, and deterministic
fallback. Human review rates factuality, clarity, tone, actionability, and
whether the feedback teaches the stated objective. The product outcome is
later independent success, not a preference score alone.

### Learner models

Compare every learned model against skill-level base rates, recency/frequency
rules, and regularized logistic regression. Report:

- log loss and Brier score;
- calibration overall and by skill, delay, history length, and prior
  experience;
- AUC only as a secondary discrimination metric;
- cold-start performance for learners and generated exercises;
- delayed recall at one-day, one-week, and longer feasible horizons;
- transfer to an unseen template;
- parameter stability and uncertainty; and
- ablations for hints, time, difficulty, primary/supporting role, and input
  mode.

Calibration matters because the scheduler acts on predicted recall. A model
that ranks learners correctly but calls a true 50% probability “90%” will set
bad intervals.

### Selection policies

Offline replay and simulation can reject unsafe policies, but final comparison
needs real delayed outcomes. The online primary metric should be delayed,
hint-free skill recall or unseen-template transfer subject to a practice-time
budget. Guardrails include frustration, reset/hint spikes, session abandonment,
review backlog, and learner override rate.

Log candidate probabilities from the beginning. Use inverse-propensity and
doubly robust estimators only where policies have adequate overlap, and publish
effective sample size and weight diagnostics. A small randomized holdout remains
the clearest check because off-policy estimates can have serious bias/variance
problems under weak overlap.

### Release gates

The following are decisions, not arbitrary leaderboard targets:

1. **Validity:** only deterministic engine and conformance results can pass an
   attempt or exercise.
2. **Generated content:** zero unvalidated exercises reach learners; failed or
   timed-out generation falls back to the reviewed bank.
3. **Advisory feedback:** zero known contradictions on the release gold set;
   malformed, low-confidence, and unknown cases use local templates.
4. **Compact model:** ship only if it adds useful coverage over rules on
   user-/template-disjoint data and stays within the measured phone budget.
5. **Learner model:** replace a simpler estimator only after improving
   time-forward calibration and at least one learning-relevant outcome.
6. **Selection policy:** no autonomous exploration outside prerequisite,
   difficulty, privacy, and session-workload constraints.
7. **Model update:** rerun the full frozen suite for every model, adapter,
   prompt, quantizer, runtime, and verifier revision.

## Experiment program

### E0 — deterministic benchmark foundation

Deliver:

- reviewed gold exercises and target predicates;
- multiple valid strategies and near misses;
- native/browser replay fixtures;
- command-span and state-delta schema;
- rule-based evidence and efficiency features; and
- baseline reports with no learned model.

This is the prerequisite for every later experiment and the highest-value
portfolio artifact.

### E1 — compact trace understanding

Compare:

1. deterministic rules;
2. logistic regression;
3. gradient-boosted trees;
4. GRU or temporal convolution; and
5. 5M, 10M, and 20M Transformer encoders.

Tasks are strategy multi-label classification, misconception classification,
feedback-template selection, pairwise solution ranking, and abstention. Train
first on solver/simulated traces, then quantify how much reviewed human data is
needed to close the synthetic-to-real gap.

### E2 — provider-neutral authoring bake-off

Use the same DSL, retrieved context, seeds, and hard/medium/easy strata for:

- one 3–4B local model;
- one 7–8B local model;
- one 12–14B local model;
- optionally one 20–32B local model; and
- one or two hosted teacher models from different providers.

Test direct generation, plan-then-materialize, verifier-feedback repair, and
generate-many-plus-rerank. Report the full validation funnel and cost per
accepted, reviewed exercise. Keep model identities in the report but design the
pipeline around capabilities, not a provider SDK.

### E3 — fine-tuning and distillation

On the smallest promising open-weight models, compare few-shot prompting with
LoRA/QLoRA at 500, 2,000, and 10,000 reviewed examples. Distill teacher strategy
labels and feedback-template choices into the compact encoder. Plot quality,
latency, memory, and cost Pareto frontiers.

Stop if fine-tuning merely memorizes templates or fails composition-disjoint
tests. A smaller prompt is not a win if verifier yield or diversity falls.

### E4 — learner modeling

Start with developer/N=1 traces only to validate plumbing, never to claim
general learning effects. As consented multi-user data arrives, compare rules,
PFA, HLR/FSRS-style models, DAS3H/BKT, and IRT on frozen time-forward splits.
Publish calibration and cold-start results before changing the scheduler.

### E5 — safe policy learning

After candidate-set and propensity logging is stable:

- validate off-policy estimators on simulated policies with known value;
- run an A/A experiment to detect logging or assignment bias;
- pre-register reward, guardrails, and stopping rules;
- compare a simple contextual policy with the transparent scheduler; and
- use delayed retention and workload, not clicks or session length, as the
  principal result.

### Reproducibility and public artifacts

Each reported experiment should be reproducible from a pinned configuration,
subject to privacy and provider availability. Publish:

- a versioned gold-set manifest and generation script for non-sensitive
  synthetic cases;
- dataset cards covering provenance, consent, redaction, splits, intended use,
  representation limits, and synthetic/human composition;
- model cards covering training data, task, metrics, calibration, deployment
  envelope, known failures, and abstention policy;
- rule and classical-model baselines alongside every neural result;
- prompt, adapter, quantizer, runtime, verifier, and content revisions;
- per-family failure analysis rather than only one aggregate score;
- quality/latency/memory/cost Pareto plots, with cost measured per validated or
  accepted result; and
- a small public evaluation dashboard that can rerun non-sensitive fixtures and
  compare archived reports without exposing learner traces.

Hosted providers may retire a revision, so archive their request schema,
settings, token counts, deterministic validation results, and reviewed outputs
where the provider terms permit it. Do not claim bit-for-bit reproducibility
for an unpinned or nondeterministic API.

## Product implementation order from the ML perspective

1. Audit the catalog and freeze a human-reviewed gold set.
2. Implement full deterministic outcome and skill-evidence verification.
3. Segment logical commands and persist privacy-safe immutable events.
4. Ship rule feedback and a transparent per-skill review scheduler.
5. Build the typed generator, solver, rejection codes, and authoring dashboard.
6. Expand the prevalidated exercise bank with templates and offline LLM
   candidates.
7. Benchmark classical and 5–20M trace models; deploy only if they improve on
   rules.
8. Add optional fact-grounded cloud feedback with a local template fallback.
9. Compare interpretable learner models after enough delayed observations.
10. Fine-tune/distill open-weight models as a measured research project.
11. Test contextual selection only after propensity logging and real retention
    outcomes exist.
12. Keep synchronous personalized generation as the final experiment, not a
    dependency of learning or review.

## Portfolio ranking

The project is valuable even with few users if the artifacts are reproducible
and the claims remain honest.

### 1. Neuro-symbolic exercise factory and verifier

**Why it ranks first:** it demonstrates formal problem decomposition, solver
design, LLM orchestration, property-based testing, differential execution, and
production safety. It is credible without a large dataset.

Portfolio artifacts:

- typed exercise DSL and deterministic verifier;
- native-Vim/browser differential test suite;
- solution-family search and shortcut detection;
- model/provider generation funnel;
- acceptance, diversity, latency, and cost dashboard; and
- failure taxonomy with reproducible examples.

### 2. Adaptive-learning comparison with delayed outcomes

**Why it ranks second:** it shows statistical modeling, calibration, causal
thinking, sequential decisions, and that the engineer understands prediction
is not intervention.

Portfolio artifacts:

- rules, PFA, HLR/FSRS, DAS3H/BKT, and IRT baselines;
- user-/time-/template-disjoint evaluation;
- calibration and forgetting-curve analysis;
- delayed-retention experiment design;
- propensity logging and off-policy diagnostics; and
- a clear result even if the simple scheduler wins.

### 3. Privacy-safe longitudinal data architecture

**Why it ranks third:** it demonstrates real ML-platform judgment rather than a
notebook-only model.

Portfolio artifacts:

- immutable, versioned event contracts;
- raw-local versus upload-safe transformations;
- consent, lineage, retention, deletion, and split policy;
- feature and model versioning; and
- reproducible backfills and model cards.

### 4. Simulated learner laboratory and compact trace model

**Why it ranks fourth:** it creates an unusual controlled sequence-modeling and
sim-to-real project while being useful for test coverage.

Portfolio artifacts:

- explicit learner dynamics and misconception policies;
- deterministic engine-in-the-loop traces;
- rules/tree/GRU/TCN/Transformer comparison;
- synthetic-to-human distribution and error analysis;
- calibrated abstention and browser inference; and
- a documented boundary between simulation evidence and human evidence.

### 5. LoRA/distillation and quantized local deployment

**Why it ranks fifth:** it demonstrates modern LLM adaptation and systems work,
but it is less differentiated if presented alone.

Portfolio artifacts:

- cross-provider/model-size bake-off;
- LoRA/QLoRA learning curves;
- teacher-to-small-model distillation;
- quantization regressions by command family;
- WebGPU/WASM/MLX deployment measurements; and
- quality-cost-latency Pareto frontiers.

The strongest CV story is not “fine-tuned a model.” It is: **designed a
deterministic educational environment, generated and verified structured
content, built privacy-safe longitudinal data, compared interpretable and deep
models, and evaluated policies on delayed outcomes.**

## Main risks and stopping rules

### Model risk

- **Hallucinated Vim behavior:** never reaches the truth boundary; reject or
  template-fallback.
- **High schema pass but low semantic validity:** report execution yield, not
  parse rate alone.
- **Trivial diversity:** cluster by template, state transformation, and strategy
  rather than lexical similarity alone.
- **Model/version drift:** pin revisions where possible and rerun frozen evals.
- **Prompt injection:** never send untrusted free-practice text; treat authored
  buffer content as data, not instructions.

### Statistical risk

- **Cold start:** use authored priors and rules; do not overfit five responses.
- **Selection bias:** log candidates and propensities; retain randomized
  exploration where ethical and useful.
- **Label leakage:** split by user, time, template, composition, and source.
- **Synthetic dominance:** reserve human-only evaluation and publish the domain
  gap.
- **Optimizing engagement instead of learning:** make delayed independent recall
  the primary objective.
- **Identity memorization:** avoid raw user/text features and test new-user
  generalization.

### Product stopping rules

- If rules cover the useful feedback cases, do not ship a runtime trace model.
- If a 3–4B model matches larger models after validation, do not serve 14B.
- If fine-tuning does not improve held-out verifier acceptance or review time,
  stop at prompting and retrieval.
- If on-device inference harms load time or keyboard responsiveness, keep it
  server-side or research-only.
- If adaptive models improve prediction but not delayed learning or workload,
  keep the transparent scheduler.
- If synchronous generation cannot reliably return a validated result inside a
  strict latency and retry budget, pre-generate and cache instead.

## Recommended conclusion

The technically strongest and safest path is not “find the cheapest LLM that
knows Vim.” It is to make Vim execution, skill evidence, and learner outcomes
machine-readable, then test increasingly sophisticated models only where the
deterministic system leaves a measurable gap.

For the product, this keeps the core free, fast, private, and offline. For the
research portfolio, it creates several real experiments: constrained generation
with executable verification, compact sequence modeling, synthetic-to-real
analysis, calibrated knowledge tracing, safe policy learning, fine-tuning, and
local deployment. The likely winning production stack is deliberately modest:
rules and a solver for truth, an interpretable learner model for review, a small
trace model only if it beats rules, and an optional 7–14B or hosted model for
offline authoring and carefully grounded coaching.

## Primary and official references

### Educational modeling and policy learning

- Pavlik, Cen, and Koedinger,
  [Performance Factors Analysis](https://files.eric.ed.gov/fulltext/ED506305.pdf),
  2009.
- Corbett and Anderson,
  [Knowledge tracing: Modeling the acquisition of procedural knowledge](https://doi.org/10.1007/BF01099821),
  1995.
- Settles and Meeder,
  [A Trainable Spaced Repetition Model for Language Learning](https://research.duolingo.com/papers/settles.acl16.pdf),
  2016.
- Choffin et al.,
  [DAS3H](https://arxiv.org/abs/1905.06873), 2019.
- Piech et al.,
  [Deep Knowledge Tracing](https://arxiv.org/abs/1506.05908), 2015.
- Liu et al.,
  [Knowledge Tracing: A Survey](https://doi.org/10.1145/3569576), 2022.
- Lee,
  [Estimating student ability and problem difficulty using item response theory and TrueSkill](https://doi.org/10.1108/IDD-08-2018-0030),
  2019.
- [Anki Manual: FSRS](https://docs.ankiweb.net/deck-options.html#fsrs) and the
  [Open Spaced Repetition benchmark](https://github.com/open-spaced-repetition/srs-benchmark),
  checked 22 July 2026.
- Cai et al.,
  [Bandit algorithms to personalize educational chatbots](https://www.hks.harvard.edu/publications/bandit-algorithms-personalize-educational-chatbots),
  2021.
- Zhan et al.,
  [Off-Policy Evaluation via Adaptive Weighting with Data from Contextual Bandits](https://arxiv.org/abs/2106.02029),
  2021.

### Generation, adaptation, and simulation

- Sarsa et al.,
  [Automatic Generation of Programming Exercises and Code Explanations using Large Language Models](https://arxiv.org/abs/2206.11861),
  2022.
- Smith et al.,
  [Generating Game Levels to Develop Computer Science Competencies](https://pmc.ncbi.nlm.nih.gov/articles/PMC7334711/),
  2020.
- Schall and de Melo,
  [The Hidden Cost of Structure: How Constrained Decoding Affects Language Model Performance](https://aclanthology.org/2025.ranlp-1.124/),
  2025.
- Hu et al., [LoRA](https://arxiv.org/abs/2106.09685), 2021.
- Dettmers et al., [QLoRA](https://arxiv.org/abs/2305.14314), 2023.
- Hinton et al.,
  [Distilling the Knowledge in a Neural Network](https://research.google/pubs/distilling-the-knowledge-in-a-neural-network/),
  2015.
- Hsieh et al.,
  [Distilling Step-by-Step](https://research.google/pubs/distilling-step-by-step-outperforming-larger-language-models-with-less-training-data-and-smaller-model-sizes/),
  2023.
- Pagonis et al.,
  [Analysis of Knowledge Tracing Performance on Synthesised Student Data](https://arxiv.org/abs/2401.16832),
  2024.
- Wang et al.,
  [When LLMs Hallucinate: Effects of Erroneous Feedback in Math Tutoring Systems](https://doi.org/10.1145/3698205.3729555),
  2025.

### Current model and runtime documentation, checked 22 July 2026

- [Qwen3 official release](https://qwenlm.github.io/blog/qwen3/).
- [Gemma 4 official overview and memory table](https://ai.google.dev/gemma/docs/core).
- [Mistral 3 official release](https://mistral.ai/news/mistral-3/).
- [gpt-oss official release and architecture](https://openai.com/index/introducing-gpt-oss/).
- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/).
- [ONNX Runtime WebGPU execution provider](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html).
- [Transformers.js WebGPU guide](https://huggingface.co/docs/transformers.js/guides/webgpu).
- [Transformers.js quantization guide](https://huggingface.co/docs/transformers.js/guides/dtypes).
- [MLX](https://github.com/ml-explore/mlx).
- [`llama.cpp`](https://github.com/ggml-org/llama.cpp).
- [vLLM](https://docs.vllm.ai/).

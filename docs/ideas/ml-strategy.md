# ML strategy

**Status: idea, not scheduled. Nothing here is implemented.** A research
proposal (July 2026) for where machine learning could help The Vim Wilds, in
what order, and how to tell whether it did. Product-side learning design is in
[adaptive-practice.md](adaptive-practice.md); validation and the cost of paid
inference are in [launch-and-monetization.md](launch-and-monetization.md).

## The core decision: neuro-symbolic, not an LLM tutor

The app owns a deterministic editor, explicit target states, a skill taxonomy,
and short observable command traces. That is a stronger foundation than a
Vim-shaped prompt. Each layer has one job:

1. **The Vim engine and conformance fixtures** decide what happened and whether
   it is valid.
2. **Rules and an offline solver** identify skill evidence, known strategies,
   inefficient patterns, and counterexamples.
3. **Statistical learner models** estimate what the learner will remember.
4. **A ranking policy** chooses among already-valid exercises.
5. **Small models or LLMs** may generate candidates and explain verified facts,
   but never create truth by assertion.

This is both safer for learners and a better data-science project: rules,
classical models, a small trace encoder, local open-weight models, and hosted
models can all be compared on the same versioned evaluation set.

**The immediate opportunity is not an LLM call.** It is to turn the structured
content and deterministic editor into clean observations. Once the app accepts
and segments alternative commands (today it rejects any key that isn't the next
canonical one), a single attempt yields final-state validity, required and
forbidden skill evidence, a logical command trace with state deltas, strategy
and efficiency features, hint/retry/recovery/latency signals, and — when the
skill reappears — a delayed outcome.

## Four jobs that must stay separate

| Job | Ground truth | First implementation | Possible learned extension | Must not do |
| --- | --- | --- | --- | --- |
| Correctness | Editor state and conformant execution | Engine replay, target predicates, evidence rules, native/browser fixtures | None needed | Ask a model whether a trace "looks correct" |
| Attempt interpretation | Command spans, state deltas, solution families, reviewed labels | Rules, solver comparison, feature model | 5–20M trace encoder; fact-grounded LLM prose | Override validity or invent command effects |
| Learner state | Later independent performance on the same skill | Per-skill counters and a forgetting heuristic | PFA, HLR, BKT/DAS3H, IRT, then sequence models | Treat one completion as permanent mastery |
| Next-exercise selection | Delayed learning and workload | Constrained candidates plus a transparent score | Calibrated ranker, then a safe contextual bandit | Let a generative model pick arbitrary content |

**Correctness is execution, not language understanding.** `5j` and `jjjjj` both
reach the same line. A movement lesson accepts both; a count drill reports
"target reached, but the count wasn't demonstrated"; an efficiency coach notes
five repeated `j`. Raw key count is evidence, never a correctness rule.

**Attempt interpretation** labels strategy families (counted motion, text
object, Visual, dot-repeat, macro, `:s`, `:normal`), misconceptions (forgotten
Escape, count on the wrong command, selection off by a row, overwritten
register, macro replayed from an unstable anchor), and efficiency (repeated
manual action, avoidable navigation). Start with rules over engine-derived
spans. An LLM, if any, only turns facts into prose — for example
`{validOutcome: true, requiredEvidenceSatisfied: false, recognizedStrategy:
"repeated-motion:j", availableAlternative: "5j"}` — and falls back to a
reviewed template on any malformed, unknown, or contradictory output.
Hallucinated tutoring feedback measurably increases learner confusion
(Wang et al., 2025).

**Learner state** is labelled only by a later, independent attempt, and output
as a calibrated prediction such as `P(independent success in 7 days | history)`
— not a decorative "92% mastered".

**Selection** operates only over a deterministic candidate set, with a
transparent first score:

```text
score = review_urgency + target_skill_need + transfer_and_variety_value
      + learner_goal_match
      − recent_template_repetition − predicted_frustration − session_cost
```

From the first adaptive release, log the full candidate set, the chosen item,
the policy version, and the selection probability. Without propensities,
off-policy evaluation later is impossible or badly biased (Zhan et al., 2021).

## Model-size ladder

Engineering hypotheses, not benchmark results. The way to decide is one gold
suite and the smallest model that clears its quality, latency, and cost gates.

| Tier | Approach | Likely role | Promotion gate |
| --- | --- | --- | --- |
| No learned model | Rules, templates, typed generators, search | Validity, evidence, basic coaching, first scheduler | Ship first; keep as permanent fallback |
| Classical ML | Regularized logistic / mixed-effects regression, gradient-boosted trees | Success prediction, item difficulty, misconception labels | Beat rules on grouped, time-forward holdouts |
| 5–20M params | GRU, temporal convolution, or 4–6-layer Transformer encoder | Trace labels, solution ranking, feedback-template choice, abstention | Add useful coverage over rules within a phone budget |
| 0.6–4B | Tuned pretrained decoder or encoder-decoder | Short grounded coaching, DSL completion, template filling | Meet faithfulness and parse gates; never control validity |
| 7–14B | Instruct or reasoning model, optionally LoRA-tuned | Offline exercise candidates, critiques, teacher labels | Higher verifier acceptance and novelty than 3–4B, at justified cost |
| 20–32B | Dense or sparse local model | Hard automation exercises, repair, teacher data | Material lift over 7–14B on hard strata |
| Frontier hosted | Chosen by evals | Rubrics, hard authoring, adjudication, supervision | Only where smaller models fail and value exceeds cost |

- **Why a tiny trace model is plausible:** it doesn't need English or world
  knowledge. Its vocabulary is normalized commands and state transitions —
  command family and slots, mode before/after, cursor-displacement buckets,
  selection shape, insert/delete/line deltas, register/search/repeat/macro/undo
  events. Pretrain on solver-generated traces (next-command, masked-command,
  state-delta prediction, contrastive pairs of equivalent strategies), then
  fine-tune on reviewed labels. Losing to a boosted tree is a publishable
  result.
- **Why prose needs a pretrained model:** training a decoder from scratch would
  mean learning English as well as Vim. Adapt a small pretrained model, and
  compare it against template retrieval first.
- **Why authoring is harder than feedback:** an exercise must coordinate a
  realistic buffer, an unambiguous instruction, a reachable target, solution
  traces, skill coverage, difficulty, no unintended shortcuts, and novelty
  without leaking held-out templates. Hence 7–14B for local authoring and a
  bigger teacher for hard families (Sarsa et al., 2022).
- **The most cost-effective learned piece may be a candidate reranker:**
  generate broadly with templates or cheap models, validate deterministically,
  then predict verifier acceptance, novelty, difficulty, and review score.

**Dense vs mixture-of-experts:** active parameters explain compute; total
parameters still have to be stored. A "30B-A3B" model computes like a small one
but does not fit in a small model's memory. Architecture, data, tokenizer,
quantization, and kernels can matter more than nominal size.

## Generation pipeline

- **Keyed context, not "all of Vim".** Retrieve by skill ID, command family,
  mode, and exercise type: for a `5j` exercise, count and vertical-motion
  rules, the state contract, and a few varied examples — not the Vim manual.
  Vector search may later help find realistic buffers or explanations but never
  supplies correctness.
- **Emit a typed intermediate representation**, not final JSON plus prose in
  one response: skills, allowed command families, initial state, target
  predicate, teaching solutions, required and forbidden evidence, difficulty
  features, and a surface plan. The pipeline materializes the buffer, replays
  every solution, searches for shortcuts, checks native and browser Vim, and
  derives state facts rather than trusting them. Constraint-based procedural
  generation is established in educational games (Smith et al., 2020).
- **Constrained decoding is a syntax aid, not a semantic proof,** and it can
  change model quality — benchmark constrained vs unconstrained-plus-repair
  (Schall & de Melo, 2025).
- **Rejection is training data.** Give every failure a deterministic reason
  code (`SCHEMA_INVALID`, `UNSUPPORTED_COMMAND`,
  `TEACHING_SOLUTION_DID_NOT_REACH_TARGET`, `BROWSER_NATIVE_DIVERGENCE`,
  `REQUIRED_EVIDENCE_MISSING`, `UNINTENDED_SHORTCUT`, `AMBIGUOUS_TARGET`,
  `DUPLICATE_TEMPLATE`, `DIFFICULTY_OUT_OF_RANGE`, `HUMAN_REVIEW_REJECTED`).
  Use it for one bounded repair attempt, to train a rejection/review-value
  predictor, and to fine-tune on accepted/rejected pairs. Never let a learner
  wait on an unbounded generate-reject loop.

## Fine-tuning, distillation, quantization

- **Fine-tune only for a measured, repeatable gap** — poor DSL adherence, low
  verifier acceptance on a command family, repetitive scenarios, weak
  difficulty control, poor misconception labels, generic feedback. Keyed
  context, structured output, examples, and repair come first.
- **Data first:** accepted and rejected candidates with reasons, diverse valid
  solutions, near misses and shortcuts, facts paired with reviewed feedback,
  labels, and full provenance. Plot learning curves at roughly 500, 2,000, and
  10,000 reviewed examples rather than guessing the scale.
- **LoRA / QLoRA** make 3–14B experiments feasible on one workstation. Compare
  base prompting, few-shot, constrained decoding, LoRA with the same context,
  LoRA with reduced context, and the template/solver baseline. Report cost per
  *accepted* candidate, not training loss.
- **Distillation:** a large teacher labels verified traces, ranks solution
  families, and makes hard negatives; a small student learns labels or short
  feedback. "Rationale" means a reviewed reason code derived from engine facts,
  never private chain-of-thought.
- **Quantization** after quality is established: compare FP16/BF16, 8-bit, and
  4-bit on the exact suite, per command family — a small aggregate loss can hide
  a large failure on macros or registers.

## Learner-model progression

Move from interpretable to flexible only when each stage has enough
longitudinal data to evaluate it (survey: Liu et al., 2022).

| Stage | Model | What it adds | Gate / limitation |
| --- | --- | --- | --- |
| 0 | Per-skill rules and spacing | Due date, recent success, hint and lapse counters | Permanent baseline |
| 1 | Performance Factors Analysis | Separate success/failure counts per skill; multi-skill items | Needs repeated observations; weight guided attempts carefully |
| 2 | Half-Life Regression, FSRS comparator | Explicit forgetting over elapsed time | Built for flashcards; procedural transfer unproven |
| 3 | DAS3H, time-aware BKT | Skill learning plus forgetting across multi-skill items | Identifiability risk; validate calibration, not only AUC |
| 4 | IRT / multidimensional IRT | Separates learner ability from item difficulty | Cold-start items need priors from authored difficulty features |
| 5 | Contextual ranker / bandit | Learns which valid exercise gives the best delayed result | Needs propensities, exploration, delayed reward, overlap, safety rules |
| 6 | Deep knowledge tracing | Nonlinear, cross-skill temporal patterns | Data hungry; better prediction may not mean better learning |

- **Stage 0** tracks, per skill: independent successes, guided completions
  (weaker), lapses, last practised, next review, interval, and which estimator
  produced it. A failure schedules a short corrective retry, never a penalty.
- **PFA** (Pavlik et al., 2009) is the natural first data-science model because
  its coefficients are inspectable. **HLR** (Settles & Meeder, 2016) answers
  "what's the chance they use `ciw` unaided after seven days?". **FSRS** —
  difficulty, stability, retrievability, deployed in Anki with an open
  benchmark — is a baseline to beat, not assumed superior for multi-skill
  procedural tasks. **BKT** (Corbett & Anderson, 1995) needs adapting for
  forgetting; **DAS3H** (Choffin et al., 2019) handles it and multi-skill items
  natively, which fits compositions like operator + motion + count + repeat.
  **IRT** (Lee, 2019) calibrates generated variants — don't fit a difficulty
  parameter from five responses and call it calibrated.
- **Bandits** (Cai et al., 2021): actions are already-valid assignments; the
  reward is later hint-free recall or unseen-template transfer, not immediate
  completion; exploration stays within pedagogically sound options; learners
  can always choose. Require offline replay, an A/A logging test, a small
  randomized safety trial, and a pre-registered comparison against the
  transparent scheduler.
- **Deep KT** (Piech et al., 2015) only with user-grouped and time-forward
  splits, template holdouts, calibration by skill and delay, and ablations
  against simple counts. Predicting the old scheduler well is not a product
  result.

## Data principles

- Store immutable local events (IndexedDB, not one mutated `localStorage`
  object) and recompute derived learner state when an estimator changes.
- Keep three representations apart: raw local events, upload-safe derived
  events, and optional cloud feedback payloads.
- Upload-safe means literals become shapes (kind, length bucket, character
  classes); positions become deltas or buckets; timings are bucketed. For
  authored exercises the server already knows the buffers from exercise and
  content IDs.
- Never upload free-practice buffers, pasted content, file names, Insert
  literals, search patterns, Ex arguments, register or macro contents,
  clipboard, or key timings fine enough to be biometric. Analytics consent and
  training-data consent are separate choices.
- Every training row is traceable to its source class (solver, template,
  simulated, consented human, teacher model, human author), versions, label
  source, allowed purposes, split, and deletion tombstones. Splits are immutable
  within an experiment.
- Minimization comes before federated learning or differential privacy: the
  best protection for free-practice text is not collecting it.

## Simulated learners

Useful because both the environment and the commands are executable; they
cannot prove a scheduler teaches people.

- Give simulated learners explicit latent state — per-skill mastery, stability,
  learning rate, slip and guess, misconception weights, strategy preferences,
  fatigue, persistence, hint seeking, input noise, transfer strength — and
  sample archetypes (fast-forgetting, slow-stable, count-averse, Insert-mode
  overuser, forgets to return to Normal, weak operator-motion composition,
  passes guided but fails transfer, fatigued mobile user, experienced tester).
- The real engine executes every simulated command, so traces can't assert
  impossible states.
- **Can establish:** schemas survive long histories; the scheduler avoids
  starvation and overload; off-policy estimators recover known synthetic values;
  classifiers recognize generator-known strategies; experimental power.
- **Cannot establish:** that synthetic misconceptions resemble real ones, that
  simulated engagement predicts return, or that a policy improves human recall.
  Synthetic data gave only minor knowledge-tracing gains in one study (Pagonis
  et al., 2024). Keep a human-only, time-forward test set and report the gap.

## Evaluation

- **Splits:** user-grouped, time-forward, template-disjoint,
  composition-disjoint (hold out e.g. count + operator + text object while
  keeping the parts), skill-family holdout, source-disjoint (human-only), and a
  model-blind gold set. Bootstrap confidence intervals by user; never split
  individual attempts randomly and claim generalization.
- **Generation:** report the whole funnel — parse, static validation, replay,
  native/browser agreement, required evidence and prerequisite fit, shortcut
  and brittleness rate, diversity, human accept/edit/reject, and cost per
  accepted exercise. Not "99% correct" from an LLM judge.
- **Attempt interpretation:** per-class precision/recall/F1, ranking accuracy
  across valid solutions, Brier score and calibration, selective risk under
  abstention, robustness to renamed identifiers, touch vs physical parity,
  latency and memory.
- **Feedback:** adversarial cases (valid outcome but missing evidence; right
  text, wrong mode; efficient unfamiliar solution; undo recovery; unsupported
  command; malformed model output; prompt-like buffer text). Gate on zero
  contradictions of verifier facts.
- **Learner models:** log loss and Brier first, calibration by skill, delay,
  and history length; AUC only secondary. Calibration matters because the
  scheduler acts on predicted recall.
- **Policies:** the primary online metric is delayed hint-free recall or
  unseen-template transfer within a practice-time budget. Use inverse-propensity
  or doubly robust estimators only with adequate overlap, and publish effective
  sample sizes. A small randomized holdout remains the clearest check.

**Release gates.** Only the engine can pass an attempt or exercise. No
unvalidated exercise reaches a learner. Advisory feedback has zero known
contradictions on the gold set. A compact model ships only if it beats rules on
disjoint data within the phone budget. A learner model replaces a simpler one
only after better time-forward calibration and a learning-relevant gain. Every
model, adapter, prompt, quantizer, runtime, or verifier change reruns the frozen
suite.

## Experiment program

- **E0 — deterministic benchmark.** Reviewed gold exercises and predicates,
  multiple valid strategies and near misses, replay fixtures, a command-span
  and state-delta schema, rule-based evidence, and baseline reports with no
  learned model. The prerequisite for everything, and the strongest portfolio
  artifact.
- **E1 — compact trace understanding.** Rules vs logistic regression vs boosted
  trees vs GRU/TCN vs 5/10/20M encoders on strategy, misconception,
  feedback-template, ranking, and abstention tasks. Train on solver traces,
  then measure how much human data closes the synthetic-to-real gap.
- **E2 — provider-neutral authoring bake-off.** One model each near 3–4B, 8B,
  and 12–14B, optionally 20–32B, plus one or two hosted teachers, on the same
  DSL, context, and strata. Compare direct generation, plan-then-materialize,
  verifier-feedback repair, and generate-many-plus-rerank.
- **E3 — fine-tuning and distillation** on the smallest promising models. Stop
  if it memorizes templates or fails composition-disjoint tests.
- **E4 — learner modeling.** N=1 developer traces validate plumbing only. With
  consented multi-user data, compare rules, PFA, HLR/FSRS, DAS3H/BKT, and IRT
  on frozen time-forward splits.
- **E5 — safe policy learning.** Validate estimators on simulated policies, run
  an A/A test, pre-register reward and stopping rules, and compare a simple
  contextual policy with the transparent scheduler on delayed retention.

Each experiment publishes a pinned config, dataset and model cards, rule and
classical baselines beside every neural result, per-family failure analysis,
and quality/latency/memory/cost Pareto plots measured per accepted result.

## Deployment notes

- **The default PWA never downloads a generative model.** Even "edge" LLMs are
  hundreds of MB to GB — enormous next to a static mobile trainer.
- **A 5–20M classifier is different:** about 5–20 MB at 8-bit, 2.5–10 MB at
  4-bit. Plausible as an optional, cached, versioned download running in a Web
  Worker, with a capability probe and a WebAssembly or rules fallback.
- **Memory rule of thumb:** a dense model at 4-bit is about `P × 0.5` bytes of
  weights, plus quantization metadata, runtime buffers, and a KV cache that
  grows with context. On Apple silicon, reserve 30–40% of unified memory for
  the OS and runtime: 16 GB suits 3–4B, 24–32 GB suits 7–14B, 48–64 GB makes
  20–32B practical.
- **Browser release gates:** nothing needs a model to start, complete, or review
  the curriculum; the download is explicit with visible size and removal;
  checksum and version pinning; cancellable worker inference with a timeout;
  measured on real iOS and Android devices; no effect on keyboard
  responsiveness; identical deterministic feedback when the model is absent.
- **Server side:** a hosted API or scale-to-zero endpoint first. Dedicated
  serving only when sustained traffic, privacy, or latency justifies idle
  capacity and operations.

## Portfolio ranking

1. **Neuro-symbolic exercise factory and verifier** — formal decomposition,
   solver design, differential native/browser testing, LLM orchestration,
   production safety. Credible without a large dataset.
2. **Adaptive-learning comparison with delayed outcomes** — rules, PFA,
   HLR/FSRS, DAS3H/BKT, IRT on disjoint splits, calibration, propensity logging;
   a clear result even if the simple scheduler wins.
3. **Privacy-safe longitudinal data architecture** — immutable versioned
   events, upload-safe transforms, consent and lineage, reproducible backfills.
4. **Simulated learner laboratory and compact trace model** — engine-in-the-loop
   traces, rules/tree/GRU/TCN/Transformer comparison, the synthetic-to-real gap.
5. **LoRA, distillation, and quantized local deployment** — valuable, but less
   differentiated on its own.

The strongest story is not "fine-tuned a model". It is: designed a
deterministic educational environment, generated and verified structured
content, built privacy-safe longitudinal data, compared interpretable and deep
models, and evaluated policies on delayed outcomes. The robotics analogy
(latent state, policies, simulators, off-policy evaluation, sim-to-real) is a
transferable *methodology*, not robotics evidence.

## Risks and stopping rules

- **Model risk:** hallucinated Vim behavior never reaches the truth boundary;
  report execution yield, not parse rate; cluster diversity by template and
  strategy, not wording; pin model revisions; treat buffer text as data, never
  instructions.
- **Statistical risk:** cold start (use authored priors, don't overfit five
  responses); selection bias (log propensities); leakage (split by user, time,
  template, composition, source); synthetic dominance; optimizing engagement
  instead of learning; memorizing identity.
- **Stop when simpler wins:** if rules cover the useful feedback, don't ship a
  trace model. If 3–4B matches larger models after validation, don't serve 14B.
  If fine-tuning doesn't improve verifier acceptance or review time, stay with
  prompting. If on-device inference hurts load time or keyboard feel, keep it
  server-side or research-only. If adaptive models improve prediction but not
  learning or workload, keep the transparent scheduler. If synchronous
  generation can't return a validated result within a strict budget,
  pre-generate.

The likely winning production stack is modest: rules and a solver for truth,
an interpretable learner model for review, a small trace model only if it beats
rules, and an optional 7–14B or hosted model for offline authoring and grounded
coaching.

## References

### Educational modeling and policy learning

- Pavlik, Cen & Koedinger, [Performance Factors Analysis](https://files.eric.ed.gov/fulltext/ED506305.pdf), 2009.
- Corbett & Anderson, [Knowledge tracing: modeling the acquisition of procedural knowledge](https://doi.org/10.1007/BF01099821), 1995.
- Settles & Meeder, [A Trainable Spaced Repetition Model for Language Learning](https://research.duolingo.com/papers/settles.acl16.pdf) (Half-Life Regression), 2016.
- Choffin et al., [DAS3H](https://arxiv.org/abs/1905.06873), 2019.
- Piech et al., [Deep Knowledge Tracing](https://arxiv.org/abs/1506.05908), 2015.
- Liu et al., [Knowledge Tracing: A Survey](https://doi.org/10.1145/3569576), 2022.
- Lee, [Estimating student ability and problem difficulty using IRT and TrueSkill](https://doi.org/10.1108/IDD-08-2018-0030), 2019.
- FSRS: [Anki manual](https://docs.ankiweb.net/deck-options.html#fsrs) and the [Open Spaced Repetition benchmark](https://github.com/open-spaced-repetition/srs-benchmark).
- Cai et al., [Bandit algorithms to personalize educational chatbots](https://www.hks.harvard.edu/publications/bandit-algorithms-personalize-educational-chatbots), 2021.
- Zhan et al., [Off-Policy Evaluation via Adaptive Weighting with Data from Contextual Bandits](https://arxiv.org/abs/2106.02029), 2021.

### Generation, adaptation, and simulation

- Sarsa et al., [Automatic Generation of Programming Exercises and Code Explanations using LLMs](https://arxiv.org/abs/2206.11861), 2022.
- Smith et al., [Generating Game Levels to Develop Computer Science Competencies](https://pmc.ncbi.nlm.nih.gov/articles/PMC7334711/), 2020.
- Schall & de Melo, [The Hidden Cost of Structure: How Constrained Decoding Affects LM Performance](https://aclanthology.org/2025.ranlp-1.124/), 2025.
- Hu et al., [LoRA](https://arxiv.org/abs/2106.09685), 2021.
- Dettmers et al., [QLoRA](https://arxiv.org/abs/2305.14314), 2023.
- Hinton et al., [Distilling the Knowledge in a Neural Network](https://research.google/pubs/distilling-the-knowledge-in-a-neural-network/), 2015.
- Hsieh et al., [Distilling Step-by-Step](https://research.google/pubs/distilling-step-by-step-outperforming-larger-language-models-with-less-training-data-and-smaller-model-sizes/), 2023.
- Pagonis et al., [Knowledge Tracing Performance on Synthesised Student Data](https://arxiv.org/abs/2401.16832), 2024.
- Wang et al., [When LLMs Hallucinate: Effects of Erroneous Feedback in Math Tutoring](https://doi.org/10.1145/3698205.3729555), 2025.

### Open-weight families and runtimes (as of July 2026 — recheck before use)

Families with a clean size ladder, useful for a controlled bake-off:
[Qwen3](https://qwenlm.github.io/blog/qwen3/) (dense 0.6–32B plus MoE),
[Gemma](https://ai.google.dev/gemma/docs/core) (edge through 31B, with published
memory tables; own license terms),
[Mistral / Ministral](https://mistral.ai/news/mistral-3/) (3B, 8B, 14B, Apache 2.0),
and [gpt-oss](https://openai.com/index/introducing-gpt-oss/) (sparse 20B and 120B,
useful for total-vs-active comparisons). Verify the exact checkpoint, license,
and runtime support before any experiment.

Runtimes: [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) and
[Transformers.js](https://huggingface.co/docs/transformers.js/guides/webgpu) for
in-browser WebGPU/WASM inference; [MLX](https://github.com/ml-explore/mlx) and
[`llama.cpp`](https://github.com/ggml-org/llama.cpp) for local Apple-silicon
work; [vLLM](https://docs.vllm.ai/) for server-side serving.

# Launch and monetization

**Status: idea, not scheduled.** How to find out whether The Vim Wilds is
useful and wanted, and how it could pay for itself if it is. Condensed from two
July 2026 strategy documents. Their dated price tables were dropped on purpose:
recompute from the [sources](#sources-to-recheck) with the
[formula](#recomputing-inference-cost) when a decision actually needs a number.
Market background is in [../market-research.md](../market-research.md).

**Where the product stands (September 2026).** A working, installable,
offline-capable PWA on GitHub Pages: 17 units, local mastery progress, free
practice, reference decks, and in-app problem reports. There is no product
analytics, no account, no payment, and no beta cohort. Input is still graded
against the next canonical key; see
[../exercise-verification-and-feedback.md](../exercise-verification-and-feedback.md).

## Principles

- **Launch as a useful free product before launching as a business.** The first
  question is not whether people click an advert. It is whether a defined
  learner can find the app, finish one learning loop, come back later, and use
  the skill on a different buffer.
- **Never sell probabilistic correctness.** Vim execution, target-state checks,
  and native/browser conformance stay the authority. Paid inference may explain
  verified facts, compare strategies, or propose exercises that are accepted
  only after deterministic validation.
- **Keep the learning loop generous.** Core commands, deterministic grading,
  scheduled review, and free practice stay outside any paywall.
- **Token costs are small at early scale; people costs are not.** Content
  review, support, tax administration, maintenance, and distribution are the
  real risks. Low infrastructure cost makes a hobby cash-positive quickly; it
  does not make the developer's time free. Model it explicitly — owner hours per
  month as a fixed part plus a per-payer part, at an opportunity rate — and
  never call gross receipts profit.
- **Pre-generate and validate exercise variety** instead of generating at
  runtime. It is cheaper, testable, cacheable, offline, and reusable. At three
  minutes of human review per accepted exercise, 1,000 exercises is 50 reviewer
  hours — far more than the inference bill. On-demand generation must first
  beat selection from a validated pool and parameterized templates.
- **Payer counts over market-size stories.** Treat early payments as
  validation, not a forecast. Before measured activation, retention,
  conversion, and churn, the honest expected commercial outcome is close to
  zero, and the portfolio value does not depend on revenue.

## Packaging

| Tier | Price idea | What it holds |
| --- | --- | --- |
| **Free** | — | The deterministic curriculum, reviewed guided and recall exercises, template variants, local progress and review scheduling, free practice, rule-based feedback, a complete offline path |
| **Supporter / offline pack** | $25–39 one time | Applied challenge and capstone packs, extra realistic buffers, deeper local analytics and export, cosmetic themes, lifetime access to purchased packs. Anchored against Vim Adventures' $35–40 *six-month* license |
| **AI Coach** | ~$6.99 / month | Explanations of verified mistakes, one relevant strategy comparison, personalized selection from the validated pool, a few generated-and-validated drills, a weak-skill recap. A published fair-use budget; local deterministic feedback once it runs out |
| **Annual AI Coach** | ~$49.99 / year | Only after three months of usage, churn, and refund data show the discount is sustainable |
| **Bring your own key** | — | For power users and demos: the user picks a provider and pays it directly. Not a substitute for a simple plan |

A donation link fits the free portfolio phase but is neither predictable
revenue nor entitlement infrastructure. Team or educator licensing waits until
individual retention is real — it is a different product.

**What not to do.** No ads in the learning loop. No "unlimited AI". No frontier
model on every keystroke. No hard paywall before a learner has experienced
delayed recall and transfer. No subscription justified only by a finite set of
advanced units. No model as pass/fail authority.

## Validation staircase

Seven stages, in order. Each ends in a gate that is fixed *before* the test and
changed only for the next cohort, never after seeing a disappointing result.
The numbers are proposed internal decisions, not industry benchmarks.

| # | Stage | Goal | Gate to move on |
| ---: | --- | --- | --- |
| 0 | Catalogue audit and gold set | Content is safe to learn from; a frozen evaluation baseline exists | Zero unresolved schema, conformance, or replay failures in reachable content; every reachable scenario reviewed or removed; every skill in the gold set or documented as untestable |
| 1 | 10–20 observed sessions | People understand the promise, controls, and recovery before any analytics | 4 of the last 5 participants complete the first-use journey unaided; no open blocking issue, no repeated damaging one |
| 2 | Measurement foundation | Decisions become auditable without collecting editor content or breaking offline use | Instrumentation QA passes on two consecutive release candidates; the whole offline path works with analytics off |
| 3 | Honest message test | Which problem statement attracts qualified learners who then play | Of ≥100 qualified visits: ≥20% start, ≥10% finish a loop, ≥5% opt into beta contact, ≥10 non-friends finish a loop |
| 4 | Closed beta, 50–100 people, 3–4 weeks | Repeated use, delayed recall, transfer, fairness, support load | ≥25% of starters meet full activation; D7 ≥20%, D30 ≥10%; ≥60% of unseen-buffer checks succeed; no known valid strategy taught as invalid |
| 5 | Payment proof | Real, refundable money instead of stated intent | ≥10 full-price payers who aren't friends, from ≥2 sources; half of them keep practising in two separate weeks |
| 6 | Organic public launch | Compound product, community, search, and portfolio value | Stable cohorts and operational readiness |
| 7 | Native apps or paid ads | Only when evidence justifies fixed work | See the gates below |

Notes that matter more than the numbers:

- **Stage 0 first.** If the catalogue fails its gate, fix or narrow it —
  generating more exercises is not the remedy for untrusted exercises. The gold
  set should cover alternative, inefficient-but-valid, near-miss, and undo
  cases, split by template and strategy family so later model tests can't leak.
- **Stage 1 sessions** (40–50 min): a context interview about the last time
  Vim slowed them down, a first-use test from the public URL alone, a
  return-value prototype, and a debrief. Recruit across new, partial,
  regular-Vim, and Vim-inside-another-editor users, iOS and Android, some
  physical keyboards, and people with access needs — not only friends or Vim
  enthusiasts. Rate findings S1 blocking, S2 damaging (teaches a wrong rule,
  rejects valid Vim, loses progress), S3 friction, S4 preference; fix S1–S2
  before broader traffic.
- **Stage 3** uses the real playable PWA with "Try a lesson" as the action, not
  a waitlist. Each message states the limits honestly: a subset of Vim, a
  cognitive trainer, not a replacement for physical-keyboard practice. Don't
  declare an A/B winner from a handful of conversions.
- **Stage 5** sells a founding Supporter offer first, not an AI subscription.
  The page shows what exists today, exact price and tax, a prominent 30-day
  refund, and what happens if the project stops. A real compliant checkout, never
  card fields in the PWA, never commerce on GitHub Pages.
- **Stage 6 channels, in order:** existing participants; Vim and Neovim
  communities (disclose authorship, ask a specific question); GitHub; engineering
  articles; a voluntary no-login share card; Show HN linking straight to the
  playable app; educators; genuinely useful search pages — not thousands of thin
  generated ones.

## Measuring learning, not traffic

**Meaningful activation** is deliberately demanding. A learner must: complete
one concept loop (explanation or demo, guided practice, an independent
attempt); return 24 hours to 7 days later; complete a due recall of the same
skill on a *different* scenario; and succeed without a solution-revealing hint.
Until review and fresh variants exist, track the first-session funnel but don't
call it activation.

**Learning measures** are editor-verified: independent recall, delayed recall
(≥24 h), near transfer to different text and distractors, tool choice in mixed
practice, recovery after a mistake, and — optionally, with consent — the same
task in a real editor. No causal "improves Vim" claim without a comparison
condition.

Every report shows numerator, denominator, cohort dates, and app/content
version. Use fixed D1/D7/D30 windows when comparing cohorts; a user too new to
have had the chance is "not yet eligible", not churned.

## Privacy rules for any telemetry

- Keep full command traces local; upload derived exercise facts, never buffers.
- Never upload free-practice content, inserted text, search patterns, Ex
  literals, register or clipboard contents, file names, or pasted text.
- Use app-authored exercise, skill, and content-version IDs; coarsen durations.
- No fingerprinting and no advertising identifiers; a random learner ID only.
- Plain-language explanation and an off switch before collecting anything.
- Keep research contact details outside the event store.
- One versioned event envelope, an allowlisted vocabulary, a receiver that
  rejects unexpected payloads, an offline queue, and analytics failures that
  never block a lesson.
- "Anonymous analytics" still needs a documented lawful basis (UK GDPR, PECR).

## Commercial decision gates

- **Before charging for a Supporter pack:** learners get far enough through the
  free curriculum to see the value; paid content passes conformance; lifetime
  wording is explicit; refund, tax, privacy, support, and entitlement paths are
  tested.
- **Before an AI Coach:** a non-LLM baseline exists; the chosen model passes
  factuality, parse, latency, and helpfulness gates on the gold set; per-user
  and global budgets, output caps, and fallback are live; 20+ testers produce a
  real cost distribution whose 95th percentile fits the price; no model output
  can override deterministic correctness.
- **Before self-hosting a model:** a specific open-weight model clears the same
  gates, measured API spend repeatedly exceeds the all-in endpoint cost, and
  load tests include cold start and failover. Start with an API or a
  scale-to-zero endpoint; never an always-on GPU for a small, bursty audience.
- **Before native stores:** the PWA has ~500 monthly active learners for three
  months (or a partner requires a store app), install limits are a top-three
  activation failure, and native unlocks a specific capability, not just an
  icon.
- **Before paid ads:** ~100 non-founder paying customers, stable activation and
  D30 across three releases, and a CAC ceiling approved in advance. First test
  capped at £250–500 on one audience.

**Economic controls for any paid inference:** authenticated per-user rate
limits, monthly feedback and generation budgets, per-request token caps,
retry and concurrency ceilings, a global monthly spend ceiling, a kill switch
with local fallback, and alerts on cost per active user.

## Hosting and payments

- **PWA first.** Native stores come only after repeat use and payment intent.
- **Leave GitHub Pages before taking money.** GitHub's terms say Pages is not
  for an online business, e-commerce site, or commercial SaaS. Cloudflare
  Pages or Netlify are plausible commercial hosts; Vercel's free tier is
  non-commercial too. This also bears on
  [../plans/asset-and-hosting-budget.md](../plans/asset-and-hosting-budget.md).
- **Keep the static learning path up during backend outages.** Accounts, sync,
  entitlements, and AI degrade independently.
- **Use a Merchant of Record** (for example Paddle) for the first worldwide
  sale; it takes on VAT and sales tax, which a plain processor does not. For a
  UK seller, customer location decides where digital-services VAT is due
  regardless of the UK registration threshold. Reconsider direct processing
  only when the savings exceed the accounting and filing work.

## Recomputing inference cost

```text
cost = (input_tokens × input_price_per_million
      + output_tokens × output_price_per_million) / 1,000,000

accepted_exercise_cost = base_generation_cost × r
```

`r` covers rejected candidates and retries; once a first-pass acceptance rate
`a` is measured, use `r = 1 / a`, split by rejection reason and model.

Choose a model by running the same held-out Vim evaluation through every
candidate and picking the **cheapest one that clears all gates**, not the
cheapest row in a price table. Measure structured-output parse rate, verifier
pass rate, duplicates, human acceptance and edit time, factual consistency,
helpfulness against rule-based feedback, p50/p95 latency, and cost per
*accepted* exercise and per *helpful* feedback event. Route: deterministic
template → smallest qualified model → mid-tier coach → frontier only on a
documented predicate. Model strategy is in
[../ml-experimentation-and-model-strategy.md](../ml-experimentation-and-model-strategy.md).

## Portfolio value

The product is a strong engineering portfolio even with a small audience, if
the public story shows disciplined decisions rather than an inflated user
count. Candidate write-ups: the exercise-quality and conformance architecture;
the deterministic verifier and its LLM boundary; the learning-measurement
protocol; baseline and compact trace models; generation cost versus quality;
adaptive scheduling with simulated and real cohorts; deployment and unit cost.
Each with a reproducible config, a baseline, negative results, and honest
limits — never "simulated learners prove human learning".

## Experiment record

Commit a short record before exposing anyone to an experiment:

```text
Experiment ID · decision it will change · population and exclusions
Hypothesis and counter-explanations · baseline and treatment
Primary metric and exact denominator
Guardrails: learning, fairness, privacy, reliability, cost
Minimum sample or end date · pass / iterate / stop thresholds
App, content, scheduler, verifier, prompt, and model versions
Result, uncertainty, segment checks, incidents, decision
```

Assign variants before exposure. For adaptive selection, log the candidate set,
features, selected item, policy version, and selection probability, or later
off-policy evaluation is much weaker. Don't stop a small test when it happens
to look good.

## Pre-launch checklist

- [ ] Every reachable exercise is reviewed and passes conformance.
- [ ] Recall uses a fresh variant wherever transfer is claimed.
- [ ] Valid equivalent solutions are not rejected in independent practice.
- [ ] First use works at 360, 390, 412, 430, and 432 CSS px, touch and physical.
- [ ] Offline first load, service-worker update, and rollback are tested.
- [ ] Support, known issues, and feedback routes work.
- [ ] Consent, withdrawal, and data deletion are clear; no raw editor content
      is uploaded anywhere.
- [ ] Commercial hosting has moved off GitHub Pages.
- [ ] Checkout, tax, refund, and terms are tested; the offer separates shipped,
      planned, and experimental features.
- [ ] Show HN links to the playable product with no signup.

## Sources to recheck

Prices and policies change; record the retrieval date and inputs with every
calculation. First-party pages used in July 2026:

- Model APIs: [OpenAI](https://developers.openai.com/api/docs/pricing),
  [Anthropic](https://platform.claude.com/docs/en/about-claude/pricing),
  [Google Gemini](https://ai.google.dev/gemini-api/docs/pricing),
  [Mistral](https://mistral.ai/pricing/api/),
  [Fireworks](https://fireworks.ai/pricing),
  [Runpod Serverless](https://docs.runpod.io/serverless/pricing),
  [Google Cloud GPUs](https://cloud.google.com/products/compute/pricing/accelerator-optimized)
- Hosting: [Cloudflare Pages](https://developers.cloudflare.com/pages/functions/pricing/),
  [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/),
  [Netlify](https://www.netlify.com/pricing/),
  [Supabase](https://supabase.com/pricing),
  [Vercel](https://vercel.com/pricing),
  [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- Payments and tax: [Stripe UK](https://stripe.com/gb/pricing),
  [Paddle](https://www.paddle.com/pricing),
  [HMRC VAT registration](https://www.gov.uk/register-for-vat/when-register-for-vat),
  [HMRC digital services VAT](https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers)
- Stores: [Apple Developer Program](https://developer.apple.com/programs/whats-included/),
  [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/),
  [Google Play access](https://support.google.com/googleplay/android-developer/answer/14659200),
  [Google Play fees](https://support.google.com/googleplay/android-developer/answer/112622)
- Research practice: [GDS user research planning](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service),
  [ICO data-protection principles](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/),
  [Show HN guidelines](https://news.ycombinator.com/showhn.html)

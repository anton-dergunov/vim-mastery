# Monetization and Unit Economics

## Purpose and decision

Vim Wilds should keep its deterministic learning loop generous and usable
without a subscription. The most credible commercial shape is:

1. a free, offline-capable curriculum, review scheduler, templated variation,
   and free-practice modes;
2. an optional one-time Supporter or challenge-pack purchase at roughly
   **£19–29 / $25–39**;
3. an optional, usage-capped **AI Coach** at roughly **£5.99 / $6.99 per
   month**, with an annual offer near **£39.99 / $49.99** only after real usage
   data supports that discount;
4. bring-your-own-key (BYOK) for technical users who want a different model or
   more experimentation.

Do not sell probabilistic correctness. Vim execution, target-state checks, and
the native/browser conformance suite remain the authority. Paid inference may
explain deterministic facts, compare strategies, or propose exercises that are
accepted only after deterministic validation. This boundary is developed in
[Adaptive Practice and Exercise Generation](./adaptive-practice-and-exercise-generation.md)
and [Exercise Verification and Feedback](./exercise-verification-and-feedback.md).
Model selection and local-model experiments are covered in
[ML Experimentation and Model Strategy](./ml-experimentation-and-model-strategy.md).

The economic conclusion is encouraging but easy to misread: **token costs are
small at early scale; content review, support, tax administration, product
maintenance, and distribution are the larger risks.** Under the worked
workload below, GPT-5.4 mini costs about **$0.41 for a typical learner-month**
and **$1.51 for a heavy learner-month**. That does not make a $6.99 subscription
automatically profitable, because payment fees, unused capacity, abuse,
refunds, support, and the developer's time still have to be paid.

## Status, currencies, and confidence

All external prices and policies in this document were checked on **22 July
2026**. Prices change frequently; recheck every linked first-party page before
launch and at least quarterly thereafter.

- Model and infrastructure prices are in US dollars unless marked otherwise.
- UK product prices and payment examples are in pounds sterling where stated.
- Provider prices are evidence; workload volumes, support time, reserves, and
  revenue cases are planning assumptions.
- Model rows are **not quality-equivalent**. A cheaper row is not a claim that
  the model will satisfy the same Vim-specific evaluation.
- The estimates exclude corporation or income tax, paid acquisition, and
  foreign-exchange movement. Indirect tax treatment is discussed separately.
- This is product planning, not accounting, tax, or legal advice.

## Executive recommendations

### Product economics

- Monetize recurring inference with a recurring plan. A finite curriculum is a
  poor reason for a perpetual subscription, but ongoing personalized coaching
  has a genuine recurrent cost and benefit.
- Keep foundational commands, deterministic grading, scheduled review, and
  free practice outside the paywall. Paid content can be applied capstones,
  realistic challenge packs, deeper analytics, themes, and convenience—not a
  deliberately weakened free learning loop.
- Pre-generate and validate most exercise variety. It is cheaper, testable,
  cacheable, available offline, and reusable across learners.
- Use a capable mini model for routine paid coaching only after it beats rules
  and smaller models on the product's gold evaluation set. Reserve frontier
  calls for offline authoring, teacher labels, or rare escalations.
- Start with an API or scale-to-zero open-weight endpoint. Do not run an
  always-on GPU for a small, bursty audience.
- Prefer a Merchant of Record for an initial worldwide paid launch unless the
  first commercial scope is deliberately limited to a simpler tax geography.

### Go-to-market economics

- PWA first; native stores come after repeat use and payment intent are proven.
- Move a commercial deployment away from GitHub Pages. GitHub explicitly says
  Pages is not intended or allowed as free hosting for an online business,
  e-commerce site, or commercial SaaS. See the official
  [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
- Treat supporter payments as validation and useful side income, not as a
  forecast. Payer counts are more honest than a top-down market-size story.
- Use the gates in
  [Product Validation and Launch](./product-validation-and-launch.md) before
  adding app-store overhead or paid advertising.

## Recomputable inference model

### Core formula

For one request or bundle of requests:

```text
cost = (input_tokens * input_price_per_million
      + output_tokens * output_price_per_million) / 1,000,000
```

Equivalently, if token volumes are already expressed in millions:

```text
cost = input_millions * input_price
     + output_millions * output_price
```

For generated exercises, let `r` be an accounting multiplier for rejected
candidates and retries:

```text
accepted_exercise_cost = base_generation_cost * r
```

The baseline uses `r = 1.20`, a 20% token allowance. This is not the same as a
20% independent failure probability repeated forever. When a measured
first-pass acceptance rate `a` becomes available, use the more defensible
expected multiplier `1 / a`, split by rejection reason and model.

### Baseline workload

These are deliberately explicit assumptions, not observed usage:

| Operation | Input tokens | Output tokens | Notes |
| --- | ---: | ---: | --- |
| One feedback event | 2,000 | 250 | Exercise facts, structured trace, rubric, and short feedback |
| One accepted generated exercise before retry allowance | 7,000 | 1,500 | Two calls in total: generation plus critique/repair |
| One accepted generated exercise after `1.20` allowance | 8,400 | 1,800 | Expected billable budget, not a literal request shape |

The two monthly learner cases are:

| Case | Feedback events | Accepted generated exercises | Total input tokens | Total output tokens |
| --- | ---: | ---: | ---: | ---: |
| Typical | 100 | 10 | 284,000 | 43,000 |
| Heavy | 300 | 50 | 1,020,000 | 165,000 |

The arithmetic is:

```text
typical input  = 100 * 2,000 + 10 * 7,000 * 1.20 = 284,000
typical output = 100 *   250 + 10 * 1,500 * 1.20 =  43,000

heavy input    = 300 * 2,000 + 50 * 7,000 * 1.20 = 1,020,000
heavy output   = 300 *   250 + 50 * 1,500 * 1.20 =   165,000
```

### OpenAI worked example

On 22 July 2026, standard short-context text prices in the official
[OpenAI API pricing table](https://developers.openai.com/api/docs/pricing)
included:

| Model | Input / 1M | Cached input / 1M | Output / 1M |
| --- | ---: | ---: | ---: |
| GPT-5.4 nano | $0.20 | $0.02 | $1.25 |
| GPT-5.4 mini | $0.75 | $0.075 | $4.50 |
| GPT-5.6 Luna | $1.00 | $0.10 | $6.00 |
| GPT-5.6 Sol | $5.00 | $0.50 | $30.00 |

For GPT-5.4 mini, one feedback event costs:

```text
(2,000 * $0.75 + 250 * $4.50) / 1,000,000
= $0.002625
```

One accepted generated exercise, including the 20% allowance, costs:

```text
((7,000 * $0.75 + 1,500 * $4.50) / 1,000,000) * 1.20
= $0.0144
```

Therefore:

```text
typical = 100 * $0.002625 + 10 * $0.0144 = $0.4065
heavy   = 300 * $0.002625 + 50 * $0.0144 = $1.5075
```

Rounded for planning, that is **$0.41 typical** and **$1.51 heavy** per active
learner-month. The corresponding OpenAI sensitivity is:

| Model | Typical month | Heavy month | 1,000 accepted exercises |
| --- | ---: | ---: | ---: |
| GPT-5.4 nano | $0.11 | $0.41 | $3.93 |
| GPT-5.4 mini | $0.41 | $1.51 | $14.40 |
| GPT-5.6 Luna | $0.54 | $2.01 | $19.20 |
| GPT-5.6 Sol | $2.71 | $10.05 | $96.00 |

The 1,000-exercise column uses 8.4 million input and 1.8 million output tokens.
It does not include human review.

OpenAI listed Batch and Flex prices at half the standard token rates for these
models on the check date. Asynchronous bank generation should use those tiers
when their latency and availability contracts fit. Cached input was 10% of
standard input for the rows above, but only actually cached tokens receive that
rate.

## Provider-neutral API comparison

The following table applies exactly the same token workload to representative
standard text prices. It is a cost screen, **not a model recommendation or a
quality ranking**. Different tokenizers, hidden/reasoning-token accounting,
rate limits, data terms, regional premiums, and structured-output reliability
make realized costs differ.

| Provider and model | Input / 1M | Output / 1M | Typical month | Heavy month | 1,000 accepted exercises |
| --- | ---: | ---: | ---: | ---: | ---: |
| [OpenAI GPT-5.4 nano](https://developers.openai.com/api/docs/pricing) | $0.20 | $1.25 | $0.11 | $0.41 | $3.93 |
| [OpenAI GPT-5.4 mini](https://developers.openai.com/api/docs/pricing) | $0.75 | $4.50 | $0.41 | $1.51 | $14.40 |
| [OpenAI GPT-5.6 Sol](https://developers.openai.com/api/docs/pricing) | $5.00 | $30.00 | $2.71 | $10.05 | $96.00 |
| [Anthropic Claude Haiku 4.5](https://platform.claude.com/docs/en/about-claude/pricing) | $1.00 | $5.00 | $0.50 | $1.85 | $17.40 |
| [Anthropic Claude Sonnet 5](https://platform.claude.com/docs/en/about-claude/pricing) | $2.00 | $10.00 | $1.00 | $3.69 | $34.80 |
| [Google Gemini 3.5 Flash-Lite](https://ai.google.dev/gemini-api/docs/pricing) | $0.30 | $2.50 | $0.19 | $0.72 | $7.02 |
| [Mistral Small 4](https://mistral.ai/pricing/api/) | $0.15 | $0.60 | $0.07 | $0.25 | $2.34 |
| [Mistral Medium 3.5](https://mistral.ai/pricing/api/) | $1.50 | $7.50 | $0.75 | $2.77 | $26.10 |
| [Fireworks gpt-oss-20b](https://docs.fireworks.ai/serverless/pricing) | $0.07 | $0.30 | $0.03 | $0.12 | $1.13 |
| [Fireworks gpt-oss-120b](https://docs.fireworks.ai/serverless/pricing) | $0.15 | $0.60 | $0.07 | $0.25 | $2.34 |

Important price qualifications on the check date:

- Anthropic described Sonnet 5's `$2 / $10` rates as introductory through
  31 August 2026, rising to `$3 / $15` on 1 September. Its Batch API was 50%
  off, and cache hits were 10% of base input after separately priced cache
  writes.
- Google's page states that output pricing includes thinking tokens. The
  selected Gemini 3.5 Flash-Lite row was generally available; preview models
  should not anchor a long-lived business plan.
- Mistral advertised 50% batch discounts and 90% cached-input discounts on its
  API pricing page. Mistral Small 4 is open-weight, but its low hosted API price
  does not imply that self-hosting the full model is cheap.
- Fireworks is an example of managed, serverless open-weight inference. Its
  catalog and prices can change independently of the model weights.

### How to choose rather than price-shop

Run the same held-out Vim evaluation through every candidate. Select the
cheapest model that clears all required gates, not the cheapest row in the
table. At minimum measure:

- structured-output parse rate;
- deterministic verifier pass rate for proposed exercises;
- duplicate and leakage rate;
- human acceptance and edit time;
- factual consistency with the supplied trace;
- helpfulness preference against rule-based feedback;
- p50/p95 latency, timeout rate, and provider availability;
- input, cached-input, reasoning/output, retry, and escalation tokens;
- cost per **accepted** exercise and cost per **helpful** feedback event.

A reasonable routing experiment is: deterministic template first, smallest
qualified model second, mini-tier coach third, frontier escalation only when a
documented predicate is met. The model-size hypotheses and evaluation design
belong in
[ML Experimentation and Model Strategy](./ml-experimentation-and-model-strategy.md).

## Sensitivity and cost traps

### Output length

Output is usually more expensive than input. For GPT-5.4 mini, adding 1,000
output tokens to each of 100 feedback events adds:

```text
100 * 1,000 * $4.50 / 1,000,000 = $0.45 per typical learner-month
```

For 300 heavy-user events it adds `$1.35`. Request a small, typed response and
render most pedagogical prose from local templates. Do not ask for chain of
thought. Reasoning tokens that a provider bills as output must be included in
the usage ledger even if they are not displayed.

### Prompt size and caching

Adding 4,000 uncached input tokens to every feedback request adds `$0.30` to
the typical GPT-5.4 mini month and `$0.90` to the heavy month. Avoid sending a
Vim manual on every request. Send the exercise facts, command taxonomy IDs,
verifier findings, and a compact rubric. Put stable system material in the
provider's prompt-cache mechanism where the access pattern actually produces
hits.

Fine-tuning may reduce prompt size and improve parse or acceptance rates, but
prompt savings alone are not a strong economic justification at this scale.
The experiment is worthwhile when it improves the complete quality/cost
frontier.

### Fine-tuning cost is not the main fine-tuning risk

Managed adapter training can also be inexpensive compared with data work. On
the check date, Fireworks listed LoRA supervised fine-tuning at `$0.50` per
million training tokens for models up to 16B parameters, `$3` for 16.1–80B,
and `$6` for 80–300B, and said fine-tuned models could be served at the base
model's price. See the official
[Fireworks pricing](https://fireworks.ai/pricing). Mistral listed classifier
fine-tuning at `$1` per million training tokens with a `$4` minimum and `$2`
monthly model storage on its
[API pricing page](https://mistral.ai/pricing/api/).

For scale, 10,000 examples averaging 1,000 training tokens over three epochs
are 30 million training tokens. At the Fireworks up-to-16B LoRA rate, one run
would be `$15`. That figure excludes failed runs, evaluation inference,
hyperparameter search, labeling, reviewer disagreement, leakage prevention,
dataset versioning, and deployment. Those are likely to dominate. Fine-tune to
improve a measured acceptance, calibration, latency, or serving objective—not
merely because the training job is cheap.

### Retry and rejection rate

At a 20% allowance, GPT-5.4 mini generation is `$0.0144` per accepted exercise.
If observed generation consumes twice the base tokens rather than `1.20` times,
the generation portion rises by 67% relative to this budget. Track rejection
reason codes—schema, unsupported command, native-Vim mismatch, browser
mismatch, duplicate, wrong difficulty, or poor pedagogy—rather than one opaque
retry counter.

### Frontier escalation

Replacing 5% of a typical learner's feedback calls with GPT-5.6 Sol instead of
GPT-5.4 mini adds about `$0.07` per month under the baseline request shape.
That is affordable when escalation is rare and useful; it becomes expensive
when “try a bigger model” substitutes for a deterministic fallback. Offline
authoring is a better first use of a frontier model.

### Tool calls and regional processing

The baseline assumes text tokens only. Hosted search, code execution,
containers, file retrieval, priority service, and data-residency endpoints can
add per-call fees or price multipliers. They are unnecessary for runtime Vim
feedback because the app already owns the editor state and verifier. For
example, OpenAI's pricing page listed a 10% regional-processing uplift for
eligible models released on or after 5 March 2026; Anthropic documented a 1.1x
US-only inference multiplier for its eligible newer models.

### Abuse and “unlimited” plans

Never advertise technically unlimited inference at the proposed price. One
automated client can erase the margin of many normal learners. Commercial
controls should include:

- authenticated per-user and per-device rate limits;
- monthly feedback and generation budgets;
- maximum input and output tokens per request;
- timeout, retry, and concurrency ceilings;
- a provider and global monthly spend ceiling;
- a kill switch and deterministic local fallback;
- anomaly alerts on tokens per active learner and cost per accepted result;
- no automatic recursive model retries without a fixed attempt limit.

Security design is a separate workstream, but these are required economic
controls, not optional hardening.

## Pre-generated bank versus on-demand generation

### Direct inference cost for 1,000 exercises

The provider table shows that 1,000 accepted exercises cost approximately
`$1–$35` on several plausible small-to-mid hosted models under the standard
rates and token assumptions, or `$96` on GPT-5.6 Sol. Batch processing can
roughly halve many offline runs. This makes the raw generation bill a weak
argument for runtime generation.

The human and engineering costs are much larger. At only three minutes of
review per accepted exercise:

```text
1,000 * 3 minutes = 50 reviewer hours
```

At an illustrative opportunity rate of `£25–75/hour`, that is
`£1,250–3,750`, before authoring the schema, repairing edge cases, running
native/browser conformance, and maintaining fixtures. The opportunity-rate
range is a planning estimate, not a market quote.

### Recommended pool architecture

1. Generate candidates asynchronously in batches.
2. Run schema, engine, native-Vim, browser, skill-evidence, duplication, and
   difficulty validation.
3. Quarantine failures with machine-readable reason codes.
4. Human-review a representative risk-based sample and every new command
   family before release.
5. Ship accepted exercises in the offline catalog or a signed downloadable
   pack.
6. Use learner state to select from the validated pool; do not regenerate what
   selection can solve.

Personalized on-demand generation is justified only when it demonstrates a
learning or engagement gain over selection and parameterized templates. Until
then, it adds latency, a failure path, moderation/support burden, and a network
dependency without adding much economic value.

## Hosted API, serverless open weights, or self-hosting

### Four deployment choices

| Choice | Fixed cost | Marginal cost | Operational burden | Best fit |
| --- | --- | --- | --- | --- |
| Proprietary model API | Near zero | Per token | Low | Early product, quality experiments, rare calls |
| Managed open-weight serverless | Near zero | Per token | Low | Provider diversity, open-model experiments, bursty traffic |
| Scale-to-zero GPU endpoint | Storage plus active seconds | GPU seconds including startup/idle | Medium | Custom weights with irregular traffic |
| Always-on GPU | Hundreds of dollars/month per GPU | Low only at high utilization | High | Stable, benchmarked, sustained load |

Local inference on the learner's device is a fifth option. It can reduce the
operator's marginal inference bill to zero and improve privacy/offline use,
but transfers model download, memory, battery, compatibility, and support costs
to the product. A compact trace classifier is credible in-browser; a
multi-gigabyte generative model should be optional rather than required.

### Current GPU reference points

Runpod's official
[Serverless pricing](https://docs.runpod.io/serverless/pricing) listed L4,
A5000, and RTX 3090 workers at `$0.00019/second` for Flex and
`$0.00013/second` for Active workers. It also bills startup, execution, and idle
seconds, plus storage. An Active worker running for 730 hours therefore has a
compute-only floor of:

```text
$0.00013 * 3,600 * 730 = $341.64/month
```

Google Cloud's
[accelerator-optimized VM price table](https://cloud.google.com/products/compute/pricing/accelerator-optimized)
listed a complete `g2-standard-4` L4 VM at about `$0.7068/hour`, or roughly
`$516/month` for 730 hours, before storage and network. Google's separate
[GPU price page](https://cloud.google.com/products/compute/gpus-pricing)
also makes clear that a raw attached-GPU price excludes the required VM, so a
GPU-only quote is not an all-in serving quote.

### Scale-to-zero break-even formula

For Runpod's `$0.00019/second` Flex example:

```text
self_hosted_request_cost = billed_seconds * $0.00019
```

Against the `$0.002625` GPT-5.4 mini feedback call, compute-only parity is
about `13.8` billed GPU-seconds. Against the `$0.0144` accepted-exercise
budget, it is about `75.8` seconds. Cold starts, model loading, idle timeout,
storage, failures, and engineering are not included. Batching and concurrency
can improve throughput dramatically, which is why a real load benchmark is
required.

### Always-on break-even intuition

An always-on `$341.64/month` GPU must replace enough API cost to justify its
fixed floor:

- at the **modeled typical** GPT-5.4 mini estimate of `$0.4065/user-month`,
  compute-only parity is about 841 active users;
- against the deliberately conservative `$1.60/user-month` inference budget
  used later, parity is about 214 active subscribers.

Neither number proves self-hosting wins. The hosted and local models may differ
in quality, one GPU may not meet latency at that concurrency, failover is not
free, and an engineer must operate it. Begin with API/serverless inference;
revisit dedicated serving only after real token volume, latency, acceptance
rate, and utilization are stable.

## PWA, backend, and account costs

### Web-first cash budget

The existing app is unusually cheap to distribute because the editor,
curriculum, and assets are static and offline-capable. A commercial version can
retain that advantage.

| Item | Validation/pilot | Small commercial service | Evidence or assumption |
| --- | ---: | ---: | --- |
| Static PWA hosting | $0 | $0–20/month | Cloudflare Pages static asset requests are free and unlimited; Netlify has a capped free plan and paid plans |
| API proxy/rate limiting | $0 | From $5/month | Cloudflare Workers Free allows 100,000 requests/day; Paid starts at $5 with 10M requests/month included |
| Auth and progress database | $0 | About $25/month | Supabase Free supports 50,000 MAU; Pro starts at $25/month |
| Domain | About $10–25/year | About $10–25/year | Planning allowance; varies by TLD and registrar |
| Transactional email/monitoring | $0–10/month | $10–40/month | Planning allowance; usage and retention dependent |
| Model inference | Usage based | Usage based | Use measured table, not a flat guess |

Official references:

- [Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Netlify pricing](https://www.netlify.com/pricing/)
- [Supabase pricing](https://supabase.com/pricing)

The contribution model below uses **$35/month fixed cash cost**: `$5` API
platform, `$25` production auth/database, and `$5` amortized domain,
email/monitoring allowance. It is a transparent planning simplification, not a
vendor quote.

### Hosting policy

The current GitHub Pages deployment remains appropriate for a free prototype
and portfolio demo. Before taking payments or making the site primarily a
commercial service, move the production domain to hosting whose terms allow
commercial use. Cloudflare Pages or Netlify are plausible starting points;
Vercel's official [pricing page](https://vercel.com/pricing) states that Hobby
is for personal, non-commercial use and Pro is `$20/month`.

Keep the static learning path available during backend outages. Accounts,
sync, entitlement, and AI should degrade independently; an inference failure
must not stop deterministic practice.

## Payments, VAT, and stores

### Direct processor versus Merchant of Record

For a UK operator, Stripe's official
[UK pricing](https://stripe.com/gb/pricing) listed `1.5% + 20p` for standard
domestic cards, `2.5% + 20p` for EEA cards, and `3.25% + 20p` for international
cards on the check date, with extra currency-conversion fees where applicable.
Stripe is cheaper at sufficient volume, but a payment processor does not by
itself become the seller or remove worldwide indirect-tax obligations.

Paddle's official [pricing](https://www.paddle.com/pricing) listed
`5% + $0.50` per checkout transaction with no monthly fee. As Merchant of
Record it includes payment handling, fraud/chargeback protection, buyer billing
support, and sales-tax/VAT compliance. The higher take rate can be a good trade
for a solo global launch.

Recommended sequence:

1. use a Merchant of Record for the first worldwide paid web release;
2. record effective fee, refund, tax, and support rates by geography;
3. reconsider direct processing only when the savings exceed accounting,
   registration, filing, and support costs.

### Tax caveat

The UK VAT registration threshold was `£90,000` of taxable turnover on the
check date, according to
[HMRC's VAT registration guidance](https://www.gov.uk/register-for-vat/when-register-for-vat).
That threshold does not eliminate customer-country obligations for cross-border
digital services. HMRC's
[digital-services guidance](https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers)
states that consumer location determines the place of supply and that a UK
seller may need to register/account in the consumer's country; it also explains
that qualifying third-party platforms can take responsibility.

Do not calculate contribution from a tax-inclusive displayed price as if the
tax were revenue. The scenario tables below treat `$6.99` and `$29` as
pre-indirect-tax planning prices, with tax added or localized by the Merchant
of Record. If a market requires tax-inclusive display, first divide gross price
by `(1 + tax_rate)`, then apply the fee and contribution formulas to the
appropriate payout basis.

### Native stores

PWA-first avoids native distribution fees while validating the product.

- The [Apple Developer Program](https://developer.apple.com/programs/whats-included/)
  costs `$99/year`. Apple's
  [Small Business Program](https://developer.apple.com/app-store/small-business-program/)
  offers a 15% commission on paid apps and in-app purchases to eligible
  developers under its `$1M` proceeds threshold.
- Google Play registration is a one-time `$25`, documented in Google's
  [general access conditions](https://support.google.com/googleplay/android-developer/answer/14659200).
  Google's [service-fee table](https://support.google.com/googleplay/android-developer/answer/112622)
  changed for EEA, UK, and US transactions from 30 June 2026. Relevant rows
  combine service and billing fees to roughly 15% for many new-install and
  subscription cases, but some existing-install transactions are higher.
  Remaining markets still include a 15% tier for the first `$1M` for enrolled
  developers.

Do not model either store as a universal 15% without checking geography,
install cohort, billing path, subscription status, and current programme
eligibility. Native release also adds review, signing, SDK, device testing,
store support, privacy declarations, and release-management labour.

## Recommended packaging

### Free

Include:

- the deterministic core curriculum;
- reviewed guided and recall exercises;
- parameterized/template variants;
- local progress and review scheduling;
- exercise Explore mode and general free practice;
- deterministic alternative-solution grading where supported;
- rule/template feedback and a graceful offline path.

Reasons: this creates a useful portfolio artifact, gives users enough value to
measure retention, supports community sharing, and ensures the product does not
become inaccurate or inert when an API is unavailable.

### Supporter or offline Pro: £19–29 / $25–39 one time

Possible value:

- applied challenge and capstone packs;
- additional realistic buffers and scenario chains;
- deeper local analytics and progress export;
- cosmetic themes/rewards;
- lifetime access to purchased offline packs;
- a visible supporter acknowledgement if desired.

Do not describe basic command documentation or deterministic correctness as a
premium feature. The closest incumbent price anchor is VIM Adventures, which
on 22 July 2026 advertised `$35` for game-only and `$40` for game plus
challenges, each for six months. See the
[official VIM Adventures page](https://vim-adventures.com/). A `$25–39`
lifetime/supporter offer is therefore plausible, but willingness to pay must be
tested rather than inferred from one competitor.

### AI Coach: £5.99 / $6.99 monthly

Sell outcomes rather than model access:

- concise explanation of verified mistakes;
- comparison with one relevant Vim strategy;
- personalized selection from the validated exercise pool;
- a limited number of newly generated, validated drills;
- a recap of weak skills and suggested next review.

Suggested internal fair-use starting budget, subject to experiment:

- 120 coach feedback events per month;
- 12 accepted personalized generated exercises per month;
- daily burst limits;
- mini-tier model by default;
- no more than 5% frontier escalation without a new business case;
- local deterministic feedback after the budget is exhausted.

The UI need not lead with numerical quotas, but terms must not promise
unbounded generation. Publish a clear fair-use policy and expose remaining
usage when the learner approaches a limit.

### Annual AI Coach: £39.99 / $49.99

At `$49.99`, Paddle's stated fee formula leaves `$46.99` before service costs.
Using the conservative `$2.20/user-month` variable service budget defined
below leaves about `$20.59` for the year before fixed costs and owner labour:

```text
$49.99 - (5% * $49.99 + $0.50) - (12 * $2.20) = $20.59
```

That is positive but much thinner than monthly billing. The annual price is an
aggressive discount and should launch only after observed usage, churn, refund,
and support data show that it is sustainable. Start monthly if those data do
not yet exist; raise the annual price rather than degrading feedback.

### BYOK

BYOK is useful for the developer, power users, and portfolio demonstrations:

- the user chooses provider/model and pays that provider directly;
- the app can expose the same evaluation/routing interface;
- it avoids subsidizing unusually heavy experimentation;
- it makes provider portability visible.

It is not a replacement for a simple paid plan: most learners will not manage
API accounts or understand provider billing. Key storage, browser exposure,
provider data terms, and proxy design belong to the separate security review.

### Support/donation and team options

A “buy me a coffee” link is appropriate for the free portfolio phase, but
donations are neither predictable revenue nor entitlement infrastructure. Keep
it secondary to a clear one-time Supporter offer.

Educator/team licensing can be tested later, after individual retention is
real. Cohort assignments, aggregate progress, privacy controls, invoices, and
support are a different product. They may support a higher annual price, but
premature team features would add more maintenance than revenue evidence.

### What not to do

- No advertising inside the learning loop.
- No “unlimited AI” promise.
- No frontier model on every keystroke or exercise.
- No hard paywall before the user experiences delayed recall and transfer.
- No subscription justified only by access to a finite set of advanced units.
- No probabilistic model as pass/fail authority.

## Subscription contribution model

### Budget assumptions

This model deliberately budgets more than the typical GPT-5.4 mini bill:

| Per subscriber-month item | Amount | Rationale |
| --- | ---: | --- |
| Price | $6.99 | Proposed US monthly price, before indirect tax |
| Paddle fee | $0.8495 | `5% * $6.99 + $0.50` |
| Inference budget | $1.60 | Rounded above the `$1.51` heavy GPT-5.4 mini case |
| Other variable service reserve | $0.60 | `$0.20` infrastructure allocation plus `$0.40` retry/abuse/refund contingency |
| Contribution before fixed cost/labour | $3.9405 | `$6.99 - $0.8495 - $1.60 - $0.60` |

Fixed cash cost is `$35/month`, as defined in the PWA/backend section.

Owner labour is made explicit rather than hidden:

```text
owner_hours_per_month = 8 + 0.02 * paying_subscribers
owner_opportunity_rate = $60/hour
```

The fixed eight hours cover releases, content/conformance checks, provider
evaluation, billing, monitoring, and community/support. The variable `0.02`
hours is 1.2 minutes per subscriber-month. Both are planning estimates and
should be replaced with time tracking.

### Payer-count scenarios

| Active AI subscribers | Gross MRR | Payment fees | Inference budget | Other variable reserve | Cash contribution after $35 fixed | Owner hours | Economic surplus after owner time | Annualized economic surplus |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 25 | $174.75 | $21.24 | $40.00 | $15.00 | $63.51 | 8.5 | -$446.49 | -$5,357.85 |
| 100 | $699.00 | $84.95 | $160.00 | $60.00 | $359.05 | 10.0 | -$240.95 | -$2,891.40 |
| 500 | $3,495.00 | $424.75 | $800.00 | $300.00 | $1,935.25 | 18.0 | $855.25 | $10,263.00 |
| 2,000 | $13,980.00 | $1,699.00 | $3,200.00 | $1,200.00 | $7,846.00 | 48.0 | $4,966.00 | $59,592.00 |

These are scenarios, not forecasts. “Economic surplus” subtracts an
opportunity cost for the owner's time; it is not a cash accounting line. The
table excludes tax, paid marketing, employees/contractors, legal work,
corporation costs, and native-store commissions.

### Break-even

Cash break-even before owner time is only about nine subscribers:

```text
$35 / $3.9405 = 8.88
```

Economic break-even under the explicit labour model is about 188 subscribers:

```text
($35 fixed cash + 8 hours * $60)
/ ($3.9405 contribution - 0.02 hours * $60)
= 187.92
```

This difference is the central business lesson. Low infrastructure cost makes
a hobby project cash-positive quickly; it does not make the developer's time
free.

If initial build effort is 400 hours valued at `$60/hour`, the opportunity cost
is `$24,000`. At `$2.7405` economic contribution per incremental subscriber-
month after variable support time, recovering that historical effort takes
about 8,758 subscriber-months, before fixed operating costs. Do not require the
portfolio project to repay sunk learning time, but do not call gross receipts
profit either.

## One-time Supporter contribution model

At a `$29` one-time purchase through Paddle:

```text
payment fee = 5% * $29 + $0.50 = $1.95
net before reserve = $29 - $1.95 = $27.05
planning contribution = $27.05 - $2 support/refund reserve = $25.05
```

| Lifetime Supporter sales | Gross receipts | Planning contribution before fixed cost and owner labour |
| ---: | ---: | ---: |
| 25 | $725 | $626.25 |
| 100 | $2,900 | $2,505 |
| 500 | $14,500 | $12,525 |
| 2,000 | $58,000 | $50,100 |

The one-time model has excellent marginal cash economics but no recurring
income to fund indefinite new content and support. It works best for a stable
offline pack with a clear lifetime-access promise, not unlimited future cloud
inference.

At `$25.05` planning contribution, approximately 958 one-time sales would
equal the illustrative `$24,000` build-time opportunity cost. Again, that is a
payback identity, not a sales forecast.

## What the project might earn

There is not enough product funnel data to estimate a probability distribution
responsibly. Before measured activation, delayed retention, conversion, and
churn, the conservative expected commercial outcome is **close to zero**, with
portfolio value independent of revenue.

The scenario tables give useful landmarks:

- 25 payers are a strong validation signal, not an income stream.
- 100 AI subscribers produce `$699 MRR` but only about `$359/month` cash
  contribution under the conservative service budget, before owner time.
- 500 AI subscribers produce about `$1,935/month` cash contribution and
  `$855/month` economic surplus under the stated labour assumptions.
- 2,000 AI subscribers produce about `$7,846/month` cash contribution and
  `$4,966/month` economic surplus; at that point support is approaching a
  part-time job in this model.
- 500 lifetime Supporter sales produce about `$12,525` planning contribution,
  but do not repeat next month.

A mixed business is healthier than interpreting either table alone: free users
create reach and evidence; Supporter sales monetize durable offline value; AI
subscribers pay for recurrent costs; occasional team sales can fund support.
The launch research should report observed conversion and cohort retention,
then replace these scenarios with a cohort-based model.

## Maintenance and hidden costs

### Cash costs often omitted

- domain renewal, email, monitoring, backups, and log retention;
- accounting, annual filings, privacy/cookie work, and legal review;
- refunds, disputes, fraud, and foreign-exchange spreads;
- provider minimums, regional inference premiums, and model migrations;
- accessibility testing and device/browser support;
- native developer fees and store commissions when applicable;
- contractors for design, pedagogy, content review, or support;
- paid acquisition, if it is ever justified by measured lifetime value.

Illustrative solo-business allowances—not quotes—are:

| Stage | Cash platform cost | Ongoing owner time |
| --- | ---: | ---: |
| Free portfolio/PWA | $0–20/month | 2–6 hours/month |
| Instrumented beta | $10–50/month | 4–12 hours/month |
| Small paid web product | $35–150/month plus inference | 8–20 hours/month |
| Hundreds of AI subscribers | Usage-dependent | 12–30+ hours/month |
| Native web + iOS + Android | Web costs plus store fees | Add release/device/support work |

ML experimentation, public evaluation reports, and portfolio writing are
valuable but should be tracked separately from minimum product maintenance.
They can easily add 8–40 hours in an active experiment month.

### Operational work by cadence

Weekly or automated:

- inference spend, errors, timeouts, parse rate, and verifier rejection rate;
- abuse/rate-limit alerts and payment failures;
- content/support issues that could teach incorrect Vim behavior.

Monthly:

- contribution by plan and cohort;
- refunds, tax/Merchant-of-Record payout reconciliation;
- active-user token distributions, not just averages;
- support time and top failure causes;
- dependency, browser, and PWA update checks.

Quarterly:

- rerun the model evaluation and price comparison;
- review provider deprecations and data terms;
- audit native-Vim/browser conformance for new command families;
- reassess pricing, annual-plan margin, quotas, and cancellation reasons.

## Financial instrumentation contract

The backend should eventually make each number in this document observable
without collecting free-form learner text. Minimum economic records:

- provider, model ID, model snapshot, service tier, and region;
- input, cached-input, output/reasoning, and rejected-output tokens;
- request type: feedback, generation, critique, repair, or escalation;
- generation candidate ID, validation result, and rejection reason;
- latency, retry count, timeout, and fallback;
- anonymized account/entitlement and plan, with billing identifiers stored in
  the payment system rather than analytics;
- monthly provider cost and attributed user cost;
- payment gross, tax, fee, refund, dispute, and net payout;
- support minutes and issue category.

Do not log inserted text, search terms, Ex-command literals, or free-practice
buffers by default. Aggregate command-family evidence is sufficient for most
cost and learning experiments. The privacy-safe learning event design is in
[ML Experimentation and Model Strategy](./ml-experimentation-and-model-strategy.md).

### Suggested alerts

- warning when rolling inference cost exceeds `$0.75` per AI active user;
- review routing/abuse when it exceeds the `$1.60` budget;
- stop or require manual approval above `$2.00` per user-month;
- alert on a sudden provider-wide token or retry increase;
- alert when accepted-exercise cost doubles against its 30-day baseline;
- hard organization-level monthly budget with a deterministic fallback.

Thresholds are initial operating hypotheses. Set them from actual model bills
and learner value, not permanently from this document.

## Decision gates

### Before charging for the Supporter pack

- Users complete enough of the free curriculum to understand the value.
- Paid content is reviewed and passes native/browser conformance.
- Lifetime/update wording is explicit.
- Refund, tax, privacy, support, and entitlement paths are tested.

### Before launching AI Coach

- A non-LLM baseline exists.
- The selected model passes factuality, parse, latency, and helpfulness gates.
- Per-user and global budgets, output caps, and fallback are live.
- Twenty or more testers generate an observed cost distribution.
- The 95th-percentile legitimate user fits the price or the fair-use policy.
- No LLM output can override deterministic correctness.

### Before annual billing

- At least three months of monthly usage, churn, and refund data exist.
- Annual expected contribution remains positive under a heavy-use sensitivity.
- The product can honor the service even if the current provider/model is
  deprecated.

### Before self-hosting

- A particular open-weight model clears the same quality gates.
- Measured monthly API spend repeatedly exceeds the all-in dedicated endpoint.
- Load tests include cold start, concurrency, p95 latency, and failover.
- Operating time and incident risk are included in the comparison.
- There is a provider/API fallback.

### Before native stores or paid acquisition

- PWA cohorts show delayed return and willingness to pay.
- Store commission and maintenance still leave positive contribution.
- Paid lifetime value is based on retention, not assumed from price.
- The staged tests in
  [Product Validation and Launch](./product-validation-and-launch.md) pass.

## Ranked commercial rollout

1. Keep the complete deterministic PWA free while measuring delayed learning
   and collecting qualitative feedback.
2. Add a donation/support link with no entitlement complexity.
3. Validate a `$25–39` lifetime Supporter/challenge pack through a refundable
   founding offer.
4. Move commercial hosting away from GitHub Pages and use a Merchant of Record.
5. Pre-generate and validate the exercise bank; do not meter ordinary exercise
   availability through LLM calls.
6. Pilot a capped AI Coach with BYOK and a small invited cohort.
7. Launch `$6.99/month` only after quality and cost distributions are known.
8. Add the discounted annual plan only after usage/churn evidence.
9. Test educator/team licensing if users request cohort workflows.
10. Consider native stores, dedicated GPUs, or paid acquisition only after the
    PWA business has demonstrated retention and contribution.

## Source register and recheck checklist

First-party sources checked on 22 July 2026:

- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Anthropic Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Mistral API pricing](https://mistral.ai/pricing/api/)
- [Fireworks serverless pricing](https://docs.fireworks.ai/serverless/pricing)
- [Fireworks fine-tuning and on-demand pricing](https://fireworks.ai/pricing)
- [Runpod Serverless pricing](https://docs.runpod.io/serverless/pricing)
- [Google Cloud accelerator VM pricing](https://cloud.google.com/products/compute/pricing/accelerator-optimized)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Netlify pricing](https://www.netlify.com/pricing/)
- [Supabase pricing](https://supabase.com/pricing)
- [Vercel pricing](https://vercel.com/pricing)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Stripe UK pricing](https://stripe.com/gb/pricing)
- [Paddle pricing](https://www.paddle.com/pricing)
- [Apple Developer Program](https://developer.apple.com/programs/whats-included/)
- [Apple App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [Google Play access conditions](https://support.google.com/googleplay/android-developer/answer/14659200)
- [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622)
- [HMRC VAT registration](https://www.gov.uk/register-for-vat/when-register-for-vat)
- [HMRC digital-services VAT guidance](https://www.gov.uk/guidance/the-vat-rules-if-you-supply-digital-services-to-private-consumers)
- [VIM Adventures pricing](https://vim-adventures.com/)

At recheck time, record the retrieval date, model snapshot, standard/cached/
batch prices, tokenizer behavior, reasoning-token billing, regional premiums,
minimum commitments, rate limits, data-retention terms, and deprecation date.
Retain the calculation inputs alongside each business report so a price change
can be recomputed rather than manually edited into an opaque total.

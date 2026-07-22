# Product Validation and Launch Strategy

**Research and policy check:** 22 July 2026

**Product stage:** working, installable PWA; pre-instrumentation and
pre-commercial validation

## Executive decision

Vim Wilds should launch as a useful free product before it launches as a
business. The first question is not whether people will click an advert. It is
whether a clearly defined learner can discover the app, finish one learning
loop, return later, and independently use the Vim skill on a different buffer.

The recommended sequence is:

1. Audit the existing catalogue and freeze a trustworthy evaluation set.
2. Observe 10–20 target learners using the product.
3. Add privacy-minimised product and learning instrumentation.
4. Test the message with 100–300 qualified visitors.
5. Run a 50–100-person, three-to-four-week beta.
6. Ask for real money through a clear, refundable founding offer.
7. Launch organically around a playable product and its engineering story.
8. Consider app stores and paid acquisition only after retention and unit
   economics justify them.

This order is deliberately evidence-seeking. It prevents a good landing page
from being mistaken for a good learning product, and prevents a few enthusiastic
comments from being mistaken for repeat demand.

This document is the distribution and validation part of a four-document
research package:

- [Adaptive practice and exercise generation](./adaptive-practice-and-exercise-generation.md)
  defines the learning experiences, review system, and product implementation
  order.
- [ML experimentation and model strategy](./ml-experimentation-and-model-strategy.md)
  defines model roles, data requirements, evaluation, and portfolio experiments.
- [Monetisation and unit economics](./monetization-and-unit-economics.md)
  defines prices, inference assumptions, contribution margins, platform costs,
  and commercial hosting.
- This document defines how to find out whether the resulting product is useful,
  wanted, and supportable.

The numeric gates below are **proposed internal decisions**, not published
industry benchmarks. They should be fixed before each test, interpreted with
their denominators, and changed only for the next cohort—not after seeing a
disappointing result.

## Current product baseline

The repository already provides a stronger validation starting point than a
mock-up:

- The public root page explains installation, while `/play/` opens the working
  game.
- The static PWA precaches its app shell, unit catalogue, unit JSON, and local
  assets. After the first load it can teach offline; optional celebration media
  may fail without blocking an exercise. See [deployment.md](./deployment.md).
- The current curriculum contains 14 units and 362 authored exercise scenarios.
  Most concepts have three unique scenarios, and guided and recall activities
  usually replay the same scenario rather than measure transfer on a new one.
- Input is currently graded against the next canonical key. The editor can test
  target state, but the runtime rejects divergent equivalent strategies before
  they can reach that state. See
  [exercise-verification-and-feedback.md](./exercise-verification-and-feedback.md).
- A substantial part of the catalogue still has draft review provenance. Content
  quantity is therefore not the same as launch-ready coverage.
- The only saved learner state is current unit, current activity, theme, and save
  time. There is no durable completion ledger, review state, attempt history,
  user account, or product telemetry.
- The designed surface is a 360–430 CSS-pixel phone, although physical keyboard
  fallback and wider browsers remain important transfer and accessibility
  contexts.

GitHub Pages remains useful for an unmonetised public prototype. It must not be
the commercial host: GitHub's current policy says Pages is not intended or
allowed for an online business, e-commerce site, or commercial SaaS. Move the
commercial application, checkout, accounts, and paid service delivery to an
appropriate host before enabling them; see the official
[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
and the hosting comparison in
[monetization-and-unit-economics.md](./monetization-and-unit-economics.md).

## What must be validated

Validation should resolve six independent hypotheses. Success at one does not
imply success at the others.

| Hypothesis | Evidence that can support it | Evidence that cannot settle it |
| --- | --- | --- |
| **Problem:** people want to improve practical Vim fluency | Recent real editing frustrations, existing workarounds, repeated practice behavior | “Vim is cool” or a feature wish list |
| **Usability:** the mobile interaction is understandable | Observed unassisted starts, command entry, recovery, and completion | The developer completing their own exercises |
| **Learning:** practice improves independent use | Delayed hint-free recall and transfer to a varied buffer | Immediate repetition of the guided keys |
| **Retention:** the product is worth returning to | Voluntary D7/D30 learning sessions and due-review use | Installs, page views, or notification opens |
| **Demand:** the promise attracts the intended audience | Qualified visitors starting and completing practice | Unqualified social impressions |
| **Commercial value:** a segment will pay enough to support the product | Real, clearly refundable purchases plus continued use | Survey answers, waitlist emails, or a fake checkout button |

Do not combine these into one score. A product can teach well but have weak
positioning; it can also attract clicks while teaching poorly. Each result calls
for a different response.

## Measurement contract

### Primary activation

A page view, install, or first exercise completion is not activation. A
**meaningfully activated learner** must do all of the following:

1. Complete one concept loop: explanation or demonstration, guided practice,
   and an independent attempt.
2. Return between 24 hours and 7 days later.
3. Complete a due recall for the same primary skill on a different scenario or
   template.
4. Succeed without a solution-revealing hint. Intention and command-family hints
   may be reported separately, but do not count as hint-free.

This intentionally demanding definition connects product value to the behavior
the app claims to improve. Until the new review and variant systems exist, track
the first-session funnel but do not relabel it as learning activation.

### Funnel and retention definitions

Every report must show the numerator, denominator, cohort dates, app/content
version, and eligibility rules.

| Metric | Exact definition |
| --- | --- |
| Qualified visit | Human landing-page session from an intentionally targeted source; exclude bots, uptime checks, the developer, and automated tests |
| Play start rate | Unique qualified visitors that begin an activity divided by qualified visitors |
| First-loop completion | Starters that finish one concept loop divided by starters |
| Meaningful activation | Starters satisfying all four activation conditions divided by starters old enough to have had the seven-day opportunity |
| D1 learning return | Activated or first-loop users who begin a learning activity 24–48 hours after their first loop, divided by eligible users |
| D7 learning return | Users who begin a learning activity on day 6, 7, or 8, divided by eligible users |
| D30 learning return | Users who begin a learning activity on day 27–33, divided by eligible users |
| Review exposure | Learners shown at least one genuinely due review divided by learners with a due review who open the app |
| Review adoption | Learners starting a shown review divided by learners shown one |
| Review completion | Learners completing a started review divided by review starters |
| Transfer success | Hint-free target-state success on an unseen scenario divided by transfer checks started |
| Time to independent mastery | Active practice time from first exposure to the first two hint-free successes separated by at least 24 hours, one on an unseen scenario |
| Purchase conversion | Non-refunded purchases divided by qualified people shown the exact price and offer |

Use rolling calendar-day windows only for operational dashboards. Use the fixed
windows above when comparing cohorts so a casual visit at any time is not
counted as a learning return.

### Learning measures

Learning evaluation should use editor-verified outcomes, not only self-report
or shorter command traces:

- **Independent recall:** can the learner reach the target without the canonical
  keys being shown?
- **Delayed recall:** can they do so after at least 24 hours?
- **Near transfer:** can they apply the same skill with different text, cursor
  position, and distractors?
- **Tool choice:** in mixed practice, do they select an appropriate command
  family without being told its name?
- **Recovery:** after a mistake, can they use undo, cancel, or retry productively?
- **Real-editor transfer:** when a consenting participant has access to a
  physical keyboard and Vim-compatible editor, can they complete a small
  analogous task there?

The last measure is valuable but optional. The curriculum explicitly positions
mobile practice as cognitive training and does not claim to replace physical
keyboard muscle memory. Definitions of correctness, skill evidence, and false
rejection are in
[exercise-verification-and-feedback.md](./exercise-verification-and-feedback.md).

For a small beta, report paired changes, confidence intervals when appropriate,
and the individual outcome distribution. Do not make a causal “improves Vim”
claim without a credible comparison condition. A within-person improvement can
justify another experiment, but practice effects, selection, and attrition
remain alternative explanations.

### Required segments

At minimum, retain coarse, self-declared segments for analysis:

- new to Vim;
- knows basic movement and editing but not composition;
- experienced Vim or Neovim user seeking advanced practice;
- phone touch keyboard versus physical keyboard;
- installed PWA versus ordinary browser session;
- first-time versus returning learner;
- acquisition source;
- accessibility or assistive-technology needs when voluntarily disclosed for a
  research session.

Do not report tiny cross-sections publicly. Combine or suppress cells that could
identify a participant.

## Privacy-preserving instrumentation

### Design principles

Instrumentation should make the product easier to learn from without turning a
text editor into a data-collection surface.

- Keep complete command traces local when they are needed for immediate
  feedback.
- Upload derived exercise facts, not buffers or arbitrary typed text.
- Never upload goal-free Free Practice content by default.
- Strip inserted text, search patterns, Ex literals, register contents, clipboard
  contents, file names, and pasted text from product analytics.
- Use app-authored exercise, skill, template, and content-version identifiers.
- Coarsen durations before upload where millisecond precision is unnecessary.
- Avoid device fingerprinting and advertising identifiers.
- Make analytics behavior visible in plain language and expose an off switch.
- Keep research recruitment contact data outside the behavioral event store.

The UK ICO identifies lawfulness, fairness, transparency, purpose limitation,
data minimisation, storage limitation, security, and accountability as the core
data-protection principles. These apply to pseudonymous online identifiers too;
see the official
[ICO guide to the data-protection principles](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/).
Cookie or local-storage choices also require a PECR and jurisdiction-specific
review. “Anonymous analytics” is not a substitute for choosing and documenting
a lawful basis. This document is product guidance, not legal advice.

### Event envelope

Every uploaded event should use one versioned envelope:

| Field | Purpose and constraint |
| --- | --- |
| `event_id` | Random unique ID used for idempotent ingestion |
| `event_name`, `schema_version` | Allowlisted event and explicit contract version |
| `occurred_at`, `received_at` | Client and server timestamps; flag implausible clock skew |
| `anonymous_learner_id` | Random product identifier, never a fingerprint or email hash |
| `session_id` | Random ID rotated after inactivity; not reused for research contact data |
| `app_version`, `content_version` | Required for diagnosing releases and excluding incompatible cohorts |
| `unit_id`, `lesson_id`, `exercise_id`, `template_id` | App-authored IDs when relevant; no buffer text |
| `primary_skill_id`, `supporting_skill_ids` | Stable curriculum tags |
| `practice_policy` | Guided, recall, review, mixed, explore, sandbox, or transfer |
| `source_channel`, `campaign_code` | Small server allowlist; discard arbitrary URL parameters |
| `experiment_assignments` | Experiment and variant IDs assigned before exposure |
| `properties` | Event-specific allowlisted values; reject unknown or overlong properties |

Use an append-only event receiver. The server validates the schema, size, enum
values, content IDs, and consent state; deduplicates `event_id`; stamps receipt
time; and rejects rather than storing an unexpected payload. Queue events
locally when offline and retry them in bounded batches. A failed analytics
request must never block lesson completion.

If deletion of server-side anonymous history is offered, keep a separate random
deletion credential on the device. Do not claim that an identifier is anonymous
while retaining a hidden table linking it to an email or research participant.

### Minimum event vocabulary

Start with a small event set. Additional events must answer a named research or
operational question before being added.

| Event | Essential properties | Question answered |
| --- | --- | --- |
| `landing_viewed` | message variant, source channel | Which promise and source brought a qualified visitor? |
| `play_started` | entry route, confidence segment | Did the visitor try the product? |
| `activity_started` | content IDs, practice policy | What did the learner choose or accept? |
| `attempt_finished` | valid outcome, skill-evidence result, hint level, retry count, duration bucket, input source | Was the task completed independently and fairly? |
| `concept_loop_completed` | skill ID, activities completed | Did first-session learning reach the intended endpoint? |
| `review_shown` | due skill IDs, due-reason bucket | Was a due review actually offered? |
| `review_started` | chosen versus recommended | Was it adopted? |
| `review_completed` | hint level, delay bucket, variant novelty | Did delayed recall occur? |
| `transfer_check_finished` | novelty dimensions, outcome, hint level | Did the skill transfer to a varied scenario? |
| `install_prompt_shown`, `install_completed` | supported platform category | Is PWA installation a meaningful obstacle or benefit? |
| `feedback_submitted` | rating enum, optional consented text stored separately | Was feedback useful or frustrating? |
| `offer_viewed`, `checkout_started`, `purchase_completed`, `refund_completed` | offer ID, displayed price, currency | Is willingness to pay real? |
| `consent_changed` | policy version and enabled categories | Can the system prove and respect the learner's choice? |

The detailed local attempt and command-segmentation contract belongs in
[exercise-verification-and-feedback.md](./exercise-verification-and-feedback.md).
The ML feature store should derive only from the consented, versioned subset
specified in
[ml-experimentation-and-model-strategy.md](./ml-experimentation-and-model-strategy.md).

### Instrumentation implementation summary

1. Add a shared event module with compile-time or runtime schema definitions and
   an explicit test-mode flag.
2. Add a local append queue suitable for offline PWA sessions; persist consent
   and retry state separately from curriculum progress.
3. Put an authenticated ingestion endpoint on the future commercial backend,
   with origin checks, payload limits, rate limits, and idempotency.
4. Build daily aggregate tables for funnels, eligible retention cohorts, review,
   transfer, content quality, acquisition, and revenue. Do not query raw events
   directly for every dashboard.
5. Keep a release annotation table so regressions can be tied to app, schema,
   content, scheduler, or model versions.
6. Add a visible privacy control, data explanation, and deletion/reset path before
   collecting real behavioral data.

Before beta, verify:

- event totals reconcile with deterministic test journeys;
- duplicate ingestion remains below 0.5%;
- required fields are at least 99% complete;
- internal/test users and bots are excluded reproducibly;
- an offline session uploads once after reconnecting;
- consent withdrawal stops upload immediately;
- no raw buffer, inserted, search, command-line, register, or clipboard content
  appears in captured payloads or server logs;
- dashboards age cohorts correctly instead of treating not-yet-eligible users as
  churned.

## Stage 0: catalogue audit and gold set

### Goal

Establish that the existing content is safe to learn from and create a stable
baseline for future verifier, generator, scheduler, and model experiments.

### Work

Inventory all 362 authored scenarios by unit, lesson, primary skill, supporting
skills, practice policy, difficulty dimensions, template family, validation
status, and review status. Separate authored scenarios from runtime activities
so guided/recall duplication is visible rather than counted as variety.

Run automated checks over every scenario:

- schema and referential integrity;
- canonical replay in the browser engine;
- native-Vim fixture where the command is claimed as supported;
- exact final text, cursor, mode, selection, register, and checkpoint state where
  declared;
- supported-command and prerequisite consistency;
- duplicate or near-duplicate initial/target pairs;
- target reachability and accidental shortcuts for policies that require them;
- phone layout and key availability for the canonical solution.

Then conduct a human pass:

- developer review of every public scenario for goal clarity, canonical strategy,
  realistic text, hint sequence, expected difficulty, and false-teaching risk;
- second expert review of every advanced macro, regex, Ex, register, and Visual
  Block family, plus a stratified 25% of the remaining families;
- record disagreements and resolution rather than silently overwriting labels.

Freeze a versioned gold set that includes each skill and verification policy,
ordinary alternative solutions, inefficient-but-valid solutions, wrong-state
near misses, missing-skill-evidence cases, undo recovery, and unsupported-engine
cases. Split by template and strategy family, not by random trace, so later model
tests cannot leak trivial variants across train and test.

### Exit gate

- Zero unresolved schema, native/browser conformance, or canonical-replay failures
  in publicly reachable content.
- Every reachable scenario has an explicit review owner, review date, and status;
  draft content is either reviewed or removed from the launch path.
- Every curriculum skill is either represented in the gold set or explicitly
  documented as not yet testable.
- Baseline completion, false-rejection, and hint metrics can be computed from
  deterministic test fixtures before real telemetry exists.

If the catalogue fails this gate, fix or narrow it. Generating more exercises is
not the remedy for untrusted exercises.

## Stage 1: 10–20 observed learner sessions

### Goal

Discover whether the intended users understand the promise, controls, teaching
language, and recovery loop before interpreting remote analytics.

Government Digital Service guidance recommends small repeated rounds—normally
4–8 people for interviews or usability tests—and notes that surveys, A/B tests,
and benchmarks need hundreds for clear results. It also recommends including
disabled users and people who need support. This supports two or three small
rounds rather than one undifferentiated test; see
[Plan user research for your service](https://www.gov.uk/service-manual/user-research/plan-user-research-for-your-service).

### Recruitment

Recruit 10–20 current or likely users across four groups, aiming for at least
three people in each before filling the remaining places:

1. people new to Vim who edit code or structured text;
2. partial users who know movement and simple deletion but feel inefficient;
3. regular Vim/Neovim users interested in advanced drills or retention;
4. learners who primarily encounter Vim emulation inside another editor.

Include both iOS and Android touch users, at least several physical-keyboard
users, and participants with relevant access needs. Do not recruit only friends,
other ML engineers, or Vim enthusiasts. Screen for recent behavior and problems,
not simply enthusiasm for the idea.

Provide an information sheet, obtain informed consent, compensate time
independently of positive feedback, and make recording optional. Official GDS
guidance says participant data should be minimised, access limited, and deleted
when no longer needed; see
[finding participants](https://www.gov.uk/service-manual/user-research/find-user-research-participants)
and
[managing participant privacy](https://www.gov.uk/service-manual/user-research/managing-user-research-data-participant-privacy).

### Session structure

Use a 40–50-minute moderated session:

1. **Context interview, 10 minutes:** ask about the last time Vim slowed them
   down, current learning methods, editor context, and what they actually do
   after forgetting a command.
2. **First-use test, 20 minutes:** give only the public URL. Ask them to explain
   the promise, begin, complete one guided and one recall activity, recover from
   an intentional mistake, and find help.
3. **Return-value prototype, 10 minutes:** show a due-review or varied-recall
   prototype and ask them to use it; do not ask whether they “like the feature.”
4. **Debrief, 10 minutes:** ask what they expected, what felt unfair, whether
   they would use it in a real week, and what they would stop using instead.

The moderator does not teach Vim unless the research question specifically
tests teaching. Note the first point at which help becomes necessary. Capture
observed behavior separately from interpretation and quotes.

### Severity and decisions

Classify findings:

- **S1 blocking:** cannot start, enter the intended key, understand success, or
  recover without intervention;
- **S2 damaging:** learns an incorrect rule, repeatedly perceives valid Vim as
  wrong, loses work/progress, or cannot read essential controls;
- **S3 friction:** completes but hesitates, misreads, or needs avoidable help;
- **S4 preference:** aesthetic or feature request without observed task impact.

Fix S1 and S2 findings before broader traffic. Batch S3 findings by repeated
pattern. Do not let a vocal S4 request displace a demonstrated learning problem.

### Exit gate

Proceed when:

- at least four of the last five participants complete the core first-use journey
  without moderator instruction;
- the last round has no open S1 problem and no repeated S2 problem;
- at least three audience groups independently describe a recurring Vim-learning
  or retention problem the product addresses;
- participants can explain the difference between guidance, independent recall,
  and unrestricted practice;
- the team has a ranked list of observed problems small enough to address before
  the next round.

These are directional usability decisions, not statistically generalisable
rates.

## Stage 2: measurement foundation

### Goal

Make later product decisions auditable without collecting editor content or
breaking offline use.

### Work

- Implement the event envelope and minimum vocabulary above.
- Implement durable local progress and per-skill review eligibility before
  reporting delayed learning metrics.
- Create one scripted synthetic journey for every funnel state and one opt-out
  journey.
- Build dashboards for acquisition, first use, meaningful activation, retention,
  review, transfer, exercise quality, and offers.
- Add a feedback link and a separate opt-in research-contact form.
- Publish a plain-language privacy notice, retention schedule, processor list,
  and contact/deletion route.
- Mark internal QA, automated conformance, and simulated-learner traffic at
  source; never clean it out by intuition after collection.

### Exit gate

Proceed when the instrumentation QA checklist passes for two consecutive release
candidates, test journeys reconcile end to end, and a person can use the entire
offline learning path with analytics disabled.

## Stage 3: honest message smoke test

### Goal

Determine which problem statement attracts qualified learners and whether they
continue into the product.

### Test design

Use the real, playable PWA. Test two or at most three materially different
messages, for example:

- **Build practical Vim recall in five-minute drills.**
- **Stop repeating keys; learn Vim's editing grammar.**
- **Keep advanced Vim commands available when you need them.**

Each page should state the limits honestly: it teaches the portable cognitive
language of Vim, supports a defined subset, works well on phones, and does not
replace sustained physical-keyboard use. Its primary action is **Try a lesson**,
not **Join a waitlist**. An optional beta contact form appears only after the
visitor can try the product.

Acquire approximately 100–300 qualified visitors from permitted, narrowly
relevant sources: personal professional contacts, a small technical article,
developer learning communities, Vim/Neovim spaces, or educators. Disclose that
you built the product and ask for critique. Follow each community's current
self-promotion rules; do not cross-post the same sales copy everywhere.

With this sample, run sequential message cohorts or use the result as descriptive
evidence. Do not declare an A/B winner from a handful of conversions. The GDS
guidance above explicitly cautions that A/B testing normally needs hundreds, and
traffic-source differences can easily dominate a small test.

### Provisional gate

Choose the thresholds before sending traffic. A reasonable initial build-more
gate is:

- at least 100 qualified visits to the selected message;
- at least 20% start a playable activity;
- at least 10% complete a first concept loop;
- at least 5% voluntarily opt into beta contact after trying it;
- at least ten visitors who are not personal friends complete a loop.

Investigate the funnel rather than averaging it away. High play starts with low
completion point to onboarding or lesson problems. Low play starts with strong
completion point to message, audience, or landing-page problems. If no message
gets 20 starts from 100 relevant visitors, interview the non-starters before
adding features.

Never fabricate scarcity, testimonials, learner counts, or a checkout. A button
for an unavailable paid feature may collect explicitly labelled interest, but it
must say that no purchase is being made.

## Stage 4: closed learning beta

### Goal

Test repeated use, delayed recall, transfer, content fairness, and operating load
over enough time for forgetting and review to occur.

### Cohort

Recruit 50–100 learners for three to four weeks. Invite in waves of 15–25 so a
bad release does not affect the whole cohort. Preserve the experience segment,
device/input segment, and acquisition source. Do not require an account unless
cross-device progress or beta communication genuinely needs one.

At onboarding:

- explain what is collected and what remains local;
- record a short confidence segment and optional baseline task;
- let the learner choose or test out rather than imposing hard locks;
- make support, withdrawal, and data deletion routes visible;
- do not tell participants which retention threshold they are expected to meet.

### Beta experience

The beta should include:

- at least one complete beginner concept loop;
- fresh recall variants rather than immediate duplicate scenarios;
- startup due review with a clear reason for the recommendation;
- focused practice and exercise Explore mode;
- equivalent-solution handling for independent tasks, with false-rejection
  reporting;
- one unseen-buffer transfer check per evaluated primary skill;
- local deterministic feedback when offline;
- a two-question optional pulse after selected sessions: usefulness and fairness,
  with a separate optional comment field.

Do not change scheduler, content, onboarding, and feedback simultaneously for
the same cohort unless the goal is purely exploratory. Annotate every release
and exclude outage-affected sessions by a predeclared rule.

### Provisional beta gates

For a recruited cohort, report both invited and started denominators. Continue
to a payment test when all of the following are directionally true:

- at least 60% of recruited learners start a concept loop;
- at least 25% of starters meet the full meaningful-activation definition;
- D7 learning return is at least 20% and D30 learning return is at least 10%
  among eligible starters;
- at least 35% of learners shown a due review start it, and at least 60% of those
  starters complete it;
- at least 60% of started unseen-buffer checks reach the target, and results do
  not depend entirely on solution-revealing hints;
- at least 15 participants voluntarily complete learning activity in both of the
  final two beta weeks;
- no repeated S1/S2 usability issue, no known engine-valid strategy taught as
  invalid, and no unresolved privacy incident remains;
- support volume is understandable and can be triaged by one maintainer.

Treat these as a portfolio of signals. Missing D30 because the beta is only
three weeks means “not measured,” not zero. If retention is weak but delayed
learners perform well, test the review entry point and habit value. If return is
high but transfer is weak, improve learning design before marketing.

### Beta report

Publish an internal report containing:

- cohort flow and exclusions;
- metric definitions and confidence/uncertainty;
- results by experience and input segment;
- exercise families with the highest false rejection, hint escalation, reset,
  and abandonment;
- delayed-recall and unseen-buffer results;
- observed support and maintenance work;
- privacy incidents or near misses;
- decisions, rejected explanations, and the next test.

Only publish anonymised aggregates externally. GDS research privacy guidance
recommends removing participant personal data and fully anonymising research
extracts before public reporting.

## Stage 5: payment proof

### Goal

Replace hypothetical willingness to pay with a transparent transaction while
protecting early supporters.

### Offer

Test one paid proposition at a time. The recommended first offer is a founding
supporter/offline product at the price selected in
[monetization-and-unit-economics.md](./monetization-and-unit-economics.md), rather
than an AI subscription whose recurring value has not yet been demonstrated.

The page must show:

- what exists today;
- what the purchase unlocks or supports;
- exact price, tax treatment, and currency;
- delivery date for anything not immediate;
- a prominent 30-day refund route;
- what happens if the project is discontinued;
- that foundational deterministic learning remains free.

Charge through a real compliant checkout. Do not collect card details directly
in the PWA and do not host commercial transactions on GitHub Pages. A refundable
deposit is acceptable only if it is clearly called a deposit, automatically
credited or refunded on the stated date, and not presented as completed product
revenue.

Test AI Coach separately only after learners repeatedly consume grounded
feedback. Show its usage policy before purchase. Do not promise unlimited
frontier-model calls, and do not market a deterministic hint template as an LLM
interaction.

### Founding gate

Use 10–20 paying founders plus repeat use as the internal build-more signal:

- at least ten full-price payers who are neither the developer nor close friends;
- purchases arrive from at least two independent acquisition sources;
- at least half of founders complete learning activity in two separate weeks
  during the next four;
- refunds and reasons are reported, not quietly excluded;
- observed per-payer support and infrastructure costs fit the unit-economics
  safety margin;
- at least five founders agree to a follow-up conversation, without making that
  a condition of purchase.

Ten purchases do not prove a large market. They prove enough concrete value to
justify a more disciplined commercial experiment. If a long waitlist produces
fewer than ten purchasers, revisit the offer and audience before adding a second
pricing tier.

## Stage 6: organic public launch

### Readiness

Launch only when a visitor can immediately play without an account, the first
loop works on representative phones, privacy and support pages exist, and the
maintainer can remain available for the launch discussion and urgent fixes.

The official [Show HN guidelines](https://news.ycombinator.com/showhn.html) are a
good general standard: the product must be something people can try, should be
easy to access without signup or email barriers, and should not be merely a
landing page or fundraiser. They also prohibit asking friends to upvote or
comment.

### Channel order

1. **Existing users and research participants.** Invite them to the public build
   without pressuring them to endorse it.
2. **Vim and Neovim communities.** Share a playable challenge, explain the
   supported-command boundary, disclose authorship, and ask a specific learning
   or conformance question.
3. **GitHub.** Keep a concise README, public demo link, screenshots, architecture
   overview, roadmap, issue templates, and a release describing user-visible
   changes.
4. **Engineering articles.** Publish the reusable technical substance: native
   Vim/browser differential testing, why exact-key grading rejects correct Vim,
   constructive exercise generation, local inference, and privacy-safe learner
   modeling.
5. **Shareable learning artifacts.** Offer a no-login daily challenge or a small
   result card that never exposes code or typed content. Sharing must be
   voluntary and useful without referral spam.
6. **Show HN.** Link directly to the playable experience, explain why it was
   built, name its limits, and remain in the thread to answer technical and
   learning-design questions.
7. **Educators and developer-training groups.** Offer a short, deterministic
   lesson pack and an aggregate-only evaluation guide before proposing a paid
   partnership.
8. **Search discovery.** Create genuinely useful, playable pages around learner
   intent—such as Vim text objects, counts, registers, and dot repeat—rather than
   thousands of generated thin pages.

Google's official SEO guide emphasises helpful, reliable, people-first content,
descriptive titles and URLs, useful link text, and giving changes weeks to be
evaluated. It explicitly says there is no secret that guarantees first place;
see the
[Google Search SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

### What to publish

Prepare one consistent launch kit:

- one-sentence promise and honest limitation;
- 30–60-second screen recording with captions;
- direct **Play now** link;
- three representative challenges for beginner, partial, and advanced users;
- short explanation of offline behavior and supported Vim semantics;
- privacy summary and full notice;
- public issue/feedback route;
- founder story and technical deep dive;
- prewritten answers about native Vim conformance, mobile muscle memory,
  equivalent commands, telemetry, AI use, pricing, and roadmap.

Tag links with a small allowlisted campaign code. Measure qualified play,
meaningful activation, D7/D30 return, and purchases by source. Do not use tracking
pixels, fingerprinting, or hidden referral data merely because a channel makes
it convenient.

### Launch operations

During launch week:

- deploy a frozen tested build and keep rollback instructions ready;
- monitor errors, cache/update failures, content fixture failures, event ingestion,
  and support—not vanity impressions;
- respond to reports with app and content version requests, never ask people to
  paste sensitive editor content publicly;
- label known issues and publish fixes in a changelog;
- avoid major scheduler or grading changes in the first measured cohort unless
  needed for safety or correctness;
- write a post-launch decision memo after D7 and update it after D30.

Community posts should be occasional, channel-specific, and useful on their own.
Do not automate reposting or treat developer communities as free ad inventory.

## Stage 7: native apps and paid acquisition

### PWA remains the default

The PWA already supplies the key early advantages: one link, no store review,
installability, offline lessons, and the same testable editor engine. Supporting
browsers can install a PWA as a standalone app; unsupported install flows can
still use it as a website, as described in MDN's
[PWA installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Do not build iOS and Android wrappers merely to look established. Consider a
native distribution project only when all of these are true:

- the PWA has at least 500 monthly active learners for three consecutive months,
  or a credible education/distribution partner requires a store app;
- measured install or platform limitations are a top-three cause of failed
  activation, supported by at least 100 affected sessions or repeated observed
  research;
- the native route enables a specific valuable capability—reliable reminders,
  keyboard integration, institutional distribution, purchase handling, or
  accessibility—not just another icon;
- projected incremental annual gross margin is at least twice the first-year
  build, review, support, and store-compliance cost;
- the same conformance and content fixtures can test web and wrapper builds.

If those conditions are met, start with the smallest wrapper that preserves the
web engine and offline assets. Keep the PWA as the canonical no-install route.
Platform fees and commissions are evaluated in
[monetization-and-unit-economics.md](./monetization-and-unit-economics.md).

### Paid acquisition gate

Paid ads amplify the existing funnel; they do not repair it. Do not buy traffic
until:

- at least 100 non-founder customers have paid through organic or partner
  sources, or three consecutive cohorts show stable paid conversion;
- meaningful activation and D30 learning return are stable across at least three
  releases;
- refunds, payment fees, inference, support, and taxes are included in observed
  contribution margin;
- the landing-to-purchase attribution path is tested without invasive tracking;
- a maximum acceptable customer-acquisition cost is approved before the campaign.

For the first test, cap spend at £250–500 and one tightly defined audience. Use
the lower of these as the CAC ceiling:

- 30% of net receipt for a one-time purchase; or
- the first three months of expected subscription contribution margin.

Stop automatically at the budget or CAC ceiling. Evaluate downstream meaningful
activation and D30 return, not just cheap clicks or checkout conversion. Increase
spend only after a complete cohort clears the gate. Search, community education,
partnerships, and portfolio content are better early investments because they
also improve product understanding and credibility.

## Portfolio-distribution strategy

The product can be an excellent ML and engineering portfolio even with a small
audience, provided the public story shows disciplined decisions rather than an
inflated user count.

### Publishable artifacts

Publish a sequence of self-contained technical artifacts:

1. **Exercise quality report:** catalogue inventory, reviewed gold-set design,
   failure taxonomy, and native/browser conformance architecture.
2. **Neuro-symbolic verifier case study:** deterministic editor truth, skill
   evidence, equivalent solutions, solver candidates, and LLM advisory boundary.
3. **Learning measurement note:** event contract, activation definition,
   delayed-recall and transfer protocol, and limitations of the evidence.
4. **Baseline model report:** rules, logistic/boosted baseline, compact trace
   model, calibration, abstention, latency, and unseen-template split.
5. **Generation report:** frontier teacher versus small/open model, constrained
   output, deterministic rejection, acceptance rate, review time, and cost-quality
   frontier.
6. **Adaptive policy report:** scheduler baseline, learner simulation, offline
   policy evaluation, real cohort result when available, and synthetic-to-real
   gap.
7. **Deployment report:** quantisation, WebGPU/ONNX or server inference, privacy,
   fallbacks, monitoring, and actual unit cost.

Each artifact should include a reproducible config, immutable dataset/evaluation
version, data or model card, baseline, negative results, error analysis, and a
short live demonstration. Publish synthetic fixtures and sufficiently aggregated
statistics; do not publish learner traces or tiny slices merely to make the
notebook reproducible.

### Credible claims

Prefer statements such as:

- “Built a deterministic Vim/browser differential verifier covering X reviewed
  exercise families.”
- “Reduced false rejection on a strategy-disjoint gold set from X to Y while
  preserving deterministic pass/fail authority.”
- “Benchmarked rules, gradient boosting, and a quantised trace encoder at X ms
  and Y MB.”
- “Ran a predeclared delayed-recall beta with N eligible learners; observed Y,
  with these limitations.”

Do not claim that simulated learners prove human learning, that a fine-tuned
model “understands Vim,” or that an uncontrolled retention change is causal.
Honest null results and rejected architectures can be stronger engineering
evidence than a polished demo without evaluation.

### Distribution to employers and technical peers

- Put a short architecture and evaluation overview in the repository landing
  documentation, with links to deeper reports.
- Record a five-minute demo that follows one event from exercise authoring through
  Vim validation, learner attempt, deterministic grading, advisory feedback, and
  aggregate evaluation.
- Turn each major experiment into one focused article rather than a broad “I
  built an AI app” announcement.
- Present at local data, ML, web, editor, and education meetups; tailor the same
  system to each audience's concerns.
- Maintain a public experiment registry and dashboard of aggregate benchmark
  results, including regressions and model/version dates.
- Link the live no-signup PWA from the CV so a reviewer can test the product before
  reading the ML report.

If real usage remains small, the catalogue factory, solver, conformance suite,
synthetic learner laboratory, model evaluation, and deployment are still valid
engineering work. Label simulated and real data unambiguously.

## Experiment and decision record

Every product, learning, pricing, or model experiment should have a short record
committed before exposure:

```text
Experiment ID and owner
Decision this experiment will change
Target population and exclusions
Hypothesis and plausible counter-explanations
Control/baseline and treatment, if any
Primary metric and exact denominator
Guardrails: learning, fairness, privacy, reliability, cost
Minimum sample or end date
Pass, iterate, and stop thresholds
App, content, scheduler, verifier, prompt, and model versions
Analysis plan, including missing data and multiple comparisons
Result, uncertainty, segment checks, incidents, and decision
```

Assign variants before exposure and log the assignment even if the learner never
starts the activity. For adaptive selection, log the candidate set, features
available at decision time, selected item, policy version, and selection
probability. Without this propensity information, later off-policy evaluation
is much weaker.

Do not repeatedly inspect a small test and stop when it looks favorable. For
early qualitative work, use a fixed round and synthesize it. For quantitative
tests, use a predeclared end date/sample or an appropriate sequential method.

## Operating cadence

This is feasible for one maintainer if the cadence stays narrow:

- **Every release:** automated content, native Vim, browser, PWA, privacy-payload,
  and analytics-journey checks; changelog and release annotation.
- **Weekly during beta/launch:** S1/S2 triage, false-rejection review, ingestion
  quality, support themes, and one ranked product decision.
- **Every two weeks during discovery:** one small research round, matching the
  GDS recommendation for continuous rounds where practical.
- **Monthly:** eligible retention cohorts, review/transfer outcomes, acquisition,
  refunds, contribution margin, and deletion/retention tasks.
- **Quarterly:** source/pricing/policy refresh, processor review, incident drill,
  gold-set expansion, model drift and calibration, and public portfolio update.

Maintain one support inbox and one public issue route. Use issue templates for
app version, content ID, device/input category, expected behavior, and whether
the report can be quoted. Never ask for arbitrary source buffers, clipboard
contents, API keys, or account credentials.

## Ranked validation roadmap

| Rank | Deliverable | Why it comes now | Evidence to move on |
| ---: | --- | --- | --- |
| 1 | Catalogue audit and gold set | Trust precedes scale and ML | Zero blocking conformance failures; reviewed launch path |
| 2 | Two or three observed research rounds | Finds product misunderstanding cheaply | Last-round core journey succeeds without S1/S2 issues |
| 3 | Local progress plus minimal event pipeline | Makes delayed value measurable | Reconciled, private, offline-safe data |
| 4 | Fresh recall variants and due review | Creates the behavior activation is meant to measure | Deterministic novelty and review fixtures pass |
| 5 | 100–300-visitor message test | Tests audience and promise without large spend | Qualified starts and completions clear predeclared gate |
| 6 | 50–100-person learning beta | Tests delayed recall, transfer, and retention | Activation, review, transfer, quality, and support signals align |
| 7 | Refundable founding offer | Tests real value rather than survey intent | 10–20 payers plus repeated use and sustainable cost |
| 8 | Organic public launch | Compounds product, community, SEO, and portfolio value | Stable cohorts and operational readiness |
| 9 | AI Coach commercial test | Requires demonstrated recurring coaching use | Incremental learning/usefulness exceeds deterministic fallback at safe cost |
| 10 | Native stores or paid ads | Adds fixed work and acquisition risk | Measured platform barrier or repeatable positive unit economics |

## Pre-launch checklist

### Learning and content

- [ ] Every reachable exercise has reviewed status and passing conformance.
- [ ] Recall uses a fresh variant where transfer is claimed.
- [ ] Valid equivalent solutions are not rejected in independent practice.
- [ ] Due review and skip/test-out behavior match
      [curriculum-and-progression.md](./curriculum-and-progression.md).
- [ ] Free Practice remains available, local by default, and ungraded.
- [ ] Learning claims match the evidence actually collected.

### Product and reliability

- [ ] First use completes at 360, 390, 412, 430, and 432 CSS-pixel target widths.
- [ ] Touch and physical keyboard paths pass.
- [ ] Offline first load/update behavior and analytics reconnection pass.
- [ ] Rollback, service-worker update, and content-version procedures are tested.
- [ ] Support, known-issues, status, and feedback routes work.

### Research and privacy

- [ ] Information sheet, consent, withdrawal, and recording choices are clear.
- [ ] Product analytics has a documented purpose and lawful-basis review.
- [ ] No raw Free Practice or literal inserted/search/Ex/register content uploads.
- [ ] Retention and deletion jobs run successfully.
- [ ] Public research outputs are anonymised and small cells suppressed.
- [ ] Disabled users and people needing support are included in research.

### Commercial and distribution

- [ ] Commercial hosting has moved away from GitHub Pages.
- [ ] Checkout, tax/VAT, refund, terms, and support behavior are tested.
- [ ] Offer wording distinguishes shipped, planned, and experimental features.
- [ ] Unit-economics limits and AI fair-use controls are configured.
- [ ] Community posts follow current rules and disclose the maker relationship.
- [ ] Show HN links to the playable product and requires no signup.
- [ ] Paid acquisition and app-store work remain off unless their gates are met.

## Final recommendation

Break the ice by inviting a small, mixed set of learners to use the existing PWA
while you watch. The most valuable early outcome is a trustworthy list of where
they fail, return, learn, or disengage—not a large mailing list. Build the
catalogue audit, varied recall, review state, and minimal event contract next;
then expose the working product to a few hundred relevant visitors and a
time-bounded beta.

If ten to twenty unrelated learners pay and continue practising, there is enough
evidence for a careful commercial product. If they learn but do not pay, Vim
Wilds can remain a strong free portfolio project with supporter purchases. If
few people return but the technical system is compelling, publish the verifier,
evaluation, local-model, and simulation work honestly. All three outcomes create
useful information; none requires app-store launches, paid ads, or an expensive
runtime LLM before the product earns them.

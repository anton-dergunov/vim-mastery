# Session 06 — Tool-choice activities across Arc 3

**Depends on:** nothing · **Blocks:** nothing
**Touches:** `content/units/10` through `14`, possibly `content/unit-content.schema.json`
**Size:** M

## Context

**This is the highest return-on-effort item in the entire review.** No engine
work, no conformance fixtures, no patch — and it targets the exact skill the
product exists to build.

Measured distribution: 30 `choice` activities across 744 total (4%). Every unit
uses exactly one, except Unit 1 (10, appropriate — it is conceptual) and Unit 7
(9, a structural anomaly handled in session 09).

Meanwhile `docs/curriculum-and-progression.md` contains an automation decision
framework — a table mapping nine situations to a preferred starting tool — and
states that *"exercises should sometimes ask the learner to select the mechanism
before entering keys"* and that *"an advanced command is not automatically the
best command."* The content does not reflect that intent.

Tool-choice discrimination is what separates someone who knows commands from
someone who automates well. It is also the cheapest activity type to author.

## Goal

Make mechanism selection a practiced skill rather than a closing remark.

## Scope

### 1. Add choice activities to Arc 3

Target roughly 4–6 per unit across Units 11–14, up from one. Each presents a
transformation and asks which mechanism to reach for **before** any keys are
entered. Draw the situations from the decision framework table:

| Situation | Expected answer |
| --- | --- |
| One local structural edit | Operator + motion or text object |
| A small fixed number of adjacent items | Count or Visual selection |
| The same nearby change repeated after movement | Dot-repeat |
| A rectangular column transformation | Visual Block |
| A textual pattern with a clear replacement | `:substitute` |
| A multi-step edit over differing local structure | Macro |
| The same Normal command on a known line range | `:normal` |
| A line-predicated delete or transformation | `:global` / `:vglobal` |
| A semantic, cross-file, judgment-heavy change | Leave Vim |

The last row matters as much as the others. An honest curriculum tells the
learner when to stop.

### 2. Make the distractors real

A good distractor is a mechanism that **would work but is worse** — more setup,
more risk, less repeatable — not one that is obviously wrong. The remediation
text should explain the trade-off (setup cost, blast radius, repeatability),
not just assert the right answer.

### 3. Add the `cgn` contrast to Unit 10

Unit 10's `search-change-echo` teaches the older `n` `.` idiom as primary
(`search-python-backward` canonical: `?debug⏎ ciwinfo Esc n . n .`). `cgn` is
taught in Unit 5 but never returns here.

`cgn` + `.` is strictly safer: it carries the match into the change, so it does
not depend on where the cursor lands. Add a lesson or a substantial activity
contrasting three tools for one job — `n.`, `cgn` + `...`, and `:%s//…/gc` —
with an explicit statement of when each wins. **That comparison is the lesson.**

### 4. Fix `find-shell-flags`

Its canonical is `f= l ciwon Esc ; l . ; l .`. The manual `l` nudge after each
`;` means the change is not self-contained — which is precisely what the
neighboring `repeat-friendly-changes` lesson warns against. The exercise
demonstrates a repeat-hostile change while teaching repeat-friendliness. Rework
it, using `cgn` if that is the natural fix.

### 5. Confirm choice feedback quality

Per `IMPROVEMENTS.md` item 7: a wrong option shows `Not quite.` with incorrect
styling, remediation, and another attempt; a correct option shows `Correct.`
with its explanation and Next; the live status is screen-reader announced.

## Out of scope

- New commands.
- Changing existing exercise canonicals except `find-shell-flags`.

## Acceptance criteria

- Units 11–14 each carry 4–6 choice activities.
- Every distractor is a plausible-but-worse mechanism, with a trade-off
  explanation in its remediation.
- Unit 10 contrasts `n.`, `cgn` + `.`, and `:%s//…/gc` explicitly.
- `find-shell-flags` no longer relies on manual cursor nudging.
- Choice feedback meets the `IMPROVEMENTS.md` item 7 contract.

## Validation

```bash
npm test
npm run test:targeted -- <choice spec> --grep "choice" # one worker
```

Check that structured choice cells stay inside their bounds at 360px
(`IMPROVEMENTS.md` item 8 covers the analogous constraint for command
assemblies).

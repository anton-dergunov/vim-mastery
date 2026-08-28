# Session 18 — Curriculum graph and portability surfacing

**Depends on:** 07, 08, 09, 10 (unit and lesson counts settled) · **Blocks:** nothing
**Touches:** all `content/units/*.json` frontmatter, `content/unit-index.json`, `app.js`
**Size:** M

## Context

Two loose ends, both cheap, both worth closing once the restructuring sessions
have settled the unit numbering.

**Prerequisites are declared but flat.** Units 5 through 12 all declare
essentially the same six-unit `prerequisiteSkillIds` list. (Unit 10 Viewport
control is the one exception session 07 created: it additionally requires
Unit 9.) That is accurate but
it does not discriminate: the graph cannot recommend an order within Arc 2, and a
learner skipping toward automation gets no useful guidance about what they
genuinely need versus what is merely conventional. Units 12 and 13 do this
better, naming specific upstream units.

This matters more than it looks. The review found that an automation-motivated
learner passes 84 lessons before reaching `:global`. That ordering is
pedagogically correct and should not change — which makes the **test-out and
preview path a core feature rather than polish** for this audience. A flat
prerequisite graph makes that path worse than it needs to be.

**Portability is tracked but invisible.** Every unit carries a
`priorityAndPortability` field doing genuinely useful work that the learner never
sees.

## Scope

### 1. Narrow the prerequisite graph

For each of Units 5–11, replace the blanket list with what the unit truly
depends on. Examples of the intended discrimination:

- Registers (Unit 8) genuinely needs operator grammar and text objects; it does
  not need long-range navigation.
- Visual selection (Unit 7) needs motions and operators; it does not need
  registers.
- Ex ranges (Unit 11) needs the modal model and line concepts far more than it
  needs text objects.

Distinguish **required** from **recommended**. The curriculum doc already makes
this distinction in prose ("Units 1–6; Unit 8 recommended") — encode it in data.

### 2. Update the graph for restructuring

Session 07 already did the numbering work: Unit 9 became Units 9 and 10, Units
10–14 became 11–15, and `unit-index.json`, `presentation.json`, and every spec
were reconciled. **No unit ever named `long-range-navigation` as a prerequisite**,
so the cascade this brief anticipated did not exist.

What is left here:

- Confirm sessions 08–10 did not change any `lessonCount` without updating the
  catalog. Note that session 08 now *adds* a lesson rather than merging two.
- Every `coverage` array whose lessons moved.

### 3. Surface portability

Show `priorityAndPortability` as a short "in your editor" note at each unit
summary. Keep it to a sentence or two. Link to the host-reality reference card
from session 14 rather than repeating its content.

Keep it host-neutral, per constraint 8 in [README.md](README.md): the baseline is
Vim itself, and an embedding editor is a variation the learner should be warned
about, not the assumed environment. Units 9 and 10 already carry notes in this
form and are the model.

Do not teach configuration. The goal is only that a learner is not confused when
a practiced command does nothing in the host they happen to be using.

### 4. Make test-out real

Confirm the curriculum doc's navigation promises hold against the settled graph:

- Any topic can be previewed.
- A test-out challenge can be requested manually for any topic.
- Skipping is possible with a visible prerequisite warning and never permanently
  locks later material.
- The three entry confidence levels (new / familiar / experienced) change the
  suggested entry point, not content availability.

For this product's primary user, the experienced-entry path into Arc 3 is the
one that matters most. Verify it specifically.

### 5. Content integrity check

Add or extend a check that every `prerequisiteSkillIds` entry, `activityRef`,
`demoRef`, `remediationRef`, and `coverage` id resolves. With four sessions
renumbering content, a stale reference is the most likely defect in this plan.

## Out of scope

- Adaptive scheduling, scoring, placement tests — deferred.
- New lesson content.

## Acceptance criteria

- No two units in Arc 2 share an identical prerequisite list unless genuinely
  identical.
- Required versus recommended prerequisites are distinguished in data.
- Every id reference in every unit resolves; a test enforces this.
- `unit-index.json` matches the post-restructuring reality.
- Every lesson marked `advanced` or `optional` is reachable and visibly marked.
- Each unit surfaces a short portability note linking to the host-reality card.
- The experienced-user path into Arc 3 works end to end.

## Validation

```bash
node --check app.js && git diff --check
npm test
```

Run the full content-integrity suite. Then walk the three entry confidence
levels end to end and confirm each reaches a sensible first lesson.

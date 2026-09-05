import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  CONCEPT_STATES,
  COVERAGE_BUCKETS,
  MAINTENANCE_STALE_SECONDS,
  MASTERY_STATE_KEY,
  buildConceptIndex,
  buildFocusedPlan,
  buildMixedPlan,
  buildToolChoicePlan,
  conceptState,
  conceptStateRank,
  eligibleConcepts,
  isEligibleForReview,
  isMaintenanceDue,
  practiceModeFor,
  readMasteryState,
  recordCompletion,
  summarizeUnit,
  togglePinnedConcept,
  unitDigest,
  writeMasteryState,
} from "../mastery-progress.js";

const rootPath = new URL("../", import.meta.url).pathname;
const unitsPath = join(rootPath, "content", "units");
const units = readdirSync(unitsPath)
  .filter(name => /^\d{2}-.*\.json$/.test(name))
  .sort()
  .map(name => JSON.parse(readFileSync(join(unitsPath, name), "utf8")));

const index = buildConceptIndex(units.map(unitDigest));
const completionsFor = (activityIds, at = 1_000) =>
  Object.fromEntries(activityIds.map(id => [id, { count: 1, lastAt: at }]));

// A deterministic generator so shuffled plans are reproducible under test.
const seededRandom = seed => () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

test("the concept catalog covers every shipped unit", () => {
  assert.equal(index.concepts.length, 138);
  // Only the activities coverage actually cites; the digest drops the rest.
  assert.equal(index.activityIndex.size, 786);
  assert.deepEqual(
    [...new Set(index.concepts.map(concept => concept.unitId))].sort(),
    units.map(unit => unit.id).sort(),
  );
});

test("concept ids are globally unique and match the schema id pattern", () => {
  const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const ids = index.concepts.map(concept => concept.id);
  assert.equal(new Set(ids).size, ids.length, "concept ids collide across units");
  for (const id of ids) assert.match(id, pattern);
});

test("state derivation is monotone under any additional completion", () => {
  // The learner's achieved state is the one thing that must never move
  // backwards. Growing the completion set one activity at a time over every
  // shipped concept is the direct statement of that.
  for (const concept of index.concepts) {
    const activityIds = concept.refs.map(ref => ref.activityId);
    let completions = {};
    let rank = conceptStateRank(conceptState(concept, completions));
    for (const activityId of activityIds) {
      completions = { ...completions, [activityId]: { count: 1, lastAt: 1 } };
      const next = conceptStateRank(conceptState(concept, completions));
      assert(next >= rank, `${concept.id} fell from ${CONCEPT_STATES[rank]} to ${CONCEPT_STATES[next]}`);
      rank = next;
    }
  }
});

test("every concept is reachable to integrated", () => {
  for (const concept of index.concepts) {
    const completions = completionsFor(concept.refs.map(ref => ref.activityId));
    assert.equal(conceptState(concept, completions), "integrated", `${concept.id} cannot be integrated`);
  }
});

test("a completed demo is evidence of learning and nothing more", () => {
  // Two challenge buckets in cursor-movement cite `movement-integration-demo`,
  // a demo. Reading `activity.phase` instead of the bucket, or counting a demo
  // as practice, would let a learner reach `integrated` by watching. These two
  // are named so the anomaly stays documented rather than silently handled.
  const watched = completionsFor(["movement-integration-demo"]);
  for (const conceptId of ["hjkl-counts", "file-line-jumps"]) {
    const concept = index.byId.get(conceptId);
    assert(
      concept.buckets.challenge.some(ref => ref.activityId === "movement-integration-demo"),
      `${conceptId} no longer cites the demo; update this test rather than deleting it`,
    );
    assert.equal(conceptState(concept, watched), "learning");
  }
});

test("coverage buckets, not activity phases, drive the taxonomy", () => {
  // Thirteen refs sit in a bucket that disagrees with the activity's own phase.
  // If that ever reaches zero the divergence has been authored away and this
  // test can go, but until then the reverse index must be built from buckets.
  let disagreements = 0;
  const phases = new Map();
  for (const unit of units) {
    for (const lesson of unit.lessons) for (const activity of lesson.activities) phases.set(activity.id, activity.phase);
  }
  for (const concept of index.concepts) {
    for (const bucket of COVERAGE_BUCKETS) {
      for (const ref of concept.buckets[bucket]) if (phases.get(ref.activityId) !== bucket) disagreements += 1;
    }
  }
  assert.equal(disagreements, 13);
});

test("conceptState never reads a clock", () => {
  const concept = index.byId.get("unnamed-register");
  const completions = completionsFor(concept.refs.map(ref => ref.activityId), 5);
  assert.equal(conceptState(concept, completions), conceptState(concept, completions));
  assert.equal(conceptState(concept, completions), "integrated");
});

test("maintenance is due only for a stale integrated concept", () => {
  const concept = index.byId.get("unnamed-register");
  const integrated = completionsFor(concept.refs.map(ref => ref.activityId), 1_000);
  assert.equal(isMaintenanceDue(concept, integrated, 1_000), false);
  assert.equal(isMaintenanceDue(concept, integrated, 1_000 + MAINTENANCE_STALE_SECONDS - 1), false);
  assert.equal(isMaintenanceDue(concept, integrated, 1_000 + MAINTENANCE_STALE_SECONDS), true);
  // Staleness is reported beside the achieved state, never instead of it.
  assert.equal(conceptState(concept, integrated), "integrated");
  const practiced = completionsFor(concept.buckets.isolate.map(ref => ref.activityId), 1_000);
  assert.equal(conceptState(concept, practiced), "practiced");
  assert.equal(isMaintenanceDue(concept, practiced, 1_000 + MAINTENANCE_STALE_SECONDS * 10), false);
});

test("review eligibility starts at practiced", () => {
  const concept = index.byId.get("unnamed-register");
  assert.equal(isEligibleForReview(concept, {}), false);
  assert.equal(isEligibleForReview(concept, completionsFor(concept.buckets.explain.map(ref => ref.activityId))), false);
  assert.equal(isEligibleForReview(concept, completionsFor(concept.buckets.isolate.map(ref => ref.activityId))), true);
});

test("focused plans respect the authored delivery in both directions", () => {
  let guidedOnly = 0;
  let recallOnly = 0;
  for (const concept of index.concepts) {
    const plan = buildFocusedPlan(concept);
    assert(plan, `${concept.id} has no replayable drill`);
    assert.equal(plan.kind, "focused");
    for (const step of plan.steps) {
      const ref = index.activityIndex.get(step.activityId);
      assert(ref.type === "exercise" || ref.type === "choice", `${step.activityId} is a ${ref.type}`);
      assert.equal(step.practiceMode, practiceModeFor(ref));
      if (ref.type === "choice") assert.equal(step.practiceMode, null);
      if (ref.delivery === "guided") { assert.equal(step.practiceMode, "guided"); guidedOnly += 1; }
      if (ref.delivery === "recall") { assert.equal(step.practiceMode, "recall"); recallOnly += 1; }
    }
  }
  assert(guidedOnly > 0 && recallOnly > 0, "the delivery carve-outs are no longer exercised");
});

test("focused plans exclude theory and demos and never repeat an activity", () => {
  for (const concept of index.concepts) {
    const ids = buildFocusedPlan(concept).steps.map(step => step.activityId);
    assert.equal(new Set(ids).size, ids.length, `${concept.id} repeats an activity`);
    for (const id of ids) assert.notEqual(index.activityIndex.get(id).type, "demo");
  }
});

test("mixed review draws only from the concepts it was given", () => {
  const chosen = ["unnamed-register", "inside-around-words", "record-replay-macro"].map(id => index.byId.get(id));
  const allowed = new Set(chosen.flatMap(concept => buildFocusedPlan(concept).steps.map(step => step.activityId)));
  const plan = buildMixedPlan(chosen, { length: 8, random: seededRandom(7) });
  assert.equal(plan.kind, "mixed");
  assert(plan.steps.length > 1);
  for (const step of plan.steps) assert(allowed.has(step.activityId), `${step.activityId} is off-plan`);
  assert.deepEqual([...plan.conceptIds].sort(), chosen.map(concept => concept.id).sort());
});

test("mixed review refuses to run below two eligible concepts", () => {
  assert.equal(buildMixedPlan([], {}), null);
  assert.equal(buildMixedPlan([index.byId.get("unnamed-register")], {}), null);
});

test("mixed review interleaves rather than blocking one concept together", () => {
  const chosen = ["unnamed-register", "inside-around-words", "record-replay-macro"].map(id => index.byId.get(id));
  const owner = new Map();
  for (const concept of chosen) {
    for (const step of buildFocusedPlan(concept).steps) owner.set(step.activityId, concept.id);
  }
  const plan = buildMixedPlan(chosen, { length: 6, random: seededRandom(3) });
  const sequence = plan.steps.map(step => owner.get(step.activityId));
  for (let position = 1; position < sequence.length; position += 1) {
    assert.notEqual(sequence[position], sequence[position - 1], "two consecutive items share a concept");
  }
});

test("tool-choice mode queues only choice activities", () => {
  const chosen = index.concepts.filter(concept => concept.buckets.challenge.some(ref => ref.type === "choice"));
  const plan = buildToolChoicePlan(chosen, { length: 6, random: seededRandom(11) });
  assert.equal(plan.kind, "tool-choice");
  assert.equal(plan.steps.length, 6);
  for (const step of plan.steps) assert.equal(index.activityIndex.get(step.activityId).type, "choice");
  assert.equal(new Set(plan.steps.map(step => step.activityId)).size, plan.steps.length);
});

test("recording a completion is additive and idempotent", () => {
  let state = { schemaVersion: 1, completions: {}, pinned: [] };
  state = recordCompletion(state, { activityId: "home-row-identifier", at: 10 });
  assert.deepEqual(state.completions["home-row-identifier"], { count: 1, lastAt: 10 });
  state = recordCompletion(state, { activityId: "home-row-identifier", at: 40 });
  assert.deepEqual(state.completions["home-row-identifier"], { count: 2, lastAt: 40 });
  // A clock that jumps backwards must not rewind the record.
  state = recordCompletion(state, { activityId: "home-row-identifier", at: 5 });
  assert.equal(state.completions["home-row-identifier"].lastAt, 40);
  assert.equal(conceptStateRank(conceptState(index.byId.get("hjkl-counts"), state.completions)), conceptStateRank("practiced"));
  assert.equal(recordCompletion(state, { activityId: "" }), state);
});

test("a personal focus list pins and unpins", () => {
  let state = { schemaVersion: 1, completions: {}, pinned: [] };
  state = togglePinnedConcept(state, "macro-append");
  assert.deepEqual(state.pinned, ["macro-append"]);
  state = togglePinnedConcept(state, "global-delete");
  state = togglePinnedConcept(state, "macro-append");
  assert.deepEqual(state.pinned, ["global-delete"]);
});

test("a corrupt, absent or hostile store yields empty state and never throws", () => {
  const store = value => ({ getItem: () => value, setItem: () => {} });
  for (const value of [null, "", "{", "[]", '"text"', "7", '{"completions":null}', '{"completions":{"a":3},"pinned":"no"}']) {
    const state = readMasteryState(store(value));
    assert.equal(state.schemaVersion, 1);
    assert.deepEqual(state.pinned, []);
    assert.equal(typeof state.completions, "object");
  }
  assert.deepEqual(readMasteryState(undefined), { schemaVersion: 1, completions: {}, pinned: [] });
  assert.deepEqual(readMasteryState({ getItem() { throw new Error("blocked"); } }).completions, {});
  const salvaged = readMasteryState(store('{"completions":{"a":{"count":"x","lastAt":"y"},"b":{"count":3,"lastAt":9}}}'));
  assert.deepEqual(salvaged.completions, { a: { count: 1, lastAt: 0 }, b: { count: 3, lastAt: 9 } });
});

test("a blocked store costs a record and not an exception", () => {
  assert.equal(writeMasteryState({ setItem() { throw new Error("quota"); } }, {}), false);
  let written = null;
  assert.equal(writeMasteryState({ setItem: (key, value) => { written = [key, value]; } }, { schemaVersion: 1 }), true);
  assert.equal(written[0], MASTERY_STATE_KEY);
});

test("a round trip through the store preserves the record", () => {
  let held = null;
  const store = { getItem: () => held, setItem: (_key, value) => { held = value; } };
  const state = recordCompletion({ schemaVersion: 1, completions: {}, pinned: ["global-delete"] }, { activityId: "x", at: 8 });
  writeMasteryState(store, state);
  assert.deepEqual(readMasteryState(store), state);
});

test("the unit rollup counts every concept exactly once", () => {
  const concepts = index.concepts.filter(concept => concept.unitId === "text-objects");
  const completions = completionsFor(concepts[0].refs.map(ref => ref.activityId), 100);
  const summary = summarizeUnit(index, "text-objects", completions, 100);
  assert.equal(summary.total, 9);
  assert.equal(Object.values(summary.counts).reduce((sum, count) => sum + count, 0), summary.total);
  assert.equal(summary.counts.integrated, 1);
  assert.equal(summary.maintenanceDue, 0);
  assert.equal(summarizeUnit(index, "text-objects", completions, 100 + MAINTENANCE_STALE_SECONDS).maintenanceDue, 1);
});

test("eligibility scales with what the learner has actually applied", () => {
  assert.deepEqual(eligibleConcepts(index, {}), []);
  const concept = index.byId.get("inside-around-words");
  const eligible = eligibleConcepts(index, completionsFor(concept.buckets.isolate.map(ref => ref.activityId)));
  assert(eligible.some(entry => entry.id === "inside-around-words"));
});

test("an unknown coverage reference is a build error, not a silent gap", () => {
  const broken = [{ id: "u", unitNumber: 1, title: "U", activities: [], coverage: [{ id: "c", concept: "c", explain: ["ghost"], demonstrate: [], isolate: [], mix: [], challenge: [] }] }];
  assert.throws(() => buildConceptIndex(broken), /unknown activity ghost/);
});
